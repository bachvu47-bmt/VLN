export default function BottomNav({ tabs, active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-gray-200 bg-white/95 backdrop-blur">
      <ul className="flex items-stretch justify-around px-1 py-1">
        {tabs.map((t) => {
          const chon = t.id === active
          return (
            <li key={t.id} className="flex-1">
              <button
                onClick={() => onChange(t.id)}
                className={`flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition ${
                  chon ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className={`text-xl leading-none ${chon ? 'scale-110' : ''} transition`}>
                  {t.icon}
                </span>
                <span className="text-[10px] font-semibold leading-tight">{t.nhan}</span>
                {chon && <span className="mt-0.5 h-1 w-1 rounded-full bg-brand-600" />}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
