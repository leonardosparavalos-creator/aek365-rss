const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());
const app = express();

app.get("/feeds/aek365.xml", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto("https://www.aek365.org/articles_categories-121/podosfairo.htm", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const articles = await page.$$eval(".articlelist_item", nodes =>
      nodes.map(n => {
        const title = n.querySelector("a")?.innerText || "No title";
        const link = n.querySelector("a")?.href || "";
        return { title, link };
      })
    );

    await browser.close();
    console.log("✅ Articles fetched:", articles);
    if (!articles.length) throw new Error("No articles found — check selector");

    res.set("Content-Type", "application/rss+xml");
    res.send(`
      <rss version="2.0">
        <channel>
          <title>AEK365 – Ποδόσφαιρο</title>
          <link>https://www.aek365.org/articles_categories-121/podosfairo.htm</link>
          <description>Auto-generated feed</description>
          ${articles.map(a => `
            <item>
              <title><![CDATA[${a.title}]]></title>
              <link>${a.link}</link>
              <guid>${a.link}</guid>
              <pubDate>${new Date().toUTCString()}</pubDate>
            </item>
          `).join("")}
        </channel>
      </rss>
    `);
  } catch (err) {
  console.error("❌ RSS error:", err); // 👈 more visible in logs
  res.status(503).send(`Failed to fetch RSS feed.\n\nError: ${err.message}`);
}
});

// ✅ THIS MUST BE LAST
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
