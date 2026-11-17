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
import { estadoTarjeta } from "@/lib/cumplimiento";
import { Card } from "@astryxdesign/core/Card";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { TablaPedidos, type FilaPedido } from "./tabla-pedidos";
import {
  TablaIncidentes,
  TablaAprobaciones,
  type FilaIncidente,
  type FilaAprobacion,
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

  const [
    pedidosHoy,
    ventasMes,
    activas,
    pendientes,
    incidentes,
    recientes,
    incidentesAbiertos,
    cocinerasPendientes,
  ] = await Promise.all([
      db.pedido.count({ where: { fecha: { gte: inicioDia } } }),
      db.pedido.aggregate({
        where: { fecha: { gte: inicioMes } },
        _sum: { total: true, comision: true },
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
    ]);

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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          etiqueta="Pedidos de hoy"
          valor={String(pedidosHoy)}
          nota="Desde las 00:00 de hoy"
        />
        <Metrica
          etiqueta="Ventas del mes"
          valor={dinero(ventasMes._sum.total ?? 0)}
          nota={`Comisión Wasakaka: ${dinero(ventasMes._sum.comision ?? 0)}`}
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
        <Text type="supporting">
          Pantalla de prueba: todavía no reemplaza al panel de la familia. Si
          esta forma de trabajar convence, la migración sigue pantalla por
          pantalla, sin tocar los datos ni las reglas de dinero.
        </Text>
      </div>
    </main>
  );
}
