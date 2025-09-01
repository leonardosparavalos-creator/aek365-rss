const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/feeds/aek365.xml", async (req, res) => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://www.aek365.org/articles_categories-121/podosfairo.htm", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const articles = await page.$$eval("article.article h2.h2 a", nodes =>
      nodes.map(n => ({
        title: n.innerText.trim(),
        link: `https://www.aek365.org${n.getAttribute("href")}`,
      }))
    );

    await browser.close();

    if (!articles.length) {
      throw new Error("No articles found. Check selectors.");
    }

    // RSS Feed
    const rssFeed = `
    <rss version="2.0">
      <channel>
        <title>AEK365 RSS – Ποδόσφαιρο</title>
        <link>https://www.aek365.org/articles_categories-121/podosfairo.htm</link>
        <description>Generated feed from AEK365 site</description>
        ${articles
          .map(
            article => `
          <item>
            <title><![CDATA[${article.title}]]></title>
            <link>${article.link}</link>
            <guid>${article.link}</guid>
            <pubDate>${new Date().toUTCString()}</pubDate>
          </item>`
          )
          .join("")}
      </channel>
    </rss>`;

    res.set("Content-Type", "application/rss+xml");
    res.send(rssFeed);
  } catch (err) {
    console.error("Error generating feed:", err);
    res.status(503).send("Failed to fetch RSS feed.");
    await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
