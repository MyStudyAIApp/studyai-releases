$gh = 'C:/Program Files/GitHub CLI/gh.exe'
$installer = 'C:/Users/rinco/Desktop/Examen/studyai/dist-electron/StudyAI-Setup.exe'
$latestYml = 'C:/Users/rinco/Desktop/Examen/studyai/dist-electron/latest.yml'
$notes = 'Primera version oficial de StudyAI. Incluye reconocimiento de voz (Whisper), IA con Gemini/Claude/Mistral, flashcards, examenes, tutor virtual y mucho mas.'

& $gh release create v1.0.0 --repo StudyAIUp/studyai-releases --title "StudyAI v1.0.0" --notes $notes $installer $latestYml
Write-Host "EXIT: $LASTEXITCODE"
