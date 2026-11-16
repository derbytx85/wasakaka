// Wasakaka — Cálculos de dinero, comisión e impuestos.
// REGLA DE ORO (sección 12 del documento): TODO cálculo de dinero e impuestos
// se hace en el servidor, nunca en el teléfono del cliente.
//
// FUENTE ÚNICA DE VERDAD DEL DINERO:
// - La comisión estándar es COMISION_ESTANDAR (8%). Ningún otro archivo define otra cifra.
// - En la base de datos TODO monto se guarda en CENTAVOS enteros (Int).
//   La conversión a dólares ocurre solo al mostrar, con formatoDinero.

export const COMISION_ESTANDAR = 8; // % por venta (RF-P03). Única cifra de comisión estándar.
export const COMISION_PROMO_FUNDADORAS = 0; // % durante la promoción de lanzamiento (RF-P04)
export const VENTAS_MES_FIN_PROMO = 40000; // centavos: US$400/mes termina la promoción fundadora
export const MESES_PROMO_FUNDADORA = 6; // la promoción dura 6 meses desde la activación
export const DIAS_AVISO_PROMO = 15; // aviso con 15 días de anticipación al salir de la promoción
export const TASA_IMPUESTO = 0.0825; // 6.25% estatal + 2% local Tarrant (RF-I01, tope 8.25%)
export const COSTO_PROCESAMIENTO_PCT = 0.029; // 2.9% Stripe (simulado en MVP)
export const COSTO_PROCESAMIENTO_FIJO = 0.3; // US$0.30 Stripe
export const CUOTA_REGULAR = 2900; // centavos: US$29/mes (RF-P05)
export const CUOTA_FUNDADORA = 1900; // centavos: US$19/mes fundadora (RF-P05; la tabla vieja de US$39 quedó desactualizada)

/** Convierte dólares (mostrar/entrada humana) a centavos enteros (almacenamiento). */
export const aCentavos = (dolares: number): number => Math.round((Number(dolares) || 0) * 100);

/** Convierte centavos enteros (almacenamiento) a dólares (mostrar). */
export const aDolares = (centavos: number): number => (Number(centavos) || 0) / 100;

export const TOPE_REDONDEO = (n: number) => Math.round(n * 100) / 100;

export interface CocineraComision {
  comisionPromo: number | null;
  promoHasta: Date | null;
  plan?: string;
}

/**
 * Comisión aplicable (RF-P03 + RF-P04).
 * Las cocineras fundadoras en promoción de lanzamiento pagan 0%.
 * Salen de la promoción lo primero que ocurra: superan US$400 de ventas en un
 * mes, o cumplen 6 meses desde su activación (promoHasta). Fuera de la
 * promoción pagan la comisión estándar.
 * @param ventasMesCentavos ventas acumuladas del mes calendario en curso (no canceladas)
 */
export function comisionAplicable(
  cocinera: CocineraComision,
  ventasMesCentavos: number = 0
): number {
  const enPromo =
    cocinera.comisionPromo != null &&
    cocinera.comisionPromo < COMISION_ESTANDAR &&
    (!cocinera.promoHasta || cocinera.promoHasta.getTime() > Date.now()) &&
    ventasMesCentavos <= VENTAS_MES_FIN_PROMO;
  return enPromo ? cocinera.comisionPromo! : COMISION_ESTANDAR;
}

export interface DesgloseDinero {
  subtotal: number;
  subtotalGravado: number;
  subtotalExento: number;
  impuesto: number;
  comision: number;
  netoCocinera: number;
  total: number;
  tasaImpuesto: number;
  comisionPct: number;
  costoProcesamiento: number;
  margenPlataforma: number;
}

/**
 * Desglose completo de un pedido (RF-P01, RF-P03, RF-I01, RF-I02).
 * - El comprador paga subtotal + impuesto. Sin cargo de servicio, sin comisión:
 *   la comisión se descuenta del lado de la cocinera y JAMÁS se cobra al comprador.
 * - El impuesto solo se aplica a la parte gravada; los platos exentos
 *   (p. ej. panadería para llevar sin utensilios) no suman impuesto.
 * - El costo de procesamiento se calcula sobre lo realmente cobrado:
 *   2.9% × (subtotal + impuesto) + US$0.30.
 * - El impuesto se aparta: nunca se mezcla con ingresos de la plataforma.
 * Trabaja en dólares (2 decimales); el almacenamiento va en centavos con aCentavos.
 */
export function calcularDesglose(
  subtotal: number,
  comisionPct: number = COMISION_ESTANDAR,
  opciones?: { subtotalGravado?: number }
): DesgloseDinero {
  const subtotalRedondeado = TOPE_REDONDEO(subtotal);
  const gravado =
    opciones?.subtotalGravado != null ? TOPE_REDONDEO(opciones.subtotalGravado) : subtotalRedondeado;
  const exento = TOPE_REDONDEO(subtotalRedondeado - gravado);
  const impuesto = TOPE_REDONDEO(gravado * TASA_IMPUESTO);
  const comision = TOPE_REDONDEO(subtotalRedondeado * (comisionPct / 100));
  const netoCocinera = TOPE_REDONDEO(subtotalRedondeado - comision);
  const total = TOPE_REDONDEO(subtotalRedondeado + impuesto);
  // Stripe cobra el porcentaje sobre lo realmente cobrado (subtotal + impuesto)
  const costoProcesamiento = TOPE_REDONDEO(
    total * COSTO_PROCESAMIENTO_PCT + COSTO_PROCESAMIENTO_FIJO
  );
  const margenPlataforma = TOPE_REDONDEO(comision - costoProcesamiento);
  return {
    subtotal: subtotalRedondeado,
    subtotalGravado: gravado,
    subtotalExento: exento,
    impuesto,
    comision,
    netoCocinera,
    total,
    tasaImpuesto: TASA_IMPUESTO,
    comisionPct,
    costoProcesamiento,
    margenPlataforma,
  };
}

export function formatoDinero(n: number): string {
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/** Formato de hora 12 h en español, p. ej. "18:00" → "6:00 p. m.". */
export function formatoHora(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const sufijo = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** Código de cierre de entrega de 4 dígitos (RF-U06 / RF-C09). */
export function generarCodigoCierre(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Referencia de pago simulada (estilo Stripe Payment Intent). */
export function generarReferenciaPago(): string {
  return `pi_wsk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Referencia de cobro de suscripción simulada (estilo Stripe Invoice). */
export function generarReferenciaSuscripcion(): string {
  return `in_wsk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Estados del pedido y transiciones permitidas (RF-C08)
export const ESTADOS_PEDIDO = [
  "nuevo",
  "confirmado",
  "en_cocina",
  "listo",
  "en_entrega",
  "para_recogida",
  "entregado",
  "cancelado",
] as const;

export const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  en_cocina: "En cocina",
  listo: "Listo",
  en_entrega: "En entrega",
  para_recogida: "Para recoger",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const FLUJO: Record<string, string[]> = {
  nuevo: ["confirmado", "cancelado"],
  confirmado: ["en_cocina", "cancelado"],
  en_cocina: ["listo", "cancelado"],
  listo: ["en_entrega", "para_recogida", "cancelado"],
  en_entrega: ["entregado"],
  para_recogida: ["entregado"],
};

/** ¿Quién puede mover el pedido y a qué estado? (regla de la sección 12) */
export function puedeTransicionar(
  actual: string,
  destino: string,
  rol: "cocinera" | "cliente" | "admin"
): boolean {
  if (actual === "entregado" || actual === "cancelado") return false;
  const destinos = FLUJO[actual] ?? [];
  if (!destinos.includes(destino)) return false;
  // el cliente solo puede cancelar un pedido nuevo
  if (rol === "cliente") return destino === "cancelado" && actual === "nuevo";
  return true; // cocinera y admin manejan el flujo completo
}

/** ¿Pasó la hora de corte de la agenda? (RF-C07) */
export function pasoHoraCorte(horaCorte: string, fecha: string): boolean {
  const ahora = new Date();
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = horaCorte.split(":").map(Number);
  const corte = new Date(y, m - 1, d, hh, mm, 0);
  return ahora.getTime() >= corte.getTime();
}
