const express = require("express");
const { chromium } = require("playwright");

const app = express();

app.get("/feeds/aek365.xml", async (req, res) => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://www.aek365.org/articles_categories-121/podosfairo.htm", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Example scraping logic (adjust selectors as needed)
    const articles = await page.$$eval(".article-list .article", nodes =>
      nodes.map(n => ({
        title: n.querySelector("a")?.innerText || "No title",
        link: n.querySelector("a")?.href || "",
      }))
    );

    await browser.close();

    if (!articles.length) {
      throw new Error("No articles found — check selector");
    }

    // Build XML
    res.set("Content-Type", "application/rss+xml");
    res.send(`
      <rss version="2.0">
        <channel>
          <title>AEK365 – Ποδόσφαιρο</title>
          <link>https://www.aek365.org/articles_categories-121/podosfairo.htm</link>
          <description>Auto-generated feed</description>
          ${articles
            .map(
              a => `
            <item>
              <title><![CDATA[${a.title}]]></title>
              <link>${a.link}</link>
              <guid>${a.link}</guid>
              <pubDate>${new Date().toUTCString()}</pubDate>
            </item>`
            )
            .join("")}
        </channel>
      </rss>
    `);
  } catch (err) {
    console.error("RSS error:", err); // <-- This will show up in Render logs
    res.status(503).send("Feed temporarily unavailable");
  }
});

app.listen(3000, () => console.log("RSS server running on port 3000"));
