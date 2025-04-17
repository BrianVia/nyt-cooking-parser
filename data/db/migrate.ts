import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

const SQLITE_DB_PATH = path.join(__dirname, "recipes.db");
const MIGRATIONS_PATH = path.join(__dirname, "migrations");

console.log(`Connecting to database: ${SQLITE_DB_PATH}`);
console.log(`Looking for migrations in: ${MIGRATIONS_PATH}`);

const sqlite = new Database(SQLITE_DB_PATH);
const db = drizzle(sqlite);

console.log("Running database migrations...");

// This command applies migrations from the specified folder
migrate(db, { migrationsFolder: MIGRATIONS_PATH });

console.log("Migrations applied successfully.");

sqlite.close();
console.log("Database connection closed.");
