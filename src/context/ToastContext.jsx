import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)
let _id = 0

const KIEU = {
  success: { icon: '✓', mau: 'bg-green-600' },
  error: { icon: '✕', mau: 'bg-brand-600' },
  info: { icon: 'ℹ', mau: 'bg-gray-800' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((noiDung, loai = 'info') => {
    const id = ++_id
    setToasts((t) => [...t, { id, noiDung, loai }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const k = KIEU[t.loai] || KIEU.info
          return (
            <div
              key={t.id}
              className={`anim-toast pointer-events-auto flex items-center gap-2 rounded-xl ${k.mau} px-4 py-2.5 text-sm font-semibold text-white shadow-lg`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs">{k.icon}</span>
              {t.noiDung}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext) || (() => {})
}
