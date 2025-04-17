import fs from "node:fs/promises";
import path from "node:path";

type Recipe = {
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  tags?: string[];
};

// Read and process the file
async function main() {
  const file = path.resolve("nyt_recipe_box_recipes.json");
  const data = await fs.readFile(file, "utf-8");
  const recipes: Recipe[] = JSON.parse(data);

  const allPrepTimes = new Set<string>();
  const allCookTimes = new Set<string>();
  const allTotalTimes = new Set<string>();
  const allTags = new Set<string>();

  for (const recipe of recipes) {
    if (recipe.prepTime && recipe.prepTime.trim()) allPrepTimes.add(recipe.prepTime.trim());
    if (recipe.cookTime && recipe.cookTime.trim()) allCookTimes.add(recipe.cookTime.trim());
    if (recipe.totalTime && recipe.totalTime.trim()) allTotalTimes.add(recipe.totalTime.trim());
    if (Array.isArray(recipe.tags))
      recipe.tags.forEach((tag) => {
        if (tag && tag.trim()) allTags.add(tag.trim());
      });
  }

  // Sorted outputs
  const sortedPrepTimes = [...allPrepTimes].sort();
  const sortedCookTimes = [...allCookTimes].sort();
  const sortedTotalTimes = [...allTotalTimes].sort();
  const sortedTags = [...allTags].sort();

  // Print results
  function printEnumArray(title: string, arr: string[]) {
    console.log(`\n// Unique ${title}:`);
    arr.forEach((v) => console.log(`"${v}",`));
    console.log();
    // For actual enums, you could output, e.g.:
    // arr.forEach((v) => console.log(`${v.replace(/[^a-zA-Z0-9]/g, "_") } = "${v}",`));
  }

  printEnumArray("prepTime", sortedPrepTimes);
  printEnumArray("cookTime", sortedCookTimes);
  printEnumArray("totalTime", sortedTotalTimes);
  printEnumArray("tags", sortedTags);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
