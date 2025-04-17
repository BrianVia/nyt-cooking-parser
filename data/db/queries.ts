import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { eq, like, sql, lt, lte, gt, gte, and, asc, desc, or } from "drizzle-orm";
import path from "path";

// --- DATABASE CONNECTION ---

const SQLITE_DB_PATH = path.join(__dirname, "recipes.db");
const sqlite = new Database(SQLITE_DB_PATH);
// Enable WAL mode for better concurrency
// sqlite.pragma('journal_mode = WAL');
const db = drizzle(sqlite, { schema, logger: false }); // Set logger: true for debugging

console.log(`DB Query Module: Connected to ${SQLITE_DB_PATH}`);

// --- TYPES ---
type Recipe = schema.Recipe;
type NewRecipe = schema.NewRecipe;
type Tag = schema.Tag;

// --- CRUD OPERATIONS ---

// CREATE (Note: Ingestion script handles bulk creation, this is for single adds)
export async function createRecipe(recipeData: NewRecipe): Promise<Recipe | null> {
  try {
    const result = await db.insert(schema.recipes).values(recipeData).returning();
    return result[0] ?? null;
  } catch (error) {
    console.error("Error creating recipe:", error);
    return null;
  }
}

// READ
export async function getRecipeById(id: number): Promise<Recipe | null> {
  try {
    // Use query builder with relations for tags
    const result = await db.query.recipes.findFirst({
      where: eq(schema.recipes.id, id),
      with: {
        recipeTags: {
          with: {
            tag: true, // Include the related tag data
          },
        },
      },
    });

    // Transform the result to include tag names directly if needed
    if (result) {
      const transformedResult = {
        ...result,
        tags: result.recipeTags.map((rt) => rt.tag.name), // Extract tag names
      };
      // We might remove recipeTags if it's redundant now
      // delete transformedResult.recipeTags;
      return transformedResult as any; // Adjust type if necessary or create a specific return type
    }

    return null;
  } catch (error) {
    console.error(`Error fetching recipe with ID ${id}:`, error);
    return null;
  }
}

export async function getAllRecipes(limit: number = 50, offset: number = 0): Promise<Recipe[]> {
  try {
    // Simple fetch without tags for brevity in a list
    const results = await db
      .select()
      .from(schema.recipes)
      .orderBy(asc(schema.recipes.name)) // Example ordering
      .limit(limit)
      .offset(offset);
    return results;
  } catch (error) {
    console.error("Error fetching all recipes:", error);
    return [];
  }
}

// UPDATE
export async function updateRecipe(id: number, updateData: Partial<NewRecipe>): Promise<Recipe | null> {
  try {
    // Ensure 'id' is not part of the update data
    const { id: _, ...dataToUpdate } = updateData;

    const result = await db.update(schema.recipes).set(dataToUpdate).where(eq(schema.recipes.id, id)).returning();
    return result[0] ?? null;
  } catch (error) {
    console.error(`Error updating recipe with ID ${id}:`, error);
    return null;
  }
}

// DELETE
export async function deleteRecipe(id: number): Promise<boolean> {
  try {
    const result = await db
      .delete(schema.recipes)
      .where(eq(schema.recipes.id, id))
      .returning({ deletedId: schema.recipes.id });
    return result.length > 0;
  } catch (error) {
    console.error(`Error deleting recipe with ID ${id}:`, error);
    return false;
  }
}

// --- SEARCH FUNCTIONS ---

// Search by Name (case-insensitive partial match)
export async function searchRecipesByName(query: string, limit: number = 20): Promise<Recipe[]> {
  try {
    const results = await db
      .select()
      .from(schema.recipes)
      .where(like(schema.recipes.name, `%${query}%`))
      .orderBy(asc(schema.recipes.name))
      .limit(limit);
    return results;
  } catch (error) {
    console.error(`Error searching recipes by name "${query}":`, error);
    return [];
  }
}

// Search by Tag (find recipes associated with a specific tag name)
export async function searchRecipesByTag(tagName: string, limit: number = 20): Promise<Recipe[]> {
  try {
    const results = await db
      .select({
        // Explicitly select columns from the recipes table
        id: schema.recipes.id,
        url: schema.recipes.url,
        name: schema.recipes.name,
        description: schema.recipes.description,
        author: schema.recipes.author,
        image: schema.recipes.image,
        recipeYield: schema.recipes.recipeYield,
        prepTimeIso: schema.recipes.prepTimeIso,
        cookTimeIso: schema.recipes.cookTimeIso,
        totalTimeIso: schema.recipes.totalTimeIso,
        totalTimeMinutes: schema.recipes.totalTimeMinutes,
        ingredients: schema.recipes.ingredients,
        instructions: schema.recipes.instructions,
        nutrition: schema.recipes.nutrition,
        rating: schema.recipes.rating,
        ratingCount: schema.recipes.ratingCount,
      })
      .from(schema.recipes)
      .innerJoin(schema.recipeTags, eq(schema.recipes.id, schema.recipeTags.recipeId))
      .innerJoin(schema.tags, eq(schema.recipeTags.tagId, schema.tags.id))
      .where(eq(schema.tags.name, tagName))
      .orderBy(asc(schema.recipes.name))
      .limit(limit);

    // Now the results should directly match the Recipe type (or be very close)
    return results as Recipe[]; // Cast if necessary, but explicit selection helps
  } catch (error) {
    console.error(`Error searching recipes by tag "${tagName}":`, error);
    return [];
  }
}

// Search by Total Time
export type TimeQuery =
  | { type: "lessThan"; minutes: number }
  | { type: "lessThanOrEqual"; minutes: number }
  | { type: "greaterThan"; minutes: number }
  | { type: "greaterThanOrEqual"; minutes: number };

export async function searchRecipesByTotalTime(timeQuery: TimeQuery, limit: number = 20): Promise<Recipe[]> {
  try {
    let condition;
    switch (timeQuery.type) {
      case "lessThan":
        condition = lt(schema.recipes.totalTimeMinutes, timeQuery.minutes);
        break;
      case "lessThanOrEqual":
        condition = lte(schema.recipes.totalTimeMinutes, timeQuery.minutes);
        break;
      case "greaterThan":
        condition = gt(schema.recipes.totalTimeMinutes, timeQuery.minutes);
        break;
      case "greaterThanOrEqual":
        condition = gte(schema.recipes.totalTimeMinutes, timeQuery.minutes);
        break;
      default:
        throw new Error("Invalid time query type");
    }

    // Ensure we only compare against recipes that HAVE a totalTimeMinutes value
    const fullCondition = and(sql`${schema.recipes.totalTimeMinutes} IS NOT NULL`, condition);

    const results = await db
      .select()
      .from(schema.recipes)
      .where(fullCondition)
      .orderBy(asc(schema.recipes.totalTimeMinutes))
      .limit(limit);
    return results;
  } catch (error) {
    console.error(`Error searching recipes by total time (${JSON.stringify(timeQuery)}):`, error);
    return [];
  }
}

// Convenience functions for specific time searches
export function searchRecipesUnder30Min(limit: number = 20) {
  return searchRecipesByTotalTime({ type: "lessThanOrEqual", minutes: 30 }, limit);
}

export function searchRecipesUnder1Hour(limit: number = 20) {
  return searchRecipesByTotalTime({ type: "lessThanOrEqual", minutes: 60 }, limit);
}

export function searchRecipesOver1Hour(limit: number = 20) {
  return searchRecipesByTotalTime({ type: "greaterThan", minutes: 60 }, limit);
}

// Example Usage (can be run directly if this file is executed, e.g., with tsx)
async function runExamples() {
  console.log("\n--- Running Query Examples ---");

  // Get recipe by ID (replace 1015978 with a valid ID from your data)
  const specificRecipeId = 1015978; // Bacon-Onion Jam ID
  console.log(`\nFetching recipe with ID: ${specificRecipeId}`);
  const recipe = await getRecipeById(specificRecipeId);
  if (recipe) {
    console.log(`Found: ${recipe.name}`);
    // console.log("Tags:", recipe.tags); // Access tags if transformed
  } else {
    console.log(`Recipe with ID ${specificRecipeId} not found.`);
  }

  // Search by name
  const nameQuery = "pizza";
  console.log(`\nSearching for recipes with name like: "${nameQuery}"`);
  const nameResults = await searchRecipesByName(nameQuery);
  console.log(`Found ${nameResults.length} results:`);
  nameResults.forEach((r) => console.log(` - ${r.name}`));

  // Search by tag
  const tagQuery = "weeknight";
  console.log(`\nSearching for recipes with tag: "${tagQuery}"`);
  const tagResults = await searchRecipesByTag(tagQuery);
  console.log(`Found ${tagResults.length} results:`);
  tagResults.slice(0, 5).forEach((r) => console.log(` - ${r.name}`));

  // Search by time (under 30 min)
  console.log(`\nSearching for recipes under 30 minutes...`);
  const timeResults = await searchRecipesUnder30Min();
  console.log(`Found ${timeResults.length} results:`);
  timeResults.slice(0, 5).forEach((r) => console.log(` - ${r.name} (${r.totalTimeMinutes} min)`));

  console.log("\n--- Examples Complete ---");
  sqlite.close(); // Close connection after examples
}

// --- Run Examples Check ---
// This allows running examples via `npm run db:query-examples`
// but prevents running them if the module is imported elsewhere.
if (import.meta.url.startsWith("file:") && process.argv[1] === path.resolve(__dirname, "queries.ts")) {
  runExamples().catch(console.error);
}

// export { db }; // Optionally export db instance if needed elsewhere
