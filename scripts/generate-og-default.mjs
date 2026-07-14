import sharp from "sharp";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="g" cx="50%" cy="-10%" r="120%">
      <stop offset="0%" stop-color="#1b2c46"/>
      <stop offset="55%" stop-color="#0E1A2B"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="72" y="72" width="156" height="10" rx="5" fill="#C8102E"/>
  <rect x="228" y="72" width="104" height="10" rx="5" fill="#FFFFFF"/>
  <text x="72" y="330" font-family="Noto Sans Georgian, Sylfaen, sans-serif"
        font-size="88" font-weight="700" fill="#FFFFFF">ქართული რესპუბლიკა</text>
  <text x="74" y="404" font-family="Noto Sans Georgian, Sylfaen, sans-serif"
        font-size="40" font-weight="600" fill="#AEB9CA">სამოქალაქო პლატფორმა</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-default.png");
console.log("public/og-default.png written");
