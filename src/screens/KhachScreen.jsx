import { useMemo, useState } from 'react'
import { KHACH_HANG } from '../data/mockData'

function vietTat(t = '') {
  const w = t.trim().split(/\s+/)
  return (w[0][0] + (w[w.length - 1][0] || '')).toUpperCase()
}

export default function KhachScreen() {
  const [q, setQ] = useState('')
  const ds = useMemo(() => {
    const k = q.trim().toLowerCase()
    return KHACH_HANG.filter((c) => !k || c.ten.toLowerCase().includes(k) || c.sdt.includes(q) || c.maKH.toLowerCase().includes(k))
  }, [q])

  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900">Khách hàng</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Hồ sơ khách & lịch sử mua hàng</p>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-gray-400" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, số điện thoại, mã KH..." className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>

      <div className="space-y-3">
        {ds.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">{vietTat(c.ten)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-gray-900">{c.ten}</span>
                <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{c.phanLoai}</span>
              </div>
              <div className="truncate text-[12px] text-gray-500">{c.sdt} · {c.diaChi}</div>
              <div className="truncate text-[11px] text-gray-400">{c.maKH} · {c.loai}</div>
            </div>
            <span className="text-gray-300">›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
