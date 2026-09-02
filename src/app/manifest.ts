import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BetterDemocracy",
    short_name: "BetterDem",
    description:
      "Delegate your vote on real bills to an ordered list of single-issue parties.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#0b2545",
    icons: [
      {
        src: "/icon-192x192.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192x192.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512x512.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
