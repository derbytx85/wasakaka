import type { ReactNode } from "react";
import { ProveedorTema } from "../panel-astryx/proveedor-tema";

export default function LayoutCocinaAstryx({
  children,
}: {
  children: ReactNode;
}) {
  return <ProveedorTema>{children}</ProveedorTema>;
}
