"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type RolActivo = "cliente" | "cocinera" | "admin";
export type VistaCliente = "inicio" | "carrito" | "pedidos";
export type VistaCocinera = "hoy" | "menu" | "agenda" | "numeros";
export type VistaAdmin = "operacion" | "aprobaciones" | "dinero";

export interface Idem {
  id: string;
  nombre: string;
  zona?: string | null;
  estado?: string;
  plan?: string;
}

export interface ItemCarrito {
  platoId: string;
  cocineraId: string;
  cocineraNombre: string;
  nombre: string;
  precio: number;
  cantidad: number;
  fotoUrl?: string | null;
}

export interface Notificacion {
  id: string;
  texto: string;
  canal: "whatsapp" | "app";
  hora: string;
}

interface WasakakaEstado {
  // identidad demo (en producción: sesión real).
  // demoMode solo es verdadero si el backend tiene DEMO_MODE=1: sin él, el
  // cambiador de rol no se renderiza y no hay ruta al panel de administración.
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  rolActivo: RolActivo;
  clienteId: string | null;
  clienteNombre: string;
  cocineraId: string | null;
  adminId: string | null;
  cocinerasDisponibles: Idem[];
  setIdentidades: (d: {
    cliente: Idem | null;
    admin: Idem | null;
    cocineras: Idem[];
  }) => void;
  setRol: (r: RolActivo) => void;
  setCocinera: (id: string) => void;
  setClienteDemo: (id: string, nombre?: string) => void;

  // navegación
  vistaCliente: VistaCliente;
  vistaCocinera: VistaCocinera;
  vistaAdmin: VistaAdmin;
  setVistaCliente: (v: VistaCliente) => void;
  setVistaCocinera: (v: VistaCocinera) => void;
  setVistaAdmin: (v: VistaAdmin) => void;

  // carrito
  items: ItemCarrito[];
  agregar: (item: ItemCarrito) => void;
  quitar: (platoId: string) => void;
  cambiarCantidad: (platoId: string, delta: number) => void;
  vaciar: () => void;

  // notificaciones simuladas (RF-N01: los avisos internos van «En la app»;
  // si algo representa un canal no integrado se rótula «demo»)
  notificaciones: Notificacion[];
  avisar: (texto: string, canal?: Notificacion["canal"]) => void;
  limpiarNotificaciones: () => void;

  // pedido activo para seguimiento
  seguimientoPedidoId: string | null;
  setSeguimiento: (id: string | null) => void;
}

export const useWasakaka = create<WasakakaEstado>()(
  persist(
    (set) => ({
  demoMode: false,
  setDemoMode: (demoMode) => set({ demoMode }),
  rolActivo: "cliente",
  clienteId: null,
  clienteNombre: "Cliente",
  cocineraId: null,
  adminId: null,
  cocinerasDisponibles: [],
  setIdentidades: (d) =>
    set({
      clienteId: d.cliente?.id ?? null,
      clienteNombre: d.cliente?.nombre ?? "Cliente",
      adminId: d.admin?.id ?? null,
      cocinerasDisponibles: d.cocineras ?? [],
      cocineraId:
        useWasakaka.getState().cocineraId ??
        d.cocineras.find((c) => c.estado === "activa")?.id ??
        d.cocineras[0]?.id ??
        null,
    }),
  setRol: (rolActivo) => set({ rolActivo }),
  setCocinera: (cocineraId) => set({ cocineraId }),
  // tras el registro en el carrito (RF-U01): la cuenta nueva pasa a ser la activa
  setClienteDemo: (clienteId, clienteNombre) =>
    set({ clienteId, clienteNombre: clienteNombre ?? "Cliente" }),

  vistaCliente: "inicio",
  vistaCocinera: "hoy",
  vistaAdmin: "operacion",
  setVistaCliente: (vistaCliente) => set({ vistaCliente }),
  setVistaCocinera: (vistaCocinera) => set({ vistaCocinera }),
  setVistaAdmin: (vistaAdmin) => set({ vistaAdmin }),

  items: [],
  agregar: (item) =>
    set((s) => {
      const existente = s.items.find((i) => i.platoId === item.platoId);
      if (existente) {
        return {
          items: s.items.map((i) =>
            i.platoId === item.platoId ? { ...i, cantidad: Math.min(20, i.cantidad + 1) } : i
          ),
        };
      }
      return { items: [...s.items, item] };
    }),
  quitar: (platoId) => set((s) => ({ items: s.items.filter((i) => i.platoId !== platoId) })),
  cambiarCantidad: (platoId, delta) =>
    set((s) => ({
      items: s.items
        .map((i) =>
          i.platoId === platoId
            ? { ...i, cantidad: Math.max(0, Math.min(20, i.cantidad + delta)) }
            : i
        )
        .filter((i) => i.cantidad > 0),
    })),
  vaciar: () => set({ items: [] }),

  notificaciones: [],
  avisar: (texto, canal = "app") =>
    set((s) => ({
      notificaciones: [
        { id: `${Date.now()}-${Math.random()}`, texto, canal, hora: new Date().toISOString() },
        ...s.notificaciones,
      ].slice(0, 30),
    })),
  limpiarNotificaciones: () => set({ notificaciones: [] }),

  seguimientoPedidoId: null,
  setSeguimiento: (seguimientoPedidoId) => set({ seguimientoPedidoId }),
}),
    {
      name: "wasakaka-sesion",
      storage: createJSONStorage(() => localStorage),
      // el carrito SÍ se conserva: el cliente típico llega por un enlace de
      // WhatsApp y puede recargar o cerrar sin querer; perder su pedido no se
      // lo perdonamos. El rol y las vistas también se restauran.
      partialize: (s) => ({
        rolActivo: s.rolActivo,
        cocineraId: s.cocineraId,
        vistaCliente: s.vistaCliente,
        vistaCocinera: s.vistaCocinera,
        vistaAdmin: s.vistaAdmin,
        items: s.items,
      }),
      // la hidratación la disparamos en un useEffect (AppShell) para evitar
      // desajustes de SSR al restaurar el rol
      skipHydration: true,
    }
  )
);
