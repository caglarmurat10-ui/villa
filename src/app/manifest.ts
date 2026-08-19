import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Villa Yönetim",
    short_name: "Villa",
    description: "Safira ve Destan rezervasyon yönetim sistemi",
    start_url: "/",
    display: "standalone",
    background_color: "#07111f",
    theme_color: "#4338ca",
    orientation: "portrait-primary",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
