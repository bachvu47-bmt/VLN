// Logo thương hiệu: mái nhà đỏ + chữ "VẬT LIỆU NHÀ"
export function RoofMark({ className = 'h-7 w-9' }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden>
      <path d="M32 3 L61 26 H50 L32 12 L14 26 H3 Z" fill="#DC2626" />
      <path d="M32 16 L48 28 H41 L32 21 L23 28 H16 Z" fill="#DC2626" opacity="0.45" />
    </svg>
  )
}

export default function RoofLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-2">
      <RoofMark className={compact ? 'h-6 w-8' : 'h-7 w-9'} />
      <span className="text-[17px] font-extrabold uppercase tracking-wide text-gray-900">
        Vật Liệu Nhà
      </span>
    </div>
  )
}
