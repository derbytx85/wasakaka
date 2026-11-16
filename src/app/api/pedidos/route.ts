import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calcularDesglose,
  comisionAplicable,
  generarCodigoCierre,
  generarReferenciaPago,
  pasoHoraCorte,
  aCentavos,
  aDolares,
} from "@/lib/dinero";
import { TOPE_VENTAS_ANUAL_CENTAVOS } from "@/lib/cumplimiento";
import { ventasDelAno, ventasDelMes } from "@/lib/ventas";

// GET /api/pedidos?clienteId= | ?cocineraId=
// Exige un filtro de identidad: sin clienteId o cocineraId no devuelve nada.
// El teléfono del cliente solo viaja al rol que lo necesita durante la entrega
// (la cocinera). El rol cliente nunca recibe teléfonos.
// POST /api/pedidos (RF-P01, RF-I01) — crea el pedido Y calcula todo en el servidor.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const clienteId = sp.get("clienteId");
  const cocineraId = sp.get("cocineraId");
  const estado = sp.get("estado") ?? undefined;

  if (!clienteId && !cocineraId) {
    return NextResponse.json(
      { error: "Falta el filtro de identidad: clienteId o cocineraId." },
      { status: 400 }
    );
  }

  try {
    const pedidos = await db.pedido.findMany({
      where: {
        ...(clienteId ? { clienteId } : {}),
        ...(cocineraId ? { cocineraId } : {}),
        ...(estado && estado !== "todos" ? { estado } : {}),
      },
      include: {
        // teléfono del cliente solo para la cocinera (lo necesita en la entrega)
        cliente: { select: { nombre: true, ...(cocineraId ? { telefono: true } : {}) } },
        cocinera: {
          select: { id: true, usuario: { select: { nombre: true } } },
        },
        items: true,
        entrega: true,
        calificacion: true,
        agenda: { select: { fecha: true, horaCorte: true } },
      },
      orderBy: { fecha: "desc" },
      take: 100,
    });

    return NextResponse.json({
      pedidos: pedidos.map((p) => ({
        ...p,
        subtotal: aDolares(p.subtotal),
        impuesto: aDolares(p.impuesto),
        comision: aDolares(p.comision),
        netoCocinera: aDolares(p.netoCocinera),
        total: aDolares(p.total),
        items: p.items.map((i) => ({ ...i, precioUnitario: aDolares(i.precioUnitario) })),
      })),
    });
  } catch (e) {
    console.error("GET /api/pedidos", e);
    return NextResponse.json({ error: "No pudimos cargar los pedidos." }, { status: 500 });
  }
}

interface CuerpoPedido {
  clienteId: string;
  items: { platoId: string; cantidad: number }[];
  tipoEntrega: "entrega_cocinera" | "recogida";
  direccionEntrega?: string;
  zona: string;
  metodoPago: "tarjeta" | "efectivo";
  fechaEntrega: string; // fecha de la agenda elegida
  fechaEntregaPor?: Record<string, string>; // cocineraId → fecha (cuando hay varias cocineras)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CuerpoPedido;

    if (!body.clienteId || !body.items?.length || !body.fechaEntrega || !body.zona) {
      return NextResponse.json({ error: "Faltan datos del pedido." }, { status: 400 });
    }
    if (body.tipoEntrega === "entrega_cocinera" && !body.direccionEntrega?.trim()) {
      return NextResponse.json(
        { error: "Escribe la dirección de entrega para llevar tu pedido a la puerta." },
        { status: 400 }
      );
    }

    const cliente = await db.usuario.findUnique({ where: { id: body.clienteId } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    // Cargar platos y agrupar por cocinera (cada cocinera genera su pedido)
    const platos = await db.plato.findMany({
      where: { id: { in: body.items.map((i) => i.platoId) } },
      include: { cocinera: { include: { usuario: true } } },
    });

    const grupos = new Map<string, { plato: (typeof platos)[number]; cantidad: number }[]>();
    for (const item of body.items) {
      const plato = platos.find((p) => p.id === item.platoId);
      if (!plato || !plato.activo) {
        return NextResponse.json(
          { error: `Un plato de tu carrito ya no está disponible: ${item.platoId}` },
          { status: 409 }
        );
      }
      const lista = grupos.get(plato.cocineraId) ?? [];
      lista.push({ plato, cantidad: Math.max(1, Math.min(20, item.cantidad)) });
      grupos.set(plato.cocineraId, lista);
    }

    const pedidosCreados: {
      id: string;
      cocinera: string;
      total: number;
      codigoCierre: string;
      metodoPago: string;
    }[] = [];

    for (const [cocineraId, itemsGrupo] of grupos) {
      const cocinera = itemsGrupo[0].plato.cocinera;
      const fechaGrupo = body.fechaEntregaPor?.[cocineraId] ?? body.fechaEntrega;

      // La vitrina debe estar activa
      if (cocinera.estado !== "activa") {
        return NextResponse.json(
          {
            error: `La cocina de ${cocinera.usuario.nombre} está en pausa ahora mismo. Prueba otro día o otra cocinera.`,
          },
          { status: 409 }
        );
      }

      // Agenda activa del día elegido (RF-C07)
      const agenda = await db.agendaCocina.findFirst({
        where: { cocineraId, fecha: fechaGrupo, activa: true },
      });
      if (!agenda) {
        return NextResponse.json(
          {
            error: `${cocinera.usuario.nombre} no cocina el ${fechaGrupo}. Revisa los días disponibles.`,
          },
          { status: 409 }
        );
      }
      if (pasoHoraCorte(agenda.horaCorte, agenda.fecha)) {
        return NextResponse.json(
          {
            error: `Se pasó la hora de corte (${agenda.horaCorte}) para el ${fechaGrupo} con ${cocinera.usuario.nombre}. Elige el siguiente día disponible.`,
          },
          { status: 409 }
        );
      }
      const yaReservados = await db.pedido.count({
        where: { agendaId: agenda.id, estado: { notIn: ["cancelado"] } },
      });
      if (yaReservados >= agenda.capacidadPedidos) {
        return NextResponse.json(
          {
            error: `Se llenó la capacidad del ${fechaGrupo} con ${cocinera.usuario.nombre} (${agenda.capacidadPedidos} pedidos). ¡Prueba otro día!`,
          },
          { status: 409 }
        );
      }

      // Efectivo solo si la cocinera lo acepta (RF-P08)
      if (body.metodoPago === "efectivo" && !cocinera.aceptaEfectivo) {
        return NextResponse.json(
          { error: `${cocinera.usuario.nombre} no acepta efectivo en recogida.` },
          { status: 409 }
        );
      }
      if (body.metodoPago === "efectivo" && body.tipoEntrega !== "recogida") {
        return NextResponse.json(
          { error: "El efectivo solo está disponible para pedidos de recogida." },
          { status: 400 }
        );
      }

      // Dinero en CENTAVOS, calculado SOLO en el servidor (RF-P01/P03/I01)
      const subtotalCentavos = itemsGrupo.reduce(
        (acc, i) => acc + i.plato.precio * i.cantidad,
        0
      );
      const gravadoCentavos = itemsGrupo
        .filter((i) => i.plato.categoriaTributaria !== "exento")
        .reduce((acc, i) => acc + i.plato.precio * i.cantidad, 0);

      // Comisión: fuente única (8% estándar / 0% fundadoras en promoción, RF-P04)
      const ventasMesCentavos = await ventasDelMes(cocineraId);
      const comisionPct = comisionAplicable(cocinera, ventasMesCentavos);
      const desglose = calcularDesglose(aDolares(subtotalCentavos), comisionPct, {
        subtotalGravado: aDolares(gravadoCentavos),
      });

      // Tope legal anual de US$150.000 (RF-C10 + RF-I04): contador del año
      // calendario en curso (ventas en plataforma + ajuste manual), en el servidor.
      const contadorAno = await ventasDelAno(cocineraId);
      if (contadorAno.totalCentavos + subtotalCentavos > TOPE_VENTAS_ANUAL_CENTAVOS) {
        await db.cocinera.update({
          where: { id: cocineraId },
          data: { estado: "suspendida", motivoEstado: "Alcanzó el tope legal anual de US$150.000" },
        });
        return NextResponse.json(
          {
            error: `${cocinera.usuario.nombre} llegó a su tope legal de ventas del año (US$150.000). Su vitrina se pausó automáticamente.`,
          },
          { status: 409 }
        );
      }

      // Lotes reales (RF-C12 / RF-A03): si el plato requiere lote, debe existir
      // un registro de lote válido de esa cocinera; sin registro no se vende ese día.
      const itemsConLote: {
        platoId: string;
        nombrePlato: string;
        cantidad: number;
        precioUnitario: number;
        lote: string | null;
        loteId: string | null;
      }[] = [];
      for (const i of itemsGrupo) {
        if (i.plato.loteRequerido) {
          const registro = await db.registroLote.findFirst({
            where: { platoId: i.plato.id, cocineraId },
            orderBy: { fecha: "desc" },
          });
          if (!registro) {
            return NextResponse.json(
              {
                error: `${i.plato.nombre} requiere un registro de lote del día y ${cocinera.usuario.nombre} todavía no lo registró. El plato no se puede vender sin lote.`,
              },
              { status: 409 }
            );
          }
          itemsConLote.push({
            platoId: i.plato.id,
            nombrePlato: i.plato.nombre,
            cantidad: i.cantidad,
            precioUnitario: i.plato.precio,
            lote: registro.lote,
            loteId: registro.id,
          });
        } else {
          itemsConLote.push({
            platoId: i.plato.id,
            nombrePlato: i.plato.nombre,
            cantidad: i.cantidad,
            precioUnitario: i.plato.precio,
            lote: null,
            loteId: null,
          });
        }
      }

      const metodoPago = body.metodoPago;

      const pedido = await db.pedido.create({
        data: {
          clienteId: body.clienteId,
          cocineraId,
          agendaId: agenda.id,
          estado: "nuevo",
          tipoEntrega: body.tipoEntrega,
          metodoPago,
          direccionEntrega:
            body.tipoEntrega === "recogida"
              ? "Recoger en casa de la cocinera (te llega el punto de encuentro)"
              : body.direccionEntrega!.trim(),
          zona: body.zona,
          subtotal: aCentavos(desglose.subtotal),
          impuesto: aCentavos(desglose.impuesto),
          comision: aCentavos(desglose.comision),
          netoCocinera: aCentavos(desglose.netoCocinera),
          total: aCentavos(desglose.total),
          codigoCierre: generarCodigoCierre(),
          fechaEntrega: fechaGrupo,
          items: {
            create: itemsConLote,
          },
          ...(metodoPago === "tarjeta"
            ? {
                pago: {
                  create: {
                    referencia: generarReferenciaPago(),
                    estado: "pagado",
                    monto: aCentavos(desglose.total),
                    costoProcesamiento: aCentavos(desglose.costoProcesamiento),
                  },
                },
              }
            : {}),
        },
        include: { items: true },
      });

      pedidosCreados.push({
        id: pedido.id,
        cocinera: cocinera.usuario.nombre,
        total: aDolares(pedido.total),
        codigoCierre: pedido.codigoCierre,
        metodoPago,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        pedidos: pedidosCreados,
        mensaje:
          pedidosCreados.length > 1
            ? `Se crearon ${pedidosCreados.length} pedidos (uno por cocinera). Cada uno tiene su código de cierre.`
            : "¡Pedido enviado! La cocinera lo confirmará y te avisamos en la aplicación.",
        notificacion: `${pedidosCreados.length} pedido(s) creado(s)`,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/pedidos", e);
    return NextResponse.json({ error: "No pudimos crear el pedido." }, { status: 500 });
  }
}
