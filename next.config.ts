import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // La vista previa del sandbox carga la app desde dominios externos
  // (p. ej. preview-chat-*.space-z.ai). Declararlos como orígenes de desarrollo
  // permitidos evita que los recursos /_next/* se sirvan de forma incoherente
  // entre el HTML del servidor y los bundles del cliente (causa de desfases
  // de hidratación tipo useId/aria-controls durante el HMR).
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
