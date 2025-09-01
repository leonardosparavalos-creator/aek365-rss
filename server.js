const express = require("express");
const puppeteer = require("puppeteer"); // ✅ NOT puppeteer-core

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/feeds/aek365.xml", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: puppeteer.executablePath(), // ✅ BUILT-IN Chrome path
    });

    const page = await browser.newPage();
    await page.goto("https://www.aek365.org/articles_categories-121/podosfairo.htm", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const articles = await page.$$eval(".article-list .article", nodes =>
      nodes.map(n => ({
        title: n.querySelector("a")?.innerText || "No title",
        link: n.querySelector("a")?.href || "",
      }))
    );

    await browser.close();

    if (!articles.length) throw new Error("No articles found — check selector");

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
    console.error("RSS error:", err);
    res.status(503).send("Failed to fetch RSS feed. Error: " + err.message);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
