import { Filesystem, Directory } from '@capacitor/filesystem'

/**
 * Guarda un archivo que el usuario ha pedido descargar, en un sitio donde
 * pueda encontrarlo de verdad.
 *
 * Antes todo iba a Directory.Data, el almacenamiento PRIVADO de la app: el
 * archivo no aparecía en el explorador de archivos, no se podía abrir con otra
 * aplicación y desaparecía al desinstalar. Y encima el aviso de "se borra en X
 * días" se ocultaba, dando por salvado algo que en realidad no lo estaba.
 *
 * Ahora se intenta la carpeta pública Documentos, que es visible para el resto
 * del teléfono y sobrevive a la desinstalación. Si el sistema no deja (Android
 * 10 sin la marca de almacenamiento heredado, o permiso denegado), se cae a la
 * carpeta privada como antes -- pero devolviendo `publico: false` para poder
 * DECÍRSELO al usuario en vez de mentirle.
 */
export async function guardarDescarga({ path, data, encoding }) {
  const comun = encoding ? { path, data, encoding } : { path, data }

  try {
    await Filesystem.writeFile({ ...comun, directory: Directory.Documents, recursive: true })
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents })
    return { publico: true, directory: Directory.Documents, uri }
  } catch (e) {
    // Sin permiso o sin acceso a la carpeta pública: mejor guardarlo dentro de
    // la app que perderlo, pero avisando de dónde ha quedado.
    await Filesystem.writeFile({ ...comun, directory: Directory.Data, recursive: true })
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data })
    return { publico: false, directory: Directory.Data, uri, motivo: e?.message || 'sin acceso' }
  }
}

/** Mensaje honesto para el toast, según dónde haya acabado el archivo. */
export function mensajeDeGuardado({ publico }, queEs = 'El archivo') {
  return publico
    ? `${queEs} está en la carpeta Documentos de tu móvil`
    : `${queEs} se ha guardado dentro de MyStudy AI (se perderá si desinstalas la app)`
}
