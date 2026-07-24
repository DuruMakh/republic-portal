import sharp from "sharp";

const SRC_ROUNDEL = "prototype/kronika-d3/brand/emblem-roundel-red-notext.png";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#F7F2E9"/>
  <rect x="72" y="72" width="156" height="10" rx="5" fill="#9F1D35"/>
  <rect x="228" y="72" width="104" height="10" rx="5" fill="#1A1611"/>
  <text x="72" y="318" font-family="Noto Serif Georgian, Sylfaen, serif"
        font-size="60" font-weight="700" fill="#1A1611">ქართული რესპუბლიკა</text>
  <text x="74" y="368" font-family="Noto Sans Georgian, Sylfaen, sans-serif"
        font-size="30" font-weight="600" fill="#6E6659">სამოქალაქო პლატფორმა</text>
</svg>`;

const roundelSize = 200;
const roundel = await sharp(SRC_ROUNDEL).resize(roundelSize, roundelSize).toBuffer();

await sharp(Buffer.from(svg))
  .composite([
    {
      input: roundel,
      left: 1200 - roundelSize - 80,
      top: Math.round((630 - roundelSize) / 2),
    },
  ])
  .png()
  .toFile("public/og-default.png");
console.log("public/og-default.png written");
