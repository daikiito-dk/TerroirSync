import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TerroirSync — Vineyard Compliance & Subsidy Automation",
    short_name: "TerroirSync",
    description:
      "Field data in, auditor reports and CDFA grant payloads out — for California wine grape growers.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#faf6ee",
    theme_color: "#5c1a28",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Full-bleed background with the motif inside the 80% safe zone.
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
