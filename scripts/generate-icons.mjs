import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#C8102E"/>
  <text x="50%" y="54%" font-family="Noto Sans Georgian, Sylfaen, sans-serif"
        font-size="220" font-weight="700" fill="#FFFFFF"
        text-anchor="middle" dominant-baseline="middle">ქრ</text>
</svg>`;

mkdirSync("public/icons", { recursive: true });
await sharp(Buffer.from(svg(false)))
  .resize(192, 192)
  .png()
  .toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg(false)))
  .resize(512, 512)
  .png()
  .toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg(true)))
  .resize(512, 512)
  .png()
  .toFile("public/icons/icon-maskable-512.png");
console.log("icons written");
