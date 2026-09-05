# -*- coding: utf-8 -*-
"""Renueva el YOUTUBE_REFRESH_TOKEN del .env con una autorizacion nueva.

Por que existe: el token anterior murio con "invalid_grant" porque la app de
Google estaba en modo "Prueba", y ahi los refresh tokens caducan a los 7 dias.
Publicada la app (5/9/2026, estado "En produccion"), el token nuevo ya no
caduca solo -- este script solo deberia hacer falta si algun dia se revoca el
acceso a mano o se cambian los permisos.

Uso:
    python scripts/youtube/autorizar_youtube.py

Imprime una URL, la abres en el navegador con la cuenta mystudyaiapp@gmail.com,
aceptas, y el script guarda el token nuevo en python-service/.env. La
contrasena la escribes tu en Google; el script solo recibe el codigo de vuelta.

Si Google avisa de "app no verificada": Configuracion avanzada -> Ir a MyStudy
AI. Es normal, la app es tuya y solo pide subir a tu propio canal.
"""
import http.server
import io
import os
import json
import socketserver
import threading
import urllib.parse
import urllib.request
import webbrowser

PUERTO = 8765
REDIRECT = 'http://localhost:%d' % PUERTO

# Tres permisos, para no tener que repetir esto cada vez que haga falta algo
# nuevo. Con solo `upload` se puede subir pero leer el canal da 403
# ("insufficient authentication scopes"), que es justo lo que paso el 5/9.
#   upload    -> subir videos
#   readonly  -> visualizaciones, me gusta, suscriptores
#   force-ssl -> leer y responder comentarios, editar videos ya subidos
SCOPE = ' '.join([
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl',
])
ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'python-service', '.env')
ENV = os.path.normpath(ENV)


def leer_env():
    datos = {}
    for linea in io.open(ENV, encoding='utf-8'):
        if '=' in linea and not linea.lstrip().startswith('#'):
            k, v = linea.split('=', 1)
            datos[k.strip()] = v.strip()
    return datos


def guardar_refresh_token(token):
    """Reescribe solo la linea del refresh token, dejando el resto intacto."""
    lineas = io.open(ENV, encoding='utf-8').read().split('\n')
    encontrada = False
    for i, l in enumerate(lineas):
        if l.startswith('YOUTUBE_REFRESH_TOKEN='):
            lineas[i] = 'YOUTUBE_REFRESH_TOKEN=' + token
            encontrada = True
            break
    assert encontrada, 'no existe la linea YOUTUBE_REFRESH_TOKEN en el .env'
    io.open(ENV, 'w', encoding='utf-8').write('\n'.join(lineas))


codigo = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        codigo['valor'] = params.get('code', [None])[0]
        codigo['error'] = params.get('error', [None])[0]
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        msg = 'Listo, ya puedes cerrar esta pestana.' if codigo['valor'] else 'Fallo la autorizacion.'
        self.wfile.write(('<h2>%s</h2>' % msg).encode('utf-8'))

    def log_message(self, *a):
        pass  # sin ruido en consola


def main():
    env = leer_env()
    cid, secret = env['YOUTUBE_CLIENT_ID'], env['YOUTUBE_CLIENT_SECRET']

    url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode({
        'client_id': cid,
        'redirect_uri': REDIRECT,
        'response_type': 'code',
        'scope': SCOPE,
        'access_type': 'offline',
        'prompt': 'consent',       # obliga a devolver refresh_token, no solo access_token
    })

    servidor = socketserver.TCPServer(('localhost', PUERTO), Handler)
    hilo = threading.Thread(target=servidor.handle_request)
    hilo.start()

    print('\nAbre esta URL y acepta con mystudyaiapp@gmail.com:\n')
    print(url + '\n')
    try:
        webbrowser.open(url)
    except Exception:
        pass

    hilo.join(timeout=300)
    servidor.server_close()

    if codigo.get('error'):
        print('Google devolvio un error:', codigo['error'])
        return
    if not codigo.get('valor'):
        print('No llego ningun codigo (se agoto el tiempo de espera).')
        return

    datos = urllib.parse.urlencode({
        'code': codigo['valor'],
        'client_id': cid,
        'client_secret': secret,
        'redirect_uri': REDIRECT,
        'grant_type': 'authorization_code',
    }).encode()
    tok = json.loads(urllib.request.urlopen(
        urllib.request.Request('https://oauth2.googleapis.com/token', data=datos), timeout=30).read())

    if 'refresh_token' not in tok:
        print('Google no devolvio refresh_token. Revoca el acceso en')
        print('https://myaccount.google.com/permissions y vuelve a ejecutarlo.')
        return

    guardar_refresh_token(tok['refresh_token'])
    print('Token nuevo guardado en', ENV)

    # Comprobacion inmediata: si el token no sirve, mejor saberlo ahora.
    r = urllib.request.Request(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        headers={'Authorization': 'Bearer ' + tok['access_token']})
    canal = json.loads(urllib.request.urlopen(r, timeout=30).read())
    print('Canal autorizado:', canal['items'][0]['snippet']['title'])


if __name__ == '__main__':
    main()
