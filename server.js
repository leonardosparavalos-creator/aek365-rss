const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/feeds/aek365.xml", async (req, res) => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    await page.goto("https://www.aek365.org/articles_categories-121/podosfairo.htm", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Wait additional time for JS content
    await page.waitForTimeout(5000);

    // Scrape article links
    const articles = await page.$$eval("article.article h2.h2 a", nodes =>
      nodes.map(n => ({
        title: n.innerText.trim(),
        link: "https://www.aek365.org" + n.getAttribute("href"),
      }))
    );

    await browser.close();

    if (!articles.length) {
      throw new Error("No articles found. Check selector or page rendering.");
    }

    // Build RSS XML
    const rssFeed = `
      <rss version="2.0">
        <channel>
          <title>AEK365 – Ποδόσφαιρο</title>
          <link>https://www.aek365.org/articles_categories-121/podosfairo.htm</link>
          <description>Auto-generated feed for MonitoRSS</description>
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
    `;

    res.set("Content-Type", "application/rss+xml");
    res.send(rssFeed);
  } catch (err) {
    console.error("Error generating feed:", err);
    res.status(503).send("Failed to fetch RSS feed.");
    await browser.close();
  }
});

app.get("/", (req, res) => {
  res.send("AEK365 RSS Generator is running. Visit /feeds/aek365.xml to view the feed.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
