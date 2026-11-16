// Seed de Wasakaka — datos demo para el MVP
// Ejecutar: bun prisma/seed.ts
// Dinero: TODO en centavos (Int). La comisión sale de la fuente única
// (src/lib/dinero.ts): 8% estándar, 0% fundadoras en promoción de lanzamiento.
import { PrismaClient } from "@prisma/client";
import { calcularDesglose, comisionAplicable, aCentavos } from "../src/lib/dinero";

const db = new PrismaClient();

// helper: fecha YYYY-MM-DD local
function dia(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function enDias(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function claveMesActual(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  // limpiar en orden inverso de dependencias
  await db.suscripcion.deleteMany({});
  await db.registroLote.deleteMany({});
  await db.impuestoMensual.deleteMany({});
  await db.incidente.deleteMany({});
  await db.calificacion.deleteMany({});
  await db.entrega.deleteMany({});
  await db.pago.deleteMany({});
  await db.pedidoItem.deleteMany({});
  await db.pedido.deleteMany({});
  await db.agendaCocina.deleteMany({});
  await db.plato.deleteMany({});
  await db.cocinera.deleteMany({});
  await db.usuario.deleteMany({});
  console.log("Base limpia.");

  // ─── Admin ──────────────────────────────────────────────
  await db.usuario.create({
    data: {
      rol: "admin",
      nombre: "Familia Wasakaka",
      telefono: "+1 817 555 0001",
      correo: "familia@wasakaka.app",
      idioma: "es",
      zona: "Northside",
    },
  });

  // ─── Cocineras ──────────────────────────────────────────
  // Fundadoras: 0% de comisión por 6 meses (promoción de lanzamiento, RF-P04).
  // Salen antes si superan US$400 de ventas en un mes (lo revisa el servidor).
  const promoFundadora = { comisionPromo: 0, promoHasta: enDias(180) };

  // 1) Doña Rosa — Northside, panadería (activa, fundadora)
  const uRosa = await db.usuario.create({
    data: { rol: "cocinera", nombre: "Doña Rosa Hernández", telefono: "+1 817 555 0101", correo: "rosa@wasakaka.app", idioma: "es", zona: "Northside" },
  });
  const rosa = await db.cocinera.create({
    data: {
      usuarioId: uRosa.id,
      direccionCasa: "2612 N Main St, Fort Worth, TX (privada)",
      tarjetaManipuladorUrl: "/demo/tarjeta-rosa.pdf",
      tarjetaVence: enDias(400),
      estado: "activa",
      radioEntregaKm: 6,
      plan: "fundadora",
      ventasFueraPlataforma: 0,
      bio: "Pan dulce mexicano hecho en mi cocina, como el del pueblo. 22 años de experiencia.",
      fotoUrl: "/img/conchas.png",
      aceptaEfectivo: true,
      ...promoFundadora,
    },
  });

  // Panadería para llevar sin utensilios: exenta de impuesto (RF-I01)
  const pConchas = await db.plato.create({
    data: {
      cocineraId: rosa.id,
      nombre: "Conchas artesanales (4 pzas)",
      descripcion: "Pan dulce esponjoso con costra de azúcar, receta de mi abuela. Horneadas la mañana del mismo día.",
      precio: 600,
      categoria: "panaderia",
      categoriaTributaria: "exento",
      ingredientes: "Harina de trigo, azúcar, mantequilla, huevos, levadura, leche, esencia de vainilla, sal",
      alergenos: JSON.stringify(["Gluten (trigo)", "Huevo", "Leche"]),
      fotoUrl: "/img/conchas.png",
      activo: true,
    },
  });
  const pEmpanadas = await db.plato.create({
    data: {
      cocineraId: rosa.id,
      nombre: "Empanadas de piña (6 pzas)",
      descripcion: "Masa dorada rellena de mermelada casera de piña, espolvoreadas con azúcar.",
      precio: 900,
      categoria: "panaderia",
      categoriaTributaria: "exento",
      ingredientes: "Harina de trigo, mantequilla, azúcar, piña, canela, huevo",
      alergenos: JSON.stringify(["Gluten (trigo)", "Huevo", "Leche"]),
      fotoUrl: "/img/empanadas.png",
      activo: true,
    },
  });
  const pGalletas = await db.plato.create({
    data: {
      cocineraId: rosa.id,
      nombre: "Galletas de piloncillo (docena)",
      descripcion: "Crujientes por fuera, suaves por dentro, con piloncillo y canela de Molino.",
      precio: 1000,
      categoria: "dulces",
      ingredientes: "Harina de trigo, piloncillo, mantequilla, huevo, canela, polvo para hornear",
      alergenos: JSON.stringify(["Gluten (trigo)", "Huevo", "Leche"]),
      fotoUrl: "/img/galletas.png",
      activo: true,
    },
  });
  const pBunuelos = await db.plato.create({
    data: {
      cocineraId: rosa.id,
      nombre: "Buñuelos crujientes (8 pzas)",
      descripcion: "Delgados y crujientes, bañados en azúcar con canela. El antojo del domingo.",
      precio: 1200,
      categoria: "dulces",
      ingredientes: "Harina de trigo, azúcar, canela, aceite vegetal, sal",
      alergenos: JSON.stringify(["Gluten (trigo)"]),
      fotoUrl: "/img/bunuelos.png",
      activo: true,
    },
  });
  const pCafecito = await db.plato.create({
    data: {
      cocineraId: rosa.id,
      nombre: "Café de olla (1 litro)",
      descripcion: "Café de jarabe con piloncillo y canela, listo para servir. Viene caliente.",
      precio: 1400,
      categoria: "bebidas",
      ingredientes: "Café molido, piloncillo, canela de Ceilán, clavo de olor",
      alergenos: JSON.stringify([]),
      fotoUrl: "/img/cafecito.png",
      activo: true,
    },
  });

  // 2) Doña Mari — Diamond Hill, repostería (activa, regular, vende TCS con DSHS)
  const uMari = await db.usuario.create({
    data: { rol: "cocinera", nombre: "Doña María Guadalupe Pérez", telefono: "+1 817 555 0202", correo: "mari@wasakaka.app", idioma: "es", zona: "Diamond Hill" },
  });
  const mari = await db.cocinera.create({
    data: {
      usuarioId: uMari.id,
      direccionCasa: "4100 E Rosewood Ave, Fort Worth, TX (privada)",
      numeroDshs: "DSHS-CF-2026-014882",
      numeroDshsVence: enDias(300), // el registro DSHS vence por separado de la tarjeta
      vendeTcs: true,
      tarjetaManipuladorUrl: "/demo/tarjeta-mari.pdf",
      tarjetaVence: enDias(540),
      estado: "activa",
      radioEntregaKm: 8,
      plan: "regular",
      ventasFueraPlataforma: 0,
      bio: "Pasteles y postres por encargo para fiestas. Especialidad: tres leches.",
      fotoUrl: "/img/tres-leches.png",
    },
  });
  const pTresLeches = await db.plato.create({
    data: {
      cocineraId: mari.id,
      nombre: "Pastel tres leches (medio)",
      descripcion: "Bizcocho bañado en tres leches con crema batida. Se entrega refrigerado.",
      precio: 2800,
      categoria: "reposteria",
      esTcs: true,
      ingredientes: "Harina de trigo, huevo, azúcar, leche entera, leche condensada, leche evaporada, crema para batir, vainilla",
      alergenos: JSON.stringify(["Gluten (trigo)", "Huevo", "Leche"]),
      fotoUrl: "/img/tres-leches.png",
      activo: true,
    },
  });
  const pFlan = await db.plato.create({
    data: {
      cocineraId: mari.id,
      nombre: "Flan casero (2 pzas)",
      descripcion: "Textura sedosa con caramelo hecho en casa. Se entrega refrigerado.",
      precio: 1100,
      categoria: "reposteria",
      esTcs: true,
      ingredientes: "Huevo, leche entera, azúcar, leche condensada, vainilla",
      alergenos: JSON.stringify(["Huevo", "Leche"]),
      fotoUrl: "/img/flan.png",
      activo: true,
    },
  });

  // 3) Sra. Lupita — Stop Six, conservas y refrigerados TCS (activa, fundadora)
  const uLupita = await db.usuario.create({
    data: { rol: "cocinera", nombre: "Sra. Lupita Ramírez", telefono: "+1 817 555 0303", correo: "lupita@wasakaka.app", idioma: "es", zona: "Stop Six" },
  });
  const lupita = await db.cocinera.create({
    data: {
      usuarioId: uLupita.id,
      direccionCasa: "5901 resultant Dr, Fort Worth, TX (privada)",
      numeroDshs: "DSHS-CF-2026-019374",
      numeroDshsVence: enDias(420),
      vendeTcs: true,
      tarjetaManipuladorUrl: "/demo/tarjeta-lupita.pdf",
      tarjetaVence: enDias(120),
      estado: "activa",
      radioEntregaKm: 5,
      plan: "fundadora",
      ventasFueraPlataforma: 0,
      bio: "Encurtidos y tamales de olla. Todo con fecha y lote registrados.",
      fotoUrl: "/img/tamales.png",
      aceptaEfectivo: true,
      ...promoFundadora,
    },
  });
  const pTamales = await db.plato.create({
    data: {
      cocineraId: lupita.id,
      nombre: "Tamales de queso y rajas (6 pzas)",
      descripcion: "Masa de maíz nixtamalizado con queso Oaxaca y rajas poblanas. Calientes al entrega.",
      precio: 1800,
      categoria: "refrigerados_tcs",
      esTcs: true,
      ingredientes: "Masa de maíz, manteca vegetal, queso Oaxaca (leche), chile poblano, cebolla, sal, hoja de maíz",
      alergenos: JSON.stringify(["Leche"]),
      fotoUrl: "/img/tamales.png",
      activo: true,
    },
  });
  const pEncurtidos = await db.plato.create({
    data: {
      cocineraId: lupita.id,
      nombre: "Jalapeños y zanahoria encurtidos (frasco 500 ml)",
      descripcion: "Ensalada de encurtidos al estilo del mercado, con vinagre casero y especias.",
      precio: 850,
      categoria: "conservas",
      ingredientes: "Jalapeño, zanahoria, cebolla, vinagre blanco, ajo, laurel, pimienta negra, sal",
      alergenos: JSON.stringify([]),
      fotoUrl: "/img/encurtidos.png",
      activo: true,
      loteRequerido: true,
    },
  });

  // 4) Carmen — pendiente de aprobación (para la cola del admin)
  const uCarmen = await db.usuario.create({
    data: { rol: "cocinera", nombre: "Carmen Delgado", telefono: "+1 817 555 0404", correo: "carmen@wasakaka.app", idioma: "es", zona: "Como" },
  });
  await db.cocinera.create({
    data: {
      usuarioId: uCarmen.id,
      direccionCasa: "5100 Clovernoll Dr, Fort Worth, TX (privada)",
      tarjetaManipuladorUrl: "/demo/tarjeta-carmen.pdf",
      tarjetaVence: enDias(700),
      estado: "pendiente",
      radioEntregaKm: 4,
      plan: "fundadora",
      ventasFueraPlataforma: 0,
      bio: "Postres y gelatinas artísticas para cumpleaños.",
      ...promoFundadora,
    },
  });

  // ─── Agendas (hoy y mañana para las activas) ─────────────
  for (const c of [rosa, mari, lupita]) {
    for (const d of [0, 1]) {
      await db.agendaCocina.create({
        data: {
          cocineraId: c.id,
          fecha: dia(d),
          horaCorte: d === 0 ? "18:00" : "14:00",
          capacidadPedidos: 10,
          activa: true,
        },
      });
    }
  }

  // ─── Clientes ────────────────────────────────────────────
  const cliente = await db.usuario.create({
    data: { rol: "cliente", nombre: "Marcos Jr.", telefono: "+1 817 555 0505", correo: "marcos@wasakaka.app", idioma: "es", zona: "Northside" },
  });
  const vecina = await db.usuario.create({
    data: { rol: "cliente", nombre: "Sra. Ana Torres", telefono: "+1 817 555 0606", correo: "ana@wasakaka.app", idioma: "es", zona: "Northside" },
  });

  // ─── Registro de lote real (RF-C12): debe existir ANTES del pedido ──
  const loteEncurtidos = await db.registroLote.create({
    data: { cocineraId: lupita.id, platoId: pEncurtidos.id, lote: "ENC-2026-1114", ph: 3.9 },
  });

  // ─── Pedidos demo en distintos estados ───────────────────
  // Desglose con la fuente única: fundadoras 0%, regular 8%.
  function montos(subtotalDolares: number, comisionPct: number, gravadoDolares?: number) {
    const d = calcularDesglose(subtotalDolares, comisionPct, gravadoDolares != null ? { subtotalGravado: gravadoDolares } : undefined);
    return {
      pedido: {
        subtotal: aCentavos(d.subtotal),
        impuesto: aCentavos(d.impuesto),
        comision: aCentavos(d.comision),
        netoCocinera: aCentavos(d.netoCocinera),
        total: aCentavos(d.total),
      },
      costoProcesamiento: aCentavos(d.costoProcesamiento),
    };
  }
  const pctFundadora = comisionAplicable({ comisionPromo: 0, promoHasta: enDias(180) });
  const pctRegular = comisionAplicable({ comisionPromo: null, promoHasta: null });

  // Pedido entregado de ayer (con calificación) — Rosa (fundadora: 0%)
  const m1 = montos(6 + 14, pctFundadora, 14); // conchas exentas, café gravado
  const ped1 = await db.pedido.create({
    data: {
      clienteId: vecina.id,
      cocineraId: rosa.id,
      estado: "entregado",
      tipoEntrega: "entrega_cocinera",
      direccionEntrega: "2811 Octavia St, Fort Worth, TX",
      zona: "Northside",
      ...m1.pedido,
      codigoCierre: "4821",
      fecha: enDias(-1),
      fechaEntrega: dia(-1),
      items: {
        create: [
          { platoId: pConchas.id, nombrePlato: pConchas.nombre, cantidad: 1, precioUnitario: 600 },
          { platoId: pCafecito.id, nombrePlato: pCafecito.nombre, cantidad: 1, precioUnitario: 1400 },
        ],
      },
      pago: {
        create: { referencia: "pi_demo_0001", estado: "pagado", monto: m1.pedido.total, costoProcesamiento: m1.costoProcesamiento },
      },
      entrega: { create: { progreso: 1, horaSalida: enDias(-1), horaEntrega: enDias(-1) } },
    },
  });
  await db.calificacion.create({
    data: { pedidoId: ped1.id, clienteId: vecina.id, cocineraId: rosa.id, estrellas: 5, comentario: "Las conchas calientitas y el café de olla increíble." },
  });

  // Pedido en entrega — Mari (regular: 8%)
  const m2 = montos(28, pctRegular);
  await db.pedido.create({
    data: {
      clienteId: cliente.id,
      cocineraId: mari.id,
      estado: "en_entrega",
      tipoEntrega: "entrega_cocinera",
      direccionEntrega: "2804 Denton Dr, Fort Worth, TX",
      zona: "Northside",
      ...m2.pedido,
      codigoCierre: "7319",
      fechaEntrega: dia(0),
      items: { create: [{ platoId: pTresLeches.id, nombrePlato: pTresLeches.nombre, cantidad: 1, precioUnitario: 2800 }] },
      pago: { create: { referencia: "pi_demo_0002", estado: "pagado", monto: m2.pedido.total, costoProcesamiento: m2.costoProcesamiento } },
      entrega: { create: { horaSalida: new Date() } },
    },
  });

  // Pedido en cocina — Lupita (fundadora: 0%; el encurtido lleva su lote REAL)
  const m3 = montos(18 + 8.5, pctFundadora);
  await db.pedido.create({
    data: {
      clienteId: cliente.id,
      cocineraId: lupita.id,
      estado: "en_cocina",
      tipoEntrega: "recogida",
      direccionEntrega: "Recoger en casa de la cocinera",
      zona: "Stop Six",
      ...m3.pedido,
      codigoCierre: "1562",
      fechaEntrega: dia(0),
      items: {
        create: [
          { platoId: pTamales.id, nombrePlato: pTamales.nombre, cantidad: 1, precioUnitario: 1800 },
          {
            platoId: pEncurtidos.id,
            nombrePlato: pEncurtidos.nombre,
            cantidad: 1,
            precioUnitario: 850,
            lote: loteEncurtidos.lote,
            loteId: loteEncurtidos.id,
          },
        ],
      },
      pago: { create: { referencia: "pi_demo_0003", estado: "pagado", monto: m3.pedido.total, costoProcesamiento: m3.costoProcesamiento } },
    },
  });

  // Pedido nuevo sin confirmar (alerta del admin) — Rosa (fundadora: 0%)
  const m4 = montos(9, pctFundadora);
  await db.pedido.create({
    data: {
      clienteId: vecina.id,
      cocineraId: rosa.id,
      estado: "nuevo",
      tipoEntrega: "entrega_cocinera",
      direccionEntrega: "3120 Prather St, Fort Worth, TX",
      zona: "Northside",
      ...m4.pedido,
      codigoCierre: "9034",
      fechaEntrega: dia(1),
      items: { create: [{ platoId: pEmpanadas.id, nombrePlato: pEmpanadas.nombre, cantidad: 1, precioUnitario: 900 }] },
      pago: { create: { referencia: "pi_demo_0004", estado: "pagado", monto: m4.pedido.total, costoProcesamiento: m4.costoProcesamiento } },
    },
  });

  // ─── Suscripciones reales (RF-P05): activas, sin cobros aún (demo) ──
  const periodo = claveMesActual();
  await db.suscripcion.create({ data: { cocineraId: rosa.id, monto: 1900, estado: "activa", periodo } });
  await db.suscripcion.create({ data: { cocineraId: mari.id, monto: 2900, estado: "activa", periodo } });
  await db.suscripcion.create({ data: { cocineraId: lupita.id, monto: 1900, estado: "activa", periodo } });

  // ─── Impuestos del mes anterior (cierre demo) ────────────
  const hoy = new Date();
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const claveMes = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;
  await db.impuestoMensual.create({
    data: {
      mes: claveMes,
      totalVentas: 1587240,
      impuestoCobrado: 130947,
      impuestoRemitido: 130947,
      comprobante: "TX-WEBFILE-" + claveMes,
    },
  });

  console.log("Seed completo: 3 cocineras activas + 1 pendiente, 9 platos, agendas, 4 pedidos demo (montos en centavos, comisión 8% / 0% fundadoras).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
