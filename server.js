const express = require("express");
const chromium = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");
const ejs = require("ejs");

const app = express();
const PORT = process.env.PORT || 3000;
const URL = "https://www.aek365.org/articles_categories-121/podosfairo.htm";

app.set("view engine", "ejs");

app.get("/feeds/aek365.xml", async (_req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 0 });

    // Adjust selectors as needed for AEK365’s markup
    const articles = await page.evaluate(() => {
      const sel = ".article_list a, article.item h2 a, .media .text h2 a";
      const anchors = Array.from(document.querySelectorAll(sel));
      const out = [];
      const seen = new Set();
      for (const a of anchors) {
        const title = (a.textContent || "").trim();
        let href = a.getAttribute("href") || "";
        if (!title || !href) continue;
        if (!/^https?:\/\//i.test(href)) href = "https://www.aek365.org" + (href.startsWith("/") ? href : "/" + href);
        if (seen.has(href)) continue;
        seen.add(href);
        out.push({ title, url: href, pubDate: new Date().toUTCString() });
        if (out.length >= 15) break;
      }
      return out;
    });

    await browser.close();

    const xml = await ejs.renderFile(__dirname + "/views/rss.ejs", { articles });
    res.set("Content-Type", "application/rss+xml");
    res.send(xml);
  } catch (err) {
    console.error("Feed build error:", err);
    res.status(503).send("Feed temporarily unavailable");
  }
});

app.get("/", (_req, res) => res.send("AEK365 RSS proxy running. Use /feeds/aek365.xml"));
app.listen(PORT, () => console.log(`Server on :${PORT}`));
