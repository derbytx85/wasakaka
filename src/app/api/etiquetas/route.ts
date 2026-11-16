import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ALERGENOS_PERMITIDOS,
  FRASE_LEGAL_ETIQUETA,
  INSTRUCCION_TCS_ETIQUETA,
} from "@/lib/cumplimiento";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// GET /api/etiquetas?cocineraId=&platos=id1,id2 (RF-C06)
// Genera y DESCARGA un PDF real con las etiquetas para imprimir en casa:
// nombre de la cocinera y su número DSHS (nunca la dirección como texto
// público), nombre del producto, ingredientes, alérgenos, la frase legal de
// cocina casera no inspeccionada y, si el plato es refrigerado (TCS), fecha
// de elaboración e instrucción de manejo seguro.
// ?formato=json mantiene la respuesta JSON original (compatibilidad).

interface Linea {
  texto: string;
  fuente: "negrita" | "normal" | "gris";
  tamano: number;
}

function envolver(texto: string, maxCaracteres: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if ((actual + " " + p).trim().length > maxCaracteres) {
      if (actual) lineas.push(actual.trim());
      actual = p;
    } else {
      actual = (actual + " " + p).trim();
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cocineraId = sp.get("cocineraId");
  const platosParam = sp.get("platos");
  const formato = sp.get("formato");

  try {
    if (!cocineraId) {
      return NextResponse.json({ error: "Falta la cocinera." }, { status: 400 });
    }
    const cocinera = await db.cocinera.findUnique({
      where: { id: cocineraId },
      include: { usuario: true },
    });
    if (!cocinera) {
      return NextResponse.json({ error: "Cocinera no encontrada." }, { status: 404 });
    }

    const ids = platosParam ? platosParam.split(",").filter(Boolean) : [];
    const platos = await db.plato.findMany({
      where: { cocineraId, ...(ids.length > 0 ? { id: { in: ids } } : {}), activo: true },
    });

    const fechaElaboracion = new Date().toLocaleDateString("es-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const etiquetas = platos.map((p) => ({
      platoId: p.id,
      nombre: p.nombre,
      ingredientes: p.ingredientes,
      alergenos: JSON.parse(p.alergenos || "[]") as string[],
      esTcs: p.esTcs,
      fechaElaboracion,
      instrucciones: p.esTcs ? INSTRUCCION_TCS_ETIQUETA : null,
      // En la etiqueta impresa va el identificador legal (número DSHS si tiene),
      // nunca la dirección como texto público en la app.
      origenLegal: cocinera.numeroDshs
        ? `${cocinera.usuario.nombre} · Registro DSHS: ${cocinera.numeroDshs}`
        : `${cocinera.usuario.nombre} · Cocina casera doméstica — Fort Worth, TX`,
      fraseLegal: FRASE_LEGAL_ETIQUETA,
    }));

    if (formato === "json") {
      return NextResponse.json({
        cocinera: { nombre: cocinera.usuario.nombre },
        etiquetas,
        listaAlergenosValidos: ALERGENOS_PERMITIDOS,
      });
    }

    // ─── PDF real (RF-C06) ────────────────────────────────────────────────
    const pdf = await PDFDocument.create();
    pdf.setTitle("Etiquetas Wasakaka — comida casera (SB 541)");
    pdf.setSubject("Etiquetas de producto con frase legal y alérgenos");
    const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const GRIS = rgb(0.35, 0.33, 0.3);
    const NEGRO = rgb(0.13, 0.12, 0.11);

    // Carta: 612 × 792 pt. Tarjetas 2 columnas × 5 filas (10 por página).
    const W = 612;
    const H = 792;
    const margen = 36;
    const gap = 10;
    const cols = 2;
    const filas = 5;
    const tarjetaW = (W - margen * 2 - gap) / cols;
    const tarjetaH = (H - margen * 2 - gap * (filas - 1)) / filas;

    let page = pdf.addPage([W, H]);
    let indice = 0;

    for (const e of etiquetas) {
      const col = indice % cols;
      const fila = Math.floor(indice / cols) % filas;
      if (fila === 0 && col === 0 && indice > 0) {
        page = pdf.addPage([W, H]);
      }
      const x = margen + col * (tarjetaW + gap);
      const y = H - margen - tarjetaH - fila * (tarjetaH + gap);

      // marco punteado para recortar
      page.drawRectangle({
        x,
        y,
        width: tarjetaW,
        height: tarjetaH,
        borderColor: rgb(0.6, 0.58, 0.55),
        borderWidth: 0.8,
        borderDashArray: [3, 2],
      });

      const pad = 7;
      const anchoUtil = tarjetaW - pad * 2;
      let cy = y + tarjetaH - pad;

      const escribir = (lineas: Linea[]) => {
        for (const l of lineas) {
          const fuente = l.fuente === "negrita" ? negrita : normal;
          const color = l.fuente === "gris" ? GRIS : NEGRO;
          for (const linea of envolver(l.texto, Math.floor(anchoUtil / (l.tamano * 0.5)))) {
            if (cy - l.tamano < y + pad) return; // sin desbordar la tarjeta
            cy -= l.tamano + 1.6;
            page.drawText(linea, {
              x: x + pad,
              y: cy,
              size: l.tamano,
              font: fuente,
              color,
            });
          }
        }
      };

      escribir([{ texto: e.nombre, fuente: "negrita", tamano: 10 }]);
      escribir([{ texto: e.origenLegal, fuente: "gris", tamano: 6.5 }]);
      escribir([
        { texto: "Ingredientes: ", fuente: "negrita", tamano: 6.8 },
      ]);
      escribir([{ texto: e.ingredientes, fuente: "normal", tamano: 6.8 }]);
      escribir([
        {
          texto: `Alérgenos: ${e.alergenos.length ? e.alergenos.join(", ") : "no contiene los alérgenos principales"}`,
          fuente: "normal",
          tamano: 6.8,
        },
      ]);
      if (e.esTcs) {
        escribir([
          { texto: `Elaborado: ${e.fechaElaboracion} · Lote: usar el registrado en el panel`, fuente: "negrita", tamano: 6.8 },
          { texto: e.instrucciones ?? "", fuente: "negrita", tamano: 6.8 },
        ]);
      }
      escribir([{ texto: e.fraseLegal, fuente: "gris", tamano: 6.2 }]);

      indice += 1;
    }

    const bytes = await pdf.save();
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="etiquetas-wasakaka-${cocinera.usuario.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf"`,
      },
    });
  } catch (e) {
    console.error("GET /api/etiquetas", e);
    return NextResponse.json({ error: "No pudimos generar las etiquetas." }, { status: 500 });
  }
}
