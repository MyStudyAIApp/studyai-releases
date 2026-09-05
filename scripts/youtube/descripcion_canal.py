# -*- coding: utf-8 -*-
"""Rellena la descripcion y las palabras clave del canal de YouTube.

Estaban VACIAS (5/9/2026): el canal no explicaba que es MyStudy AI ni enlazaba
a la web, asi que quien llegaba por un Short no tenia por donde seguir.

Necesita el scope youtube.force-ssl (ya concedido, ver autorizar_youtube.py).

Uso:
    python descripcion_canal.py
"""
import io
import json
import os
import urllib.parse
import urllib.request

ENV = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'python-service', '.env'))

DESCRIPCION = (
    "MyStudy AI convierte tus apuntes en resumenes, fichas y examenes.\n\n"
    "Sube un PDF, haz una foto o dicta tus apuntes en voz, y los transformamos "
    "en material de estudio listo para repasar: resumenes, fichas de repaso, "
    "examenes de practica, podcasts para escuchar y un tutor que resuelve tus "
    "dudas.\n\n"
    "Aqui publicamos trucos de estudio y como sacarle partido a la app.\n\n"
    "Pruebalo gratis: https://mystudyai.eu\n"
    "Tambien en Google Play: MyStudy App y MyStudy Scan"
)

PALABRAS = ('estudiar "tecnicas de estudio" apuntes resumenes fichas examenes '
            'selectividad universidad bachillerato "app de estudio"')


def access_token():
    env = {}
    for l in io.open(ENV, encoding='utf-8'):
        if '=' in l and not l.lstrip().startswith('#'):
            k, v = l.split('=', 1)
            env[k.strip()] = v.strip()
    d = urllib.parse.urlencode({
        'client_id': env['YOUTUBE_CLIENT_ID'],
        'client_secret': env['YOUTUBE_CLIENT_SECRET'],
        'refresh_token': env['YOUTUBE_REFRESH_TOKEN'],
        'grant_type': 'refresh_token',
    }).encode()
    r = urllib.request.urlopen(urllib.request.Request('https://oauth2.googleapis.com/token', data=d), timeout=30)
    return json.loads(r.read())['access_token']


def pedir(url, at, datos=None, metodo='GET'):
    req = urllib.request.Request(
        url, data=json.dumps(datos).encode('utf-8') if datos else None, method=metodo,
        headers={'Authorization': 'Bearer ' + at, 'Content-Type': 'application/json; charset=UTF-8'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def main():
    at = access_token()
    canal = pedir('https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&mine=true', at)['items'][0]

    # Se parte de lo que ya hay y solo se cambian dos campos: mandar un
    # brandingSettings incompleto borraria el resto de ajustes del canal.
    branding = canal['brandingSettings']
    branding.setdefault('channel', {})
    branding['channel']['description'] = DESCRIPCION
    branding['channel']['keywords'] = PALABRAS

    pedir('https://www.googleapis.com/youtube/v3/channels?part=brandingSettings', at,
          {'id': canal['id'], 'brandingSettings': branding}, 'PUT')

    # Releer: es lo unico que confirma que YouTube se lo quedo.
    c2 = pedir('https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&mine=true', at)['items'][0]
    desc = c2['brandingSettings']['channel'].get('description', '')
    assert 'mystudyai.eu' in desc, 'la descripcion no se guardo'
    print('descripcion guardada,', len(desc), 'caracteres')
    print('palabras clave:', c2['brandingSettings']['channel'].get('keywords', '(ninguna)')[:80])


if __name__ == '__main__':
    main()
