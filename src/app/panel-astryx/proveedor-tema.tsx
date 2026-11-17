"use client";

// Proveedor de tema Astryx (sistema de diseño de Meta) SOLO para la ruta
// /panel-astryx. El resto de la app sigue con su diseño actual: esta es la
// pantalla de prueba de la migración gradual que recomienda la guía oficial
// de Astryx para apps Tailwind/shadcn (una superficie a la vez).
import { Theme } from "@astryxdesign/core/theme";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import type { ReactNode } from "react";

export function ProveedorTema({ children }: { children: ReactNode }) {
  return (
    <Theme theme={matchaTheme} mode="light">
      {children}
    </Theme>
  );
}
