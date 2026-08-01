// Icono (o emoji, para mascotas como el búho del Tutor) dentro de un círculo
// de color — colores fijos de Tailwind (no remapeados por tema, salvo "blue"
// que usa primary-* para heredar el acento del tema activo).
export default function IconBadge({ icon: Icon, emoji, color = 'slate', size = 'md', className = '' }) {
  const sizes = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-11 h-11' }
  const iconSizes = { sm: 14, md: 16, lg: 20 }
  const emojiSizes = { sm: 13, md: 15, lg: 20 }
  const colors = {
    blue:   'bg-primary-500/15 text-primary-400',
    purple: 'bg-purple-500/15 text-purple-400',
    green:  'bg-emerald-500/15 text-emerald-400',
    amber:  'bg-amber-500/15 text-amber-400',
    pink:   'bg-pink-500/15 text-pink-400',
    teal:   'bg-teal-500/15 text-teal-400',
    red:    'bg-red-500/15 text-red-400',
    slate:  'bg-slate-700/60 text-slate-400',
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-full shrink-0 ${sizes[size]} ${colors[color] || colors.slate} ${className}`}>
      {emoji
        ? <span style={{ fontSize: emojiSizes[size], lineHeight: 1 }}>{emoji}</span>
        : <Icon size={iconSizes[size]} stroke={1.8} />}
    </span>
  )
}
