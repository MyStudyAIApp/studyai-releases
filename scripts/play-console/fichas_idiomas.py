# -*- coding: utf-8 -*-
"""Anade las fichas de Play en ingles, aleman y frances.

Contexto (5/9/2026): las dos apps se distribuyen en 27 paises pero solo tenian
ficha en `es-ES`, asi que un aleman leia la descripcion en espanol. Play usa la
ficha del idioma por defecto como respaldo, asi que el resto de idiomas siguen
viendo la espanola.

Los TITULOS no se traducen: "MyStudy App" y "MyStudy Scan" son la marca.

Limites de Play: titulo 30, descripcion corta 80, larga 4000 caracteres. El
script los comprueba ANTES de enviar nada, porque un error a mitad deja el edit
a medias.

Uso:
    python fichas_idiomas.py            # aplica
    python fichas_idiomas.py --probar   # solo valida longitudes, no toca Play
"""
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

CRED = Path(__file__).resolve().parents[2] / 'credentials' / 'play-console-service-account.json'

SCAN = 'eu.mystudyai.scan'
TWA = 'eu.mystudyai.twa'

FICHAS = {
    SCAN: {
        'en-US': {
            'title': 'MyStudy Scan',
            'shortDescription': 'Scan notes and record your voice — straight to your study library',
            'fullDescription': (
                "MyStudy Scan is the fastest way to get your paper notes and voice memos into your "
                "study library, ready to review anywhere.\n\n"
                "📷 Scan your notes with the camera — it detects the edges automatically and turns "
                "them into a PDF, several pages in a row if you need.\n"
                "🎙️ Record voice notes and they are transcribed into text on their own — ideal for "
                "jotting something down quickly between classes.\n"
                "📚 Everything goes straight to your Library, organised by subject.\n"
                "📅 Exam reminders so you never miss one.\n\n"
                "Sync with your MyStudy App account to turn whatever you scan or record here into "
                "summaries, exams, podcasts and much more."
            ),
        },
        'de-DE': {
            'title': 'MyStudy Scan',
            'shortDescription': 'Notizen scannen und Sprache aufnehmen — direkt in deine Bibliothek',
            'fullDescription': (
                "MyStudy Scan ist der schnellste Weg, deine Papiernotizen und Sprachnotizen in deine "
                "Lernbibliothek zu bringen — bereit zum Wiederholen, wo immer du willst.\n\n"
                "📷 Scanne deine Notizen mit der Kamera — die Ränder werden automatisch erkannt und "
                "in ein PDF umgewandelt, auch mehrere Seiten hintereinander.\n"
                "🎙️ Nimm Sprachnotizen auf, die von selbst in Text umgewandelt werden — ideal, um "
                "zwischen zwei Vorlesungen schnell etwas festzuhalten.\n"
                "📚 Alles landet direkt in deiner Bibliothek, nach Fächern geordnet.\n"
                "📅 Erinnerungen an deine Prüfungen, damit du keine verpasst.\n\n"
                "Synchronisiere mit deinem MyStudy-App-Konto und mache aus dem, was du hier scannst "
                "oder aufnimmst, Zusammenfassungen, Prüfungen, Podcasts und vieles mehr."
            ),
        },
        'fr-FR': {
            'title': 'MyStudy Scan',
            'shortDescription': 'Scanne tes notes et enregistre ta voix — direct dans ta bibliothèque',
            'fullDescription': (
                "MyStudy Scan est le moyen le plus rapide de faire passer tes notes papier et tes "
                "mémos vocaux dans ta bibliothèque d'étude, prêts à être révisés où que tu sois.\n\n"
                "📷 Scanne tes notes avec l'appareil photo — les bords sont détectés automatiquement "
                "et converties en PDF, même plusieurs pages à la suite.\n"
                "🎙️ Enregistre des mémos vocaux : ils sont transcrits en texte tout seuls — idéal "
                "pour noter quelque chose vite entre deux cours.\n"
                "📚 Tout va directement dans ta Bibliothèque, classé par matière.\n"
                "📅 Des rappels pour tes examens, pour n'en manquer aucun.\n\n"
                "Synchronise avec ton compte MyStudy App pour transformer ce que tu scannes ou "
                "enregistres ici en résumés, examens, podcasts et bien plus."
            ),
        },
    },
    TWA: {
        'en-US': {
            'title': 'MyStudy App',
            'shortDescription': 'Study with AI: topics, summaries, podcasts, exams and tutor',
            'fullDescription': (
                "MyStudy App turns your notes and PDFs into real study material using artificial "
                "intelligence.\n\n"
                "📂 Organise your subjects by topic instead of one big mixed list — you always know "
                "where each note is.\n"
                "📚 Automatically generate summaries, outlines, glossaries and flashcards from your "
                "documents.\n"
                "🎧 Turn your notes into podcasts and revise by listening, wherever you want.\n"
                "📝 Create mixed practice exams (multiple choice, true/false, open questions and "
                "problems) from your own notes.\n"
                "🦉 Ask Tutor anything you don't understand — by text or by voice.\n"
                "🌍 Practise languages with exercises adapted to your level.\n"
                "📅 Plan your studying and never miss an exam.\n"
                "📈 Track your progress: marks, study streak and how you improve over time.\n\n"
                "Carry all your notes with you and revise anywhere, without being tied to a computer.\n\n"
                "Ideal for students at any level who want to study more efficiently."
            ),
        },
        'de-DE': {
            'title': 'MyStudy App',
            'shortDescription': 'Lernen mit KI: Themen, Zusammenfassungen, Podcasts, Prüfungen',
            'fullDescription': (
                "MyStudy App verwandelt deine Notizen und PDFs mit künstlicher Intelligenz in echtes "
                "Lernmaterial.\n\n"
                "📂 Ordne deine Fächer nach Themen statt alles in einer langen Liste — so weißt du "
                "immer, wo jede Notiz steckt.\n"
                "📚 Erstelle automatisch Zusammenfassungen, Gliederungen, Glossare und Lernkarten aus "
                "deinen Dokumenten.\n"
                "🎧 Mache aus deinen Notizen Podcasts und wiederhole beim Hören, wo immer du willst.\n"
                "📝 Erstelle gemischte Übungsprüfungen (Multiple Choice, Richtig/Falsch, offene "
                "Fragen und Aufgaben) aus deinen eigenen Notizen.\n"
                "🦉 Frage den Tutor alles, was du nicht verstehst — per Text oder per Sprache.\n"
                "🌍 Übe Sprachen mit Aufgaben, die zu deinem Niveau passen.\n"
                "📅 Plane dein Lernen und verpasse keine Prüfung.\n"
                "📈 Verfolge deinen Fortschritt: Noten, Lernserie und Entwicklung über die Zeit.\n\n"
                "Nimm all deine Notizen mit und wiederhole überall, ohne am Rechner sitzen zu müssen.\n\n"
                "Ideal für Lernende jeder Stufe, die effizienter lernen wollen."
            ),
        },
        'fr-FR': {
            'title': 'MyStudy App',
            'shortDescription': "Étudier avec l'IA : résumés, podcasts, examens et tuteur",
            'fullDescription': (
                "MyStudy App transforme tes notes et tes PDF en véritable matériel d'étude grâce à "
                "l'intelligence artificielle.\n\n"
                "📂 Organise tes matières par thème au lieu de tout mélanger dans une seule liste — "
                "tu sais toujours où se trouve chaque note.\n"
                "📚 Génère automatiquement des résumés, des plans, des glossaires et des fiches à "
                "partir de tes documents.\n"
                "🎧 Transforme tes notes en podcasts et révise en écoutant, où tu veux.\n"
                "📝 Crée des examens blancs variés (QCM, vrai/faux, questions ouvertes et exercices) "
                "à partir de tes propres notes.\n"
                "🦉 Pose au Tuteur toutes tes questions — par écrit ou à la voix.\n"
                "🌍 Pratique les langues avec des exercices adaptés à ton niveau.\n"
                "📅 Organise ton plan de révision et ne rate aucun examen.\n"
                "📈 Suis ta progression : notes, série d'étude et évolution dans le temps.\n\n"
                "Emporte toutes tes notes avec toi et révise où tu veux, sans dépendre d'un "
                "ordinateur.\n\n"
                "Idéal pour les étudiants de tout niveau qui veulent étudier plus efficacement."
            ),
        },
    },
}

LIMITES = {'title': 30, 'shortDescription': 80, 'fullDescription': 4000}


def validar():
    """Play rechaza el edit entero si un texto se pasa: mejor verlo antes."""
    fallos = []
    for pkg, idiomas in FICHAS.items():
        for idioma, ficha in idiomas.items():
            for campo, tope in LIMITES.items():
                n = len(ficha[campo])
                if n > tope:
                    fallos.append('%s %s %s: %d de %d' % (pkg, idioma, campo, n, tope))
                else:
                    print('  ok %-18s %-6s %-16s %4d/%d' % (pkg.split('.')[-1], idioma, campo, n, tope))
    assert not fallos, 'textos demasiado largos:\n' + '\n'.join(fallos)


def aplicar():
    creds = service_account.Credentials.from_service_account_file(
        str(CRED), scopes=['https://www.googleapis.com/auth/androidpublisher'])
    svc = build('androidpublisher', 'v3', credentials=creds, cache_discovery=False)

    for pkg, idiomas in FICHAS.items():
        edit = svc.edits().insert(packageName=pkg, body={}).execute()
        eid = edit['id']
        for idioma, ficha in idiomas.items():
            svc.edits().listings().update(
                packageName=pkg, editId=eid, language=idioma, body=ficha).execute()
            print('  %s -> %s escrito' % (pkg, idioma))
        svc.edits().commit(packageName=pkg, editId=eid).execute()
        print('  %s COMMIT ok' % pkg)

        # Releer: lo unico que confirma que Play se lo quedo.
        e2 = svc.edits().insert(packageName=pkg, body={}).execute()
        vivos = [l['language'] for l in
                 svc.edits().listings().list(packageName=pkg, editId=e2['id']).execute()['listings']]
        svc.edits().delete(packageName=pkg, editId=e2['id']).execute()
        print('  %s idiomas ahora: %s' % (pkg, sorted(vivos)))


if __name__ == '__main__':
    validar()
    if '--probar' not in sys.argv:
        aplicar()
