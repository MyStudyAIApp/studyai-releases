"""Sube un .aab a la pista "internal" (Prueba interna) de Play Console.

Requiere la cuenta de servicio en credentials/play-console-service-account.json
(rol "Release manager" o superior en Play Console, para las dos apps:
eu.mystudyai.scan y eu.mystudyai.twa).

Uso:
    python upload_to_internal.py <package_name> <ruta_al_aab>

Ejemplo:
    python upload_to_internal.py eu.mystudyai.scan "D:\\...\\app-release.aab"
"""
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CREDENTIALS_PATH = Path(__file__).resolve().parents[2] / "credentials" / "play-console-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]


def upload(package_name: str, aab_path: str, track: str = "internal"):
    creds = service_account.Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=SCOPES)
    service = build("androidpublisher", "v3", credentials=creds)

    edit = service.edits().insert(packageName=package_name, body={}).execute()
    edit_id = edit["id"]
    print(f"[{package_name}] edit creado: {edit_id}")

    media = MediaFileUpload(aab_path, mimetype="application/octet-stream", resumable=True)
    bundle = service.edits().bundles().upload(
        packageName=package_name,
        editId=edit_id,
        media_body=media,
    ).execute()
    version_code = bundle["versionCode"]
    print(f"[{package_name}] AAB subido, versionCode {version_code}")

    service.edits().tracks().update(
        packageName=package_name,
        editId=edit_id,
        track=track,
        body={"releases": [{"versionCodes": [str(version_code)], "status": "completed"}]},
    ).execute()
    print(f"[{package_name}] pista '{track}' actualizada")

    result = service.edits().commit(packageName=package_name, editId=edit_id).execute()
    print(f"[{package_name}] commit OK: {result['id']}")
    return version_code


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python upload_to_internal.py <package_name> <ruta_al_aab> [track]")
        sys.exit(1)
    pkg = sys.argv[1]
    path = sys.argv[2]
    trk = sys.argv[3] if len(sys.argv) > 3 else "internal"
    upload(pkg, path, trk)
