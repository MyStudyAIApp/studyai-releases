import { supabase } from '../lib/supabase'
import { api, IS_ELECTRON } from '../store/appStore'

/**
 * Sincroniza los documentos y asignaturas locales (SQLite) con Supabase.
 * SOLO tiene sentido en escritorio: usa las columnas supabase_id/sync_status
 * del SQLite local (main.py), que no existen en el backend cloud (web_main.py).
 * Si se ejecuta en móvil/web, todo documento de la nube parecería "no sincronizado"
 * y se duplicaría en cada llamada — por eso el guard de IS_ELECTRON es obligatorio,
 * no solo una comprobación en el caller.
 *
 * @param {object} user  - Usuario de Supabase (de useAuth)
 * @param {function} onProgress - Callback opcional: ({ total, current }) => void
 * @returns {{ synced: number, errors: number, deletedFromWeb: number }}
 */
export async function runSync(user, onProgress) {
  if (!user || !IS_ELECTRON) return { synced: 0, errors: 0, deletedFromWeb: 0 }

  let synced = 0
  let errors = 0
  let deletedFromWeb = 0

  try {
    // ── 1. Sincronizar asignaturas ──────────────────────────────────────────
    const { items: subjects } = await api('GET', '/subjects')
    const subjectIdMap = {}  // local integer id → supabase uuid

    for (const s of subjects) {
      if (s.supabase_id) {
        subjectIdMap[s.id] = s.supabase_id
        continue
      }
      try {
        const { data, error } = await supabase
          .from('subjects')
          .insert({ user_id: user.id, name: s.name, color: s.color })
          .select('id')
          .single()
        if (error) throw error
        await api('PATCH', `/subjects/${s.id}/sync-status`, {
          supabase_id: data.id,
          sync_status: 'synced',
        })
        subjectIdMap[s.id] = data.id
        synced++
      } catch { errors++ }
    }

    // ── 2. Sincronizar documentos ───────────────────────────────────────────
    const { items: docs } = await api('GET', '/documents?limit=1000')
    const unsynced = docs.filter(d => !d.supabase_id && d.sync_status !== 'deleted_from_web')
    const alreadySynced = docs.filter(d => d.supabase_id && d.sync_status === 'synced')

    onProgress?.({ total: unsynced.length, current: 0 })

    for (let i = 0; i < unsynced.length; i++) {
      const doc = unsynced[i]
      try {
        // Obtenemos el texto completo del doc individual
        const fullDoc = await api('GET', `/documents/${doc.id}`)

        const { data, error } = await supabase
          .from('documents')
          .insert({
            user_id:      user.id,
            title:        doc.title,
            file_path:    '',  // no hay archivo en la nube, solo texto
            file_size:    doc.file_size || 0,
            pages:        doc.pages || 0,
            language:     'es',
            subject_id:   doc.subject_id ? (subjectIdMap[doc.subject_id] || null) : null,
            text_content: (fullDoc.text_content || '').slice(0, 50000),
            has_images:   doc.has_images || false,
            has_formulas: doc.has_formulas || false,
            is_scanned:   doc.file_type === 'escaneado',
          })
          .select('id')
          .single()

        if (error) throw error

        await api('PATCH', `/documents/${doc.id}/sync-status`, {
          supabase_id: data.id,
          sync_status: 'synced',
          last_synced_at: true,
        })
        synced++
        onProgress?.({ total: unsynced.length, current: i + 1 })
      } catch { errors++ }
    }

    // ── 3. Detectar borrados desde la web ───────────────────────────────────
    if (alreadySynced.length > 0) {
      const ids = alreadySynced.map(d => d.supabase_id)
      const { data: deletedInCloud } = await supabase
        .from('documents')
        .select('id')
        .in('id', ids)
        .not('deleted_at', 'is', null)

      for (const del of (deletedInCloud || [])) {
        const local = alreadySynced.find(d => d.supabase_id === del.id)
        if (local) {
          await api('PATCH', `/documents/${local.id}/sync-status`, {
            sync_status: 'deleted_from_web',
          })
          deletedFromWeb++
        }
      }
    }

  } catch (e) {
    console.error('[Sync] Error:', e)
  }

  return { synced, errors, deletedFromWeb }
}

/**
 * Sube UN documento local a la nube bajo demanda (el usuario decide cuándo,
 * ya no es automático). Si el documento ya tenía un supabase_id pero la fila
 * ya no existe en la nube (huérfano — puede pasar si se borró en Supabase por
 * otro medio), lo detecta y lo vuelve a subir en vez de darlo por sincronizado.
 */
export async function syncSingleDocument(user, doc) {
  if (!user || !IS_ELECTRON) return { ok: false }

  try {
    if (doc.supabase_id) {
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('id', doc.supabase_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (existing) return { ok: true, alreadySynced: true }
      // Huérfano: el registro local dice "sincronizado" pero ya no existe en la nube.
    }

    let supabaseSubjectId = null
    if (doc.subject_id) {
      const { items: subjects } = await api('GET', '/subjects')
      const localSubject = subjects.find(s => s.id === doc.subject_id)
      if (localSubject?.supabase_id) {
        supabaseSubjectId = localSubject.supabase_id
      } else if (localSubject) {
        const { data } = await supabase
          .from('subjects')
          .insert({ user_id: user.id, name: localSubject.name, color: localSubject.color })
          .select('id')
          .single()
        if (data) {
          supabaseSubjectId = data.id
          await api('PATCH', `/subjects/${localSubject.id}/sync-status`, {
            supabase_id: data.id,
            sync_status: 'synced',
          })
        }
      }
    }

    const fullDoc = await api('GET', `/documents/${doc.id}`)
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id:      user.id,
        title:        doc.title,
        file_path:    '',
        file_size:    doc.file_size || 0,
        pages:        doc.pages || 0,
        language:     'es',
        subject_id:   supabaseSubjectId,
        text_content: (fullDoc.text_content || '').slice(0, 50000),
        has_images:   doc.has_images || false,
        has_formulas: doc.has_formulas || false,
        is_scanned:   doc.file_type === 'escaneado',
      })
      .select('id')
      .single()
    if (error) throw error

    await api('PATCH', `/documents/${doc.id}/sync-status`, {
      supabase_id: data.id,
      sync_status: 'synced',
      last_synced_at: true,
    })
    return { ok: true, alreadySynced: false }
  } catch (e) {
    console.error('[Sync] Error al subir documento:', e)
    return { ok: false, error: e.message }
  }
}

/**
 * Comprueba de verdad (una sola consulta por lote, no una por documento) qué
 * documentos marcados como "sincronizados" en local existen realmente en la
 * nube. Los que no aparecen aquí son "huérfanos" (el flag local mentía) y
 * deben tratarse como solo-local hasta que el usuario los vuelva a subir.
 * Devuelve un Set con los supabase_id verificados de verdad.
 */
export async function checkCloudPresence(user, docs) {
  if (!user || !IS_ELECTRON) return new Set()
  const ids = docs.filter(d => d.supabase_id).map(d => d.supabase_id)
  if (ids.length === 0) return new Set()
  try {
    const { data } = await supabase
      .from('documents')
      .select('id')
      .in('id', ids)
      .eq('user_id', user.id)
      .is('deleted_at', null)
    return new Set((data || []).map(d => d.id))
  } catch {
    return new Set()
  }
}

/** Soft-delete de un documento en Supabase (cuando se borra en el escritorio). */
export async function deleteFromCloud(user, doc) {
  if (!user || !doc?.supabase_id) return
  try {
    await supabase.from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', doc.supabase_id)
      .eq('user_id', user.id)
  } catch { /* silencioso */ }
}

/** Soft-delete de una asignatura en Supabase. */
export async function deleteSyncedSubject(user, supabaseId) {
  if (!user || !supabaseId) return
  try {
    await supabase.from('subjects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', supabaseId)
      .eq('user_id', user.id)
  } catch { /* silencioso */ }
}

/** Restaura un documento que fue borrado desde la web (borra el deleted_at en Supabase). */
export async function restoreToCloud(user, doc) {
  if (!user || !doc?.supabase_id) return false
  try {
    const { error } = await supabase.from('documents')
      .update({ deleted_at: null })
      .eq('id', doc.supabase_id)
      .eq('user_id', user.id)
    if (error) throw error
    await api('PATCH', `/documents/${doc.id}/sync-status`, { sync_status: 'synced' })
    return true
  } catch { return false }
}

/**
 * Descarga a este ordenador los documentos que solo existen en la nube
 * (subidos desde la web o el móvil con la misma cuenta). Solo trae texto,
 * no el PDF original (igual que runSync solo sube texto, no el archivo).
 */
export async function pullFromCloud(user) {
  if (!user || !IS_ELECTRON) return { downloaded: 0, errors: 0 }

  let downloaded = 0
  let errors = 0

  try {
    const { items: localDocs } = await api('GET', '/documents?limit=1000')
    const localSupabaseIds = new Set(localDocs.filter(d => d.supabase_id).map(d => d.supabase_id))

    const { data: cloudDocs, error } = await supabase
      .from('documents')
      .select('id, title, text_content, pages, file_size, has_images, has_formulas, is_scanned, subject_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
    if (error) throw error

    const missing = (cloudDocs || []).filter(d => !localSupabaseIds.has(d.id))
    if (missing.length === 0) return { downloaded: 0, errors: 0 }

    // Mapear subject_id (uuid) -> nombre, para recrear/emparejar la asignatura en local
    const subjectIds = [...new Set(missing.map(d => d.subject_id).filter(Boolean))]
    let subjectNameById = {}
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)
      subjectNameById = Object.fromEntries((subjects || []).map(s => [s.id, s.name]))
    }

    for (const doc of missing) {
      try {
        await api('POST', '/documents/from-cloud', {
          supabase_id:  doc.id,
          title:        doc.title,
          text_content: doc.text_content || '',
          subject_name: doc.subject_id ? (subjectNameById[doc.subject_id] || null) : null,
          pages:        doc.pages || 0,
          file_size:    doc.file_size || 0,
          has_images:   doc.has_images || false,
          has_formulas: doc.has_formulas || false,
          is_scanned:   doc.is_scanned || false,
        })
        downloaded++
      } catch { errors++ }
    }
  } catch (e) {
    console.error('[Sync] Error al descargar de la nube:', e)
  }

  return { downloaded, errors }
}
