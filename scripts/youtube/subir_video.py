# -*- coding: utf-8 -*-
"""Sube un video a YouTube con el refresh token del .env.

Uso:
    python scripts/youtube/subir_video.py <ruta_video> <titulo> <ruta_descripcion.txt>

La descripcion va en un fichero aparte para no pelearse con las comillas y los
acentos en la linea de comandos (ver la nota de curl+UTF-8 en la memoria de
marketing).

El permiso concedido es solo `youtube.upload`: sirve para subir, NO para leer
datos del canal. Si hace falta leer, hay que reautorizar con otro scope.
"""
import io
import json
import os
import sys
import urllib.parse
import urllib.request

ENV = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'python-service', '.env'))


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


def subir(ruta, titulo, descripcion, tags, categoria='27'):
    """categoria 27 = Education. privacyStatus public: sale publicado al momento."""
    at = access_token()
    meta = {
        'snippet': {
            'title': titulo,
            'description': descripcion,
            'tags': tags,
            'categoryId': categoria,
        },
        'status': {
            'privacyStatus': 'public',
            'selfDeclaredMadeForKids': False,
        },
    }
    datos = io.open(ruta, 'rb').read()

    # Subida "resumable" en dos pasos: primero la metadata, que devuelve la URL
    # donde va el binario. Es lo que recomienda YouTube para video.
    req = urllib.request.Request(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        data=json.dumps(meta).encode('utf-8'),
        headers={
            'Authorization': 'Bearer ' + at,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': str(len(datos)),
            'X-Upload-Content-Type': 'video/mp4',
        })
    resp = urllib.request.urlopen(req, timeout=60)
    destino = resp.headers['Location']

    req2 = urllib.request.Request(destino, data=datos, method='PUT',
                                  headers={'Content-Type': 'video/mp4', 'Content-Length': str(len(datos))})
    r2 = urllib.request.urlopen(req2, timeout=300)
    return json.loads(r2.read())


if __name__ == '__main__':
    ruta, titulo, ruta_desc = sys.argv[1], sys.argv[2], sys.argv[3]
    desc = io.open(ruta_desc, encoding='utf-8').read()
    tags = ['estudiar', 'estudiantes', 'tecnicas de estudio', 'vuelta al cole',
            'selectividad', 'universidad', 'bachillerato', 'IA', 'plan de estudio']
    try:
        v = subir(ruta, titulo, desc, tags)
        print('SUBIDO id:', v['id'])
        print('https://www.youtube.com/watch?v=' + v['id'])
        print('estado:', v['status']['privacyStatus'])
    except Exception as e:
        print('ERROR', getattr(e, 'code', ''), e.read()[:500] if hasattr(e, 'read') else e)
