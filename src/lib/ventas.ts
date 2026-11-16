import { db } from "@/lib/db";

// Wasakaka — Contadores de ventas derivados (RF-C10 + RF-I04).
// El tope legal de US$150.000 es ANUAL (año calendario): el contador se calcula
// sumando los pedidos del año en curso por su fecha — nunca se congela de un año
// a otro. Las ventas fuera de la plataforma son un ajuste manual editable por
// la cocinera en «Mis números». Todo en centavos.

export interface VentasContador {
  plataformaCentavos: number;
  fueraCentavos: number;
  totalCentavos: number;
}

function inicioAnoCalendario(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function inicioMesCalendario(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
}

/** Ventas del AÑO calendario en curso + ajuste manual fuera de la plataforma. */
export async function ventasDelAno(cocineraId: string): Promise<VentasContador> {
  const [agregado, cocinera] = await Promise.all([
    db.pedido.aggregate({
      where: {
        cocineraId,
        fecha: { gte: inicioAnoCalendario() },
        estado: { not: "cancelado" },
      },
      _sum: { subtotal: true },
    }),
    db.cocinera.findUnique({
      where: { id: cocineraId },
      select: { ventasFueraPlataforma: true },
    }),
  ]);
  const plataforma = agregado._sum.subtotal ?? 0;
  const fuera = cocinera?.ventasFueraPlataforma ?? 0;
  return { plataformaCentavos: plataforma, fueraCentavos: fuera, totalCentavos: plataforma + fuera };
}

/** Ventas del MES calendario en curso (para la salida de la promoción fundadora: US$400/mes). */
export async function ventasDelMes(cocineraId: string): Promise<number> {
  const agregado = await db.pedido.aggregate({
    where: {
      cocineraId,
      fecha: { gte: inicioMesCalendario() },
      estado: { not: "cancelado" },
    },
    _sum: { subtotal: true },
  });
  return agregado._sum.subtotal ?? 0;
}

/** Suma de ventas de un mes clave "YYYY-MM" (para el cierre de impuestos). */
export async function ventasDeMesClave(mes: string): Promise<{ ventasCentavos: number; impuestoCentavos: number }> {
  const [y, m] = mes.split("-").map(Number);
  const desde = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const hasta = new Date(y, m, 1, 0, 0, 0, 0);
  const agregado = await db.pedido.aggregate({
    where: { fecha: { gte: desde, lt: hasta }, estado: { not: "cancelado" } },
    _sum: { subtotal: true, impuesto: true },
  });
  return {
    ventasCentavos: agregado._sum.subtotal ?? 0,
    impuestoCentavos: agregado._sum.impuesto ?? 0,
  };
}
