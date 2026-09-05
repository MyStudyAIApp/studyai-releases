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

// Crear el "canal de comunicación" (contexto)
const AuthContext = createContext(null)

// Componente que envuelve toda la app y "emite" el estado de auth
export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null)
  const [session, setSession]             = useState(null)
  const [loading, setLoading]             = useState(true)
  // true cuando el usuario llega desde el enlace "restablecer contraseña"
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

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
    })

    // Escuchar cambios de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
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

  const value = {
    user, session, loading, signOut, getToken,
    isPasswordRecovery, clearPasswordRecovery, beginPasswordRecovery,
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
