"""Actualiza la ficha de Play Store de MyStudy Scan (textos + icono + gráfico
de funciones) vía la API de Play Developer. Faltan las capturas de pantalla
reales -- se suben aparte cuando haya un móvil con la app instalada a mano.

Uso:
    python update_store_listing_scan.py
"""
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CREDENTIALS_PATH = Path(__file__).resolve().parents[2] / "credentials" / "play-console-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
LANG = "es-ES"
PACKAGE_NAME = "eu.mystudyai.scan"

TITLE = "MyStudy Scan"
SHORT_DESC = "Escanea apuntes y graba tu voz -- directo a tu biblioteca de estudio"
FULL_DESC = """MyStudy Scan es la forma más rápida de pasar tus apuntes en papel y tus notas de voz a tu biblioteca de estudio, lista para repasar donde quieras.

📷 Escanea tus apuntes con la cámara -- detecta los bordes automáticamente y los convierte en PDF, incluso varias páginas seguidas.
🎙️ Graba notas de voz y se transcriben solas a texto -- ideal para apuntar algo rápido entre clases.
📚 Todo va directo a tu Biblioteca, organizado por asignaturas.
📅 Recordatorios de tus exámenes para no perderte ninguno.

Sincroniza con tu cuenta de MyStudy App para generar resúmenes, exámenes, podcasts y mucho más a partir de lo que escanees o grabes aquí."""

ICON_PATH = Path(r"D:\Proyectos Claude\studyai\assets\icon-scan-512-rgb.png")
FEATURE_GRAPHIC_PATH = Path(r"D:\Proyectos Claude\studyai\assets\feature-graphic-scan.png")


def main():
    creds = service_account.Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=SCOPES)
    service = build("androidpublisher", "v3", credentials=creds)

    edit = service.edits().insert(packageName=PACKAGE_NAME, body={}).execute()
    edit_id = edit["id"]
    print(f"edit creado: {edit_id}")

    service.edits().listings().update(
        packageName=PACKAGE_NAME,
        editId=edit_id,
        language=LANG,
        body={
            "language": LANG,
            "title": TITLE,
            "shortDescription": SHORT_DESC,
            "fullDescription": FULL_DESC,
        },
    ).execute()
    print("textos actualizados")

    def upload_image(image_type: str, path: Path):
        media = MediaFileUpload(str(path), mimetype="image/png")
        service.edits().images().upload(
            packageName=PACKAGE_NAME,
            editId=edit_id,
            language=LANG,
            imageType=image_type,
            media_body=media,
        ).execute()
        print(f"{image_type}: {path.name} subido")

    upload_image("icon", ICON_PATH)
    upload_image("featureGraphic", FEATURE_GRAPHIC_PATH)

    result = service.edits().commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
    print(f"commit OK: {result['id']}")


if __name__ == "__main__":
    main()
