import RoofLogo from './RoofLogo'

function vietTat(ten = '') {
  const w = ten.trim().split(/\s+/)
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase()
  return (w[0][0] + w[w.length - 1][0]).toUpperCase()
}

export default function AppHeader({ user, variant = 'default', coBaoMoi = false, onBell, onAvatar }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
      <RoofLogo />

      {variant === 'home' ? (
        <button onClick={onAvatar} className="tap flex items-center gap-2 text-right">
          <div className="leading-tight">
            <div className="text-sm font-bold text-gray-900">{user?.hoTen}</div>
            <div className="text-[11px] text-gray-500">{user?.chucVu}</div>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {vietTat(user?.hoTen)}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button onClick={onBell} className="tap relative text-gray-500" aria-label="Thông báo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {coBaoMoi && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600" />}
          </button>
          <button onClick={onAvatar} className="tap flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
            {vietTat(user?.hoTen)}
          </button>
        </div>
      )}
    </header>
  )
}
