import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eu.mystudyai.scan',
  appName: 'MyStudy Scan',
  webDir: 'dist',
  server: {
    // En desarrollo apunta al PC por WiFi (cambiar IP según red)
    // En producción eliminar este bloque y usar el bundle estático
    // url: 'http://192.168.1.X:5173',
    // cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    Camera: {
      // Permisos de cámara para el escáner
    },
    SpeechRecognition: {
      // STT nativo para turnos cortos (tutor, idiomas)
    },
  },
};

export default config;
