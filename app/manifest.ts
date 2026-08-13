import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KayPaint",
    short_name: "KayPaint",
    description: "Full-featured image editor in your browser",
    start_url: "/editor",
    display: "standalone",
    background_color: "#111827",
    theme_color: "#6366f1",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
