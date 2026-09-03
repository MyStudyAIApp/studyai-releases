"""Promociona a PRODUCCION la version que ya esta en Prueba interna.

    python scripts/play-console/promote_to_production.py            # las dos apps
    python scripts/play-console/promote_to_production.py eu.mystudyai.scan

Que hace exactamente: copia el versionCode que hay en el track 'internal' al
track 'production', con sus notas de version. NO sube ningun AAB nuevo (ya esta
subido) y NO publica nada en vivo.

⚠️ POR QUE ESTO NO SACA LA APP AL PUBLICO
Las apps tienen "Publicacion gestionada" activada: cualquier cambio queda
retenido en 'Resumen de publicacion' hasta que una persona pulsa
"Publicar N cambios" en el navegador. Este script solo mete la version en esa
cola, que es lo que dispara la revision de Google para produccion. La salida en
vivo sigue siendo una decision manual.

Comprobar despues en:
Play Console -> la app -> Resumen de publicacion -> "Cambios listos para publicarse"
"""
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

RAIZ = Path(__file__).resolve().parents[2]
CRED = RAIZ / "credentials" / "play-console-service-account.json"

APPS = ("eu.mystudyai.scan", "eu.mystudyai.twa")


def promocionar(svc, pkg):
    print(f"\n===== {pkg} =====")
    edit = svc.edits().insert(packageName=pkg, body={}).execute()
    eid = edit["id"]
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

        cuerpo = {"releases": [{
            "name": rel.get("name"),
            "versionCodes": vcs,
            "status": "completed",
        }]}
        # Sin esto, promocionar borraria las notas de version en los 4 idiomas.
        if rel.get("releaseNotes"):
            cuerpo["releases"][0]["releaseNotes"] = rel["releaseNotes"]
            print(f"  notas de version: {len(rel['releaseNotes'])} idiomas")

        svc.edits().tracks().update(
            packageName=pkg, editId=eid, track="production", body=cuerpo).execute()
        svc.edits().commit(packageName=pkg, editId=eid).execute()
        print(f"  OK -> produccion {rel.get('name')} en cola, esperando revision de Google")
    except Exception as e:
        print(f"  ERROR: {e}")
        try:
            svc.edits().delete(packageName=pkg, editId=eid).execute()
        except Exception:
            pass
        raise


def main():
    if not CRED.exists():
        sys.exit(f"No encuentro las credenciales en {CRED}")
    creds = service_account.Credentials.from_service_account_file(
        str(CRED), scopes=["https://www.googleapis.com/auth/androidpublisher"])
    svc = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

    objetivos = sys.argv[1:] or list(APPS)
    for pkg in objetivos:
        promocionar(svc, pkg)

    print("\nHecho. NADA esta en vivo todavia: revisa la cola en")
    print("Play Console -> app -> Resumen de publicacion antes de publicar.")


if __name__ == "__main__":
    main()
