# -*- coding: utf-8 -*-
"""
Pone las novedades del cuaderno en la pista indicada, en los 4 idiomas.

Uso:  python notas_play.py <internal|production>

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

NOTAS = {
"eu.mystudyai.scan": {
 "es-ES": """Mi cuaderno

Haz una foto de la página de tu libreta al salir de clase y se guarda junto al resto de apuntes de esa asignatura, ordenados por día. Deja de acumular fotos sueltas que luego no encuentras: es un cuaderno que va creciendo solo, y cuando llega el examen lo tienes todo junto.

Si la página lleva escrita la fecha, la respetamos.

También leemos mejor la letra a mano, y te avisamos si una foto ha salido poco legible en vez de guardarla a medias.""",

 "en-US": """My notebook

Take a photo of your notebook page on your way out of class and it is saved alongside the rest of your notes for that subject, sorted by day. No more loose photos you can never find again: the notebook grows on its own, and when the exam comes you have everything in one place.

If the page has the date written on it, we keep that date.

We also read handwriting better now, and we tell you when a photo came out hard to read instead of saving it half done.""",

 "de-DE": """Mein Heft

Fotografiere nach dem Unterricht die Seite deines Hefts, und sie wird zusammen mit deinen übrigen Notizen zu diesem Fach gespeichert, nach Tagen geordnet. Schluss mit losen Fotos, die du später nicht wiederfindest: Das Heft wächst von selbst, und zur Prüfung hast du alles beisammen.

Steht das Datum auf der Seite, übernehmen wir es.

Außerdem lesen wir Handschrift jetzt besser und sagen dir Bescheid, wenn ein Foto schlecht lesbar ist, statt es halbfertig zu speichern.""",

 "fr-FR": """Mon cahier

Prends une photo de la page de ton cahier en sortant de cours : elle est enregistrée avec le reste de tes notes de cette matière, classées par jour. Fini les photos éparpillées que tu ne retrouves jamais : le cahier s'étoffe tout seul, et le jour de l'examen tu as tout au même endroit.

Si la date est écrite sur la page, nous la reprenons.

Nous lisons aussi mieux l'écriture manuscrite, et nous te prévenons quand une photo est peu lisible au lieu de l'enregistrer à moitié.""",
},

"eu.mystudyai.twa": {
 "es-ES": """Mi cuaderno

Tus apuntes escaneados dejan de ser fotos sueltas. Cada página se suma al cuaderno de su asignatura, ordenada por día, y desde ahí repasas, imprimes o te lo llevas a Word.

Los apuntes escaneados ahora se leen como texto: se adapta a la pantalla del móvil, y puedes copiarlo, buscarlo y escucharlo.""",

 "en-US": """My notebook

Your scanned notes stop being loose photos. Each page is added to its subject's notebook, sorted by day, and from there you can review, print or export it to Word.

Scanned notes are now shown as text: it fits your phone screen, and you can copy it, search it and listen to it.""",

 "de-DE": """Mein Heft

Deine gescannten Notizen sind keine losen Fotos mehr. Jede Seite wird dem Heft ihres Fachs hinzugefügt, nach Tagen geordnet, und von dort kannst du wiederholen, drucken oder nach Word exportieren.

Gescannte Notizen werden jetzt als Text angezeigt: Er passt sich dem Handybildschirm an, und du kannst ihn kopieren, durchsuchen und anhören.""",

 "fr-FR": """Mon cahier

Tes notes numérisées ne sont plus des photos éparpillées. Chaque page rejoint le cahier de sa matière, classée par jour, et de là tu peux réviser, imprimer ou l'exporter vers Word.

Les notes numérisées s'affichent désormais sous forme de texte : il s'adapte à l'écran du téléphone, et tu peux le copier, le rechercher et l'écouter.""",
},
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
