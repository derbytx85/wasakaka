import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wasakaka — Comida casera de tu barrio",
    short_name: "Wasakaka",
    description:
      "El mercado en línea de comida casera latina de Fort Worth: panadería, repostería y antojos hechos en casa, bajo la ley de comida casera de Texas.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    dir: "ltr",
    background_color: "#fdf8ef",
    theme_color: "#d05a1e",
    categories: ["food", "shopping", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Ver catálogo del barrio",
        url: "/?vista=cliente",
        description: "Cocineras y platos activos cerca de ti",
      },
      {
        name: "Panel de la cocinera",
        url: "/?vista=cocinera",
        description: "Tus platos, agenda y pedidos del día",
      },
    ],
  };
}
