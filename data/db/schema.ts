import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, real, index } from "drizzle-orm/sqlite-core";

// --- TABLES ---

export const recipes = sqliteTable(
  "recipes",
  {
    id: integer("id").primaryKey(), // Extracted from URL
    url: text("url").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    author: text("author"),
    image: text("image"), // Store URL as string
    recipeYield: text("recipeYield"),
    prepTimeIso: text("prepTimeIso"),
    cookTimeIso: text("cookTimeIso"),
    totalTimeIso: text("totalTimeIso"),
    totalTimeMinutes: integer("totalTimeMinutes"), // For searching/filtering
    ingredients: text("ingredients", { mode: "json" }).$type<string[]>(), // Store as JSON string
    instructions: text("instructions", { mode: "json" }).$type<string[]>(), // Store as JSON string
    nutrition: text("nutrition", { mode: "json" }), // Store as JSON string
    rating: real("rating"),
    ratingCount: integer("ratingCount"),
    // Timestamps could be added if needed:
    // createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
    // updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => {
    return {
      nameIdx: index("name_idx").on(table.name),
      totalTimeMinutesIdx: index("total_time_minutes_idx").on(table.totalTimeMinutes),
    };
  }
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
  },
  (table) => {
    return {
      tagNameIdx: index("tag_name_idx").on(table.name),
    };
  }
);

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }), // Cascade delete if recipe is removed
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }), // Cascade delete if tag is removed (though tags likely won't be deleted often)
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.recipeId, table.tagId] }),
      recipeIdx: index("recipe_tag_recipe_idx").on(table.recipeId),
      tagIdx: index("recipe_tag_tag_idx").on(table.tagId),
    };
  }
);

// --- RELATIONS ---

export const recipesRelations = relations(recipes, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

// Define relation from junction table back to recipes and tags
export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));

// --- TYPES (Optional but helpful) ---
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type RecipeTag = typeof recipeTags.$inferSelect;
export type NewRecipeTag = typeof recipeTags.$inferInsert;
