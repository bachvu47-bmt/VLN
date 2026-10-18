// Thanh điều hướng dưới — 5 tab, active màu Đỏ #DC2626, bóng đổ ngược
const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5 M5 9.5V20h5v-6h4v6h5V9.5" />,
  search: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3" />,
  khach: (
    <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M17 11a3 3 0 1 0 0-6 M21.5 20a5.5 5.5 0 0 0-5-5.5" />
  ),
  sauban: <path d="M6 3h9l4 4v14a0 0 0 0 1 0 0H6a0 0 0 0 1 0 0V3Z M14 3v4h4 M9 12h7 M9 16h7 M9 8h3" />,
  them: <path d="M4 7h16 M4 12h16 M4 17h16" />,
}

export default function BottomNav({ tabs, active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-gray-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <ul className="flex items-stretch justify-around px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
        {tabs.map((t) => {
          const chon = t.id === active
          return (
            <li key={t.id} className="flex-1">
              <button
                onClick={() => onChange(t.id)}
                className={`tap flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-1 transition ${
                  chon ? 'text-brand-600' : 'text-gray-400'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center ${chon ? 'anim-pop' : ''}`}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={chon ? 2.2 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[22px] w-[22px]"
                  >
                    {ICONS[t.icon]}
                  </svg>
                </span>
                <span className={`text-[10px] leading-tight ${chon ? 'font-bold' : 'font-medium'}`}>{t.nhan}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
