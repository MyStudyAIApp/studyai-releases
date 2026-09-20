# -*- coding: utf-8 -*-
"""Sube el AAB a Prueba interna CON notas de version y lo promociona a Produccion.

    python scripts/play-console/subir_y_promocionar.py --solo-subir
    python scripts/play-console/subir_y_promocionar.py --promocionar

Por que existe habiendo ya upload_to_internal.py y promote_to_production.py:
aquel subia SIN notas de version, y promote_to_production copia las notas que
encuentra en la pista interna. Al promocionar una release sin notas, Play se
queda sin ellas en los 4 idiomas: las que habia en produccion desaparecen.
Se detecto el 2026-09-20 antes de promocionar, comparando las dos pistas.

[!][!] --promocionar SACA LA APP AL PUBLICO. NO HAY NINGUN BOTON DESPUES.
La "Publicacion gestionada" esta DESACTIVADA en esta cuenta. En cuanto Google
aprueba la revision, la version sale sola a TODOS los usuarios.
"""
import argparse
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

RAIZ = Path(__file__).resolve().parents[2]
CRED = RAIZ / "credentials" / "play-console-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]

# Notas escuetas a proposito: es lo que hace todo el mundo y lo que el dueno
# pidio. Los idiomas son los mismos cuatro que la ficha de Play.
NOTAS = {
    "es-ES": "Corrección de errores.",
    "en-US": "Bug fixes.",
    "de-DE": "Fehlerbehebungen.",
    "fr-FR": "Corrections de bugs.",
}

APPS = {
    "eu.mystudyai.scan": RAIZ / "android/app/build/outputs/bundle/release/app-release.aab",
    "eu.mystudyai.twa": RAIZ.parent / "studyai-app/capacitor-app/android/app/build/outputs/bundle/release/app-release.aab",
}


def servicio():
    if not CRED.exists():
        sys.exit(f"No encuentro las credenciales en {CRED}")
    creds = service_account.Credentials.from_service_account_file(str(CRED), scopes=SCOPES)
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)


def notas():
    return [{"language": idioma, "text": texto} for idioma, texto in NOTAS.items()]


def subir(svc, pkg: str, aab: Path):
    print(f"\n===== {pkg} =====")
    if not aab.exists():
        sys.exit(f"  No existe el AAB: {aab}")
    print(f"  AAB: {aab.name} ({aab.stat().st_size // 1024} KB)")

    eid = svc.edits().insert(packageName=pkg, body={}).execute()["id"]
    try:
        media = MediaFileUpload(str(aab), mimetype="application/octet-stream", resumable=True)
        bundle = svc.edits().bundles().upload(packageName=pkg, editId=eid, media_body=media).execute()
        vc = bundle["versionCode"]
        print(f"  subido, versionCode {vc}")

        svc.edits().tracks().update(
            packageName=pkg, editId=eid, track="internal",
            body={"releases": [{
                "versionCodes": [str(vc)],
                "status": "completed",
                "releaseNotes": notas(),
            }]},
        ).execute()
        print(f"  pista 'internal' actualizada, notas en {len(NOTAS)} idiomas")

        svc.edits().commit(packageName=pkg, editId=eid).execute()
        print("  commit OK")
        return vc
    except Exception:
        try:
            svc.edits().delete(packageName=pkg, editId=eid).execute()
        except Exception:
            pass
        raise


def promocionar(svc, pkg: str):
    print(f"\n===== {pkg} =====")
    eid = svc.edits().insert(packageName=pkg, body={}).execute()["id"]
    try:
        tracks = svc.edits().tracks().list(packageName=pkg, editId=eid).execute()["tracks"]
        interno = next((t for t in tracks if t["track"] == "internal"), None)
        produccion = next((t for t in tracks if t["track"] == "production"), None)
        if not interno or not interno.get("releases"):
            print("  No hay nada en Prueba interna. Nada que hacer.")
            svc.edits().delete(packageName=pkg, editId=eid).execute()
            return

        rel = interno["releases"][0]
        vcs = rel["versionCodes"]
        actual = produccion["releases"][0]["versionCodes"] if produccion and produccion.get("releases") else []
        print(f"  produccion ahora: {actual}")
        print(f"  interna:          {vcs}  (version {rel.get('name')})")
        if actual == vcs:
            print("  Ya estan igual. Nada que hacer.")
            svc.edits().delete(packageName=pkg, editId=eid).execute()
            return

        # Las notas se toman de la release interna; si por lo que sea no las
        # tuviera, se ponen las de aqui. Promocionar sin notas las BORRARIA en
        # los 4 idiomas, que es el fallo que motivo este script.
        rn = rel.get("releaseNotes") or notas()
        svc.edits().tracks().update(
            packageName=pkg, editId=eid, track="production",
            body={"releases": [{
                "name": rel.get("name"),
                "versionCodes": vcs,
                "status": "completed",
                "releaseNotes": rn,
            }]},
        ).execute()
        svc.edits().commit(packageName=pkg, editId=eid).execute()
        print(f"  OK -> produccion {rel.get('name')} ENVIADA, notas en {len(rn)} idiomas")
    except Exception:
        try:
            svc.edits().delete(packageName=pkg, editId=eid).execute()
        except Exception:
            pass
        raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo-subir", action="store_true")
    ap.add_argument("--promocionar", action="store_true")
    args = ap.parse_args()
    if not (args.solo_subir or args.promocionar):
        sys.exit("Elige --solo-subir o --promocionar")

    svc = servicio()
    for pkg, aab in APPS.items():
        if args.solo_subir:
            subir(svc, pkg, aab)
        else:
            promocionar(svc, pkg)

    if args.promocionar:
        print("\n[!] La publicacion gestionada esta DESACTIVADA: estas versiones")
        print("    saldran SOLAS a todos los usuarios en cuanto Google apruebe")
        print("    la revision. No hay ningun paso manual despues de esto.")


if __name__ == "__main__":
    main()
