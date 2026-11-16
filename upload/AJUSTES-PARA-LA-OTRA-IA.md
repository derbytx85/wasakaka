# Instrucciones de ajuste — Wasakaka (plataforma de comida casera)

**Para:** la IA que construyó el proyecto.
**Contexto:** Wasakaka es una PWA (aplicación web instalable) en Next.js + Prisma + SQLite que implementa el documento `upload/requerimientos-tecnicos-comida-casera.md` (la especificación, con requerimientos RF-C, RF-P, RF-I, RF-U, RF-A, RF-N y RNF). La demo fue revisada corriendo la aplicación y auditada contra esa especificación. El ciclo de pedido funciona y el motor de cumplimiento está bien construido. Lo que sigue son los ajustes aprobados por el dueño, en orden de prioridad. **No son sugerencias: cada punto trae el estado actual, el estado esperado y cómo se verifica.**

Reglas generales para todos los cambios:

- No cambiar el nombre (Wasakaka), la paleta (terracota/crema/maíz), ni las tipografías (Nunito + Baloo 2). La identidad visual está aprobada.
- Español primero en toda la interfaz, como hoy.
- Nada de funciones nuevas fuera de la especificación (cupones, lealtad y publicidad son fase 2).
- Lo que esté simulado debe verse simulado en la interfaz (rótulo «demo» o «estimado»). Nada de pantallas que afirmen como real algo que el sistema no hizo.
- Al terminar cada bloque, la aplicación debe seguir corriendo completa: catálogo → carrito → pedido → estados → cierre con código → calificación.

---

## P0 — El dinero no puede mentir

### 1. Una sola fuente de verdad para la comisión

- **Hoy:** `src/lib/dinero.ts` usa 8%, `prisma/schema.prisma` trae 5% por defecto, los datos de ejemplo usan 5% y el panel de administración suma con otro criterio.
- **Debe quedar:** la constante `COMISION_ESTANDAR = 0.08` de `src/lib/dinero.ts` manda. El valor por defecto del esquema pasa a 0.08, los datos de ejemplo se siembran con 0.08, y el panel de administración suma el campo `Pedido.comision` ya almacenado, sin recalcular nada.
- **Verificación:** buscar en todo el código: no debe quedar ningún `0.05` de comisión fuera de una prueba.

### 2. Comisión promocional de lanzamiento: 0% para fundadoras

- **Regla nueva (decisión del dueño):** las cocineras fundadoras pagan **0% de comisión** usando el mecanismo de comisión promocional de la especificación (RF-P04: campos `comisionPromo` y `promoHasta`).
- **Salida de la promoción (lo primero que ocurra):** la cocinera supera **US$400 en ventas en un mes**, o cumple **6 meses** desde su activación. Al salir, su comisión pasa a ser la estándar de 8%.
- **Debe quedar:** `comisionAplicable()` devuelve 0 para fundadoras dentro de la promoción y 0.08 fuera de ella; el panel de la cocinera muestra «Comisión fundadora: US$0 (promoción de lanzamiento)» cuando aplica, y al salir de la promoción la cocinera ve el aviso con 15 días de anticipación en su panel.
- **Verificación:** un pedido de US$18 de una cocinera fundadora en promoción deja `comision = 0` y `netoCocinera = 18`.

### 3. La comisión jamás se le cobra al comprador

- **Hoy:** `src/components/cliente/vista-carrito.tsx` suma la comisión al total del cliente (total = subtotal + impuesto + comisión) y la muestra como línea «Comisión Wasakaka (8%)». La especificación (RF-P01, RF-U04) lo prohíbe: la comisión se descuenta del lado de la cocinera.
- **Debe quedar:** el comprador paga **subtotal + impuesto**, nada más. Se elimina la línea de comisión del desglose del carrito y de cualquier pantalla del cliente.
- **Verificación:** en el carrito, para un subtotal de US$18, el total es US$18 + impuesto. La palabra «comisión» no aparece en ninguna pantalla del rol cliente.

### 4. Impuesto: fuera el 8,25% plano del navegador

- **Hoy:** el carrito calcula un 8,25% plano en el cliente. En Texas la tasa depende de la dirección y de la categoría del producto, y la panadería para llevar sin utensilios está **exenta**.
- **Debe quedar:**
  1. El desglose lo calcula solo el servidor (`calcularDesglose` en `src/lib/dinero.ts`). El cliente no calcula impuestos.
  2. Cada plato gana una categoría tributaria (`gravado` / `exento`) editable en el editor de platos; el impuesto se aplica solo a la parte gravada.
  3. Mientras no exista cálculo por dirección de entrega, la línea se rotula **«Impuesto estimado»** en todas las pantallas.
- **Verificación:** un plato marcado exento no suma impuesto en el desglose, en ningún rol.

### 5. Costo de procesamiento calculado sobre lo realmente cobrado

- **Hoy:** `costoProcesamiento` se calcula como 2,9% del subtotal + US$0,30. Stripe cobra el porcentaje sobre el total cobrado (subtotal + impuesto).
- **Debe quedar:** 2,9% × (subtotal + impuesto) + US$0,30.
- **Verificación:** para subtotal US$20 con impuesto US$1,65, el costo es 2,9% × US$21,65 + US$0,30 ≈ US$0,93.

### 6. Suscripción: modelo real y cifras no inventadas

- **Hoy:** no existe el modelo `Suscripcion`; el panel muestra una cuota fija y una fecha de próximo cobro simulada, y el panel de administración calcula el ingreso por suscripciones como «cocineras activas × US$19».
- **Debe quedar:**
  1. Crear el modelo `Suscripcion` de la sección 4 de la especificación (cocinera, monto, estado, período). Cuotas: **US$29 regular, US$19 fundadora** (la tabla de la sección 4 que dice US$39 está desactualizada; manda RF-P05).
  2. La suscripción solo se cobra en meses con al menos una venta o con la vitrina activa (RF-P05). El cobro puede seguir simulado, pero el estado debe ser real en la base: sin suscripción activa, el panel no muestra «próximo cobro».
  3. El panel de administración suma solo suscripciones reales. Si no hay ninguna cobrada, muestra «Sin cobros reales aún (demo)».
- **Verificación:** con los datos de ejemplo, el ingreso por suscripciones del panel admin es US$0 rotulado como demo, no una multiplicación.

---

## P0 — Seguridad mínima antes de mostrar la demo a nadie

### 7. Las identidades demo no pueden quedar abiertas

- **Hoy:** `GET /api/demo/identidades` entrega públicamente todas las cuentas, incluida la de administración, y el componente `CambiarRol` permite ser admin con un toque. `GET /api/pedidos` sin parámetros devuelve hasta 100 pedidos con nombres y teléfonos de clientes.
- **Debe quedar:**
  1. El endpoint de identidades demo y el cambiador de rol solo funcionan con la variable de entorno `DEMO_MODE=1`. Sin ella, el endpoint responde 404 y el cambiador no se renderiza.
  2. `GET /api/pedidos` exige `clienteId` o `cocineraId`; sin filtro no devuelve nada. Los teléfonos de clientes solo se incluyen en la respuesta para el rol que los necesita durante la entrega.
- **Verificación:** sin `DEMO_MODE`, no existe forma de llegar al panel de administración desde la interfaz ni por URL directa del endpoint de identidades.

### 8. Higiene del repositorio

- **Hoy:** el archivo `.env` y la base `db/custom.db` están versionados en git aunque `.gitignore` los excluye.
- **Debe quedar:** `git rm --cached` de ambos, confirmar que `.gitignore` los cubre, y dejar una nota en el README: cualquier clave que haya estado en ese `.env` debe rotarse antes de desplegar.
- **Además:** en `src/lib/db.ts`, el registro de consultas de Prisma (`log: ['query']`) queda activo solo en desarrollo.

---

## P1 — UI y UX (interfaz y experiencia de uso)

Cada punto trae el archivo principal. La identidad visual no cambia: cambia la estructura, la legibilidad y la honestidad de lo que se muestra.

### 9. Un solo sistema de estilos

- **Hoy:** conviven Tailwind v4 (`globals.css` con `@import "tailwindcss"` y `@theme`) y un `tailwind.config.ts` de la v3 que envuelve variables `oklch` en `hsl()` y busca contenido en rutas que no son `./src/...`.
- **Debe quedar:** manda la v4. Eliminar `tailwind.config.ts` (o dejarlo vacío con un comentario que lo diga). Prohibido `hsl(var(--…))` sobre las variables del tema.
- **Verificación:** la app se ve idéntica a hoy en las tres vistas, y borrar el archivo de configuración no cambia ningún estilo.

### 10. Permitir el zoom (accesibilidad)

- **Hoy:** `src/app/layout.tsx` fija `maximumScale: 1` en el viewport: el usuario no puede ampliar la pantalla.
- **Debe quedar:** sin `maximumScale`. El zoom del navegador queda libre (RNF-05: público con vista cansada).

### 11. Anchos según el rol (el panel de administración es de computador)

- **Hoy:** todo vive en `max-w-3xl`, una columna de teléfono, incluido el panel de administración que la especificación pensó para uso en computador.
- **Debe quedar:** cliente `max-w-3xl` (móvil primero, como hoy); cocinera `max-w-5xl` desde pantallas medianas; administración `max-w-7xl` con sus tarjetas en grilla (`md:grid-cols-2`, `xl:grid-cols-3`) en `src/components/admin/vista-admin.tsx`. El contenedor está en `src/components/app-shell.tsx`: el ancho depende del rol activo.

### 12. Logo real e iconografía consistente

- **Hoy:** el encabezado muestra un emoji 🍲 aunque existe `public/logo.svg`; la iconografía mezcla emojis (🍲 ❄️ ⏳ 👩‍🍳) con íconos Lucide sin criterio.
- **Debe quedar:** el encabezado usa `logo.svg`. Toda la iconografía funcional (botones, estados, insignias) es Lucide. Los emojis quedan solo en estados vacíos y mensajes de celebración, nunca como ícono de un control.

### 13. Ingredientes siempre visibles en la tarjeta del plato

- **Hoy:** en `TarjetaPlato` (`src/components/cliente/vista-inicio.tsx`) los ingredientes van truncados a una línea (`line-clamp-1`). La especificación (RF-U02) exige ingredientes y alérgenos siempre visibles, no escondidos.
- **Debe quedar:** ingredientes completos o con un mínimo de 3 líneas visibles en la tarjeta, y alérgenos siempre visibles como hoy. El detalle del plato ya los trae completos: no tocarlo.

### 14. Objetivos táctiles y texto legible

- **Hoy:** las píldoras de filtro y las pestañas de la cocinera usan texto de 12px y poco alto.
- **Debe quedar:** todo control táctil con alto mínimo de 40px; filtros y pestañas con texto de al menos 14px; en la app de la cocinera, las acciones principales con texto de al menos 16px (RNF-05).

### 15. El carrito sobrevive a la recarga

- **Hoy:** `src/store/wasakaka.ts` persiste rol y vistas, pero no el carrito: recargar la página pierde el pedido armado. El cliente típico llega por un enlace de WhatsApp y puede cerrar sin querer.
- **Debe quedar:** `items` incluido en el `partialize` del store persistido.

### 16. Modo oscuro: completo o fuera

- **Hoy:** `globals.css` define la paleta `.dark` completa y no existe ningún control que la active.
- **Debe quedar:** una de dos: un interruptor en el encabezado que alterne la clase `dark`, o eliminar la paleta `.dark`. No dejarlo a medias.

### 17. La cocinera tiene cara

- **Hoy:** el catálogo muestra un ícono genérico de gorro de chef aunque el modelo de datos tiene `fotoUrl` de la cocinera.
- **Debe quedar:** la foto de la cocinera en el encabezado de su sección del catálogo, con respaldo de sus iniciales sobre el color primario cuando no tenga foto.

### 18. Fuera el mapa falso del seguimiento

- **Hoy:** en `src/components/cliente/vista-pedidos.tsx` el «seguimiento en vivo» es un dibujo cuyo avance lo calcula un temporizador de 6 minutos en el navegador desde la hora de salida. No hay ubicación real detrás (RF-U05 sigue sin implementar y así seguirá hasta la fase de funciones reales).
- **Debe quedar:** eliminar el mapa simulado y su temporizador. El seguimiento muestra solo el paso a paso de estados del pedido (nuevo → confirmado → en cocina → listo → en entrega/recogida → entregado), que sí es información real.

### 19. Textos que no prometen lo que no existe

- **Hoy:** la hoja de notificaciones rotula «WhatsApp» mensajes que nunca se enviaron por WhatsApp (no hay integración), y la pantalla de cuenta pendiente dice «Te avisamos por WhatsApp apenas te aprueben».
- **Debe quedar:** los avisos internos se rotulan «En la app». Si un aviso representa un canal aún no integrado, se rotula «WhatsApp (demo)». La pantalla de cuenta pendiente dice «Te avisamos en la aplicación apenas te aprueben».

### 20. Consistencia de formato

- Todo monto en pantalla pasa por `formatoDinero` (`src/lib/dinero.ts`). El helper `formatoHora` está duplicado en `vista-inicio.tsx`: centralizarlo en `src/lib/dinero.ts` (o en un `src/lib/formato.ts`) y usarlo desde todos los componentes.

---

## P2 — Datos y reglas que hoy son de utilería

### 21. Dinero sin decimales flotantes

- **Hoy:** precios, impuestos y comisiones son `Float` en `prisma/schema.prisma`, con redondeos a mano en el código.
- **Debe quedar:** montos en centavos enteros (`Int`) o `Decimal` en todo el esquema, con la conversión a dólares solo al mostrar (`formatoDinero`).

### 22. El tope legal de US$150.000 es anual

- **Hoy:** el contador `ventasAnioActual` nunca se reinicia al cambiar el año y no suma las ventas fuera de la plataforma (el campo `ventasFueraPlataforma` existe y nadie lo usa). Una cocinera real terminaría chocando con un muro permanente.
- **Debe quedar:** el contador suma solo las ventas del año calendario en curso (por fecha de pedido) más el ajuste manual de ventas fuera de la plataforma, editable por la cocinera en «Mis números» (RF-C10 + RF-I04). Los niveles de alerta (80% y 95%) y la pausa al 100% se mantienen.

### 23. El registro DSHS tiene su propia fecha

- **Hoy:** la vigencia del registro DSHS (el departamento de salud de Texas) se calcula con la fecha de vencimiento de la tarjeta de manipulador de alimentos, porque el esquema no tiene campo propio.
- **Debe quedar:** campo `numeroDshsVence` (fecha) en el modelo de cocinera; la regla TCS (alimentos refrigerados) de `validarPlato` usa ese campo. La tarjeta de manipulador y el registro DSHS son documentos distintos y vencen por separado.

### 24. Etiquetas en PDF de verdad

- **Hoy:** `GET /api/etiquetas` devuelve JSON. La especificación (RF-C06) pide un PDF descargable para imprimir en hojas de etiquetas.
- **Debe quedar:** el endpoint genera y descarga un PDF (agregar una librería de PDF al proyecto) con: nombre y dirección de la cocinera (o su número DSHS), nombre del producto, ingredientes, alérgenos, la frase legal de cocina casera no inspeccionada y, si el plato es refrigerado, fecha de elaboración e instrucción de manejo seguro.

### 25. Lotes reales, trazabilidad real

- **Hoy:** el lote que se guarda en cada ítem de pedido se fabrica en el momento (`LOTE-<timestamp>`) y el protocolo de incidentes busca a los compradores por plato, no por lote.
- **Debe quedar:** si el plato requiere lote, el ítem del pedido referencia un registro real de `RegistroLote` de esa cocinera; sin registro de lote válido, el plato no se puede vender ese día. El protocolo de incidentes (RF-A03) arma la lista de clientes de las últimas 72 horas **por lote**.

### 26. Registro de clientes

- **Hoy:** no existe ningún endpoint que cree un cliente; la demo funciona porque los datos de ejemplo ya traen uno. La especificación (RF-U01) pide registro recién al momento de pagar.
- **Debe quedar:** endpoint de registro de cliente (nombre, teléfono, correo) invocado desde el carrito al confirmar el primer pedido.

### 27. Cierre de impuestos que exista

- **Hoy:** el modelo `ImpuestoMensual` nunca se escribe; el reporte mensual del panel es una suma en pantalla sin cierre guardado ni comprobante (RF-I03).
- **Debe quedar:** al generar el reporte del mes desde el panel, se guarda el registro en `ImpuestoMensual` (ventas, impuesto cobrado, estado de remisión) y queda consultable. El endpoint de la especificación es `GET /api/admin/impuestos/:mes`.

---

## Lo que NO hay que hacer todavía

- **No migrar a Supabase** ni reescribir la pila (sigue Next.js + Prisma; la base SQLite es aceptable para la demo y el piloto). La migración de base de datos es una decisión posterior del dueño.
- **No integrar Stripe real, ni WhatsApp real, ni mapas reales.** Es la fase siguiente, después del piloto con 5 cocineras. Todo lo de pagos y avisos sigue simulado, pero rotulado como demo según los puntos 6 y 19.
- **No crear el endpoint de ubicación en vivo** hasta que exista el mapa real que lo consuma.
- **No tocar** el motor de cumplimiento de ingredientes prohibidos salvo lo indicado en el punto 23: funciona y está verificado en el servidor.

## Orden de ejecución y aceptación final

1. Primero P0 completo (puntos 1 a 8), después P1 (9 a 20), después P2 (21 a 27).
2. Al entregar, correr el ciclo completo en la aplicación y reportar el resultado de estas verificaciones mínimas:
   - Pedido de US$18 con cocinera fundadora en promoción: el cliente paga US$18 + impuesto estimado; la cocinera ve comisión US$0 y neto US$18.
   - El mismo pedido con cocinera regular: comisión US$1,44 y neto US$16,56, sin que el cliente vea ninguna línea de comisión.
   - Un plato marcado exento de impuesto no suma impuesto en ningún rol.
   - Sin `DEMO_MODE=1`, nadie puede entrar como administración.
   - El carrito conserva sus ítems tras recargar la página.
   - El seguimiento del pedido ya no muestra ningún mapa ni avance por temporizador.
3. Si algún punto de este documento contradice la especificación, gana este documento en los puntos 2 y 6 (precios) y gana la especificación en todo lo demás. Ante cualquier otra duda, preguntar antes de inventar.
