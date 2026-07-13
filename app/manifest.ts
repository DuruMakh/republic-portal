import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ქართული რესპუბლიკა",
    short_name: "რესპუბლიკა",
    description: "სამოქალაქო პლატფორმა",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#C8102E",
    lang: "ka",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
