import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./data/db/schema.ts",
  out: "./data/db/migrations",
  dialect: "sqlite", // Use 'sqlite' dialect
  dbCredentials: {
    url: "./data/db/recipes.db",
  },
  verbose: true,
  strict: true,
});
