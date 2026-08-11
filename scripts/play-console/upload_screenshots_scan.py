"""Sube las capturas de pantalla de teléfono a la ficha de Play Store de
MyStudy Scan vía la API de Play Developer.

Uso:
    python upload_screenshots_scan.py
"""
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CREDENTIALS_PATH = Path(__file__).resolve().parents[2] / "credentials" / "play-console-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
LANG = "es-ES"
PACKAGE_NAME = "eu.mystudyai.scan"

SCREENSHOTS_DIR = Path(r"C:\Users\rinco\AppData\Local\Temp\claude\D--Proyectos-Claude-studyai\d7b41773-2c5f-4495-9623-dce5400d6f0c\scratchpad\screenshots")
SCREENSHOTS = [
    SCREENSHOTS_DIR / "04_escanear_crop.png",
    SCREENSHOTS_DIR / "03_grabar_crop.png",
    SCREENSHOTS_DIR / "00_biblioteca_crop.png",
    SCREENSHOTS_DIR / "02_examenes_crop.png",
    SCREENSHOTS_DIR / "05_podcasts_crop.png",
]


def main():
    creds = service_account.Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=SCOPES)
    service = build("androidpublisher", "v3", credentials=creds)

    edit = service.edits().insert(packageName=PACKAGE_NAME, body={}).execute()
    edit_id = edit["id"]
    print(f"edit creado: {edit_id}")

    for path in SCREENSHOTS:
        media = MediaFileUpload(str(path), mimetype="image/png")
        service.edits().images().upload(
            packageName=PACKAGE_NAME,
            editId=edit_id,
            language=LANG,
            imageType="phoneScreenshots",
            media_body=media,
        ).execute()
        print(f"phoneScreenshots: {path.name} subida")

    result = service.edits().commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
    print(f"commit OK: {result['id']}")


if __name__ == "__main__":
    main()
