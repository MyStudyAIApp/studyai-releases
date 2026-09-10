"""Promociona a PRODUCCION la version que ya esta en Prueba interna.

    python scripts/play-console/promote_to_production.py            # las dos apps
    python scripts/play-console/promote_to_production.py eu.mystudyai.scan

Que hace exactamente: copia el versionCode que hay en el track 'internal' al
track 'production', con sus notas de version. NO sube ningun AAB nuevo (ya esta
subido).

[!][!] ESTO SACA LA APP AL PUBLICO. NO HAY NINGUN BOTON DESPUES.
La "Publicacion gestionada" esta DESACTIVADA en esta cuenta (confirmado por el
dueno el 2026-09-10). En cuanto Google aprueba la revision, la version sale sola
a TODOS los usuarios: no queda retenida en ningun sitio y nadie tiene que pulsar
nada.

Este aviso decia justo lo CONTRARIO hasta el 2026-09-10 -- que la publicacion
gestionada estaba activada y que nada salia sin intervencion humana. Alguien se
lo creyo y le dijo al dueno que sus apps estaban retenidas cuando ya iban camino
de produccion. Si algun dia se vuelve a activar la publicacion gestionada,
ACTUALIZAR ESTE TEXTO: es lo primero que se lee antes de ejecutar esto.

Comprobar despues en:
Play Console -> la app -> Produccion -> Publicaciones
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
        print(f"  OK -> produccion {rel.get('name')} ENVIADA. Saldra sola al aprobar Google.")
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

    print("")
    print("[!] Hecho. La publicacion gestionada esta DESACTIVADA: estas versiones")
    print("    saldran SOLAS a todos los usuarios en cuanto Google apruebe la")
    print("    revision. No hay ningun paso manual despues de esto.")


if __name__ == "__main__":
    main()
