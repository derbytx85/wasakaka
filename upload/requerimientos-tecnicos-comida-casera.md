# Requerimientos técnicos — Plataforma de comida hecha en casa (Fort Worth, Texas)

* **Proyecto:** mercado en línea de comida casera latina (panadería, repostería y antojos) bajo la ley de comida casera de Texas.
* **Fecha:** 2026-11-14 · **Versión:** 1.0
* **Base de negocio:** brainstorming 360° del mismo día (`brainstorm-comida-casera.md`). Este documento traduce ese negocio a requerimientos de construcción: qué debe hacer el sistema, con qué piezas y en qué orden.
* **Supuesto de partida:** la validación de mercado (kit ya entregado) confirma interés. Si la validación falla, este documento se ajusta antes de construir.

**Siglas usadas, explicadas al primer uso y en el glosario final:** SB 541 (Senate Bill 541, la ley estatal de comida casera), DSHS (Texas Department of State Health Services, departamento estatal de salud), TCS (Time and Temperature Control for Safety, alimentos que exigen control de tiempo y temperatura), API (Application Programming Interface, interfaz de programación entre sistemas), MVP (Minimum Viable Product, producto mínimo viable: la primera versión útil).

---

## 1. Alcance

### 1.1 Producto mínimo viable (MVP, la versión 1)
- Registro y habilitación de cocineras con verificación de cumplimiento legal.
- Catálogo por barrio con preórdenes (días de cocina y hora de corte).
- Compra con tarjeta, impuesto sobre las ventas calculado y apartado por la plataforma, comisión única de la plataforma del 8% por venta, sin cargo al comprador.
- Pago a la cocinera de su precio menos la comisión única del 8% (que ya cubre el costo de procesamiento bancario; ver sección 6).
- Entrega personal de la cocinera con ubicación en vivo, o recogida por el cliente, con código de cierre.
- Suscripción de la cocinera: US$29/mes (fundadoras: US$19/mes por 6 meses) + comisión única del 8% por venta.
- Panel de administración para la familia (aprobaciones, pedidos, incidentes, reporte de impuestos).
- Notificaciones por WhatsApp y por la aplicación.
- Español primero, inglés segundo, en todas las interfaces.

### 1.2 Fuera del MVP (fase 2, no construir ahora)
- Entrega por terceros (la ley no la permite para ventas por internet de comida casera).
- Venta mayorista a tiendas mediante la figura del vendedor de comida casera registrado (cottage food vendor).
- Cocinas comerciales con permiso para platos con carne.
- Aplicación de escritorio, programa de lealtad, cupones complejos, publicidad pagada dentro de la plataforma.
- Expansión fuera de Texas (cada estado tiene su propia ley de comida casera).

## 2. Actores y roles

| Actor | Quién es | Qué hace en el sistema |
|---|---|---|
| **Cocinera** | Persona individual que vende desde su casa | Se habilita, publica menú, recibe preórdenes, cocina, entrega o despacha recogidas, cobra |
| **Cliente** | Comprador del barrio | Busca por zona, encarga, paga, sigue la entrega, califica |
| **Administradora/or (familia)** | Papá y mamá de Marcos | Aprueban cocineras y menús, atienden reclamos e incidentes, revisan impuestos y métricas |
| **Sistema** | La plataforma | Aplica las reglas legales, calcula impuestos, cobra, paga, avisa y registra todo |

Regla estructural derivada de la ley: la cocinera vende **como persona individual** (la definición legal de operación de comida casera no admite vender a través de una sociedad). El sistema nunca debe presentar a la cocinera como empresa ni emitir sus documentos a nombre de una sociedad suya.

## 3. Arquitectura general

Una sola base de código (monorepositorio) con tres frentes y un núcleo compartido, usando la pila que Marcos ya domina:

| Pieza | Tecnología | Notas |
|---|---|---|
| Aplicación de la cocinera | React Native con Expo (Android y iPhone desde el mismo código) | Debe funcionar con conexión inestable; modo de bajo consumo de datos |
| Aplicación del cliente | React Native con Expo + versión web ligera (enlace sin instalar) | El enlace web es clave: el cliente latino llega por WhatsApp y no debe verse obligado a instalar |
| Panel de administración | Next.js (web) | Para uso en computador, en casa |
| Backend (la parte servidora) | Next.js (rutas API) sobre Supabase | Una sola API REST (Representational State Transfer, arquitectura estándar de servicios web) para las tres piezas |
| Base de datos | PostgreSQL en Supabase | Con seguridad a nivel de fila (RLS, Row Level Security: cada usuario solo ve sus datos) |
| Autenticación | Supabase Auth | Correo + contraseña y enlace mágico; teléfono como dato verificado |
| Archivos e imágenes | Supabase Storage | Fotos de platos, tarjeta de manipulación, registros |
| Tiempo real | Supabase Realtime | Ubicación de la entrega y estados del pedido |
| Pagos | Stripe (procesador de pagos) + Stripe Connect + Stripe Billing + Stripe Tax | Detalle en secciones 6 y 7 |
| Mapas y direcciones | Google Maps Platform (mapas, geocodificación y rutas) | Alternativa de respaldo: Mapbox |
| Mensajería | WhatsApp Business Platform (API oficial de Meta) | Plantillas aprobadas para avisos de pedido |
| Despliegue | Vercel (web y API) + tiendas de aplicaciones (fases) | Ambientes: desarrollo, pruebas y producción, separados |

**Decisión de publicación móvil:** la versión 1 se distribuye como aplicación instalable desde enlace (PWA, Progressive Web App: aplicación web instalable) para validar sin fricción; la publicación en App Store (US$99/año) y Google Play (US$25, pago único) se hace cuando haya cocineras pagando. El código Expo permite compilar a tiendas sin reescribir.

## 4. Modelo de datos (tablas principales)

| Tabla | Campos clave | Para qué |
|---|---|---|
| `usuarios` | id, rol (cocinera/cliente/admin), nombre, teléfono, correo, idioma, zona | Cuentas y roles |
| `cocineras` | usuario_id, dirección de casa (privada), número DSHS (si aplica), vende_tcs (sí/no), tarjeta_manipulador_url, tarjeta_vence, estado (pendiente/activa/suspendida), radio_entrega_km, cuenta_stripe_id, plan (fundadora/regular), ventas_anio_actual | Habilitación legal y comercial de cada cocinera |
| `platos` | cocinera_id, nombre, descripción, precio, categoría, es_tcs, ingredientes, alérgenos[], foto_url, activo | Menú con datos de cumplimiento |
| `agenda_cocina` | cocinera_id, fecha, hora_corte, capacidad_pedidos, activa | Días de cocina y preorden |
| `pedidos` | id, cliente_id, cocinera_id, estado, tipo_entrega (entrega_cocinera/recogida), dirección_entrega, subtotal, impuesto, cargo_servicio, total, código_cierre, fecha | La transacción completa |
| `pedido_items` | pedido_id, plato_id, cantidad, precio_unitario, lote (si aplica) | Detalle y trazabilidad por lote |
| `pagos` | pedido_id, stripe_payment_intent_id, estado, monto, costo_procesamiento, reembolso_id | Conciliación con Stripe |
| `suscripciones` | cocinera_id, stripe_subscription_id, monto, estado, periodo | La cuota plana de US$39/US$19 |
| `entregas` | pedido_id, ubicación_actual (lat/lng), hora_salida, hora_entrega, evidencia | Seguimiento en vivo |
| `calificaciones` | pedido_id, cliente_id, cocinera_id, estrellas, comentario, respuesta_cocinera | Reputación |
| `incidentes` | id, pedido_id, tipo (salud/calidad/otro), descripción, acciones, estado | Protocolo sanitario y de reclamos |
| `impuestos_mensuales` | mes, total_ventas, impuesto_cobrado, impuesto_remitido, comprobante | Cierre mensual ante el Contralor de Texas |
| `registros_lote` | cocinera_id, plato_id, lote, fecha, ph (si aplica) | Encurtidos/fermentados: guardar 12 meses por ley |

Datos que **nunca** se guardan en la base propia: números de tarjeta (los procesa Stripe; la plataforma cumple así el estándar PCI DSS, Payment Card Industry Data Security Standard, sin tocar datos bancarios).

## 5. Requerimientos funcionales — Aplicación de la cocinera (frontend)

- **RF-C01 Registro y habilitación guiada:** asistente paso a paso: datos personales → dirección de casa (privada, nunca pública) → ¿vende comida refrigerada (TCS)? → subida de la tarjeta de manipulador de alimentos (foto o PDF) → si vende TCS, número de registro del DSHS → cuenta bancaria vía Stripe Connect → radio de entrega. La cuenta queda en estado «pendiente» hasta aprobación del panel.
- **RF-C02 Vencimientos automáticos:** aviso 30, 15 y 3 días antes de que venza la tarjeta de manipulador (vigencia 2 años); vencida la tarjeta, la vitrina se pausa sola hasta renovarla.
- **RF-C03 Editor de platos con cumplimiento forzado:** campos obligatorios: nombre, descripción, precio, foto, ingredientes y alérgenos (lista cerrada de los principales: leche, huevo, trigo, soya, maní, nueces, pescado, mariscos, sésamo). Sin esos campos, el plato no se puede publicar.
- **RF-C04 Bloqueo de categorías prohibidas:** lista cerrada de categorías publicables (panadería, repostería, dulces, conservas permitidas, refrigerados TCS, bebidas sin alcohol, mezclas secas). Si la cocinera declara en ingredientes carne, pollo, cerdo, pescado, mariscos o helado, el sistema bloquea la publicación y muestra la explicación legal en español simple. El bloqueo es por reglas del servidor, no solo de pantalla (nadie lo salta cambiando la aplicación).
- **RF-C05 Regla TCS:** un plato marcado TCS solo se publica si la cocinera tiene registro DSHS vigente en su perfil; su etiqueta incluye fecha de elaboración e instrucción de manejo seguro en el tamaño exigido.
- **RF-C06 Generador de etiquetas:** botón «descargar etiquetas» que produce un PDF con: nombre y dirección de la cocinera (o su número DSHS), nombre del producto, ingredientes, alérgenos, la frase legal de cocina casera no inspeccionada y, si aplica, fecha y manejo seguro. Formato para imprimir en casa en hojas de etiquetas estándar.
- **RF-C07 Agenda y preórdenes:** la cocinera activa sus días de cocina, define hora de corte y capacidad máxima de pedidos por día. Pasada la hora de corte, el plato deja de recibir encargos ese día.
- **RF-C08 Gestión de pedidos del día:** lista ordenada por hora, con estados: nuevo → confirmado → en cocina → listo → en entrega / para recogida → entregado. Botón de «salí a entregar» que activa la ubicación en vivo.
- **RF-C09 Cierre con código:** la entrega se cierra con el código de 4 dígitos del cliente o con su confirmación en la aplicación; sin cierre no hay pago liberado.
- **RF-C10 Contador del tope legal:** barra visible «Ventas del año: US$X de US$150.000» con alertas al 80% y al 95%; al 100% la vitrina se pausa y se le ofrece la ruta de cocina comercial (fase 2).
- **RF-C11 Mis números:** ventas del día/semana/mes, cuánto recibirá y cuándo (calendario de pagos de Stripe), su cuota, la comisión del 8% de cada pedido con su neto, y próxima fecha de cobro. Transparencia total: ningún cargo oculto en ninguna pantalla.
- **RF-C12 Registro de lotes:** para encurtidos y fermentados, campo de lote y pH por producción, guardado 12 meses y exportable.

## 6. Requerimientos funcionales — Pagos, suscripción y dinero (backend)

- **RF-P01 Cobro al cliente:** Stripe Payment Intents (intenciones de pago) con el monto total = subtotal + impuesto, sin cargo de servicio al comprador. La plataforma es la vendedora registral a efectos del impuesto (ver sección 7). Su comisión (RF-P03) se descuenta del lado de la cocinera al pagarle.
- **RF-P02 Pago a la cocinera:** cuentas **Standard** de Stripe Connect (Stripe cobra el procesamiento directo y no cobra extra por cuenta; las cuentas Express costarían US$2/mes por cocinera activa + 0,25% + US$0,25 por pago y quedan descartadas para el MVP). La cocinera recibe el 100% de su precio de venta.
- **RF-P03 Comisión única del 8% (decisión de Marcos, 14-11-2026):** la plataforma cobra una comisión del **8% por venta**, de la cual paga el costo de procesamiento de Stripe (2,9% + US$0,30 por pago). La aritmética es la protección del modelo: la comisión supera al costo de la tarjeta en todo tamaño de pedido realista (pedido de US$10: comisión US$0,80 contra costo US$0,59; de US$20: US$1,60 contra US$0,88; de US$40: US$3,20 contra US$1,46), así que **el costo de la tarjeta nunca sale de la suscripción ni genera pérdidas**. La cocinera ve por pedido: precio, comisión 8%, neto a recibir. Sin cargo de servicio al comprador (el de US$0,99 del diseño anterior queda eliminado).

- **RF-P04 Comisión promocional configurable:** el panel puede fijar una comisión reducida (por ejemplo 5%) para cocineras fundadoras o campañas por barrio, con fecha de inicio y fin registradas. La comisión estándar es 8% y ningún cambio aplica retroactivamente a pedidos ya pagados.

- **RF-P05 Suscripción de la cocinera:** Stripe Billing: US$29/mes (plan regular) y US$19/mes (fundadora, 6 meses, luego migra sola a US$29 con aviso 15 días antes). Si el cobro falla: 3 reintentos en 7 días, vitrina en pausa al día 8, baja a los 30 días sin pago. Sin pedidos, la cocinera puede pausar su vitrina; la suscripción se cobra solo en meses con vitrina activa al menos 1 día (decisión de negocio registrada: cobrar por mes activo, no por mes calendario).
- **RF-P06 Reembolsos y disputas:** reembolso total si la cocinera cancela o no entrega; parcial por acuerdo en el panel. Las disputas bancarias (contracargos, US$15 por caso en Stripe) se asignan a la cocinera en cuentas Standard; el panel muestra el estado y las pruebas (código de cierre, ubicación, horas) se adjuntan con un clic.
- **RF-P07 Conciliación automática:** tarea nocturna que compara pagos de Stripe contra la base de datos; cualquier diferencia mayor a US$0,01 genera alerta en el panel. Nada de conciliación a mano en planillas.
- **RF-P08 Efectivo en recogida (opcional por cocinera):** pedidos de recogida pueden pagarse en efectivo al retirar: costo de tarjeta cero, pero sin garantía de prepago; el pedido queda marcado «efectivo» y no cuenta para el fondo del RF-P03. La cocinera decide si lo acepta.

## 7. Requerimientos funcionales — Impuestos (backend, obligación legal de la plataforma)

Contexto: por la sección 151.0242 del Código de Impuestos de Texas, el proveedor del mercado (marketplace provider) debe **cobrar y remitir** el impuesto sobre las ventas de terceros. La plataforma tendrá permiso de impuesto sobre las ventas de Texas (Texas Sales and Use Tax Permit) a nombre de su sociedad (LLC) antes de la primera venta.

- **RF-I01 Cálculo por venta:** Stripe Tax calcula la tasa según la dirección de entrega (estatal 6,25% + local hasta 2%; total máximo 8,25%) y la categoría del producto (hay productos de panadería para llevar exentos según el caso: la categoría tributaria se define por plato con la tabla del Contralor, no a mano por venta). Costo de Stripe Tax: ~0,5% del volumen, contado como costo operativo.
- **RF-I02 Apartado contable:** el impuesto cobrado nunca se mezcla con ingresos: cuenta contable separada en el sistema y en los reportes («impuesto por remitir»).
- **RF-I03 Cierre y declaración mensual:** el panel genera el reporte del mes (ventas por jurisdicción, impuesto cobrado) listo para declarar y pagar al Contralor en su portal; queda guardado el comprobante en `impuestos_mensuales`.
- **RF-I04 Ventas fuera de la plataforma:** las ventas directas de la cocinera (fuera de la aplicación) son su responsabilidad fiscal; el sistema no las registra ni las mezcla (pero sí cuentan para su tope de US$150.000: la cocinera puede declararlas en un campo manual de ajuste del contador RF-C10).

## 8. Requerimientos funcionales — Cliente (frontend)

- **RF-U01 Entrada sin fricción:** enlace web que abre el catálogo del barrio sin instalar nada y sin registro previo; el registro se pide recién al pagar.
- **RF-U02 Catálogo por cercanía:** cocineras dentro del radio que ellas mismas definieron; filtros: tipo (panadería, repostería, refrigerados), alérgenos a evitar, día de cocina. Cada plato muestra ingredientes y alérgenos siempre visibles, no escondidos.
- **RF-U03 Preorden clara:** cada plato muestra «encarga hasta las 6:00 p. m., entrega mañana entre 4 y 6 p. m.» — nada de promesas de inmediatez.
- **RF-U04 Pago transparente:** desglose visible antes de pagar: subtotal + impuesto. Sin cargo de servicio ni cargos sorpresa: el precio del plato es el precio (la comisión la descuenta la plataforma de su lado de la venta, no la paga el comprador).
- **RF-U05 Seguimiento en vivo:** mapa con la ubicación de la cocinera solo durante la entrega de su pedido; avisos por WhatsApp en cada cambio de estado.
- **RF-U06 Código y confirmación:** código de 4 dígitos para cerrar la entrega o la recogida; botón «tuve un problema» que abre reclamo directo al panel (y a incidente si es de salud).
- **RF-U07 Calificaciones:** 1–5 estrellas y comentario tras la entrega; la cocinera puede responder; las calificaciones alimentan el orden del catálogo.

## 9. Requerimientos funcionales — Panel de administración (familia)

- **RF-A01 Aprobaciones:** cola de cocineras pendientes con su tarjeta, registro DSHS y datos; aprobar/rechazar con motivo. Cola de platos nuevos de cocineras en sus primeros 30 días (revisión humana anti-categorías prohibidas, segunda capa tras el bloqueo automático).
- **RF-A02 Mapa y operación del día:** pedidos en curso, entregas en vivo, alertas de pedidos sin confirmar a 30 minutos de la hora de corte.
- **RF-A03 Incidentes y protocolo de salud:** al reportarse un problema de salud: (1) pausa inmediata de la cocinera y del plato, (2) lista automática de clientes que compraron ese lote en 72 horas para contactarlos, (3) registro de acciones con hora, (4) reapertura solo manual tras revisión. Todo queda en `incidentes` como evidencia.
- **RF-A04 Dinero:** suscripciones activas/fallidas, comisiones del 8% y su margen tras pagar el procesamiento, conciliación (RF-P07), reporte de impuestos del mes (RF-I03).
- **RF-A05 Soporte:** bandeja de reclamos con respuesta por WhatsApp desde el panel; preguntas frecuentes en español para respuestas rápidas.
- **RF-A06 Métricas mínimas:** cocineras activas, pedidos por barrio, venta promedio, bajas de suscripción y su motivo. Sin métricas vanidosas: solo las que deciden abrir o cerrar un barrio.

## 10. Notificaciones y comunicaciones

- **RF-N01 Canales:** WhatsApp (principal), notificación push en la aplicación y correo (respaldo y documentos). Plantillas de WhatsApp aprobadas por Meta para: pedido recibido, confirmado, en cocina, en entrega, entregado, problema, recordatorio de renovación de tarjeta, cobro de suscripción fallido.
- **RF-N02 Regla de idioma:** todo mensaje sale en el idioma del perfil del destinatario (español por defecto).
- **RF-N03 Sin spam:** máximo los mensajes del ciclo del pedido + 1 aviso comercial semanal optativo (con salida fácil). El número de WhatsApp Business es de la plataforma, verificado, con nombre y foto del negocio.

## 11. Requerimientos no funcionales

- **RNF-01 Seguridad:** RLS activo en todas las tablas (cada cocinera y cliente solo accede a lo suyo); dirección de casa de la cocinera visible solo para administración y, al momento de la recogida, como punto en el mapa — nunca como texto público; contraseñas con el estándar de Supabase Auth; sesiones con expiración; registro de auditoría de acciones del panel (quién aprobó, pausó o reembolsó, y cuándo).
- **RNF-02 Privacidad:** la ubicación en vivo existe solo durante una entrega activa y se borra del historial público a las 24 horas (queda el registro interno del pedido). Datos personales mínimos; política de privacidad y términos en español e inglés, aceptados al registrarse.
- **RNF-03 Rendimiento:** catálogo carga en menos de 2,5 segundos en un teléfono Android gama media con 4G; imágenes de platos comprimidas automáticamente (máx. 300 KB por foto servida).
- **RNF-04 Disponibilidad y respaldo:** respaldo automático diario de la base de datos (incluido en Supabase) + exportación semanal de pedidos, pagos e impuestos a almacenamiento externo. Objetivo: si el proveedor cae, ningún registro fiscal se pierde.
- **RNF-05 Accesibilidad y lenguaje:** botones grandes, texto mínimo de 16px en la aplicación de la cocinera, lenguaje simple sin tecnicismos; toda sigla en pantalla va explicada (regla de la casa).
- **RNF-06 Costos operativos objetivo del MVP:** infraestructura total ≤ US$350/mes hasta 100 cocineras (Vercel + Supabase + mapas + WhatsApp + Stripe Tax ~0,5% del volumen aparte).

## 12. API principal (contrato entre frentes y backend)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/pedidos` | Cliente | Crea el pedido y la intención de pago (con el impuesto calculado en el servidor y la comisión del 8% aplicada del lado de la cocinera) |
| `GET /api/catalogo?zona=` | Público | Cocineras y platos activos de la zona |
| `POST /api/cocineras/habilitacion` | Cocinera | Envía documentos y datos para aprobación |
| `POST /api/platos` / `PATCH /api/platos/:id` | Cocinera | Crea/edita platos (pasa por el motor de cumplimiento RF-C04/C05) |
| `POST /api/etiquetas` | Cocinera | Genera el PDF de etiquetas de uno o varios platos |
| `PATCH /api/pedidos/:id/estado` | Cocinera/Cliente | Cambia el estado del pedido (con reglas de quién puede pasar a qué estado) |
| `POST /api/pedidos/:id/ubicacion` | Cocinera | Envía su ubicación durante la entrega (cada 15–30 segundos) |
| `POST /api/webhooks/stripe` | Stripe | Eventos de pago, suscripción, reembolso y disputa (fuente de verdad del dinero) |
| `GET /api/admin/impuestos/:mes` | Admin | Reporte mensual de impuestos (RF-I03) |
| `POST /api/admin/incidentes/:id/acciones` | Admin | Ejecuta el protocolo (pausar, contactar lote, reabrir) |

Regla de oro de la API: **todo cálculo de dinero e impuestos se hace en el servidor**, nunca en el teléfono del cliente.

## 13. Ambientes, despliegue e implementación por etapas

- **Ambientes:** desarrollo (datos de juguete), pruebas (Stripe en modo de prueba, WhatsApp de prueba) y producción. Ninguna prueba con dinero real antes del ambiente de producción.
- **Etapa 0 — Cimientos (semana 1–2):** repositorio, ambientes, autenticación, roles, RLS, diseño base en español. *Criterio de salida:* una cocinera de prueba inicia sesión y ve su panel vacío.
- **Etapa 1 — Cocinera (semana 3–5):** habilitación (RF-C01/C02), platos con cumplimiento (RF-C03–C06), agenda (RF-C07). *Criterio de salida:* una cocinera real completa su habilitación y publica 3 platos legales; un plato con carne es rechazado por el sistema.
- **Etapa 2 — Dinero (semana 6–8):** pagos y Connect (RF-P01–P03), suscripción (RF-P05), impuestos (RF-I01–I03), conciliación (RF-P07). *Criterio de salida:* compra de prueba de punta a punta con impuesto correcto según dos direcciones distintas y pago íntegro a la cocinera de prueba.
- **Etapa 3 — Cliente y entrega (semana 9–11):** catálogo web (RF-U01–U04), seguimiento en vivo (RF-U05), códigos (RF-U06), calificaciones (RF-U07), pedidos de la cocinera (RF-C08/C09). *Criterio de salida:* un pedido real de prueba entregado por la cocinera piloto, con el cliente viendo el mapa.
- **Etapa 4 — Panel y lanzamiento (semana 12–13):** aprobaciones, incidentes y métricas (RF-A01–A06), notificaciones completas (RF-N01), endurecimiento de seguridad y respaldo (RNF-01/04). *Criterio de salida:* simulacro de incidente de salud ejecutado en menos de 10 minutos desde el panel.
- **Piloto:** 5 cocineras fundadoras, 1 barrio, 2 semanas, con soporte diario de la familia. Recién después: las 25 fundadoras y publicación en tiendas.

## 14. Riesgos técnicos y decisiones abiertas

| Riesgo / decisión | Estado | Mitigación o qué falta |
|---|---|---|
| Stripe Tax (~0,5% del volumen) encarece el margen de la comisión del 8% | Aceptado y costeado | Alternativa: TaxJar o cálculo propio por tabla del Contralor en fase 2 |
| WhatsApp puede tardar en aprobar plantillas y la verificación del número | Riesgo de calendario | Iniciar el trámite en la Etapa 0; mientras tanto, push y correo |
| El bloqueo de ingredientes prohibidos por texto libre dará falsos positivos/negativos | Conocido | Lista cerrada de categorías + revisión humana los primeros 30 días (RF-A01) |
| Google Maps cobra por uso al crecer | Costo variable | Presupuesto por barrio; evaluar Mapbox al pasar de 100 cocineras |
| ¿La suscripción se cobra también en meses sin ventas? | Decidido: solo meses con vitrina activa (RF-P05) | Revisar a los 6 meses con datos de bajas |
| Nombre y marca de la plataforma | **Abierto** (decisión de Marcos y la familia) | Debe elegirse antes de la Etapa 4 (dominio, WhatsApp Business, tiendas) |
| Constitución de la LLC y permiso de impuesto sobre las ventas de Texas | **Abierto** (trámite previo a producción) | Sin el permiso no se puede vender: es requisito de la Etapa 2 |

## Glosario

| Sigla | Significado | En simple |
|---|---|---|
| API | Application Programming Interface | La puerta por donde las aplicaciones le piden cosas al servidor |
| DSHS | Texas Department of State Health Services | Departamento estatal de salud de Texas |
| LLC | Limited Liability Company | Sociedad de responsabilidad limitada |
| MVP | Minimum Viable Product | Primera versión útil del producto |
| PCI DSS | Payment Card Industry Data Security Standard | Estándar de seguridad de tarjetas (lo cumple Stripe por nosotros) |
| PDF | Portable Document Format | Formato de documento portátil |
| PWA | Progressive Web App | Aplicación web que se puede «instalar» desde un enlace |
| REST | Representational State Transfer | Estilo estándar de servicios web |
| RLS | Row Level Security | Seguridad por fila: cada quien ve solo sus datos |
| SB 541 | Senate Bill 541 | Ley 541 del Senado de Texas (comida casera, 2025) |
| TCS | Time and Temperature Control for Safety | Alimentos que exigen control de tiempo y temperatura |

*Documento generado el 2026-11-14 a partir del brainstorming 360° del proyecto. Los requerimientos con identificador (RF/RNF) son la referencia para construir, probar y aceptar cada etapa.*
