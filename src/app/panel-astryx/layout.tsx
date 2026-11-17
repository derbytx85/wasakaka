import type { ReactNode } from "react";
import { ProveedorTema } from "./proveedor-tema";

export default function LayoutPanelAstryx({
  children,
}: {
  children: ReactNode;
}) {
  return <ProveedorTema>{children}</ProveedorTema>;
}
