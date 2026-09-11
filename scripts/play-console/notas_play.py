# -*- coding: utf-8 -*-
"""
Pone las novedades de la version en curso en la pista indicada, en los 4 idiomas.

Uso:  python notas_play.py <internal|production>

Este fichero se REESCRIBE en cada version: lleva el texto de la que se esta
publicando ahora (Scan 1.40 / App 1.44, editor del cuaderno y dudas en Apuntes). Las notas de las
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

Ya puedes retocar a mano lo que hay en Mi cuaderno: cambiar o borrar una palabra, poner negrita, subrayado o un título más grande, y verlo aplicado mientras escribes. Una página nueva se añade debajo, sin tocar lo que hayas editado.

Las palabras que no se leyeron con seguridad salen ahora en ámbar también en Apuntes: tócalas para corregirlas o darlas por buenas.

Y al pasar tu libreta a texto respetamos lo subrayado, las mayúsculas y las comillas.""",

 "en-US": """Edit your notes

You can now touch up My notebook by hand: change or delete a word, add bold, underline or a bigger heading, and see it applied as you type. A new page is added below, without touching what you edited.

Words we could not read with confidence now show in amber in Notes too: tap them to fix them or confirm them.

And when we turn your notebook into text we keep underlining, capital letters and quotation marks.""",

 "de-DE": """Notizen bearbeiten

Du kannst Mein Heft jetzt von Hand nachbessern: ein Wort ändern oder löschen, Fettdruck, Unterstreichung oder eine größere Überschrift setzen — und siehst es beim Tippen. Eine neue Seite kommt darunter dazu, ohne deine Änderungen anzurühren.

Unsicher gelesene Wörter erscheinen jetzt auch in Notizen bernsteinfarben: antippen, um sie zu korrigieren oder zu bestätigen.

Beim Umwandeln in Text übernehmen wir Unterstreichungen, Großbuchstaben und Anführungszeichen.""",

 "fr-FR": """Modifier tes notes

Tu peux maintenant retoucher Mon cahier à la main : changer ou supprimer un mot, mettre en gras, souligner ou agrandir un titre, et le voir appliqué en écrivant. Une nouvelle page s'ajoute en dessous, sans toucher à ce que tu as modifié.

Les mots lus sans certitude apparaissent désormais en ambre dans Notes aussi : touche-les pour les corriger ou les valider.

Et en passant ton cahier au texte, nous conservons les soulignements, les majuscules et les guillemets.""",

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
