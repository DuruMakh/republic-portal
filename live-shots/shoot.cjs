const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch();
  const log = [];
  for (const [name, w, h, mobile] of [["desktop", 1440, 900, false], ["phone", 390, 844, true]]) {
    for (const path of ["/", "/about"]) {
      const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
      const p = await c.newPage();
      p.on("console", (m) => { if (m.type() === "error") log.push(`${name} ${path} console: ${m.text()}`); });
      p.on("requestfailed", (r) => log.push(`${name} ${path} failed: ${r.url()} ${r.failure()?.errorText}`));
      p.on("response", (r) => { if (r.status() >= 400) log.push(`${name} ${path} ${r.status()}: ${r.url()}`); });
      await p.goto("https://respublika.ge" + path, { waitUntil: "networkidle" });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      await p.waitForTimeout(1500);
      const info = await p.evaluate(() => ({
        css: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
        h1Font: getComputedStyle(document.querySelector("h1")).fontFamily,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        unity: !!document.querySelector(".unity-fonts"),
        srOnlyPos: (() => { const s = document.querySelector(".sr-only"); return s ? getComputedStyle(s).position : null; })(),
      }));
      log.push(`${name} ${path} info: ${JSON.stringify(info)}`);
      const n = `${name}${path === "/" ? "-home" : path.replace("/", "-")}`;
      await p.screenshot({ path: `live-shots/${n}-top.png` });
      await p.screenshot({ path: `live-shots/${n}-full.png`, fullPage: true });
      await c.close();
    }
  }
  fs.writeFileSync("live-shots/log.txt", log.join("\n") + "\n");
  await b.close();
})();
