; StudyAI - Inno Setup Installer
; Compresion lzma2/ultra64 - sin limite de tamano, maneja >2 GB sin problemas

#define MyAppName "MyStudy AI"
#define MyAppVersion "1.0.44"
#define MyAppPublisher "MyStudy AI"
#define MyAppExeName "MyStudy AI.exe"
#define SourceDir "..\dist-electron\win-unpacked"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-electron
OutputBaseFilename=StudyAI-Setup
SetupIconFile=..\assets\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
; Sin requisito de admin - instala por usuario o por maquina a eleccion
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
; Solo x64
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Desinstalar
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} {#MyAppVersion}
; Pantalla de bienvenida (imagen por defecto de Inno Setup)

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el Escritorio"; Flags: checkedonce

[Files]
; Toda la aplicacion Electron empaquetada
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir {#MyAppName} ahora"; Flags: nowait postinstall skipifsilent

; Registro del protocolo mystudyai:// -- deep link de vuelta tras iniciar sesion
; con Google (el navegador del sistema redirige aqui, Windows relanza la app)
[Registry]
Root: HKCU; Subkey: "Software\Classes\mystudyai"; ValueType: string; ValueName: ""; ValueData: "URL:MyStudy AI Auth Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\mystudyai"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\mystudyai\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"",0"
Root: HKCU; Subkey: "Software\Classes\mystudyai\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

; (Sin codigo Pascal - Ollama se instala desde la propia app en Ajustes > IA local)
