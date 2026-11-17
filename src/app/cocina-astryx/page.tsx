// Vista de la cocinera — VISTA PREVIA con Astryx (sistema de diseño de Meta).
//
// Ruta independiente /cocina-astryx: la misma base y las mismas reglas del
// panel actual de la cocinera, presentadas con componentes Astryx. Muestra a
// la cocinera activa con más pedidos de la demo: cuánto vendió, cuánto le
// queda (su neto), cómo va frente al tope de la promoción fundadora
// (US$400/mes con comisión 0%), sus pedidos recientes y sus platos con el
// estado de publicación, impuesto y conservación de un vistazo.
import { db } from "@/lib/db";
import { aDolares, VENTAS_MES_FIN_PROMO } from "@/lib/dinero";
import { CATEGORIA_LABEL } from "@/lib/cumplimiento";
import { Card } from "@astryxdesign/core/Card";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import {
  TablaPedidosCocinera,
  TablaPlatos,
  type FilaPedidoCocinera,
  type FilaPlato,
} from "./tablas-cocina";

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

export default async function CocinaAstryx() {
  // La cocinera activa con más pedidos (en la demo, la más representativa).
  const conteo = await db.pedido.groupBy({
    by: ["cocineraId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });
  const cocinera = conteo[0]
    ? await db.cocinera.findUnique({
        where: { id: conteo[0].cocineraId },
        include: { usuario: { select: { nombre: true } } },
      })
    : await db.cocinera.findFirst({
        where: { estado: "activa" },
        include: { usuario: { select: { nombre: true } } },
      });

  if (!cocinera) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Heading level={1}>Cocina</Heading>
        <Text type="supporting">
          Todavía no hay cocineras activas en esta demo.
        </Text>
      </main>
    );
  }

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [pedidosHoy, mes, platosActivos, recientes, platos] =
    await Promise.all([
      db.pedido.count({
        where: { cocineraId: cocinera.id, fecha: { gte: inicioDia } },
      }),
      db.pedido.aggregate({
        where: { cocineraId: cocinera.id, fecha: { gte: inicioMes } },
        _sum: { total: true, netoCocinera: true },
      }),
      db.plato.count({ where: { cocineraId: cocinera.id, activo: true } }),
      db.pedido.findMany({
        where: { cocineraId: cocinera.id },
        orderBy: { fecha: "desc" },
        take: 10,
        include: { cliente: { select: { nombre: true } } },
      }),
      db.plato.findMany({
        where: { cocineraId: cocinera.id },
        orderBy: { nombre: "asc" },
      }),
    ]);

  const ventasMes = mes._sum.total ?? 0;
  const esFundadora = cocinera.plan === "fundadora";
  const notaPromo = esFundadora
    ? ventasMes < VENTAS_MES_FIN_PROMO
      ? `Lleva ${dinero(ventasMes)} de ${dinero(VENTAS_MES_FIN_PROMO)}: sigue con comisión 0%`
      : `Superó los ${dinero(VENTAS_MES_FIN_PROMO)}: la comisión del 8% parte el próximo mes`
    : "Plan regular: comisión del 8% por venta";

  const filasPedidos: FilaPedidoCocinera[] = recientes.map((p) => ({
    id: p.id,
    fecha: p.fecha.toLocaleDateString("es", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cliente: p.cliente.nombre,
    total: dinero(p.total),
    neto: dinero(p.netoCocinera),
    estado: p.estado,
  }));

  const filasPlatos: FilaPlato[] = platos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: CATEGORIA_LABEL[p.categoria] ?? p.categoria,
    precio: dinero(p.precio),
    activo: p.activo,
    categoriaTributaria: p.categoriaTributaria,
    esTcs: p.esTcs,
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>Cocina de {cocinera.usuario.nombre}</Heading>
        <Badge
          variant={esFundadora ? "teal" : "neutral"}
          label={esFundadora ? "Plan fundadora" : "Plan regular"}
        />
        <Badge variant="teal" label="Vista previa · Astryx" />
      </div>
      <Text type="supporting">
        Su día y su dinero de un vistazo, con los componentes del sistema de
        diseño de Meta. Datos reales de esta demo, en vivo.
      </Text>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          etiqueta="Pedidos de hoy"
          valor={String(pedidosHoy)}
          nota="Desde las 00:00 de hoy"
        />
        <Metrica
          etiqueta="Tu neto del mes"
          valor={dinero(mes._sum.netoCocinera ?? 0)}
          nota="Lo que te queda después de la comisión"
        />
        <Metrica etiqueta="Ventas del mes" valor={dinero(ventasMes)} nota={notaPromo} />
        <Metrica
          etiqueta="Platos publicados"
          valor={String(platosActivos)}
          nota={`de ${platos.length} en su menú`}
        />
      </div>

      <div className="mt-8">
        <Heading level={2}>Pedidos recientes</Heading>
        <div className="mt-3">
          <TablaPedidosCocinera filas={filasPedidos} />
        </div>
      </div>

      <div className="mt-8">
        <Heading level={2}>Mis platos</Heading>
        <Text type="supporting">
          Publicación, impuesto y conservación de cada plato, sin abrir uno
          por uno.
        </Text>
        <div className="mt-3">
          <TablaPlatos filas={filasPlatos} />
        </div>
      </div>

      <div className="mt-8">
        <Text type="supporting">
          Pantalla de prueba: todavía no reemplaza al panel actual de la
          cocinera. La migración sigue pantalla por pantalla, sin tocar los
          datos ni las reglas de dinero.
        </Text>
      </div>
    </main>
  );
}
