const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;
const LIST_URL = "https://www.aek365.org/articles_categories-121/podosfairo.htm";

/* ---------- utils ---------- */
const esc = s => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function buildRss(items) {
  const now = new Date().toUTCString();
  const itemsXml = items.map(it => `
    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="true">${esc(it.link)}</guid>
      ${it.description ? `<description>${esc(it.description)}</description>` : ""}
      ${it.pubDate ? `<pubDate>${esc(it.pubDate)}</pubDate>` : ""}
    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>AEK365 – Ποδόσφαιρο</title>
  <link>${esc(LIST_URL)}</link>
  <description>Auto-generated feed from AEK365</description>
  <lastBuildDate>${now}</lastBuildDate>
  <pubDate>${now}</pubDate>
  <language>el</language>
  ${itemsXml}
</channel>
</rss>`;
}

/* ---------- scraper ---------- */
async function scrapeList() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    locale: "el-GR",
    extraHTTPHeaders: { "accept-language": "el-GR,el;q=0.9,en;q=0.8" }
  });
  const page = await ctx.newPage();

  // speed up: skip heavy assets
  await page.route("**/*", route => {
    const t = route.request().resourceType();
    if (t === "image" || t === "font" || t === "media") return route.abort();
    route.continue();
  });

  await page.goto(LIST_URL, { waitUntil: "networkidle", timeout: 60000 });

  // layout used on AEK365 category pages you sent
  await page.waitForSelector("article.article, article.item", { timeout: 20000 });

  const items = await page.evaluate(() => {
    const abs = href =>
      /^https?:\/\//i.test(href)
        ? href
        : "https://www.aek365.org" + (href.startsWith("/") ? href : "/" + href);

    // Support both known layouts: article.article … and article.item …
    const articles = Array.from(document.querySelectorAll("article.article, article.item"));
    const out = [];
    const seen = new Set();

    for (const art of articles) {
      const a = art.querySelector("h2 a, .text h2 a, a.img, a[href^='/a-']");
      if (!a) continue;

      const link = abs(a.getAttribute("href") || "");
      if (!link || seen.has(link)) continue;
      seen.add(link);

      const titleNode = art.querySelector("h2 a, .text h2 a") || a;
      const title = (titleNode.textContent || "").replace(/\s+/g, " ").trim();

      const descNode = art.querySelector("p.stext, p.lead");
      const description = descNode ? descNode.textContent.replace(/\s+/g, " ").trim() : "";

      const timeNode = art.querySelector("time[datetime]");
      const pubDate = timeNode ? new Date(timeNode.getAttribute("datetime").replace(" ", "T") + "Z").toUTCString() : "";

      out.push({ title, link, description, pubDate });
      if (out.length >= 25) break;
    }
    return out;
  });

  await browser.close();
  return items;
}

/* ---------- routes ---------- */
app.get("/feeds/aek365.xml", async (_req, res) => {
  try {
    const items = await scrapeList();
    if (!items.length) throw new Error("No items parsed");
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(buildRss(items));
  } catch (e) {
    console.error("RSS error:", e?.message || e);
    res.status(503).send("Feed temporarily unavailable");
  }
});

app.get("/", (_req, res) => res.send("AEK365 RSS proxy running. Use /feeds/aek365.xml"));

app.listen(PORT, () => console.log(`Server on :${PORT}`));
