# Runbook: cierre del servicio MyStudy AI

Qué hacer, y en qué orden, si algún día se decide cerrar MyStudy AI.

Existe porque las Condiciones de Uso (§ Interrupción del servicio) prometen
cosas concretas — 30 días de preaviso, ventana de descarga, reembolsos — y
ese día no es momento de improvisar. Escrito el 2026-08-25.

**El orden importa más que la velocidad.** El paso 1 es el que hace que casi
no haya reembolsos que pagar. Si se hace tarde, el trabajo se multiplica.

---

## Antes de nada: por qué esto no debería doler

Solo hay **un plan de suscripción y es mensual** (Pro, 15 €/mes — ver
`PRICE_MAP` en `python-service/stripe_billing.py`). No hay plan anual.

Si el mismo día del anuncio se cortan las renovaciones, cada usuario agota
el mes que ya tenía pagado dentro de la ventana de 30 días de preaviso. Nadie
se queda con periodo pagado sin disfrutar y **los reembolsos de suscripción
son cero**.

> ⚠️ Si alguna vez se crea un plan anual, esto deja de ser cierto y habrá
> prorrateos de verdad. Actualizar este documento el mismo día que se cree
> ese precio.

Lo que sí hay que devolver siempre son los **bonos comprados y no
consumidos**: es dinero cobrado por algo que no se va a entregar.

---

## Día 0 — Cortar renovaciones (ANTES de anunciar nada)

Primero se corta el grifo, después se comunica. Al revés, hay gente que
renueva justo entre el anuncio y el corte, y esa sí genera reembolso.

**Stripe.** Marcar todas las suscripciones activas como
`cancel_at_period_end = true`. Mantiene el acceso hasta el final del ciclo ya
pagado y evita el siguiente cobro. No usar cancelación inmediata: cortaría un
periodo que el usuario ya pagó.

```bash
python -c "
import stripe, os
stripe.api_key = os.environ['STRIPE_SECRET_KEY']
n = 0
for s in stripe.Subscription.list(status='active', limit=100).auto_paging_iter():
    stripe.Subscription.modify(s.id, cancel_at_period_end=True)
    n += 1
print(f'{n} suscripciones marcadas para no renovar')
"
```

**Google Play.** Desde Play Console, retirar el producto de suscripción para
que nadie más se suscriba. Las suscripciones vivas siguen su curso; Google
gestiona sus propias renovaciones.

**Cerrar la entrada de dinero nuevo.** Desactivar los `price_id` de bonos en
`PRICE_MAP` y ocultar los botones de compra en Ajustes y en la web. Cobrar un
bono el día antes de cerrar es el peor escenario posible.

## Día 0 — Anunciar

Preaviso mínimo de **30 días naturales** desde este momento (Condiciones,
§ Interrupción del servicio). Por dos vías, las dos son obligatorias:

1. **Email** a la dirección asociada a cada cuenta. Ya existe la
   infraestructura de Resend en el backend (ver los avisos de retención e
   inactividad en `web_main.py` como plantilla). Ojo con qué clave de Resend
   se usa: la de `studesign.es` NO envía desde `mystudyai.eu`.
2. **Aviso visible dentro de la aplicación.** La tabla `announcements` ya
   existe y se muestra en la app.

El mensaje debe decir, sin rodeos: la fecha efectiva de cierre, que se puede
descargar todo desde **Ajustes → Descargar mis datos**, que no habrá más
cobros, y que los bonos sin consumir se devuelven.

## Días 1–30 — Ventana de descarga

`POST /account/export` tiene que seguir vivo hasta la fecha efectiva de
cierre. Esto significa **no apagar Render ni Supabase antes de tiempo**, por
muy tentador que sea dejar de pagarlos.

Genera el ZIP en segundo plano y envía por email un enlace de descarga que
caduca a los 7 días (`_generate_and_email_export` en `web_main.py`) — el usuario
no espera en la app ni hay riesgo de chocar con el límite de 100s de
Cloudflare, incluso con bibliotecas grandes. El cron
`/admin/cleanup-old-exports` borra esos ZIPs pasados 7 días; durante el cierre,
comprobar que sigue corriendo o desactivarlo temporalmente si genera ruido.

## Días 1–30 — Reembolsar los bonos no consumidos

`bono_purchases` son los abonos y `bono_consumption` los cargos; el saldo es
la resta (ver el comentario en `python-service/ai/quotas.py`, línea ~240).

```bash
psql "$DATABASE_URL" -c "
select p.user_id, p.category,
       sum(p.amount_eur) - coalesce((select sum(c.amount_eur) from bono_consumption c
            where c.user_id = p.user_id and c.category = p.category), 0) as saldo_eur
from bono_purchases p
group by 1, 2
having sum(p.amount_eur) - coalesce((select sum(c.amount_eur) from bono_consumption c
            where c.user_id = p.user_id and c.category = p.category), 0) > 0
order by 3 desc;"
```

Cada fila de `bono_purchases` guarda su `stripe_event_id` o su
`revenuecat_event_id`, así que localizar el cargo concreto a devolver es
directo, sin rebuscar en el panel.

- **Compras por Stripe** → `stripe.Refund.create(charge=..., amount=...)` con
  el importe del saldo, no el total de la compra.
- **Compras por Google Play** → no se pueden reembolsar desde aquí. Van por
  Play Console o por la Play Developer API (`purchases.products.refund`).

> Comprobar el saldo de Stripe antes de empezar: los reembolsos salen de ahí
> y, si no hay fondos, Stripe tira del banco. Con la cuenta ya en cierre eso
> puede fallar en el peor momento.

## Días 1–30 — Facturas rectificativas (el paso que de verdad lleva tiempo)

**Cada reembolso exige emitir una factura rectificativa y registrarla en
VeriFactu.** Esto va por BeeL y es el cuello de botella real del cierre, no
los reembolsos en sí.

Antes de lanzar los reembolsos, confirmar con BeeL si su API permite emitir
rectificativas en lote o si hay que hacerlas una a una. Si son pocas, a mano
sirve.

No borrar facturas a mano bajo ningún concepto: rompe la numeración
correlativa. Una devolución se documenta con una rectificativa, nunca
eliminando la original.

## Fecha efectiva de cierre

- Apagar la web y el backend.
- Retirar las tres apps de Google Play.
- Dejar en pie una página estática mínima en el dominio explicando el cierre
  y con el contacto `support@mystudyai.eu` operativo (ImprovMX) durante al
  menos un año, para reclamaciones y ejercicio de derechos.

## Cierre + 30 días — Borrado

Las Condiciones y la Política de Privacidad prometen borrado permanente a los
30 días naturales de la fecha efectiva de cierre.

- Borrar todos los datos de Supabase (base de datos y bucket `documents`).
- Cancelar Supabase, Render, Cloudflare, Mistral, Groq, Azure, Sentry,
  RevenueCat.

**Lo que NO se borra, por obligación legal:** las facturas y justificantes de
pago. Se conservan durante los plazos fiscales y mercantiles españoles (hasta
6 años). Están en Stripe, Google Play y BeeL. **Descargar una copia completa
antes de cancelar esas cuentas** — si se cancela BeeL sin bajarse las
facturas, el problema es de Hacienda, no de los usuarios.

---

## Resumen en una línea

Cortar renovaciones → anunciar con 30 días → mantener la descarga viva →
devolver bonos + rectificativas → cerrar → borrar a los 30 días → guardar las
facturas 6 años.
