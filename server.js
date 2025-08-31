const express = require("express");
const { chromium } = require("playwright-chromium");
const ejs = require("ejs");

const app = express();
const PORT = process.env.PORT || 3000;
const URL = "https://www.aek365.org/articles_categories-121/podosfairo.htm";

app.set("view engine", "ejs");

app.get("/feeds/aek365.xml", async (_req, res) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      locale: "el-GR",
      extraHTTPHeaders: {
        "accept-language": "el-GR,el;q=0.9,en;q=0.8"
      }
    });

    const page = await context.newPage();

    // Speed up: don’t load images/ fonts/ media
    await page.route("**/*", route => {
      const type = route.request().resourceType();
      if (["image", "media", "font"].includes(type)) return route.abort();
      route.continue();
    });

    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Wait for articles to render (RequireJS populates DOM)
    const selectors = [
      "article.item h2 a",
      ".media .text h2 a",
      ".article_list a"
    ];

    let ready = false;
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 15000 });
        ready = true;
        break;
      } catch (_) {
        // try next selector
      }
    }

    if (!ready) {
      const html = await page.content();
      console.log("NO SELECTOR MATCHED. HTML PREVIEW:\n", html.slice(0, 1200));
      throw new Error("No article selector matched");
    }

    const articles = await page.evaluate(() => {
      function abs(href) {
        if (!href) return "";
        return /^https?:\/\//i.test(href)
          ? href
          : "https://www.aek365.org" + (href.startsWith("/") ? href : "/" + href);
      }
      const sels = ["article.item h2 a", ".media .text h2 a", ".article_list a"];
      const nodes = [];
      for (const s of sels) nodes.push(...document.querySelectorAll(s));
      const seen = new Set();
      const out = [];
      for (const a of nodes) {
        const title = (a.textContent || "").trim();
        let href = a.getAttribute("href") || "";
        href = abs(href);
        if (!title || !href) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        out.push({ title, link: href, pubDate: new Date().toUTCString() });
        if (out.length >= 20) break;
      }
      return out;
    });

    console.log(`FOUND ${articles.length} items`);
    if (!articles.length) {
      const html = await page.content();
      console.log("ZERO ITEMS. HTML PREVIEW:\n", html.slice(0, 1200));
      throw new Error("No articles parsed");
    }

    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(buildRss(articles));
  } catch (err) {
    console.error("RSS error:", err?.message || err);
    res.status(503).send("Feed temporarily unavailable");
  } finally {
    if (browser) await browser.close();
  }
});

app.get("/", (_req, res) =>
  res.send("AEK365 RSS proxy running. Use /feeds/aek365.xml")
);

app.listen(PORT, () => console.log(`Server on :${PORT}`));

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function buildRss(items) {
  const now = new Date().toUTCString();
  const itemsXml = items
    .map(
      it => `
    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="true">${esc(it.link)}</guid>
      <pubDate>${esc(it.pubDate)}</pubDate>
    </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>AEK365 – Ποδόσφαιρο</title>
  <link>https://www.aek365.org/articles_categories-121/podosfairo.htm</link>
  <description>Auto-generated feed from AEK365</description>
  <lastBuildDate>${now}</lastBuildDate>
  <pubDate>${now}</pubDate>
  <language>el</language>
  ${itemsXml}
</channel>
</rss>`;
}
