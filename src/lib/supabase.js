/**
 * MyStudy AI — Cliente Supabase para el navegador
 * =============================================
 * Este archivo crea la "conexión" entre el frontend React y Supabase.
 *
 * La ANON KEY es pública (es segura mostrarla en el código del frontend)
 * porque las tablas están protegidas con RLS: cada usuario solo ve sus datos.
 *
 * La SERVICE KEY (la secreta) NUNCA debe estar aquí — solo en el backend Python.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://kdxmnfqbsfpcakqxanrf.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkeG1uZnFic2ZwY2FrcXhhbnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzQ0NDUsImV4cCI6MjA5NjM1MDQ0NX0.1x3Gk08EQCTqSj9rBiA1tVAuu-ZpIGZ9coQqpi6fB7I'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// URL del backend web Python
export const WEB_API = import.meta.env.VITE_WEB_API_URL || 'https://api.mystudyai.eu'
