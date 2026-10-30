# NexoStock — landing comercial

Landing estática en Astro. Oferta de lanzamiento: **USD 29/mes + USD 59 de implementación**, una Tiendanube y hasta tres ubicaciones físicas más fallados y virtual. Cobro en ARS al oficial vendedor del Banco Nación al emitir cada cobro. Sin anual ni prueba operativa automática.

### Precios en pesos

El importe estimado en ARS es principal y la referencia contractual en USD permanece visible. `src/lib/exchange-rate.mjs` consulta el oficial vendedor de DolarAPI (fuente Ámbito, puede diferir del BNA). Muestra fecha y fuente. El build incorpora una cotización y el navegador la actualiza con un tiempo máximo de 3,5 segundos, sin cookies ni referrer. Conserva una caché funcional por una hora; admite un último valor de hasta siete días para fines de semana y feriados. Ante errores usa ese valor identificado; si no hay cotización reciente, vuelve a USD sin inventar un tipo de cambio. `src/data/exchange-rate.json` es el respaldo verificado inicial, sujeto a la misma validación de antigüedad. El monto final en ARS se determina al emitir cada cobro con BNA.

## Desarrollo y validación

Node 22.19 o superior; recomendado Node 24 LTS. El binario del runtime de Codex también sirve sin cambiar el Node global de la máquina.

```powershell
npm ci
npm run dev
npm test
npm run check
npm run build
npm run preview
```

El sitio genera `/`, `/privacidad` y `/condiciones`. No necesita backend. Fuente Inter alojada localmente, licencia en `public/fonts/LICENSE-Inter.txt`. La tarjeta social incluye fuente SVG y PNG de 1200×630.

## Oferta y contacto

La configuración central está en `src/lib/site.ts`. `PUBLIC_WHATSAPP_NUMBER` permite reemplazar el celular en formato `549` + diez dígitos. Se agregó el prefijo argentino al número de la landing original y se valida su formato; antes de publicar, el titular debe comprobar que es el número comercial activo. No se enviaron mensajes para probarlo.

Los CTA abren WhatsApp directamente con un mensaje editable y la referencia aleatoria `NS-XXXXXXXX`. No envían el mensaje automáticamente. Sin JavaScript también funcionan, usando el texto base sin referencia.

`ProductPreview` y `Walkthrough` usan ejemplos identificados, con datos ficticios. No acceden a una instalación real. Las pestañas admiten teclado y el sitio respeta movimiento reducido. Los documentos comerciales se mantienen en Benai/NexoStock de Drive y en `nexo-stock/docs/ESTRATEGIA_COMERCIAL.md` y `PRICING_LANZAMIENTO.md`.

## PostHog Free — preparado, deshabilitado por defecto

El titular todavía no tiene cuenta de PostHog y pidió dejar la configuración preparada. No hay SDK ni grabaciones: el cliente envía únicamente cinco tipos de evento a la API Capture, después de aceptar medición. No se creó una cuenta ni se contrataron servicios.

1. Crear un proyecto Free, sin tarjeta ni complementos, y elegir región EU o US.
2. En ajustes de privacidad, descartar IP y desactivar geolocalización, replay y autocaptura. Mantener retención de hasta doce meses.
3. Copiar `.env.example` a `.env.local` o configurar las variables en el proveedor de hosting. Usar el **token público de proyecto phc_**, nunca una clave personal/secreta. Fijar el host a la región correcta.
4. Usar `PUBLIC_ANALYTICS_ENV=production` solo para el build de producción. Dejarlo `disabled` en previews y pruebas. Solo los dominios `nexostock.benai.com.ar` y `www.nexostock.benai.com.ar` pueden enviar eventos.
5. Configurar `PUBLIC_ANALYTICS_CAMPAIGNS` con códigos exactos admitidos. Ejemplo: `?utm_source=instagram&utm_medium=paid_social&utm_campaign=local_online`. Los valores desconocidos se reducen a `other` o `unassigned`; otros parámetros nunca se transmiten.
6. Recompilar y verificar recepción real en PostHog. Sin aceptar, con rechazo, DNT/GPC, staff, localhost y previews no debe haber tráfico analítico.

Para excluir staff: abrir `/?ns_internal=1` una vez por navegador. Para quitar la exclusión: `/?ns_internal=0` y recargar. La preferencia es local y no sale en eventos. Las preferencias de medición se pueden cambiar en el footer.

Eventos: `landing_view`, `pricing_view`, `demo_open`, `demo_step_view`, `whatsapp_click`. La referencia de sesión se almacena solo después de aceptar; sin consentimiento es efímera y no se relaciona con eventos. No se comparten cookies entre subdominios, no se crean perfiles personales ni se envían URLs, productos, importes o datos de compradores.

Los tests usan transporte simulado para validar consentimiento, exclusiones, deduplicación y minimización. No prueban recepción en una cuenta todavía inexistente. Las visitas consentidas son una muestra; un clic a WhatsApp es intención, no un contacto confirmado.

El exportador agregado del producto, las consultas para insights y la plantilla comercial están en `nexo-stock/docs/ANALITICA_Y_NSM.md`. No requieren Group Analytics ni activar un scheduler. Las APIs operativas del producto no cambiaron.

## Antes de publicar

Confirmar titularidad del número comercial y condiciones fiscales de la cotización. Revisar el preview responsive y las rutas informativas. El sitio no realiza cobros ni crea suscripciones; cada implementación requiere propuesta aceptada y aceptación operativa. El pedido web pagado/cancelado, backup del servicio y estabilidad siguen sujetos a la guía de alta del producto.
