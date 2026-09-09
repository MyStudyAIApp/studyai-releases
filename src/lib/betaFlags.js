/**
 * Funciones en pruebas: visibles solo para el propietario mientras se rodan.
 *
 * La web y las apps ya estan en produccion con clientes de pago, asi que una
 * funcion nueva se despliega de verdad (mismo sitio, mismo backend, mismas
 * apps) pero sin que la vea nadie mas hasta que este probada. Asi se prueba en
 * el entorno real, no en una replica, sin arriesgar a los usuarios.
 *
 * El mismo uid esta en el backend (OWNER_USER_ID en web_main.py), que ademas
 * devuelve 404 en los endpoints de la funcion a cualquier otro usuario: no
 * basta con ocultar el boton, porque la ruta seguiria siendo llamable.
 *
 * Para abrir una funcion al publico: quitar su entrada de aqui y el
 * `_notebook_owner_gate` (o equivalente) del backend. Nada mas.
 */
const OWNER_USER_ID = '61c1df2a-adcd-43b5-a141-2fb2d517b4b9'

// Funciones aun en pruebas. Vaciar el array = abierta a todo el mundo.
const EN_PRUEBAS = []

export function verFuncion(nombre, user) {
  if (!EN_PRUEBAS.includes(nombre)) return true
  return user?.id === OWNER_USER_ID
}
