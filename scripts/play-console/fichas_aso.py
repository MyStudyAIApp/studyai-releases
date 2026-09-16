# -*- coding: utf-8 -*-
"""Fichas de Play optimizadas para busqueda (ASO), 8 idiomas por app.

Contexto (16/9/2026): keyword research con google-play-scraper (sugerencias de
Play + top 5 competidores). Cambios frente a fichas_idiomas.py:
- Titulo = marca + gancho con palabra clave (antes solo la marca).
- Cuaderno de apuntes y agenda de examenes destacados: ninguna app de la
  competencia junta escanear la libreta + estudiar + agenda.
- Descripciones largas mas completas (Play indexa las 4000).
- Idiomas nuevos: it-IT, pt-PT, nl-NL, pl-PL.

Reutiliza validar() y aplicar() de fichas_idiomas.py.

Uso:
    python fichas_aso.py --probar   # valida longitudes y muestra textos, no toca Play
    python fichas_aso.py            # aplica
"""
import sys

import fichas_idiomas as fi

S = fi.SCAN
T = fi.TWA

# ---------------------------------------------------------------- MyStudy App
APP = {
    'es-ES': {
        'title': 'MyStudy: Estudia con IA',
        'shortDescription': 'Escanea tu cuaderno, crea flashcards y test, y apunta tus exámenes en la agenda',
        'fullDescription': (
            "MyStudy convierte tus apuntes, tu cuaderno y tus PDF en material de estudio: resúmenes, "
            "flashcards, test y podcasts. Todo ordenado por asignaturas y con una agenda para no "
            "olvidar ningún examen.\n\n"
            "📓 CUADERNO DIGITAL\n"
            "Haz una foto a la página de tu libreta y el texto se añade al cuaderno de esa asignatura, "
            "ordenado por fecha. Digitaliza tus apuntes a mano y tenlos siempre contigo.\n\n"
            "📅 AGENDA DE EXÁMENES\n"
            "Apunta la fecha de cada examen y recibe un recordatorio a tiempo. Tu calendario de "
            "exámenes y tu material de estudio, en la misma app.\n\n"
            "🃏 FLASHCARDS Y TARJETAS DE ESTUDIO\n"
            "Crea flashcards automáticamente a partir de tus apuntes y repasa lo importante.\n\n"
            "📝 TEST Y EXÁMENES DE PRÁCTICA\n"
            "Genera exámenes mixtos (tipo test, verdadero/falso, desarrollo y problemas) con tus "
            "propios apuntes.\n\n"
            "📚 RESUMIR PDF Y APUNTES\n"
            "Resúmenes, esquemas y glosarios a partir de tus documentos en segundos.\n\n"
            "🎧 PODCASTS DE TUS APUNTES\n"
            "Convierte tus apuntes en audio y repasa escuchando, donde quieras.\n\n"
            "🦉 TUTOR\n"
            "Pregunta cualquier duda por texto o por voz.\n\n"
            "Además:\n"
            "• Asignaturas organizadas por temas.\n"
            "• Práctica de idiomas adaptada a tu nivel.\n"
            "• Tu progreso: notas, racha de estudio y evolución.\n\n"
            "Ideal para ESO, bachillerato, selectividad (PAU/EBAU), universidad y oposiciones: "
            "cualquier estudiante que quiera estudiar mejor en menos tiempo."
        ),
    },
    'en-US': {
        'title': 'MyStudy: AI Study & Flashcards',
        'shortDescription': 'Scan your notebook, make flashcards & quizzes, and plan your exams',
        'fullDescription': (
            "MyStudy turns your notes, your notebook and your PDFs into study material: summaries, "
            "flashcards, quizzes and podcasts. Everything organised by subject, with an exam planner "
            "so you never forget a test.\n\n"
            "📓 DIGITAL NOTEBOOK\n"
            "Take a photo of a page from your notebook and the text is added to that subject's "
            "notebook, sorted by date. Digitize your handwritten notes and carry them everywhere.\n\n"
            "📅 EXAM PLANNER\n"
            "Add the date of each exam and get a reminder in time. Your study planner and your study "
            "material, in one app.\n\n"
            "🃏 FLASHCARDS\n"
            "Create flashcards automatically from your notes and review what matters.\n\n"
            "📝 QUIZZES AND PRACTICE EXAMS\n"
            "Generate mixed practice exams (multiple choice, true/false, open questions and problems) "
            "from your own notes.\n\n"
            "📚 SUMMARIZE PDFS AND NOTES\n"
            "Summaries, outlines and glossaries from your documents in seconds.\n\n"
            "🎧 PODCASTS FROM YOUR NOTES\n"
            "Turn your notes into audio and revise by listening, wherever you are.\n\n"
            "🦉 TUTOR\n"
            "Ask anything you don't understand, by text or by voice.\n\n"
            "Also:\n"
            "• Subjects organised by topic.\n"
            "• Language practice adapted to your level.\n"
            "• Your progress: marks, study streak and improvement over time.\n\n"
            "Ideal for high school, university and exam prep: any student who wants to study "
            "smarter in less time."
        ),
    },
    'de-DE': {
        'title': 'MyStudy: Lernen mit KI',
        'shortDescription': 'Heft scannen, Karteikarten & Tests erstellen, Prüfungen im Lernplaner',
        'fullDescription': (
            "MyStudy verwandelt deine Notizen, dein Heft und deine PDFs in Lernmaterial: "
            "Zusammenfassungen, Karteikarten, Tests und Podcasts. Alles nach Fächern geordnet, mit "
            "einem Lernplaner, damit du keine Prüfung vergisst.\n\n"
            "📓 DIGITALES NOTIZBUCH\n"
            "Fotografiere eine Seite aus deinem Heft und der Text wird dem Notizbuch des Fachs "
            "hinzugefügt, nach Datum sortiert. Handschriftliche Notizen digitalisieren und immer "
            "dabeihaben.\n\n"
            "📅 PRÜFUNGSPLANER\n"
            "Trage jede Prüfung ein und erhalte rechtzeitig eine Erinnerung. Schulplaner und "
            "Lernmaterial in einer App.\n\n"
            "🃏 KARTEIKARTEN UND LERNKARTEN\n"
            "Erstelle automatisch Karteikarten aus deinen Notizen und wiederhole das Wichtigste.\n\n"
            "📝 TESTS UND ÜBUNGSPRÜFUNGEN\n"
            "Gemischte Übungsprüfungen (Multiple Choice, Richtig/Falsch, offene Fragen und Aufgaben) "
            "aus deinen eigenen Notizen.\n\n"
            "📚 PDFS UND NOTIZEN ZUSAMMENFASSEN\n"
            "Zusammenfassungen, Gliederungen und Glossare aus deinen Dokumenten in Sekunden.\n\n"
            "🎧 PODCASTS AUS DEINEN NOTIZEN\n"
            "Mach aus deinen Notizen Audio und lerne beim Zuhören, wo immer du bist.\n\n"
            "🦉 TUTOR\n"
            "Frag alles, was du nicht verstehst, per Text oder per Sprache.\n\n"
            "Außerdem:\n"
            "• Fächer nach Themen geordnet.\n"
            "• Sprachen üben passend zu deinem Niveau.\n"
            "• Dein Fortschritt: Noten, Lernserie und Entwicklung.\n\n"
            "Ideal für Schule, Abitur, Ausbildung und Studium: für alle, die in weniger Zeit besser "
            "lernen wollen."
        ),
    },
    'fr-FR': {
        'title': 'MyStudy : Révisions avec IA',
        'shortDescription': 'Scanne ton cahier, crée flashcards et quiz, et note tes examens dans ton agenda',
        'fullDescription': (
            "MyStudy transforme tes notes, ton cahier et tes PDF en matériel de révision : résumés, "
            "fiches de révision, flashcards, quiz et podcasts. Tout est classé par matière, avec un "
            "agenda pour n'oublier aucun examen.\n\n"
            "📓 CAHIER NUMÉRIQUE\n"
            "Prends en photo une page de ton cahier : le texte s'ajoute au cahier de la matière, "
            "classé par date. Numérise tes notes manuscrites et garde-les toujours sur toi.\n\n"
            "📅 AGENDA DES EXAMENS\n"
            "Note la date de chaque examen et reçois un rappel à temps. Ton planning de révision et "
            "tes cours dans la même app.\n\n"
            "🃏 FLASHCARDS ET FICHES DE RÉVISION\n"
            "Crée automatiquement des flashcards à partir de tes notes et révise l'essentiel.\n\n"
            "📝 QUIZ ET EXAMENS BLANCS\n"
            "Génère des examens blancs variés (QCM, vrai/faux, questions ouvertes et exercices) à "
            "partir de tes propres notes.\n\n"
            "📚 RÉSUMER TES PDF ET TES COURS\n"
            "Synthèses, plans et glossaires à partir de tes documents en quelques secondes.\n\n"
            "🎧 PODCASTS DE TES COURS\n"
            "Transforme tes notes en audio et révise en écoutant, où tu veux.\n\n"
            "🦉 TUTEUR\n"
            "Pose toutes tes questions, par écrit ou à la voix.\n\n"
            "Et aussi :\n"
            "• Matières organisées par thème.\n"
            "• Pratique des langues adaptée à ton niveau.\n"
            "• Ta progression : notes, série d'étude et évolution.\n\n"
            "Idéal pour le collège, le lycée, le bac, les études supérieures et les concours : pour "
            "tous ceux qui veulent mieux réviser en moins de temps."
        ),
    },
    'it-IT': {
        'title': "MyStudy: Studia con l'IA",
        'shortDescription': 'Scansiona il quaderno, crea flashcard e quiz, e segna gli esami in agenda',
        'fullDescription': (
            "MyStudy trasforma i tuoi appunti, il tuo quaderno e i tuoi PDF in materiale di studio: "
            "riassunti, flashcard, quiz e podcast. Tutto organizzato per materia, con un'agenda per "
            "non dimenticare nessun esame.\n\n"
            "📓 QUADERNO DIGITALE\n"
            "Fotografa una pagina del quaderno e il testo si aggiunge al quaderno di quella materia, "
            "in ordine di data. Digitalizza i tuoi appunti scritti a mano e portali sempre con te.\n\n"
            "📅 AGENDA DEGLI ESAMI\n"
            "Segna la data di ogni esame e ricevi un promemoria in tempo. Planner di studio e "
            "materiale nella stessa app.\n\n"
            "🃏 FLASHCARD\n"
            "Crea flashcard automaticamente dai tuoi appunti e ripassa ciò che conta.\n\n"
            "📝 QUIZ E SIMULAZIONI D'ESAME\n"
            "Genera esami misti (risposta multipla, vero/falso, domande aperte e problemi) dai tuoi "
            "appunti.\n\n"
            "📚 RIASSUMERE PDF E APPUNTI\n"
            "Riassunti, schemi e glossari dai tuoi documenti in pochi secondi.\n\n"
            "🎧 PODCAST DEI TUOI APPUNTI\n"
            "Trasforma gli appunti in audio e ripassa ascoltando, ovunque.\n\n"
            "🦉 TUTOR\n"
            "Chiedi qualsiasi dubbio, per testo o a voce.\n\n"
            "Inoltre:\n"
            "• Materie organizzate per argomenti.\n"
            "• Pratica delle lingue adatta al tuo livello.\n"
            "• I tuoi progressi: voti, serie di studio ed evoluzione.\n\n"
            "Ideale per scuola superiore, maturità, università e concorsi: per chi vuole studiare "
            "meglio in meno tempo."
        ),
    },
    'pt-PT': {
        'title': 'MyStudy: Estuda com IA',
        'shortDescription': 'Digitaliza o caderno, cria flashcards e testes, e marca os exames na agenda',
        'fullDescription': (
            "O MyStudy transforma os teus apontamentos, o teu caderno e os teus PDF em material de "
            "estudo: resumos, flashcards, testes e podcasts. Tudo organizado por disciplina, com uma "
            "agenda para não esqueceres nenhum exame.\n\n"
            "📓 CADERNO DIGITAL\n"
            "Tira uma foto a uma página do caderno e o texto é adicionado ao caderno dessa "
            "disciplina, por data. Digitaliza os teus apontamentos à mão e leva-os sempre contigo.\n\n"
            "📅 AGENDA DE EXAMES\n"
            "Marca a data de cada exame e recebe um lembrete a tempo. Planeamento de estudo e "
            "material na mesma app.\n\n"
            "🃏 FLASHCARDS\n"
            "Cria flashcards automaticamente a partir dos teus apontamentos e revê o essencial.\n\n"
            "📝 TESTES E EXAMES DE PRÁTICA\n"
            "Gera exames mistos (escolha múltipla, verdadeiro/falso, resposta aberta e problemas) com "
            "os teus apontamentos.\n\n"
            "📚 RESUMIR PDF E APONTAMENTOS\n"
            "Resumos, esquemas e glossários a partir dos teus documentos em segundos.\n\n"
            "🎧 PODCASTS DOS TEUS APONTAMENTOS\n"
            "Transforma os apontamentos em áudio e estuda a ouvir, onde quiseres.\n\n"
            "🦉 TUTOR\n"
            "Pergunta qualquer dúvida por texto ou por voz.\n\n"
            "E ainda:\n"
            "• Disciplinas organizadas por temas.\n"
            "• Prática de línguas adaptada ao teu nível.\n"
            "• O teu progresso: notas, série de estudo e evolução.\n\n"
            "Ideal para o secundário, exames nacionais e universidade: para quem quer estudar melhor "
            "em menos tempo."
        ),
    },
    'nl-NL': {
        'title': 'MyStudy: Studeren met AI',
        'shortDescription': 'Scan je schrift, maak flashcards en quizzen, en plan je examens in je agenda',
        'fullDescription': (
            "MyStudy maakt van je aantekeningen, je schrift en je pdf's studiemateriaal: "
            "samenvattingen, flashcards, quizzen en podcasts. Alles per vak geordend, met een agenda "
            "zodat je geen enkel examen vergeet.\n\n"
            "📓 DIGITAAL SCHRIFT\n"
            "Maak een foto van een pagina uit je schrift en de tekst wordt toegevoegd aan het schrift "
            "van dat vak, op datum. Digitaliseer je handgeschreven aantekeningen en heb ze altijd "
            "bij je.\n\n"
            "📅 EXAMENPLANNER\n"
            "Zet de datum van elk examen erin en krijg op tijd een herinnering. Studieplanner en "
            "lesstof in één app.\n\n"
            "🃏 FLASHCARDS\n"
            "Maak automatisch flashcards van je aantekeningen en herhaal wat belangrijk is.\n\n"
            "📝 QUIZZEN EN OEFENEXAMENS\n"
            "Maak gemengde oefenexamens (meerkeuze, waar/niet waar, open vragen en opgaven) van je "
            "eigen aantekeningen.\n\n"
            "📚 PDF'S EN AANTEKENINGEN SAMENVATTEN\n"
            "Samenvattingen, schema's en woordenlijsten van je documenten in seconden.\n\n"
            "🎧 PODCASTS VAN JE AANTEKENINGEN\n"
            "Zet je aantekeningen om in audio en leer al luisterend, waar je maar wilt.\n\n"
            "🦉 TUTOR\n"
            "Stel elke vraag via tekst of spraak.\n\n"
            "Verder:\n"
            "• Vakken geordend per onderwerp.\n"
            "• Talen oefenen op jouw niveau.\n"
            "• Je voortgang: cijfers, studiereeks en ontwikkeling.\n\n"
            "Ideaal voor middelbare school, eindexamens en studie: voor iedereen die slimmer wil "
            "leren in minder tijd."
        ),
    },
    'pl-PL': {
        'title': 'MyStudy: Nauka z AI',
        'shortDescription': 'Skanuj zeszyt, twórz flashcards i testy, zapisuj egzaminy w terminarzu',
        'fullDescription': (
            "MyStudy zamienia Twoje notatki, zeszyt i pliki PDF w materiały do nauki: streszczenia, "
            "flashcards, testy i podcasty. Wszystko uporządkowane według przedmiotów, z terminarzem, "
            "żebyś nie zapomniał o żadnym egzaminie.\n\n"
            "📓 CYFROWY ZESZYT\n"
            "Zrób zdjęcie strony z zeszytu, a tekst trafi do zeszytu danego przedmiotu, według daty. "
            "Zdigitalizuj odręczne notatki i miej je zawsze przy sobie.\n\n"
            "📅 TERMINARZ EGZAMINÓW\n"
            "Wpisz datę każdego egzaminu i dostań przypomnienie na czas. Planer nauki i materiały "
            "w jednej aplikacji.\n\n"
            "🃏 FLASHCARDS (FISZKI)\n"
            "Twórz fiszki automatycznie z notatek i powtarzaj to, co ważne.\n\n"
            "📝 TESTY I EGZAMINY PRÓBNE\n"
            "Generuj mieszane egzaminy (wielokrotny wybór, prawda/fałsz, pytania otwarte i zadania) "
            "z własnych notatek.\n\n"
            "📚 STRESZCZANIE PDF I NOTATEK\n"
            "Streszczenia, konspekty i słowniczki z Twoich dokumentów w kilka sekund.\n\n"
            "🎧 PODCASTY Z NOTATEK\n"
            "Zamień notatki w audio i ucz się, słuchając, gdziekolwiek jesteś.\n\n"
            "🦉 TUTOR\n"
            "Zadaj każde pytanie tekstem lub głosem.\n\n"
            "Oprócz tego:\n"
            "• Przedmioty uporządkowane według tematów.\n"
            "• Nauka języków dopasowana do Twojego poziomu.\n"
            "• Twoje postępy: oceny, seria nauki i rozwój.\n\n"
            "Idealne do liceum, matury, studiów i egzaminów: dla każdego, kto chce uczyć się lepiej "
            "w krótszym czasie."
        ),
    },
}

# --------------------------------------------------------------- MyStudy Scan
SCAN = {
    'es-ES': {
        'title': 'MyStudy Scan: Escáner de PDF',
        'shortDescription': 'Escanea documentos a PDF y transcribe audio a texto con tu grabadora de voz',
        'fullDescription': (
            "MyStudy Scan es un escáner de PDF y una grabadora de voz pensados para estudiar: pasa "
            "tus apuntes en papel y tus notas de voz a tu biblioteca de estudio en segundos.\n\n"
            "📷 ESCÁNER DE DOCUMENTOS A PDF\n"
            "Escanea apuntes, hojas y documentos con la cámara del móvil. Detecta los bordes "
            "automáticamente y los convierte en PDF, incluso varias páginas seguidas.\n\n"
            "🎙️ GRABADORA DE VOZ QUE TRANSCRIBE\n"
            "Graba notas de voz o una explicación y se transcriben solas: audio a texto sin "
            "escribir nada. Ideal para apuntar algo rápido entre clases.\n\n"
            "📓 MI CUADERNO\n"
            "Escanea la página de tu libreta y el texto se suma al cuaderno de esa asignatura, "
            "ordenado por fecha: tus apuntes a mano, digitalizados y juntos.\n\n"
            "📚 TODO EN TU BIBLIOTECA\n"
            "Lo que escaneas o grabas va directo a tu biblioteca, organizado por asignaturas.\n\n"
            "📅 RECORDATORIOS DE EXÁMENES\n"
            "Apunta las fechas de tus exámenes y recibe un aviso a tiempo.\n\n"
            "🔗 CONECTADO CON MYSTUDY APP\n"
            "Con tu cuenta de MyStudy App, convierte lo que escanees o grabes en resúmenes, "
            "flashcards, test y podcasts, y añade tus apuntes al cuaderno de cada asignatura.\n\n"
            "Escanear documentos, digitalizar apuntes, OCR de texto y transcripción de audio en una "
            "sola app."
        ),
    },
    'en-US': {
        'title': 'MyStudy Scan: PDF Scanner',
        'shortDescription': 'Document scanner to PDF and voice recorder that transcribes audio to text',
        'fullDescription': (
            "MyStudy Scan is a PDF scanner and voice recorder built for studying: get your paper "
            "notes and voice memos into your study library in seconds.\n\n"
            "📷 DOCUMENT SCANNER TO PDF\n"
            "Scan notes, sheets and documents with your phone camera. Edges are detected "
            "automatically and turned into a PDF, even several pages in a row.\n\n"
            "🎙️ VOICE RECORDER THAT TRANSCRIBES\n"
            "Record voice notes or a lecture explanation and they are transcribed on their own: "
            "audio to text without typing. Perfect for quick notes between classes.\n\n"
            "📓 MY NOTEBOOK\n"
            "Scan a page from your notebook and the text is added to that subject's notebook, "
            "sorted by date: your handwritten notes, digitized and together.\n\n"
            "📚 EVERYTHING IN YOUR LIBRARY\n"
            "What you scan or record goes straight to your library, organised by subject.\n\n"
            "📅 EXAM REMINDERS\n"
            "Add your exam dates and get a reminder in time.\n\n"
            "🔗 CONNECTED TO MYSTUDY APP\n"
            "With your MyStudy App account, turn what you scan or record into summaries, "
            "flashcards, quizzes and podcasts, and add your notes to each subject's notebook.\n\n"
            "Scan documents, digitize notes, OCR text and transcribe audio in a single app."
        ),
    },
    'de-DE': {
        'title': 'MyStudy Scan: PDF Scanner',
        'shortDescription': 'Dokumente scannen als PDF und Diktiergerät, das Audio in Text umwandelt',
        'fullDescription': (
            "MyStudy Scan ist PDF-Scanner und Diktiergerät fürs Lernen: Bring deine Notizen auf "
            "Papier und deine Sprachnotizen in Sekunden in deine Lernbibliothek.\n\n"
            "📷 DOKUMENTE SCANNEN ALS PDF\n"
            "Scanne Notizen, Blätter und Dokumente mit der Handykamera. Die Ränder werden "
            "automatisch erkannt und in ein PDF umgewandelt, auch mehrere Seiten hintereinander.\n\n"
            "🎙️ DIKTIERGERÄT MIT TRANSKRIPTION\n"
            "Nimm Sprachnotizen auf und sie werden automatisch transkribiert: Audio zu Text ohne "
            "Tippen. Ideal für schnelle Notizen zwischen zwei Stunden.\n\n"
            "📚 ALLES IN DEINER BIBLIOTHEK\n"
            "Was du scannst oder aufnimmst, landet direkt in deiner Bibliothek, nach Fächern "
            "geordnet.\n\n"
            "📅 PRÜFUNGSERINNERUNGEN\n"
            "Trage deine Prüfungstermine ein und erhalte rechtzeitig eine Erinnerung.\n\n"
            "🔗 VERBUNDEN MIT MYSTUDY APP\n"
            "Mit deinem MyStudy-App-Konto wird aus Scans und Aufnahmen Zusammenfassungen, "
            "Karteikarten, Tests und Podcasts, und deine Notizen kommen ins Notizbuch jedes Fachs.\n\n"
            "Dokumente scannen, Notizen digitalisieren, OCR-Texterkennung und Audio transkribieren "
            "in einer App."
        ),
    },
    'fr-FR': {
        'title': 'MyStudy Scan : Scanner PDF',
        'shortDescription': 'Scanner de documents PDF et dictaphone qui transcrit l’audio en texte',
        'fullDescription': (
            "MyStudy Scan est un scanner PDF et un dictaphone pensés pour les études : fais passer "
            "tes notes papier et tes mémos vocaux dans ta bibliothèque en quelques secondes.\n\n"
            "📷 SCANNER DE DOCUMENTS EN PDF\n"
            "Scanne tes notes, feuilles et documents avec l'appareil photo. Les bords sont détectés "
            "automatiquement et convertis en PDF, même plusieurs pages à la suite.\n\n"
            "🎙️ DICTAPHONE QUI TRANSCRIT\n"
            "Enregistre des mémos vocaux : ils sont transcrits tout seuls, de l'audio en texte sans "
            "rien taper. Idéal pour noter vite quelque chose entre deux cours.\n\n"
            "📚 TOUT DANS TA BIBLIOTHÈQUE\n"
            "Ce que tu scannes ou enregistres va directement dans ta bibliothèque, classé par "
            "matière.\n\n"
            "📅 RAPPELS D'EXAMENS\n"
            "Note les dates de tes examens et reçois un rappel à temps.\n\n"
            "🔗 CONNECTÉ À MYSTUDY APP\n"
            "Avec ton compte MyStudy App, transforme ce que tu scannes ou enregistres en résumés, "
            "flashcards, quiz et podcasts, et ajoute tes notes au cahier de chaque matière.\n\n"
            "Scanner des documents, numériser tes notes, OCR et transcription audio dans une seule "
            "app."
        ),
    },
    'it-IT': {
        'title': 'MyStudy Scan: Scanner PDF',
        'shortDescription': 'Scanner di documenti in PDF e registratore vocale che trascrive l’audio',
        'fullDescription': (
            "MyStudy Scan è uno scanner PDF e un registratore vocale pensati per lo studio: porta i "
            "tuoi appunti di carta e le note vocali nella tua libreria in pochi secondi.\n\n"
            "📷 SCANNER DI DOCUMENTI IN PDF\n"
            "Scansiona appunti, fogli e documenti con la fotocamera. I bordi vengono rilevati "
            "automaticamente e convertiti in PDF, anche più pagine di seguito.\n\n"
            "🎙️ REGISTRATORE VOCALE CHE TRASCRIVE\n"
            "Registra note vocali e vengono trascritte da sole: da audio a testo senza scrivere. "
            "Ideale per appunti veloci tra una lezione e l'altra.\n\n"
            "📚 TUTTO NELLA TUA LIBRERIA\n"
            "Ciò che scansioni o registri va direttamente nella libreria, organizzato per materia.\n\n"
            "📅 PROMEMORIA DEGLI ESAMI\n"
            "Segna le date degli esami e ricevi un promemoria in tempo.\n\n"
            "🔗 COLLEGATO A MYSTUDY APP\n"
            "Con il tuo account MyStudy App, trasforma ciò che scansioni o registri in riassunti, "
            "flashcard, quiz e podcast, e aggiungi gli appunti al quaderno di ogni materia.\n\n"
            "Scansionare documenti, digitalizzare appunti, OCR e trascrizione audio in un'unica app."
        ),
    },
    'pt-PT': {
        'title': 'MyStudy Scan: Digitalizar PDF',
        'shortDescription': 'Digitalizador de documentos em PDF e gravador de voz que transcreve áudio',
        'fullDescription': (
            "O MyStudy Scan é um digitalizador de PDF e um gravador de voz pensados para estudar: "
            "passa os teus apontamentos em papel e notas de voz para a tua biblioteca em segundos.\n\n"
            "📷 DIGITALIZAR DOCUMENTOS PARA PDF\n"
            "Digitaliza apontamentos, folhas e documentos com a câmara. Deteta as margens "
            "automaticamente e converte-os em PDF, mesmo várias páginas seguidas.\n\n"
            "🎙️ GRAVADOR DE VOZ QUE TRANSCREVE\n"
            "Grava notas de voz e são transcritas sozinhas: áudio para texto sem escrever. Ideal "
            "para apontar algo rápido entre aulas.\n\n"
            "📚 TUDO NA TUA BIBLIOTECA\n"
            "O que digitalizas ou gravas vai direto para a tua biblioteca, organizado por "
            "disciplina.\n\n"
            "📅 LEMBRETES DE EXAMES\n"
            "Marca as datas dos teus exames e recebe um aviso a tempo.\n\n"
            "🔗 LIGADO AO MYSTUDY APP\n"
            "Com a tua conta MyStudy App, transforma o que digitalizas ou gravas em resumos, "
            "flashcards, testes e podcasts, e junta os apontamentos ao caderno de cada disciplina.\n\n"
            "Digitalizar documentos, apontamentos, OCR e transcrição de áudio numa só app."
        ),
    },
    'nl-NL': {
        'title': 'MyStudy Scan: PDF Scanner',
        'shortDescription': 'Documenten scannen naar pdf en spraakrecorder die audio naar tekst omzet',
        'fullDescription': (
            "MyStudy Scan is een pdf-scanner en spraakrecorder gemaakt om te studeren: zet je "
            "papieren aantekeningen en spraakmemo's in seconden in je studiebibliotheek.\n\n"
            "📷 DOCUMENTEN SCANNEN NAAR PDF\n"
            "Scan aantekeningen, bladen en documenten met je camera. De randen worden automatisch "
            "herkend en omgezet naar pdf, ook meerdere pagina's achter elkaar.\n\n"
            "🎙️ SPRAAKRECORDER DIE TRANSCRIBEERT\n"
            "Neem spraakmemo's op en ze worden vanzelf uitgeschreven: audio naar tekst zonder te "
            "typen. Ideaal voor snelle notities tussen de lessen.\n\n"
            "📚 ALLES IN JE BIBLIOTHEEK\n"
            "Wat je scant of opneemt, gaat direct naar je bibliotheek, geordend per vak.\n\n"
            "📅 EXAMENHERINNERINGEN\n"
            "Zet je examendata erin en krijg op tijd een herinnering.\n\n"
            "🔗 VERBONDEN MET MYSTUDY APP\n"
            "Met je MyStudy App-account maak je van scans en opnames samenvattingen, flashcards, "
            "quizzen en podcasts, en voeg je aantekeningen toe aan het schrift van elk vak.\n\n"
            "Documenten scannen, aantekeningen digitaliseren, OCR en audio transcriberen in één app."
        ),
    },
    'pl-PL': {
        'title': 'MyStudy Scan: Skaner PDF',
        'shortDescription': 'Skaner dokumentów do PDF i dyktafon, który zamienia nagrania na tekst',
        'fullDescription': (
            "MyStudy Scan to skaner PDF i dyktafon stworzone do nauki: przenieś papierowe notatki "
            "i notatki głosowe do swojej biblioteki w kilka sekund.\n\n"
            "📷 SKANER DOKUMENTÓW DO PDF\n"
            "Skanuj notatki, kartki i dokumenty aparatem telefonu. Krawędzie są wykrywane "
            "automatycznie i zamieniane w PDF, także kilka stron po kolei.\n\n"
            "🎙️ DYKTAFON Z TRANSKRYPCJĄ\n"
            "Nagrywaj notatki głosowe, a zostaną same przepisane: nagranie na tekst bez pisania. "
            "Idealne do szybkich notatek między lekcjami.\n\n"
            "📚 WSZYSTKO W BIBLIOTECE\n"
            "To, co zeskanujesz lub nagrasz, trafia prosto do biblioteki, według przedmiotów.\n\n"
            "📅 PRZYPOMNIENIA O EGZAMINACH\n"
            "Wpisz daty egzaminów i dostań przypomnienie na czas.\n\n"
            "🔗 POŁĄCZONE Z MYSTUDY APP\n"
            "Z kontem MyStudy App zamienisz skany i nagrania w streszczenia, flashcards, testy "
            "i podcasty, a notatki dodasz do zeszytu każdego przedmiotu.\n\n"
            "Skanowanie dokumentów, digitalizacja notatek, OCR i transkrypcja audio w jednej "
            "aplikacji."
        ),
    },
}

fi.FICHAS = {S: SCAN, T: APP}

if __name__ == '__main__':
    fi.validar()
    if '--probar' not in sys.argv:
        fi.aplicar()
