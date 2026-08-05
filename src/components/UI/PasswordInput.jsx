import { useState, forwardRef } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'

// Campo de contraseña con el "ojito" para ver lo que se ha escrito — sin esto,
// un error de tecleo en un campo de contraseña es invisible hasta que falla el
// envío, tanto al escribir la contraseña nueva como al confirmarla.
// Acepta cualquier prop normal de <input> (value, onChange, placeholder...) y
// las reenvía tal cual; solo controla el "type" (password/text) por dentro.
const PasswordInput = forwardRef(function PasswordInput(
  { className = '', ...props }, ref
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        title={visible ? 'Ocultar' : 'Mostrar'}
      >
        {visible ? <IconEyeOff size={17} /> : <IconEye size={17} />}
      </button>
    </div>
  )
})

export default PasswordInput
