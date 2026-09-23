/**
 * MyStudy AI — Contexto de Autenticación
 * =====================================
 * Este archivo es el "cerebro" del login en el frontend.
 *
 * En simple: es como un walkie-talkie que cualquier parte de la app puede
 * escuchar para saber si hay un usuario logueado, quién es, y cómo
 * cerrar sesión.
 *
 * Uso en cualquier componente:
 *   const { user, loading, signOut } = useAuth()
 *   if (!user) return <Redirect to="/login" />
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { consumirVueltaDeRecuperacion } from '../lib/recoveryWeb'
import { registrarAceptacionSiProcede, necesitaAceptacion, guardarAceptacion } from '../lib/aceptacion'

// Crear el "canal de comunicación" (contexto)
const AuthContext = createContext(null)

// Componente que envuelve toda la app y "emite" el estado de auth
export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null)
  const [session, setSession]             = useState(null)
  const [loading, setLoading]             = useState(true)
  // true cuando el usuario llega desde el enlace "restablecer contraseña"
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  // true cuando la cuenta acaba de crearse (alta con Google) y todavía no hay
  // constancia de que aceptara Condiciones ni declarara la edad. La app se
  // para y le pide ambas cosas antes de dejarle entrar.
  const [needsTerms, setNeedsTerms] = useState(false)

  // Constancia de la aceptación: primero se convierte la marca de la casilla
  // en fecha (alta por email, o por Google desde la pestaña de registro) y
  // solo después se mira si falta — si no, se le pediría a quien ya la dio.
  const revisarAceptacion = async (user) => {
    await registrarAceptacionSiProcede(user?.id)
    setNeedsTerms(await necesitaAceptacion(user))
  }

  useEffect(() => {
    // WEB: el evento PASSWORD_RECOVERY se dispara al canjear el ?code=, que
    // ocurre al importar supabase-js — antes de que esto se suscriba. Así que
    // no basta con escucharlo: se comprueba también la marca que dejó
    // LoginPage al pedir el correo (ver src/lib/recoveryWeb.js).
    if (consumirVueltaDeRecuperacion()) setIsPasswordRecovery(true)

    // Al arrancar: recuperar la sesión guardada en el navegador (si existe)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      revisarAceptacion(session?.user)
    })

    // Escuchar cambios de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        // Es aqui donde cae el alta con Google: vuelve del redirect y aparece
        // la sesion. Si la cuenta acaba de nacer sin constancia, se le pide.
        if (event === 'SIGNED_IN') revisarAceptacion(session?.user)
        if (event === 'SIGNED_OUT') setNeedsTerms(false)
        // Supabase dispara PASSWORD_RECOVERY cuando el usuario llega
        // desde el enlace del email de restablecimiento de contraseña
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Cerrar sesión
  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // El JWT del usuario actual (se incluye en cada llamada al backend Python)
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const clearPasswordRecovery = () => setIsPasswordRecovery(false)

  // En apps nativas el evento PASSWORD_RECOVERY no llega: el enlace del email
  // vuelve por deep link y se canjea a mano (ver src/lib/googleAuth.js), así que
  // es el propio flujo quien avisa de que toca pedir contraseña nueva.
  const beginPasswordRecovery = () => setIsPasswordRecovery(true)

  // El usuario acepta en la pantalla de aviso: se guarda la constancia y se
  // le deja pasar. Si falla el guardado NO se le deja entrar: el sentido de
  // esa pantalla es que quede el rastro, no que la vea.
  const acceptTerms = async (sinCorreos = false) => {
    await guardarAceptacion(user?.id, sinCorreos)
    setNeedsTerms(false)
  }

  const value = {
    user, session, loading, signOut, getToken,
    isPasswordRecovery, clearPasswordRecovery, beginPasswordRecovery,
    needsTerms, acceptTerms,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para usar el contexto cómodamente
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
