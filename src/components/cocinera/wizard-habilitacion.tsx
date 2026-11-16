"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, UserRoundPlus, Upload } from "lucide-react";

const ZONAS = ["Northside", "Diamond Hill", "Como", "Stop Six", "Fairmount", "Riverside"];

// Asistente de habilitación (RF-C01): paso a paso, en español simple.
// La cuenta queda «pendiente» hasta que el panel la apruebe.

export function WizardHabilitacion({
  alTerminar,
  modoOtro = false,
}: {
  alTerminar: () => void;
  modoOtro?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(1);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [zona, setZona] = useState("");
  const [direccionCasa, setDireccionCasa] = useState("");
  const [vendeTcs, setVendeTcs] = useState(false);
  const [numeroDshs, setNumeroDshs] = useState("");
  const [tarjetaNombre, setTarjetaNombre] = useState("");
  const [radioEntregaKm, setRadioEntregaKm] = useState("5");
  const [plan, setPlan] = useState<"fundadora" | "regular">("fundadora");
  const [enviando, setEnviando] = useState(false);

  const totalPasos = 5;

  const enviar = async () => {
    setEnviando(true);
    try {
      const res = await fetch("/api/cocineras/habilitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          telefono,
          correo: correo || undefined,
          zona,
          direccionCasa,
          vendeTcs,
          numeroDshs: vendeTcs ? numeroDshs : undefined,
          tarjetaManipuladorUrl: tarjetaNombre || "/demo/tarjeta-nueva.pdf",
          radioEntregaKm: Number(radioEntregaKm) || 5,
          plan,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: "Faltó algo del asistente", description: d.error, variant: "destructive" });
        return;
      }
      toast({
        title: "¡Solicitud enviada!",
        description: d.mensaje,
      });
      alTerminar();
      setAbierto(false);
      setPaso(1);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        {modoOtro ? (
          <Button variant="outline" className="w-full rounded-full">
            <UserRoundPlus className="size-4" /> Registrar otra cocinera
          </Button>
        ) : (
          <Button className="w-full rounded-full bg-primary font-bold hover:bg-primary/90">
            <UserRoundPlus className="size-4" /> Quiero vender en Wasakaka
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] rounded-2xl p-0">
        <div className="space-y-4 overflow-y-auto p-5 scroll-lindo" style={{ maxHeight: "88vh" }}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-primary">
              Habilitación de cocinera ({paso}/{totalPasos})
            </DialogTitle>
            <DialogDescription>
              La ley de comida casera de Texas (SB 541) pide estos datos para
              habilitarte. Tu dirección de casa NUNCA se muestra al público.
            </DialogDescription>
          </DialogHeader>

          {/* progreso */}
          <div className="flex gap-1">
            {Array.from({ length: totalPasos }, (_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < paso ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          {paso === 1 && (
            <div className="space-y-3">
              <h3 className="font-bold">Tus datos</h3>
              <div className="space-y-1.5">
                <Label htmlFor="w-nombre">Nombre completo *</Label>
                <Input id="w-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Como en tu tarjeta de manipulador" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-tel">Teléfono (WhatsApp) *</Label>
                <Input id="w-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+1 817 …" inputMode="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-correo">Correo (opcional)</Label>
                <Input id="w-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tucorreo@ejemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Tu barrio *</Label>
                <Select value={zona} onValueChange={setZona}>
                  <SelectTrigger><SelectValue placeholder="Elige tu zona" /></SelectTrigger>
                  <SelectContent>
                    {ZONAS.map((z) => (
                      <SelectItem key={z} value={z}>{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-3">
              <h3 className="font-bold">Tu dirección de casa (privada)</h3>
              <p className="text-sm text-muted-foreground">
                Solo la familia Wasakaka la ve para las entregas. A los clientes
                nunca se la mostramos como texto.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="w-dir">Dirección completa *</Label>
                <Input id="w-dir" value={direccionCasa} onChange={(e) => setDireccionCasa(e.target.value)} placeholder="Calle, número, ciudad, TX" />
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-3">
              <h3 className="font-bold">Tarjeta de manipulador de alimentos *</h3>
              <p className="text-sm text-muted-foreground">
                La tarjeta de manipulador tiene vigencia de 2 años. Te avisamos
                30, 15 y 3 días antes de que venza.
              </p>
              <label
                htmlFor="w-tarjeta"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary"
              >
                <Upload className="size-6 text-primary" />
                <span className="text-sm font-semibold">
                  {tarjetaNombre ? `Archivo listo: ${tarjetaNombre}` : "Sube foto o PDF de tu tarjeta"}
                </span>
                <input
                  id="w-tarjeta"
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setTarjetaNombre(e.target.files?.[0]?.name ?? "")}
                />
              </label>
            </div>
          )}

          {paso === 4 && (
            <div className="space-y-3">
              <h3 className="font-bold">¿Vendes refrigerados (TCS)?</h3>
              <p className="text-sm text-muted-foreground">
                TCS significa Time and Temperature Control for Safety: alimentos
                que necesitan refrigeración, como flan, tamales de olla o
                crema pastelera. Para venderlos necesitas registro del DSHS
                (Departamento de Salud de Texas).
              </p>
              <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-3">
                <span className="text-sm font-semibold">Voy a vender TCS</span>
                <Switch checked={vendeTcs} onCheckedChange={setVendeTcs} />
              </div>
              {vendeTcs && (
                <div className="space-y-1.5">
                  <Label htmlFor="w-dshs">Número de registro DSHS *</Label>
                  <Input id="w-dshs" value={numeroDshs} onChange={(e) => setNumeroDshs(e.target.value)} placeholder="DSHS-CF-2026-…" />
                </div>
              )}
            </div>
          )}

          {paso === 5 && (
            <div className="space-y-3">
              <h3 className="font-bold">Último paso: tu plan</h3>
              <div className="space-y-1.5">
                <Label>¿A cuántos km entregas?</Label>
                <Input value={radioEntregaKm} onChange={(e) => setRadioEntregaKm(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
                <p className="text-xs text-muted-foreground">Los clientes solo te ven si están dentro de tu radio.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPlan("fundadora")}
                  className={`rounded-2xl border p-3 text-left ${plan === "fundadora" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <p className="text-sm font-bold">Fundadora</p>
                  <p className="text-xs text-muted-foreground">$19/mes por 6 meses</p>
                  <p className="mt-1 text-[11px] font-bold text-primary">Ahorras $60</p>
                </button>
                <button
                  onClick={() => setPlan("regular")}
                  className={`rounded-2xl border p-3 text-left ${plan === "regular" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <p className="text-sm font-bold">Regular</p>
                  <p className="text-xs text-muted-foreground">$29/mes</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Sin compromiso</p>
                </button>
              </div>
              <p className="rounded-xl bg-secondary/60 p-3 text-xs">
                Además de la cuota, la plataforma cobra el 8% por venta (ya
                incluye el costo de la tarjeta). Sin cargos ocultos: tu pedido
                de $10 te deja $9.20.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {paso > 1 && (
              <Button variant="outline" className="rounded-full" onClick={() => setPaso(paso - 1)}>
                <ArrowLeft className="size-4" /> Atrás
              </Button>
            )}
            {paso < totalPasos ? (
              <Button
                className="flex-1 rounded-full bg-primary font-bold hover:bg-primary/90"
                onClick={() => setPaso(paso + 1)}
              >
                Siguiente <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                disabled={enviando}
                className="flex-1 rounded-full bg-primary font-bold hover:bg-primary/90"
                onClick={enviar}
              >
                <CheckCircle2 className="size-4" /> {enviando ? "Enviando…" : "Enviar solicitud"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
