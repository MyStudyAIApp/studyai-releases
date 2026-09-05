# -*- coding: utf-8 -*-
"""Plantillas de los correos de cuenta de Supabase, con marca y en espanol.

Contexto (5/9/2026): estaban en los VALORES POR DEFECTO de Supabase y en
INGLES. Un usuario espanol recibia "Reset your password" sin logo ni estetica.

Reglas del HTML de correo, que no son capricho:
  - Maquetacion con <table> y CSS EN LINEA. Gmail y Outlook ignoran las hojas
    de estilo, flexbox y grid.
  - El logo tiene que ser una URL publica absoluta. No valen rutas relativas
    ni adjuntos. Se usa https://mystudyai.eu/favicon.png, que ya esta servido.
  - El logo lleva su propio fondo oscuro, asi que se ve bien tanto en Gmail
    claro como en oscuro (un PNG con fondo blanco se ve como un ladrillo).
  - Las variables de Supabase se copian LITERALES: cambiar una letra de
    {{ .ConfirmationURL }} rompe el enlace y deja a la gente sin poder entrar.

Uso:
    python plantillas_supabase.py <fichero_con_el_token> [clave ...]
Sin claves aplica todas. Con claves, solo esas (p.ej. `recovery`).
"""
import io
import json
import os
import sys
import urllib.request

REF = 'kdxmnfqbsfpcakqxanrf'
URL = 'https://api.supabase.com/v1/projects/%s/config/auth' % REF
# Cloudflare devuelve 403 (error 1010) si no llega User-Agent de navegador.
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/128.0 Safari/537.36')

LOGO = 'https://mystudyai.eu/favicon.png'
WEB = 'https://mystudyai.eu'
SOPORTE = 'support@mystudyai.eu'
MORADO = '#7c3aed'


def envoltura(titulo, parrafos, boton_texto=None, boton_url=None, nota=None):
    """Devuelve el HTML completo de un correo: cabecera, cuerpo y pie."""
    cuerpo = ''.join(
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">%s</p>' % p
        for p in parrafos)

    boton = ''
    if boton_texto:
        boton = (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            'style="margin:8px 0 24px;"><tr><td align="center" bgcolor="%s" '
            'style="border-radius:10px;">'
            '<a href="%s" style="display:inline-block;padding:13px 28px;font-size:15px;'
            'font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">%s</a>'
            '</td></tr></table>' % (MORADO, boton_url, boton_texto)
        )

    pie_nota = ''
    if nota:
        pie_nota = ('<p style="margin:0 0 16px;font-size:13px;line-height:1.6;'
                    'color:#64748b;">%s</p>' % nota)

    return (
        '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color:#f1f5f9;padding:32px 12px;">'
        '<tr><td align="center">'
        '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" '
        'style="max-width:520px;background-color:#ffffff;border-radius:16px;'
        'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">'

        # Cabecera con el logo
        '<tr><td align="center" style="padding:32px 32px 8px;">'
        '<img src="%s" width="56" height="56" alt="MyStudy AI" '
        'style="display:block;border:0;border-radius:12px;">'
        '</td></tr>'

        # Titulo
        '<tr><td align="center" style="padding:8px 32px 0;">'
        '<h1 style="margin:0;font-size:20px;line-height:1.35;color:#0f172a;'
        'font-weight:700;">%s</h1>'
        '</td></tr>'

        # Cuerpo y boton
        '<tr><td style="padding:20px 32px 0;">%s%s%s</td></tr>'

        # Pie
        '<tr><td style="padding:8px 32px 32px;border-top:1px solid #e2e8f0;">'
        '<p style="margin:16px 0 4px;font-size:12px;line-height:1.6;color:#94a3b8;">'
        'Este correo te lo env&iacute;a <a href="%s" style="color:%s;text-decoration:none;">'
        'MyStudy AI</a>. Si necesitas ayuda, escr&iacute;benos a '
        '<a href="mailto:%s" style="color:%s;text-decoration:none;">%s</a>.</p>'
        '</td></tr>'

        '</table></td></tr></table>'
    ) % (LOGO, titulo, cuerpo, boton, pie_nota, WEB, MORADO, SOPORTE, MORADO, SOPORTE)


IGNORAR = 'Si no has sido t&uacute;, puedes ignorar este correo sin hacer nada.'

PLANTILLAS = {
    'recovery': {
        'asunto': 'Cambia tu contraseña de MyStudy AI',
        'html': envoltura(
            'Cambia tu contrase&ntilde;a',
            ['Hemos recibido una petici&oacute;n para cambiar tu contrase&ntilde;a. '
             'Pulsa el bot&oacute;n y elige una nueva.'],
            'Elegir contrase&ntilde;a nueva', '{{ .ConfirmationURL }}',
            IGNORAR + ' Tu contrase&ntilde;a actual seguir&aacute; funcionando.'),
    },
    'confirmation': {
        'asunto': 'Confirma tu correo y empieza a estudiar',
        'html': envoltura(
            'Confirma tu correo',
            ['Ya casi est&aacute;. Pulsa el bot&oacute;n para confirmar tu correo y '
             'terminar de crear tu cuenta.'],
            'Confirmar mi correo', '{{ .ConfirmationURL }}',
            'Si no has creado ninguna cuenta, puedes ignorar este correo.'),
    },
    'magic_link': {
        'asunto': 'Tu enlace de acceso a MyStudy AI',
        'html': envoltura(
            'Entra en tu cuenta',
            ['Pulsa el bot&oacute;n para entrar. El enlace caduca en unos minutos y '
             'solo se puede usar una vez.'],
            'Entrar en MyStudy AI', '{{ .ConfirmationURL }}', IGNORAR),
    },
    'email_change': {
        'asunto': 'Confirma tu nuevo correo',
        'html': envoltura(
            'Confirma tu nuevo correo',
            ['Pulsa el bot&oacute;n para confirmar <strong>{{ .NewEmail }}</strong> '
             'como tu nuevo correo.'],
            'Confirmar el cambio', '{{ .ConfirmationURL }}', IGNORAR),
    },
    'password_changed_notification': {
        'asunto': 'Tu contraseña ha cambiado',
        'html': envoltura(
            'Tu contrase&ntilde;a ha cambiado',
            ['Te avisamos de que la contrase&ntilde;a de tu cuenta se ha cambiado hace un momento.'],
            None, None,
            'Si no has sido t&uacute;, escr&iacute;benos cuanto antes a ' + SOPORTE + '.'),
    },
}

CLAVE_ASUNTO = 'mailer_subjects_%s'
CLAVE_HTML = 'mailer_templates_%s_content'


def aplicar(token, claves):
    cuerpo = {}
    for c in claves:
        p = PLANTILLAS[c]
        cuerpo[CLAVE_ASUNTO % c] = p['asunto']
        cuerpo[CLAVE_HTML % c] = p['html']

    req = urllib.request.Request(
        URL, data=json.dumps(cuerpo).encode('utf-8'), method='PATCH',
        headers={'Authorization': 'Bearer ' + token,
                 'Content-Type': 'application/json',
                 'User-Agent': UA})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def comprobar(devuelto, claves):
    """Relee lo que respondio la API: que la variable siga intacta y sea el nuestro."""
    for c in claves:
        html = devuelto.get(CLAVE_HTML % c, '')
        assert 'mystudyai.eu/favicon.png' in html, '%s: no se guardo nuestra plantilla' % c
        if c != 'password_changed_notification':
            assert '{{ .ConfirmationURL }}' in html, '%s: se perdio ConfirmationURL' % c
        if c == 'email_change':
            assert '{{ .NewEmail }}' in html, 'email_change: se perdio NewEmail'
        print('  OK', c, '->', devuelto.get(CLAVE_ASUNTO % c))


if __name__ == '__main__':
    token = io.open(sys.argv[1], encoding='utf-8').read().strip()
    claves = sys.argv[2:] or list(PLANTILLAS)
    for c in claves:
        assert c in PLANTILLAS, 'plantilla desconocida: %s' % c
    print('aplicando:', ', '.join(claves))
    comprobar(aplicar(token, claves), claves)
