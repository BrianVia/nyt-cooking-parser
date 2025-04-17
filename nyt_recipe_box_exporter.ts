import fs from "node:fs/promises";
import path from "node:path";
import { getNytRecipesFromLinks } from "./nytRecipeExtractor.ts"; // <-- YOUR extractor module

const NYT_USER_ID = "91708466"; // put your user id here
const RECIPE_BOX_PAGE_SIZE = 48;

const HEADERS = {
  accept: "*/*",
  "content-type": "application/json",
  "x-cooking-api": "cooking-frontend",
  cookie:
    "nyt-oc=0; nyt-a=i2UWdf8L2kH-BEl3RXDH0k; regi_cookie=ndslap=88&news_tenure=319&regi_id=91708466; nyt-m=712EF253A35F740A4BB731D49951B081&vp=i.0&ira=i.0&er=i.1727888125&pr=l.4.0.0.0.0&cav=i.1&ier=i.0&ifv=i.0&igf=i.0&n=i.2&imv=i.0&g=i.0&t=i.15&vr=l.4.0.0.0.0&imu=i.1&iga=i.0&s=s.wirecutter&igu=i.1&prt=i.0&ica=i.0&iue=i.1&ird=i.0&iir=i.0&uuid=s.966881ea-7db1-4c46-87ae-36b7fff18426&v=i.0&rc=i.0&fv=i.0&igd=i.0&iru=i.1&e=i.1730469600&ft=i.0&iub=i.0; nyt-tos-viewed=true; purr-pref-agent=<G_<C_<T0<Tp1_<Tp2_<Tp3_<Tp4_<Tp7_<a0_; purr-cache=<G_<C_<T0<Tp1_<Tp2_<Tp3_<Tp4_<Tp7_<a12<K0<S0<rUS+US-VA<ur; nyt-b3-traceid=af1c57be66f0426598b7c343b12f4c91; nyt-traceid=(null); nyt-purr=cfshprhohckrhdrhhgah2taaa; _cb=i7Uq7CivKh5BqfqJD; iter_id=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhaWQiOiI2N2VmZWQ5ZDk1YmViZWQ2NzU1NDhlOTciLCJjb21wYW55X2lkIjoiNWMwOThiM2QxNjU0YzEwMDAxMmM2OGY5IiwiaWF0IjoxNzQzNzc3MTgxfQ.k_jX8IyY3X-V2vt9vtbjDPs2QkKKWaZz5KTUBgYejCI; __gads=ID=f44c937476f78554:T=1743988541:RT=1743988986:S=ALNI_MYAdtTnBgUah-szihlrz_dCGSbBbg; __gpi=UID=00001008e1a3a2f2:T=1743988541:RT=1743988986:S=ALNI_MaHr7taOlx387YRv5U8ZsKicJRC7w; __eoi=ID=1b4660fa3fdb18ea:T=1743988541:RT=1743988986:S=AA-AfjaVHxoiAEEkox-viMXo4b9J; _chartbeat2=.1743777180926.1743989246416.101._TSUfCpy556ChEsR4BgQp70CSlDWm.8; nyt-gdpr=0; nyt-geo=US; SIDNY=CBsSNgiVnc6oBhCYyoTABhoSMS33Vn4cCCcQEHRyGHAf5fzHILK43SsqAh53OPeb7uUFQgUItJLkARpAQUeNInuYk931k8DFX1OZL-kj2PDYYf_eiUm55J0bpXpR54Vh79lc4XyQUN9PwVGoxZmXuSC9yolz2UctFrFDDA==; NYT-S=0^CBsSNgiVnc6oBhCYyoTABhoSMS33Vn4cCCcQEHRyGHAf5fzHILK43SsqAh53OPeb7uUFQgUItJLkARpAQUeNInuYk931k8DFX1OZL-kj2PDYYf_eiUm55J0bpXpR54Vh79lc4XyQUN9PwVGoxZmXuSC9yolz2UctFrFDDA==; nyt-jkidd=uid=91708466&lastRequest=1744905376746&activeDays=%5B0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C1%2C0%2C0%2C1%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C1%2C1%2C1%5D&adv=5&a7dv=3&a14dv=5&a21dv=5&lastKnownType=sub&newsStartDate=1740903446&entitlements=AAA+ATH+AUD+CKG+MM+MOW+MSD+MTD+WC+XWD", // <--- put your session cookies here!
  referer: "https://cooking.nytimes.com/recipe-box",
  // ... add/adjust other headers as needed for auth
};

async function fetchOneBoxPage(page: number): Promise<string[] | null> {
  const url = `https://cooking.nytimes.com/api/v2/users/${NYT_USER_ID}/search/recipe_box_search?q=&per_page=${RECIPE_BOX_PAGE_SIZE}&page=${page}&include_crops=ipad_mediumThreeByTwo440,card`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.warn(`Failed to fetch NYT recipe box page ${page}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (!Array.isArray(data.collectables)) return [];
  // Map to all found recipe links
  return data.collectables.map((r: any) => r.url).filter(Boolean);
}

// Download ALL recipe links for your account
export async function downloadAllRecipeBoxLinks(): Promise<string[]> {
  const allLinks: string[] = [];
  let page = 1;
  let keepGoing = true;

  do {
    const links = await fetchOneBoxPage(page);
    if (!links) throw new Error(`Aborting: could not fetch page ${page}`);
    allLinks.push(...links);
    process.stdout.write(`Found ${allLinks.length} bookmarks so far (page ${page})...\n`);
    // The API returns total_pages, so you could stop at last page
    if (links.length < RECIPE_BOX_PAGE_SIZE) keepGoing = false;
    else page++;
  } while (keepGoing);

  // Remove possible duplicates (can happen if you bookmark/delete often)
  return Array.from(new Set(allLinks));
}

// MAIN FUNCTION: recipe box downloader to FS
async function main() {
  console.log("Fetching all recipe box links...");
  const links = await downloadAllRecipeBoxLinks();

  // Save links as backup
  await fs.writeFile(path.resolve("nyt_recipe_box_links.json"), JSON.stringify(links, null, 2), "utf-8");

  console.log(`Downloading full recipes for ${links.length} bookmarks...`);
  const recipes = await getNytRecipesFromLinks(links);

  // Optionally: filter out failed/null recipes!
  const successful = recipes.filter((r) => r != null);

  await fs.writeFile(path.resolve("nyt_recipe_box_recipes.json"), JSON.stringify(successful, null, 2), "utf-8");

  console.log(`Done. Downloaded ${successful.length} out of ${links.length} recipes.`);
}

if (process.argv[1] === (process.env._ || process.argv[1])) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
main();
