import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../data/db/schema";
import { eq } from "drizzle-orm";
import * as iso8601 from "iso8601-duration";

// --- TYPES (aligning with JSON structure and schema) ---

// Simplified NytRecipe type matching the JSON structure
interface NytRecipeSource {
  url: string;
  name: string;
  description?: string; // Optional in source
  author?: string; // Optional in source
  image?: string | string[]; // Can be string or array in source
  recipeYield?: string; // Optional in source
  prepTime?: string; // Optional ISO duration
  cookTime?: string; // Optional ISO duration
  totalTime?: string; // Optional ISO duration
  ingredients?: string[]; // Optional in source
  instructions?: string[]; // Optional in source
  nutrition?: Record<string, string | number | null>; // Optional in source
  tags?: string[]; // Optional in source
  rating?: number; // Optional in source
  ratingCount?: number; // Optional in source
}

// --- DATABASE SETUP ---

const SQLITE_DB_PATH = path.join(__dirname, "..", "data", "db", "recipes.db");
const sqlite = new Database(SQLITE_DB_PATH);
const db = drizzle(sqlite, { schema });

console.log(`Connected to SQLite database at: ${SQLITE_DB_PATH}`);

// --- HELPER FUNCTIONS ---

function extractIdFromUrl(url: string): number | null {
  const match = url.match(/recipes\/(\d+)-/);
  return match && match[1] ? parseInt(match[1], 10) : null;
}

function parseIsoDurationToMinutes(durationStr: string | undefined | null): number | null {
  if (!durationStr) return null;
  try {
    const duration = iso8601.parse(durationStr);
    let totalMinutes = 0;
    totalMinutes += (duration.days || 0) * 24 * 60;
    totalMinutes += (duration.hours || 0) * 60;
    totalMinutes += duration.minutes || 0;
    // Ignore seconds and smaller units for simplicity
    return totalMinutes > 0 ? totalMinutes : null;
  } catch (e) {
    // console.warn(`Could not parse duration string "${durationStr}":`, e);
    return null;
  }
}

// --- MAIN INGESTION LOGIC ---

async function ingestRecipes() {
  console.log("Starting recipe ingestion...");

  const jsonPath = path.join(__dirname, "..", "nyt_recipe_box_recipes.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON file not found at ${jsonPath}`);
    process.exit(1);
  }

  let rawData: Buffer;
  try {
    rawData = fs.readFileSync(jsonPath);
  } catch (error) {
    console.error(`Error reading JSON file at ${jsonPath}:`, error);
    process.exit(1);
  }

  let recipesSource: NytRecipeSource[];
  try {
    recipesSource = JSON.parse(rawData.toString());
    if (!Array.isArray(recipesSource)) {
      throw new Error("JSON data is not an array");
    }
  } catch (error) {
    console.error(`Error parsing JSON data:`, error);
    process.exit(1);
  }

  console.log(`Found ${recipesSource.length} recipes in the source file.`);

  let recipesIngested = 0;
  let tagsCreated = 0;
  let recipeTagsLinked = 0;
  let errorsEncountered = 0;

  const tagCache: Record<string, number> = {}; // Cache tag names to their IDs

  // Pre-load existing tags into cache for efficiency
  try {
    const existingTags = await db.select().from(schema.tags);
    existingTags.forEach((tag) => {
      tagCache[tag.name] = tag.id;
    });
    console.log(`Pre-loaded ${existingTags.length} existing tags into cache.`);
  } catch (error) {
    console.error("Error pre-loading tags:", error);
    // Continue without cache if pre-loading fails
  }

  for (const recipeData of recipesSource) {
    const recipeId = extractIdFromUrl(recipeData.url);

    if (recipeId === null) {
      console.warn(`Skipping recipe: Could not extract ID from URL "${recipeData.url}"`);
      errorsEncountered++;
      continue;
    }

    // Prepare recipe for insertion
    const newRecipe: schema.NewRecipe = {
      id: recipeId,
      url: recipeData.url,
      name: recipeData.name,
      description: recipeData.description ?? null,
      author: recipeData.author ?? null,
      // Handle image being string or array
      image: Array.isArray(recipeData.image) ? recipeData.image[0] : recipeData.image ?? null,
      recipeYield: recipeData.recipeYield ?? null,
      prepTimeIso: recipeData.prepTime ?? null,
      cookTimeIso: recipeData.cookTime ?? null,
      totalTimeIso: recipeData.totalTime ?? null,
      totalTimeMinutes: parseIsoDurationToMinutes(recipeData.totalTime),
      // Ensure ingredients/instructions are arrays, default to empty if null/undefined
      ingredients: recipeData.ingredients ?? [],
      instructions: recipeData.instructions ?? [],
      nutrition: recipeData.nutrition ? JSON.stringify(recipeData.nutrition) : null, // Store nutrition object as JSON string
      rating: recipeData.rating ?? null,
      ratingCount: recipeData.ratingCount ?? null,
    };

    try {
      // Insert Recipe
      await db.insert(schema.recipes).values(newRecipe).onConflictDoNothing();
      // We assume conflict means it exists, so we don't increment recipesIngested here if conflict happens
      // A more robust way might check if it *was* inserted, but this is simpler.
      recipesIngested++; // Count attempt rather than success on conflict

      // Process Tags
      const recipeTags = recipeData.tags ?? [];
      if (recipeTags.length > 0) {
        for (const tagName of recipeTags) {
          if (!tagName) continue; // Skip empty tags

          let tagId = tagCache[tagName];

          // If tag not in cache, try to insert/find it
          if (tagId === undefined) {
            try {
              // Insert tag, ignore if already exists
              await db.insert(schema.tags).values({ name: tagName }).onConflictDoNothing();
              tagsCreated++; // Increment potential creation count

              // Fetch the ID (either newly inserted or existing)
              const result = await db
                .select({ id: schema.tags.id })
                .from(schema.tags)
                .where(eq(schema.tags.name, tagName))
                .limit(1);

              if (result.length > 0) {
                tagId = result[0].id;
                tagCache[tagName] = tagId; // Add to cache
              } else {
                console.warn(`Failed to find or insert tag: "${tagName}"`);
                errorsEncountered++;
                continue; // Skip linking this tag
              }
            } catch (tagError) {
              console.error(`Error processing tag "${tagName}" for recipe ID ${recipeId}:`, tagError);
              errorsEncountered++;
              continue; // Skip linking this tag
            }
          }

          // Link Recipe and Tag
          try {
            await db.insert(schema.recipeTags).values({ recipeId: recipeId, tagId: tagId }).onConflictDoNothing();
            recipeTagsLinked++; // Count attempt
          } catch (linkError) {
            console.error(`Error linking recipe ID ${recipeId} to tag ID ${tagId} ("${tagName}"):`, linkError);
            errorsEncountered++;
          }
        }
      }
    } catch (recipeError) {
      console.error(`Error processing recipe ID ${recipeId} ("${recipeData.name}"):`, recipeError);
      errorsEncountered++;
    }

    if ((recipesIngested + errorsEncountered) % 100 === 0) {
      console.log(`Processed ${recipesIngested + errorsEncountered} / ${recipesSource.length} recipes...`);
    }
  }

  console.log("--- Ingestion Summary ---");
  console.log(`Total recipes processed (attempted insertions): ${recipesIngested}`);
  console.log(`Potential new tags created (attempted insertions): ${tagsCreated}`);
  console.log(`Recipe-tag links processed (attempted insertions): ${recipeTagsLinked}`);
  console.log(`Errors encountered: ${errorsEncountered}`);
  console.log("-------------------------");

  // Close the database connection
  sqlite.close();
  console.log("Database connection closed.");
}

// Run the ingestion
ingestRecipes().catch((error) => {
  console.error("Unhandled error during ingestion:", error);
  sqlite.close(); // Ensure connection is closed on error
  process.exit(1);
});
