import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aDolares } from "@/lib/dinero";
import { ventasDeMesClave } from "@/lib/ventas";

// GET /api/admin/impuestos/[mes] (RF-I03)
// Cierre mensual de impuestos: genera (o devuelve) el registro guardado en
// ImpuestoMensual para el mes clave "YYYY-MM". Ventas e impuesto se calculan
// de los pedidos reales del mes; el resultado queda consultable en la base
// como comprobante del cierre. La remisión al Contralor se registra después.

const MES_REGEX = /^\d{4}-\d{2}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mes: string }> }
) {
  const { mes } = await params;
  if (!MES_REGEX.test(mes)) {
    return NextResponse.json(
      { error: "El mes debe tener el formato YYYY-MM." },
      { status: 400 }
    );
  }

  try {
    const existente = await db.impuestoMensual.findUnique({ where: { mes } });
    if (existente) {
      return NextResponse.json({
        ok: true,
        cierre: {
          mes,
          totalVentas: aDolares(existente.totalVentas),
          impuestoCobrado: aDolares(existente.impuestoCobrado),
          impuestoRemitido: aDolares(existente.impuestoRemitido),
          comprobante: existente.comprobante,
          yaGuardado: true,
        },
      });
    }

    const { ventasCentavos, impuestoCentavos } = await ventasDeMesClave(mes);
    const cierre = await db.impuestoMensual.create({
      data: {
        mes,
        totalVentas: ventasCentavos,
        impuestoCobrado: impuestoCentavos,
        impuestoRemitido: 0,
        comprobante: `cierre-${mes}`,
      },
    });

    return NextResponse.json({
      ok: true,
      cierre: {
        mes,
        totalVentas: aDolares(cierre.totalVentas),
        impuestoCobrado: aDolares(cierre.impuestoCobrado),
        impuestoRemitido: aDolares(cierre.impuestoRemitido),
        comprobante: cierre.comprobante,
        yaGuardado: false,
      },
      mensaje: `Cierre del mes ${mes} guardado: queda registrado como comprobante interno (RF-I03).`,
    });
  } catch (e) {
    console.error("GET /api/admin/impuestos/[mes]", e);
    return NextResponse.json({ error: "No pudimos generar el cierre del mes." }, { status: 500 });
  }
}
