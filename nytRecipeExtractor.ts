// nytRecipeExtractor.ts
export interface NytRecipe {
  url: string;
  name: string;
  description: string;
  author: string;
  image: string | string[];
  recipeYield: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  ingredients: string[];
  instructions: string[];
  nutrition?: Record<string, string | number | null>;
  tags: string[];
  rating?: number;
  ratingCount?: number;
}

export function extractNYTCookingRecipeFromHtml(html: string): NytRecipe | null {
  const ldJsonScripts = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  const recipeObjects: any[] = [];
  for (const m of ldJsonScripts) {
    try {
      const block = JSON.parse(m[1].replace(/\u201c|\u201d/g, '"'));
      if (Array.isArray(block)) {
        for (const o of block) recipeObjects.push(o);
      } else {
        recipeObjects.push(block);
      }
    } catch {}
  }
  const recipe = recipeObjects.find((o) => o["@type"] === "Recipe");
  if (!recipe) return null;

  function getNutrition(obj: any): Record<string, string | number | null> | undefined {
    const n = obj.nutrition;
    if (!n) return undefined;
    // Filter out keys starting with "@" and cast values to the expected type
    const entries = Object.entries(n)
      .filter(([k]) => !k.startsWith("@"))
      .map(([k, v]) => [k, v as string | number | null]);
    return Object.fromEntries(entries);
  }

  let tags: string[] = [];
  if (recipe.keywords) tags = tags.concat(recipe.keywords.split(",").map((s: string) => s.trim()));
  if (recipe.recipeCategory) tags = tags.concat(recipe.recipeCategory.split(",").map((s: string) => s.trim()));

  return {
    url: recipe.url,
    name: recipe.name,
    description: recipe.description,
    author: typeof recipe.author === "object" ? recipe.author.name : recipe.author,
    image: Array.isArray(recipe.image) ? recipe.image[0]?.url || recipe.image[0] : recipe.image,
    recipeYield: recipe.recipeYield,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    ingredients: recipe.recipeIngredient || [],
    instructions: Array.isArray(recipe.recipeInstructions)
      ? recipe.recipeInstructions.map((i: any) => (typeof i === "string" ? i : i.text))
      : [],
    nutrition: getNutrition(recipe),
    tags: [...new Set(tags)],
    rating: recipe.aggregateRating?.ratingValue,
    ratingCount: recipe.aggregateRating?.ratingCount,
  };
}

// FETCH AND EXTRACT MULTIPLE RECIPES

export async function getNytRecipesFromLinks(urls: string[]): Promise<(NytRecipe | null)[]> {
  // fetch with proper headers to avoid bot detection
  async function fetchHtml(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml",
        },
      });
      if (!response.ok) return null;
      return await response.text();
    } catch (e) {
      return null;
    }
  }

  // Run in parallel!
  return Promise.all(
    urls.map(async (url) => {
      const html = await fetchHtml(url);
      if (!html) return null;
      return extractNYTCookingRecipeFromHtml(html);
    })
  );
}
