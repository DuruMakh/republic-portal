import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "prototype/kronika-d3/brand/emblem-roundel-red-notext.png";
mkdirSync("public/icons", { recursive: true });
await sharp(SRC).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(SRC).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#9F1D35" },
})
  .composite([{ input: await sharp(SRC).resize(400, 400).toBuffer(), gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");
await sharp(SRC).resize(48, 48).png().toFile("app/icon.png");
console.log("icons written");
