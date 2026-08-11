import { registerPlugin } from '@capacitor/core'

// Puente al plugin nativo Kotlin (BillingPlugin.kt, solo existe en el proyecto
// Android de MyStudy App -- eu.mystudyai.twa, ver capacitor-app/android/).
// En MyStudy Scan o en web/escritorio, registerPlugin() no falla al importar,
// pero cualquier llamada real rechaza con "plugin not implemented" -- por eso
// el paywall solo se muestra tras detectIsFullMobileApp() en appStore.js.
const Billing = registerPlugin('Billing')

export default Billing
