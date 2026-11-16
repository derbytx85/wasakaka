"use client";

import { useWasakaka } from "@/store/wasakaka";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Cambio de identidad para la etapa demo (en producción: Supabase Auth).
// "Ver la app como…" — cliente, cada cocinera, o el panel de la familia.
// Solo se renderiza cuando el backend tiene DEMO_MODE=1 (lo decide AppShell);
// sin demoMode este componente no existe en la página.

export function CambiarRol() {
  const {
    rolActivo,
    setRol,
    clienteNombre,
    cocineraId,
    cocinerasDisponibles,
    setCocinera,
    setSeguimiento,
  } = useWasakaka();

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Ver como
      </span>
      <Select
        value={`${rolActivo}:${cocineraId ?? ""}`}
        onValueChange={(v) => {
          const [rol, id] = v.split(":");
          setRol(rol as "cliente" | "cocinera" | "admin");
          if (rol === "cocinera" && id) setCocinera(id);
          setSeguimiento(null);
        }}
      >
        <SelectTrigger className="h-9 w-auto min-w-0 flex-1 gap-1 border-none bg-transparent p-0 text-sm font-bold shadow-none focus:ring-0 [&>svg]:size-4">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cliente:">
            Cliente · {clienteNombre}
          </SelectItem>
          {cocinerasDisponibles.map((c) => (
            <SelectItem key={c.id} value={`cocinera:${c.id}`}>
              Cocinera · {c.nombre}
              {c.estado === "pendiente" ? " (pendiente)" : c.estado === "suspendida" ? " (en pausa)" : ""}
            </SelectItem>
          ))}
          <SelectItem value="admin:">
            Familia · Panel admin
          </SelectItem>
        </SelectContent>
      </Select>
      {cocinerasDisponibles.find((c) => c.id === cocineraId)?.estado === "pendiente" && rolActivo === "cocinera" && (
        <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-700">
          pendiente
        </Badge>
      )}
    </div>
  );
}
