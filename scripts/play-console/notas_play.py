# -*- coding: utf-8 -*-
"""
Pone las novedades de la version en curso en la pista indicada, en los 4 idiomas.

Uso:  python notas_play.py <internal|production>

Este fichero se REESCRIBE en cada version: lleva el texto de la que se esta
publicando ahora (Scan 1.42 / App 1.46, aviso de version nueva dentro de la app). Las notas de las
versiones anteriores estan en el historial de git.

Esta vez el usuario las quiere ESCUETAS: arreglo de errores y ya.

Sin emojis, sin exclamaciones y sin la palabra "IA" (norma del proyecto):
se cuenta el problema real y lo que hace la app, como lo contaria una persona.
"""
import sys
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

TRACK = sys.argv[1] if len(sys.argv) > 1 else "internal"
if TRACK not in ("internal", "production"):
    sys.exit("pista no valida: usa internal o production")

CRED = Path(__file__).resolve().parents[2] / "credentials" / "play-console-service-account.json"

# Las dos apps comparten Mi cuaderno, asi que comparten novedades.
TEXTOS = {
 "es-ES": "Corrección de errores.",
 "en-US": "Bug fixes.",
 "de-DE": "Fehlerbehebungen.",
 "fr-FR": "Corrections de bugs.",
}

NOTAS = {
    "eu.mystudyai.scan": TEXTOS,
    "eu.mystudyai.twa": TEXTOS,
}

creds = service_account.Credentials.from_service_account_file(
    str(CRED), scopes=["https://www.googleapis.com/auth/androidpublisher"])
svc = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

for pkg, textos in NOTAS.items():
    for idioma, t in textos.items():
        if len(t) > 500:
            sys.exit(f"{pkg} {idioma}: {len(t)} caracteres, Play admite 500. No se sube nada.")

for pkg, textos in NOTAS.items():
    e = svc.edits().insert(packageName=pkg, body={}).execute()["id"]
    tr = svc.edits().tracks().get(editId=e, packageName=pkg, track=TRACK).execute()
    releases = tr.get("releases", [])
    if not releases:
        sys.exit(f"{pkg}: la pista {TRACK} no tiene ninguna version. No se toca nada.")
    releases[0]["releaseNotes"] = [{"language": k, "text": v} for k, v in textos.items()]
    svc.edits().tracks().update(
        editId=e, packageName=pkg, track=TRACK, body={"track": TRACK, "releases": releases}).execute()
    svc.edits().commit(editId=e, packageName=pkg).execute()
    vc = releases[0].get("versionCodes", ["?"])
    print(f"{pkg}: novedades puestas en '{TRACK}' v{','.join(map(str, vc))} "
          f"({len(textos)} idiomas)")
