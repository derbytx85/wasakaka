// Panel de administración — VISTA PREVIA con Astryx (sistema de diseño de
// Meta, el mismo que la app usa por dentro en Facebook).
//
// Ruta independiente /panel-astryx: lee la MISMA base de datos y las mismas
// reglas del panel actual (comisión ya almacenada en el pedido, dinero en
// centavos convertido solo al mostrar), pero presenta todo con los
// componentes de Astryx: tarjetas de métricas, tabla de datos real e
// insignias de estado por color. No reemplaza todavía al «Panel de la
// familia»: es la primera pantalla de la migración gradual, para comparar.
import { db } from "@/lib/db";
import { aDolares } from "@/lib/dinero";
import { estadoTarjeta, CATEGORIA_LABEL } from "@/lib/cumplimiento";
import { Card } from "@astryxdesign/core/Card";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { TablaPedidos, type FilaPedido } from "./tabla-pedidos";
import {
  TablaIncidentes,
  TablaAprobaciones,
  TablaPlatosRevisar,
  TablaConciliacion,
  TablaZonas,
  type FilaIncidente,
  type FilaAprobacion,
  type FilaPlatoRevisar,
  type FilaConciliacion,
  type FilaZona,
} from "./tablas-extra";

export const dynamic = "force-dynamic";

const dinero = (centavos: number) => `$${aDolares(centavos).toFixed(2)}`;

function Metrica({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
}) {
  return (
    <Card padding={4}>
      <Text type="supporting">{etiqueta}</Text>
      <Heading level={3}>{valor}</Heading>
      <Text type="supporting">{nota}</Text>
    </Card>
  );
}

export default async function PanelAstryx() {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const hoy = new Date();
  const claveMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const fechaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const claveMesAnterior = `${fechaMesAnterior.getFullYear()}-${String(fechaMesAnterior.getMonth() + 1).padStart(2, "0")}`;
  const hace30dias = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    pedidosHoy,
    pedidosMes,
    activas,
    pendientes,
    incidentes,
    recientes,
    incidentesAbiertos,
    cocinerasPendientes,
    pagosMes,
    cobradasMes,
    suscripcionesActivas,
    cierreActual,
    impuestoAnterior,
    cocinerasNuevas,
    pedidosHoyFull,
  ] = await Promise.all([
      db.pedido.count({ where: { fecha: { gte: inicioDia } } }),
      // RF-A04: el dinero del mes sale de los pedidos NO cancelados; la
      // comisión se suma del campo ya almacenado en cada pedido.
      db.pedido.findMany({
        where: { fecha: { gte: inicioMes }, estado: { not: "cancelado" } },
      }),
      db.cocinera.count({ where: { estado: "activa" } }),
      db.cocinera.count({ where: { estado: "pendiente" } }),
      db.incidente.count({ where: { estado: "abierto" } }),
      db.pedido.findMany({
        orderBy: { fecha: "desc" },
        take: 12,
        include: {
          cliente: { select: { nombre: true } },
          cocinera: { include: { usuario: { select: { nombre: true } } } },
        },
      }),
      db.incidente.findMany({
        where: { estado: { not: "cerrado" } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          pedido: {
            include: {
              cocinera: { include: { usuario: { select: { nombre: true } } } },
            },
          },
        },
      }),
      db.cocinera.findMany({
        where: { estado: "pendiente" },
        orderBy: { createdAt: "asc" },
        include: { usuario: { select: { nombre: true } } },
      }),
      db.pago.findMany({
        where: { createdAt: { gte: inicioMes }, estado: "pagado" },
      }),
      // RF-P05: suscripciones SOLO desde cobros reales guardados en la base.
      db.suscripcion.findMany({
        where: { estado: "cobrada", periodo: claveMes },
      }),
      db.suscripcion.count({ where: { estado: "activa" } }),
      // RF-I02/I03: cierres mensuales de impuesto ya guardados.
      db.impuestoMensual.findUnique({ where: { mes: claveMes } }),
      db.impuestoMensual.findUnique({ where: { mes: claveMesAnterior } }),
      db.cocinera.findMany({
        where: { updatedAt: { gte: hace30dias }, estado: "activa" },
        select: { id: true },
      }),
      db.pedido.findMany({
        where: { fecha: { gte: inicioDia } },
        include: {
          agenda: { select: { fecha: true, horaCorte: true } },
        },
      }),
    ]);

  const platosRecientesLista = await db.plato.findMany({
    where: {
      createdAt: { gte: hace30dias },
      cocineraId: { in: cocinerasNuevas.map((c) => c.id) },
    },
    include: { cocinera: { include: { usuario: { select: { nombre: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Dinero del mes (mismas reglas que el panel actual).
  const ventasSubtotal = Math.round(
    pedidosMes.reduce((a, p) => a + p.subtotal, 0),
  );
  const comisionMes = Math.round(pedidosMes.reduce((a, p) => a + p.comision, 0));
  const impuestoMes = Math.round(pedidosMes.reduce((a, p) => a + p.impuesto, 0));
  const procesamientoMes = Math.round(
    pagosMes.reduce((a, p) => a + p.costoProcesamiento, 0),
  );
  const ingresoSuscripciones = Math.round(
    cobradasMes.reduce((a, s) => a + s.monto, 0),
  );
  const ventaPromedio =
    pedidosMes.length > 0 ? Math.round(ventasSubtotal / pedidosMes.length) : 0;

  const zonasMap = new Map<string, { pedidos: number; total: number }>();
  for (const p of pedidosMes) {
    const z = zonasMap.get(p.zona) ?? { pedidos: 0, total: 0 };
    z.pedidos += 1;
    z.total += p.subtotal;
    zonasMap.set(p.zona, z);
  }
  const filasZonas: FilaZona[] = [...zonasMap.entries()].map(([zona, v]) => ({
    id: zona,
    zona,
    pedidos: String(v.pedidos),
    total: dinero(v.total),
  }));

  // Alertas RF-A02: pedidos de hoy sin confirmar, a 30 min o menos del corte.
  const alertas = pedidosHoyFull
    .filter((p) => p.estado === "nuevo" && p.agenda)
    .map((p) => {
      const [hh, mm] = p.agenda!.horaCorte.split(":").map(Number);
      const corte = new Date();
      corte.setHours(hh, mm, 0, 0);
      const minutos = Math.round((corte.getTime() - Date.now()) / 60000);
      return minutos <= 30 && minutos > 0
        ? {
            id: p.id,
            texto: `Pedido sin confirmar a ${minutos} min de la hora de corte (${p.agenda!.horaCorte})`,
          }
        : null;
    })
    .filter((a): a is { id: string; texto: string } => a !== null);

  const filasPlatosRevisar: FilaPlatoRevisar[] = platosRecientesLista.map(
    (p) => ({
      id: p.id,
      nombre: p.nombre,
      cocinera: p.cocinera.usuario.nombre,
      categoria: CATEGORIA_LABEL[p.categoria] ?? p.categoria,
      ingredientes:
        p.ingredientes.length > 90
          ? `${p.ingredientes.slice(0, 90)}…`
          : p.ingredientes,
      activo: p.activo,
    }),
  );

  const filasConciliacion: FilaConciliacion[] = [
    {
      id: "ventas",
      concepto: "Ventas del mes",
      detalle: "Subtotal de los pedidos, sin contar el impuesto",
      monto: dinero(ventasSubtotal),
    },
    {
      id: "comision",
      concepto: "Comisión Wasakaka",
      detalle: "8% por venta; 0% en fundadoras durante su promoción",
      monto: dinero(comisionMes),
    },
    {
      id: "procesamiento",
      concepto: "Procesamiento de pagos",
      detalle: "Costo de las tarjetas cobradas este mes",
      monto: dinero(procesamientoMes),
    },
    {
      id: "margen",
      concepto: "Margen Wasakaka",
      detalle: "Comisión menos procesamiento",
      monto: dinero(comisionMes - procesamientoMes),
    },
    {
      id: "impuesto",
      concepto: "Impuesto apartado",
      detalle: "Se remite al Estado: nunca se mezcla con los ingresos",
      monto: dinero(impuestoMes),
    },
    {
      id: "suscripciones",
      concepto: "Suscripciones cobradas",
      detalle:
        cobradasMes.length === 0
          ? "Sin cobros reales este mes (demo: no se simulan ingresos)"
          : `${cobradasMes.length} cobro(s) reales este mes`,
      monto: dinero(ingresoSuscripciones),
    },
  ];

  const filas: FilaPedido[] = recientes.map((p) => ({
    id: p.id,
    hora: p.fecha.toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    cliente: p.cliente.nombre,
    cocinera: p.cocinera.usuario.nombre,
    entrega: p.tipoEntrega === "recogida" ? "Recogida" : "Entrega a domicilio",
    total: dinero(p.total),
    comision: dinero(p.comision),
    estado: p.estado,
  }));

  const filasIncidentes: FilaIncidente[] = incidentesAbiertos.map((i) => ({
    id: i.id,
    fecha: i.createdAt.toLocaleDateString("es", {
      day: "2-digit",
      month: "2-digit",
    }),
    cocinera: i.pedido.cocinera.usuario.nombre,
    tipo: i.tipo,
    descripcion:
      i.descripcion.length > 80
        ? `${i.descripcion.slice(0, 80)}…`
        : i.descripcion,
    estado: i.estado,
  }));

  const filasAprobaciones: FilaAprobacion[] = cocinerasPendientes.map(
    (c) => ({
      id: c.id,
      nombre: c.usuario.nombre,
      desde: c.createdAt.toLocaleDateString("es", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      plan: c.plan,
      tarjetaNivel: estadoTarjeta(c.tarjetaVence).nivel,
      vendeTcs: c.vendeTcs,
      tieneDshs: Boolean(c.numeroDshs),
    }),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>Panel de administración</Heading>
        <Badge variant="teal" label="Vista previa · Astryx" />
      </div>
      <Text type="supporting">
        La misma información del panel de la familia, con los componentes del
        sistema de diseño de Meta. Datos reales de esta demo, en vivo.
      </Text>

      {alertas.length > 0 && (
        <div className="mt-4">
          <Card padding={4}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="warning" label="Hora de corte cerca" />
              <Text type="supporting">
                {alertas.map((a) => a.texto).join(" · ")}
              </Text>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          etiqueta="Pedidos de hoy"
          valor={String(pedidosHoy)}
          nota="Desde las 00:00 de hoy"
        />
        <Metrica
          etiqueta="Ventas del mes"
          valor={dinero(ventasSubtotal)}
          nota={`Comisión Wasakaka: ${dinero(comisionMes)}`}
        />
        <Metrica
          etiqueta="Cocineras activas"
          valor={String(activas)}
          nota={
            pendientes > 0
              ? `${pendientes} esperando aprobación`
              : "Sin aprobaciones pendientes"
          }
        />
        <Metrica
          etiqueta="Incidentes abiertos"
          valor={String(incidentes)}
          nota={
            incidentes > 0 ? "Requieren atención" : "Todo tranquilo por aquí"
          }
        />
      </div>

      <div className="mt-8">
        <Heading level={2}>Pedidos recientes</Heading>
        <Text type="supporting">
          El estado se distingue por color: amarillo cuando hay que actuar,
          colores fríos cuando el pedido avanza, gris cuando ya cerró.
        </Text>
        <div className="mt-3">
          <TablaPedidos filas={filas} />
        </div>
      </div>

      <div className="mt-8">
        <Heading level={2}>Incidentes abiertos</Heading>
        <Text type="supporting">
          Salud en rojo, calidad en amarillo: lo urgente se ve antes de leer.
        </Text>
        <div className="mt-3">
          {filasIncidentes.length > 0 ? (
            <TablaIncidentes filas={filasIncidentes} />
          ) : (
            <Text type="supporting">Sin incidentes abiertos. 🎉</Text>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Heading level={2}>Esperando aprobación</Heading>
        <Text type="supporting">
          El cumplimiento de cada cocinera en dos insignias: tarjeta de
          manipulador de alimentos y registro DSHS (Departamento de Salud del
          Estado de Texas) cuando vende comida refrigerada.
        </Text>
        <div className="mt-3">
          {filasAprobaciones.length > 0 ? (
            <TablaAprobaciones filas={filasAprobaciones} />
          ) : (
            <Text type="supporting">Nadie espera aprobación.</Text>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Heading level={2}>Platos nuevos a revisar</Heading>
        <Text type="supporting">
          Platos de cocineras en sus primeros 30 días: la segunda capa contra
          categorías prohibidas por la ley de comida casera de Texas — ojo con
          ingredientes de carne.
        </Text>
        <div className="mt-3">
          {filasPlatosRevisar.length > 0 ? (
            <TablaPlatosRevisar filas={filasPlatosRevisar} />
          ) : (
            <Text type="supporting">
              Sin platos nuevos de cocineras recientes.
            </Text>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Heading level={2}>Conciliación del mes</Heading>
        <Text type="supporting">
          El dinero separado por naturaleza. Suscripciones activas hoy:{" "}
          {suscripcionesActivas}.
        </Text>
        <div className="mt-3">
          <TablaConciliacion filas={filasConciliacion} />
        </div>
      </div>

      <div className="mt-8">
        <Heading level={2}>Impuesto de ventas</Heading>
        <Text type="supporting">
          El impuesto se aparta de las ventas: nunca se mezcla con los
          ingresos. Cobrado este mes ({claveMes}): {dinero(impuestoMes)}.
        </Text>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Card padding={4}>
            <Text type="supporting">Cierre de este mes</Text>
            {cierreActual ? (
              <>
                <Heading level={3}>{dinero(cierreActual.impuestoCobrado)}</Heading>
                <Text type="supporting">
                  Ventas del cierre: {dinero(cierreActual.totalVentas)} ·
                  Remitido: {dinero(cierreActual.impuestoRemitido)}
                </Text>
                <Badge
                  variant="info"
                  label={`Comprobante ${cierreActual.comprobante}`}
                />
              </>
            ) : (
              <Text type="supporting">
                Aún no hay un cierre guardado para este mes.
              </Text>
            )}
          </Card>
          <Card padding={4}>
            <Text type="supporting">Mes anterior ({claveMesAnterior})</Text>
            {impuestoAnterior ? (
              <>
                <Heading level={3}>
                  {dinero(impuestoAnterior.impuestoCobrado)}
                </Heading>
                <Text type="supporting">
                  Ventas del cierre: {dinero(impuestoAnterior.totalVentas)} ·
                  Remitido: {dinero(impuestoAnterior.impuestoRemitido)}
                </Text>
                <Badge
                  variant="info"
                  label={`Comprobante ${impuestoAnterior.comprobante}`}
                />
              </>
            ) : (
              <Text type="supporting">
                Sin cierre guardado del mes anterior.
              </Text>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <Heading level={2}>Métricas del mes</Heading>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Metrica
            etiqueta="Pedidos del mes"
            valor={String(pedidosMes.length)}
            nota="Sin contar cancelados"
          />
          <Metrica
            etiqueta="Venta promedio por pedido"
            valor={dinero(ventaPromedio)}
            nota="Subtotal promedio del mes"
          />
        </div>
        <div className="mt-3">
          <TablaZonas filas={filasZonas} />
        </div>
      </div>

      <div className="mt-8">
        <Text type="supporting">
          Pantalla de prueba: todavía no reemplaza al panel de la familia. Si
          esta forma de trabajar convence, la migración sigue pantalla por
          pantalla, sin tocar los datos ni las reglas de dinero.
        </Text>
      </div>
    </main>
  );
}
