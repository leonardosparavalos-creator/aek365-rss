const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

app.get("/feeds/aek365.xml", async (req, res) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
    );

    await page.goto(
      "https://www.aek365.org/articles_categories-121/podosfairo.htm",
      {
        waitUntil: "networkidle0",
        timeout: 60000,
      }
    );

    await page.waitForTimeout(5000); // wait for content to render

    const articles = await page.$$eval("article.article h2.h2 a", (nodes) =>
      nodes.map((n) => ({
        title: n.innerText.trim(),
        link: "https://www.aek365.org" + n.getAttribute("href"),
      }))
    );

    await browser.close();

    if (!articles.length) {
      throw new Error("No articles found.");
    }

    // Build RSS XML
    const rssFeed = `
      <rss version="2.0">
        <channel>
          <title>AEK365 – Ποδόσφαιρο</title>
          <link>https://www.aek365.org/articles_categories-121/podosfairo.htm</link>
          <description>Auto-generated feed</description>
          ${articles
            .map(
              (a) => `
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
    console.error("Feed error:", err.message);
    res.status(503).send("Failed to fetch RSS feed.");
    await browser.close();
  }
});

app.get("/", (req, res) => {
  res.send("✅ AEK365 RSS is live. Visit /feeds/aek365.xml to get your feed.");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
