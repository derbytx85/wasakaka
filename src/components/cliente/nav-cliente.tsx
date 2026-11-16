"use client";

import { useWasakaka } from "@/store/wasakaka";
import { Home, ShoppingBasket, Package } from "lucide-react";

// Navegación inferior estilo app (PWA) para el rol cliente.

export function NavCliente() {
  const { vistaCliente, setVistaCliente, items } = useWasakaka();
  const conteo = items.reduce((a, i) => a + i.cantidad, 0);

  const pestañas = [
    { id: "inicio", etiqueta: "Inicio", Icono: Home },
    { id: "carrito", etiqueta: "Canasta", Icono: ShoppingBasket },
    { id: "pedidos", etiqueta: "Pedidos", Icono: Package },
  ] as const;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-3xl">
        {pestañas.map(({ id, etiqueta, Icono }) => {
          const activa = vistaCliente === id;
          return (
            <button
              key={id}
              onClick={() => setVistaCliente(id)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
                activa ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={activa ? "page" : undefined}
            >
              <Icono className="size-6" />
              {etiqueta}
              {id === "carrito" && conteo > 0 && (
                <span className="absolute right-1/4 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {conteo > 9 ? "9+" : conteo}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
