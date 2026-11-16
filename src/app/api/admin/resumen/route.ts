import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estadoTarjeta } from "@/lib/cumplimiento";
import { aDolares } from "@/lib/dinero";

// GET /api/admin/resumen (RF-A01–A06)
// Panel de la familia: aprobaciones, operación del día, incidentes,
// dinero e impuestos del mes, y métricas mínimas.
// Reglas: la comisión se suma del campo Pedido.comision YA almacenado (sin
// recalcular); las suscripciones se suman solo de cobros reales (RF-P05);
// el dinero sale en dólares (la base guarda centavos).

export async function GET() {
  try {
    const hoy = new Date();
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const claveMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

    // RF-A01: cola de cocineras pendientes
    const pendientes = await db.cocinera.findMany({
      where: { estado: "pendiente" },
      include: { usuario: true },
    });

    // RF-A01: platos nuevos de cocineras recién aprobadas (revisión humana anti-prohibidos)
    const hace30dias = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const cocinerasNuevas = await db.cocinera.findMany({
      where: { updatedAt: { gte: hace30dias }, estado: "activa" },
      include: { usuario: true },
    });
    const idsNuevas = new Set(cocinerasNuevas.map((c) => c.id));
    const platosRecientes = (await db.plato.findMany({
      where: { createdAt: { gte: hace30dias }, cocineraId: { in: [...idsNuevas] } },
      include: { cocinera: { include: { usuario: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    })).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      cocinera: p.cocinera.usuario.nombre,
      categoria: p.categoria,
      ingredientes: p.ingredientes,
      activo: p.activo,
      createdAt: p.createdAt,
    }));

    // RF-A02: pedidos del día
    const pedidosHoy = await db.pedido.findMany({
      where: { fecha: { gte: inicioDia } },
      include: {
        cliente: { select: { nombre: true } },
        cocinera: { select: { usuario: { select: { nombre: true } } } },
        agenda: { select: { fecha: true, horaCorte: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const pedidosActivos = pedidosHoy.filter(
      (p) => !["entregado", "cancelado"].includes(p.estado)
    );

    // alertas RF-A02: pedidos sin confirmar cerca de la hora de corte
    const alertasCorte = pedidosActivos
      .filter((p) => p.estado === "nuevo" && p.agenda)
      .map((p) => {
        const [hh, mm] = p.agenda!.horaCorte.split(":").map(Number);
        const corte = new Date();
        corte.setHours(hh, mm, 0, 0);
        const minutos = Math.round((corte.getTime() - Date.now()) / 60000);
        return minutos <= 30 && minutos > 0
          ? { pedidoId: p.id, texto: `Pedido sin confirmar a ${minutos} min de la hora de corte` }
          : null;
      })
      .filter(Boolean);

    // RF-A03: incidentes abiertos
    const incidentes = await db.incidente.findMany({
      where: { estado: { not: "cerrado" } },
      include: {
        pedido: {
          include: {
            cocinera: { select: { usuario: { select: { nombre: true } } } },
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // RF-A04: dinero — la comisión se suma del campo YA almacenado en cada pedido
    const pagosMes = await db.pago.findMany({
      where: { createdAt: { gte: inicioMes }, estado: "pagado" },
    });
    const pedidosMes = await db.pedido.findMany({
      where: { fecha: { gte: inicioMes }, estado: { not: "cancelado" } },
    });
    const comisionMesCentavos = Math.round(pedidosMes.reduce((a, p) => a + p.comision, 0));
    const procesamientoMesCentavos = Math.round(
      pagosMes.reduce((a, p) => a + p.costoProcesamiento, 0)
    );
    const impuestoMesCentavos = Math.round(pedidosMes.reduce((a, p) => a + p.impuesto, 0));

    // RF-P05: suscripciones reales — se suma SOLO lo cobrado en la base este período.
    const cobradasMes = await db.suscripcion.findMany({
      where: { estado: "cobrada", periodo: claveMes },
    });
    const ingresoSuscripcionesCentavos = Math.round(
      cobradasMes.reduce((a, s) => a + s.monto, 0)
    );
    const suscripcionesActivas = await db.suscripcion.count({ where: { estado: "activa" } });

    // RF-I02/I03: impuesto aparte + cierres mensuales guardados
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const claveMesAnterior = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;
    const impuestoAnterior = await db.impuestoMensual.findUnique({
      where: { mes: claveMesAnterior },
    });
    const cierreActual = await db.impuestoMensual.findUnique({
      where: { mes: claveMes },
    });

    // RF-A06: métricas mínimas
    const cocinerasActivas = await db.cocinera.count({ where: { estado: "activa" } });
    const ventasPorZona = new Map<string, { pedidos: number; totalCentavos: number }>();
    for (const p of pedidosMes) {
      const z = ventasPorZona.get(p.zona) ?? { pedidos: 0, totalCentavos: 0 };
      z.pedidos += 1;
      z.totalCentavos += p.subtotal;
      ventasPorZona.set(p.zona, z);
    }
    const ventaPromedioCentavos =
      pedidosMes.length > 0
        ? Math.round(pedidosMes.reduce((a, p) => a + p.subtotal, 0) / pedidosMes.length)
        : 0;

    const convPedidosHoy = (p: (typeof pedidosHoy)[number]) => ({
      id: p.id,
      estado: p.estado,
      cliente: p.cliente.nombre,
      cocinera: p.cocinera.usuario.nombre,
      total: aDolares(p.total),
      subtotal: aDolares(p.subtotal),
      comision: aDolares(p.comision),
      netoCocinera: aDolares(p.netoCocinera),
      tipoEntrega: p.tipoEntrega,
      metodoPago: p.metodoPago,
      fechaEntrega: p.fechaEntrega,
      horaCorte: p.agenda?.horaCorte,
    });

    return NextResponse.json({
      pendientes: pendientes.map((c) => ({
        id: c.id,
        nombre: c.usuario.nombre,
        telefono: c.usuario.telefono,
        zona: c.usuario.zona,
        vendeTcs: c.vendeTcs,
        numeroDshs: c.numeroDshs,
        numeroDshsVence: c.numeroDshsVence,
        tarjeta: c.tarjetaManipuladorUrl,
        tarjetaVence: c.tarjetaVence,
        tarjetaEstado: estadoTarjeta(c.tarjetaVence).nivel,
        radioEntregaKm: c.radioEntregaKm,
        plan: c.plan,
        bio: c.bio,
      })),
      platosRecientes,
      pedidosHoy: pedidosHoy.map(convPedidosHoy),
      alertasCorte,
      incidentes,
      dinero: {
        ventasMes: aDolares(Math.round(pedidosMes.reduce((a, p) => a + p.subtotal, 0))),
        comisionMes: aDolares(comisionMesCentavos),
        procesamientoMes: aDolares(procesamientoMesCentavos),
        margenMes: aDolares(comisionMesCentavos - procesamientoMesCentavos),
        impuestoMesApartado: aDolares(impuestoMesCentavos),
        suscripcionesActivas,
        ingresoSuscripcionesMes: aDolares(ingresoSuscripcionesCentavos),
        // honestidad (RF-P05): si no hay cobros reales, la UI lo rótula demo
        suscripcionesSinCobrosReales: cobradasMes.length === 0,
      },
      impuestos: {
        mesActual: claveMes,
        mesActualCobrado: aDolares(impuestoMesCentavos),
        cierreActual: cierreActual
          ? {
              totalVentas: aDolares(cierreActual.totalVentas),
              impuestoCobrado: aDolares(cierreActual.impuestoCobrado),
              impuestoRemitido: aDolares(cierreActual.impuestoRemitido),
              comprobante: cierreActual.comprobante,
            }
          : null,
        mesAnterior: impuestoAnterior
          ? {
              mes: impuestoAnterior.mes,
              totalVentas: aDolares(impuestoAnterior.totalVentas),
              impuestoCobrado: aDolares(impuestoAnterior.impuestoCobrado),
              impuestoRemitido: aDolares(impuestoAnterior.impuestoRemitido),
              comprobante: impuestoAnterior.comprobante,
            }
          : null,
      },
      metricas: {
        cocinerasActivas,
        pedidosMes: pedidosMes.length,
        ventaPromedio: aDolares(ventaPromedioCentavos),
        ventasPorZona: [...ventasPorZona.entries()].map(([zona, v]) => ({
          zona,
          pedidos: v.pedidos,
          total: aDolares(v.totalCentavos),
        })),
      },
    });
  } catch (e) {
    console.error("GET /api/admin/resumen", e);
    return NextResponse.json({ error: "No pudimos cargar el panel." }, { status: 500 });
  }
}
