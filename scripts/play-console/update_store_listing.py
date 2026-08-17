"""Actualiza la ficha de Play Store (textos + icono + gráfico de funciones +
capturas de pantalla de teléfono) para una app, vía la API de Play Developer.

Requiere la cuenta de servicio en credentials/play-console-service-account.json
con permiso para gestionar la presencia en la tienda (no solo releases).

Uso:
    python update_store_listing.py <package_name>
"""
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CREDENTIALS_PATH = Path(__file__).resolve().parents[2] / "credentials" / "play-console-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
LANG = "es-ES"

TITLE = "MyStudy App"
SHORT_DESC = "Estudia con IA: asignaturas por temas, resúmenes, podcasts, exámenes y tutor"
FULL_DESC = """MyStudy App convierte tus apuntes y PDFs en material de estudio real usando inteligencia artificial.

📂 Organiza tus asignaturas por temas, no todo mezclado en una lista — así siempre sabes dónde está cada apunte.
📚 Genera automáticamente resúmenes, esquemas, glosarios y fichas de estudio a partir de tus documentos.
🎧 Convierte tus apuntes en podcasts para repasar escuchando, donde y cuando quieras.
📝 Crea exámenes de práctica mixtos (test, verdadero/falso, desarrollo y problemas) con tus propios apuntes.
🦉 Pregunta a Tutor cualquier duda — por texto o por voz.
🌍 Practica idiomas con ejercicios adaptados a tu nivel.
📅 Organiza tu plan de estudio y no te pierdas ningún examen.
📈 Sigue tu progreso: notas, racha de estudio y evolución en el tiempo.

Lleva todos tus apuntes contigo y repásalos donde quieras, sin depender de estar delante del ordenador.

Ideal para estudiantes de cualquier nivel que quieran estudiar de forma más eficiente."""

SCRATCHPAD = Path(r"C:\Users\rinco\AppData\Local\Temp\claude\D--Proyectos-Claude-studyai\ff409346-2918-4d96-9c4c-e109cefaebd9\scratchpad")
ICON_PATH = Path(r"D:\Proyectos Claude 2\studyai\src\public\pwa-512-rgb.png")
FEATURE_GRAPHIC_PATH = Path(r"D:\Proyectos Claude 2\studyai\src\public\feature-graphic.png")
SCREENSHOTS_DIR = SCRATCHPAD / "playstore_screens"
SCREENSHOT_ORDER = ["progreso", "biblioteca1", "biblioteca2", "pendiente", "tutor"]


def main(package_name: str):
    creds = service_account.Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=SCOPES)
    service = build("androidpublisher", "v3", credentials=creds)

    edit = service.edits().insert(packageName=package_name, body={}).execute()
    edit_id = edit["id"]
    print(f"edit creado: {edit_id}")

    service.edits().listings().update(
        packageName=package_name,
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
            packageName=package_name,
            editId=edit_id,
            language=LANG,
            imageType=image_type,
            media_body=media,
        ).execute()
        print(f"{image_type}: {path.name} subido")

    upload_image("icon", ICON_PATH)
    upload_image("featureGraphic", FEATURE_GRAPHIC_PATH)

    for name in SCREENSHOT_ORDER:
        upload_image("phoneScreenshots", SCREENSHOTS_DIR / f"{name}.png")

    result = service.edits().commit(packageName=package_name, editId=edit_id).execute()
    print(f"commit OK: {result['id']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python update_store_listing.py <package_name>")
        sys.exit(1)
    main(sys.argv[1])
