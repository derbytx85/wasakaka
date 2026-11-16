// Wasakaka — Motor de cumplimiento legal (SB 541, ley de comida casera de Texas)
// REGLA DE ORO: este motor corre SOLO en el servidor (RF-C04: "el bloqueo es por
// reglas del servidor, no solo de pantalla").

export const CATEGORIAS_PERMITIDAS = [
  "panaderia",
  "reposteria",
  "dulces",
  "conservas",
  "refrigerados_tcs",
  "bebidas",
  "mezclas_secas",
] as const;

export type Categoria = (typeof CATEGORIAS_PERMITIDAS)[number];

export const CATEGORIA_LABEL: Record<string, string> = {
  panaderia: "Panadería",
  reposteria: "Repostería",
  dulces: "Dulces",
  conservas: "Conservas permitidas",
  refrigerados_tcs: "Refrigerados TCS",
  bebidas: "Bebidas sin alcohol",
  mezclas_secas: "Mezclas secas",
};

export const ALERGENOS_PERMITIDOS = [
  "Leche",
  "Huevo",
  "Gluten (trigo)",
  "Soya",
  "Maní",
  "Nueces",
  "Pescado",
  "Mariscos",
  "Sésamo",
] as const;

// Lista cerrada RF-C04: ingredientes que la ley de comida casera NO permite
// vender por internet. Se normalizan acentos y se buscan palabras completas.
const PROHIBIDOS: { regex: RegExp; ingrediente: string; explicacion: string }[] = [
  {
    regex: /\b(carne|res|vaca|beef|steak|arrachera|carnitas)\b/,
    ingrediente: "carne de res",
    explicacion:
      "Los platos con carne no están permitidos bajo la ley de comida casera de Texas (SB 541).",
  },
  {
    regex: /\b(pollo|chicken|gallina|pavo|turkey|guajolote)\b/,
    ingrediente: "pollo o pavo",
    explicacion:
      "Los platos con pollo o pavo no están permitidos bajo la ley de comida casera de Texas.",
  },
  {
    regex: /\b(cerdo|puerco|jam[oó]n|tocino|bacon|chorizo|salchicha|ham|pork|lengua| barbacoa)\b/,
    ingrediente: "cerdo o derivados",
    explicacion:
      "Los platos con cerdo (o sus derivados como jamón y chorizo) no están permitidos bajo la ley de comida casera de Texas.",
  },
  {
    regex: /\b(pescado|at[uú]n|salm[oó]n|fish|tuna|salmon|tilapia)\b/,
    ingrediente: "pescado",
    explicacion:
      "Los platos con pescado no están permitidos bajo la ley de comida casera de Texas.",
  },
  {
    regex: /\b(mariscos|camar[oó]n|camarones|ost[ió]n|ostra|mejill[oó]n|cangrejo|langosta|shrimp|seafood|calamar|pulpo)\b/,
    ingrediente: "mariscos",
    explicacion:
      "Los platos con mariscos no están permitidos bajo la ley de comida casera de Texas.",
  },
  {
    regex: /\b(helado|ice\s*cream|nieve( de|s)? crema)\b/,
    ingrediente: "helado",
    explicacion:
      "El helado exige cadena de frío y no está permitido bajo la ley de comida casera de Texas.",
  },
];

/** Normaliza el texto: minúsculas y sin acentos, para detectar palabras prohibidas. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface ResultadoCumplimiento {
  ok: boolean;
  violaciones: { ingrediente: string; explicacion: string }[];
  requiereDshs: boolean;
  mensajes: string[];
}

/**
 * Valida un plato antes de publicarlo (RF-C03, RF-C04, RF-C05).
 * Se llama desde POST /api/platos y PATCH /api/platos/:id.
 */
export function validarPlato(input: {
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  esTcs: boolean;
  ingredientes: string;
  alergenos: string[];
  cocineraVendeTcs: boolean;
  cocineraDshsVigente: boolean;
}): ResultadoCumplimiento {
  const mensajes: string[] = [];
  const violaciones: { ingrediente: string; explicacion: string }[] = [];

  // Campos obligatorios RF-C03
  const faltantes: string[] = [];
  if (!input.nombre?.trim()) faltantes.push("nombre");
  if (!input.descripcion?.trim()) faltantes.push("descripción");
  if (!input.precio || input.precio <= 0) faltantes.push("precio");
  if (!input.ingredientes?.trim()) faltantes.push("ingredientes");
  if (!input.alergenos || input.alergenos.length === 0) {
    // permitir "sin alérgenos" explícito: lista vacía = sin alérgenos declarados
    // pero el campo debe existir en el formulario; aquí no bloqueamos
  }
  if (faltantes.length > 0) {
    mensajes.push(
      `Faltan campos obligatorios: ${faltantes.join(", ")}. Sin ellos el plato no se puede publicar.`
    );
  }

  // Categoría de lista cerrada RF-C04
  if (!CATEGORIAS_PERMITIDAS.includes(input.categoria as Categoria)) {
    violaciones.push({
      ingrediente: "categoría no permitida",
      explicacion: `La categoría «${input.categoria}» no está en la lista de categorías publicables: ${CATEGORIAS_PERMITIDAS.map((c) => CATEGORIA_LABEL[c]).join(", ")}.`,
    });
  }

  // Ingredientes prohibidos RF-C04 (texto libre → búsqueda de palabras)
  const textoBusqueda = normalizar(
    `${input.nombre} ${input.descripcion} ${input.ingredientes}`
  );
  for (const prohibido of PROHIBIDOS) {
    // el regex original tiene acentos; probamos contra texto normalizado con versión sin acentos
    const patronSinAcentos = normalizar(prohibido.regex.source.replace(/[\u0300-\u036f]/g, ""));
    const re = new RegExp(patronSinAcentos.replace(/\\/g, "\\"), "i");
    if (re.test(textoBusqueda)) {
      violaciones.push({
        ingrediente: prohibido.ingrediente,
        explicacion: prohibido.explicacion,
      });
    }
  }

  // Regla TCS RF-C05
  if (input.esTcs) {
    if (!input.cocineraVendeTcs) {
      violaciones.push({
        ingrediente: "alimento TCS sin registro",
        explicacion:
          "Para vender refrigerados TCS (alimentos que exigen control de tiempo y temperatura) necesitas registrarte con el DSHS (Texas Department of State Health Services). Actualiza tu habilitación para vender este plato.",
      });
    } else if (!input.cocineraDshsVigente) {
      violaciones.push({
        ingrediente: "registro DSHS vencido",
        explicacion:
          "Tu registro del DSHS está vencido o pendiente de revisión. Renuévalo para publicar platos TCS.",
      });
    } else {
      mensajes.push(
        "Este plato TCS debe llevar etiqueta con fecha de elaboración e instrucción de manejo seguro."
      );
    }
  }

  return {
    ok: violaciones.length === 0 && mensajes.every((m) => !m.startsWith("Faltan")),
    violaciones,
    requiereDshs: input.esTcs,
    mensajes,
  };
}

/** ¿La tarjeta de manipulador está vencida o por vencer? (RF-C02) */
export function estadoTarjeta(tarjetaVence: Date | null | undefined): {
  diasRestantes: number | null;
  vencida: boolean;
  nivel: "ok" | "aviso" | "critico" | "vencida" | "sin_tarjeta";
} {
  if (!tarjetaVence) return { diasRestantes: null, vencida: true, nivel: "sin_tarjeta" };
  const dias = Math.ceil((tarjetaVence.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return { diasRestantes: dias, vencida: true, nivel: "vencida" };
  if (dias <= 3) return { diasRestantes: dias, vencida: false, nivel: "critico" };
  if (dias <= 30) return { diasRestantes: dias, vencida: false, nivel: "aviso" };
  return { diasRestantes: dias, vencida: false, nivel: "ok" };
}

// Tope legal de US$150.000 por AÑO CALENDARIO (RF-C10 + RF-I04).
// Se guarda en CENTAVOS: 150_000_000 ¢ = US$150,000. El contador se calcula
// sumando las ventas del año calendario en curso (por fecha de pedido) más el
// ajuste manual de ventas fuera de la plataforma (ver src/lib/ventas.ts):
// al cambiar el año, el contador arranca de cero de nuevo.
export const TOPE_VENTAS_ANUAL_CENTAVOS = 150_000_000;

/** Nivel del contador del tope legal RF-C10. Recibe centavos. */
export function nivelTopeVentas(ventasCentavos: number): {
  porcentaje: number;
  nivel: "ok" | "aviso80" | "critico95" | "tope";
} {
  const porcentaje = Math.min(100, (ventasCentavos / TOPE_VENTAS_ANUAL_CENTAVOS) * 100);
  if (porcentaje >= 100) return { porcentaje: 100, nivel: "tope" };
  if (porcentaje >= 95) return { porcentaje, nivel: "critico95" };
  if (porcentaje >= 80) return { porcentaje, nivel: "aviso80" };
  return { porcentaje, nivel: "ok" };
}

export const FRASE_LEGAL_ETIQUETA =
  "Hecho en una cocina casera que no es inspeccionada por el departamento de salud estatal o local.";

export const INSTRUCCION_TCS_ETIQUETA =
  "Manténgase refrigerado. Este alimento se elaboró en una cocina casera. Consuma antes de 7 días.";
