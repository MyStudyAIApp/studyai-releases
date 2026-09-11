# -*- coding: utf-8 -*-
"""
Pone las novedades de la version en curso en la pista indicada, en los 4 idiomas.

Uso:  python notas_play.py <internal|production>

Este fichero se REESCRIBE en cada version: lleva el texto de la que se esta
publicando ahora (Scan 1.39 / App 1.43, editor del cuaderno). Las notas de las
versiones anteriores estan en el historial de git.

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
 "es-ES": """Edita tus apuntes

Ya puedes retocar a mano lo que hay en Mi cuaderno: cambiar o borrar una palabra, poner negrita, subrayado o un título más grande. Cuando escanees una página nueva, se añade debajo sin tocar nada de lo que hayas editado.

Al pasar tu libreta a texto ahora respetamos lo que llevas subrayado, las mayúsculas y las comillas.

Y la app te avisa por dentro cuando hay una versión nueva.""",

 "en-US": """Edit your notes

You can now touch up by hand what is in My notebook: change or delete a word, add bold, underline or a bigger heading. When you scan a new page, it is added below without touching anything you edited.

When we turn your notebook into text we now keep what you underlined, the capital letters and the quotation marks.

And the app tells you from the inside when a new version is out.""",

 "de-DE": """Notizen bearbeiten

Du kannst jetzt in Mein Heft von Hand nachbessern: ein Wort ändern oder löschen, Fettdruck, Unterstreichung oder eine größere Überschrift setzen. Eine neu gescannte Seite kommt darunter dazu, ohne deine Änderungen anzurühren.

Beim Umwandeln in Text übernehmen wir jetzt Unterstreichungen, Großbuchstaben und Anführungszeichen.

Und die App sagt dir selbst Bescheid, wenn es eine neue Version gibt.""",

 "fr-FR": """Modifier tes notes

Tu peux maintenant retoucher à la main ce qui se trouve dans Mon cahier : changer ou supprimer un mot, mettre en gras, souligner ou agrandir un titre. Une page numérisée s'ajoute en dessous sans toucher à ce que tu as modifié.

En passant ton cahier au texte, nous conservons désormais les soulignements, les majuscules et les guillemets.

Et l'application te prévient elle-même quand une nouvelle version sort.""",
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
