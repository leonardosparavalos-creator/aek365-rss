const express = require("express");
const puppeteer = require("puppeteer");
const ejs = require("ejs");
const fs = require("fs");
const app = express();

const PORT = process.env.PORT || 3000;
const URL = "https://www.aek365.org/articles_categories-121/podosfairo.htm";

app.set("view engine", "ejs");

app.get("/feeds/aek365.xml", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle2" });

    const articles = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll(".article_list a"));
      return anchors.slice(0, 10).map((a) => ({
        title: a.innerText.trim(),
        url: a.href,
      }));
    });

    await browser.close();

    const xml = await ejs.renderFile(__dirname + "/views/rss.ejs", { articles });
    res.set("Content-Type", "application/rss+xml");
    res.send(xml);
  } catch (err) {
    res.status(503).send("Feed temporarily unavailable");
  }
});

app.get("/", (req, res) => {
  res.send("AEK365 Puppeteer RSS Proxy is running.");
});

app.listen(PORT, () => console.log("Server started on port " + PORT));
