const express = require("express");
const { chromium } = require("playwright-chromium");
const ejs = require("ejs");

const app = express();
const PORT = process.env.PORT || 3000;
const URL = "https://www.aek365.org/articles_categories-121/podosfairo.htm";

app.set("view engine", "ejs");

app.get("/feeds/aek365.xml", async (_req, res) => {
  try {
    const browser = await chromium.launch({ args: ["--no-sandbox"], headless: true });
    const page = await browser.newPage();

    // Load and wait for network to settle
    await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });

    // Grab article anchors from multiple known layouts
    const articles = await page.evaluate(() => {
      const sels = [
        ".article_list a",              // older markup
        "article.item h2 a",            // current markup seen
        ".media .text h2 a"             // alternate container
      ];
      const nodes = [];
      for (const s of sels) nodes.push(...document.querySelectorAll(s));
      const seen = new Set();
      const out = [];
      for (const a of nodes) {
        const title = (a.textContent || "").trim();
        let href = a.getAttribute("href") || "";
        if (!title || !href) continue;
        if (!/^https?:\/\//i.test(href)) {
          href = "https://www.aek365.org" + (href.startsWith("/") ? href : "/" + href);
        }
        if (seen.has(href)) continue;
        seen.add(href);
        out.push({ title, link: href, pubDate: new Date().toUTCString() });
        if (out.length >= 20) break;
      }
      return out;
    });

    await browser.close();

    if (!articles.length) throw new Error("No articles parsed");

    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(buildRss(articles));
  } catch (err) {
    console.error("RSS error:", err?.message || err);
    res.status(503).send("Feed temporarily unavailable");
  }
});

app.get("/", (_req, res) => res.send("AEK365 RSS proxy running. Use /feeds/aek365.xml"));
app.listen(PORT, () => console.log(`Server on :${PORT}`));

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function buildRss(items) {
  const now = new Date().toUTCString();
  const itemsXml = items.map(it => `
    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="true">${esc(it.link)}</guid>
      <pubDate>${esc(it.pubDate)}</pubDate>
    </item>`).join("\n");
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

