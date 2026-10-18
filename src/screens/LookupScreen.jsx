import { useMemo, useState } from 'react'
import { SAN_PHAM } from '../data/mockData'

function BoTinhVatTu({ sp }) {
  const [m2, setM2] = useState('')
  const dm = sp.dinhMuc
  const dienTich = parseFloat(m2) || 0
  const soLuong = (dienTich * dm.giaTri).toFixed(2)

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
        🧮 Bộ tính vật tư
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Định mức: <b>{dm.giaTri} {dm.donVi}</b>. {dm.ghiChu}
      </p>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold text-gray-600">Diện tích (m²)</label>
          <input
            type="number"
            min="0"
            value={m2}
            onChange={(e) => setM2(e.target.value)}
            placeholder="vd: 25"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div className="text-2xl text-gray-300">→</div>
        <div className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-white">
          <div className="text-[10px] uppercase tracking-wide text-brand-100">Cần dùng</div>
          <div className="text-lg font-black leading-tight">
            {soLuong} <span className="text-xs font-semibold">{dm.donVi.split('/')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Flashcard({ sp, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">{sp.icon}</span>
            <div>
              <div className="text-[10px] font-mono text-gray-400">{sp.ma}</div>
              <h3 className="text-lg font-black leading-tight text-gray-900">{sp.ten}</h3>
              <div className="text-xs text-gray-500">{sp.hangSX} · {sp.donVi}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-500">✕</button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-gray-600">{sp.moTa}</p>

        {/* THẺ CẢNH BÁO ĐỎ */}
        <div className="mb-4 rounded-xl border-2 border-brand-600 bg-brand-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-700">
            🚨 Cảnh báo — Chống chỉ định
          </div>
          <ul className="space-y-2">
            {sp.canhBao.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm font-semibold text-brand-800">
                <span className="mt-0.5">⛔</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* TỶ LỆ PHA TRỘN */}
        <div className="mb-4">
          <div className="mb-2 text-sm font-bold text-gray-800">⚗️ Tỷ lệ pha trộn chuẩn</div>
          <div className="space-y-2">
            {sp.tyLePha.map((t, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs font-bold text-brand-600">{t.buoc}</div>
                <div className="mt-0.5 text-sm text-gray-700">{t.noiDung}</div>
              </div>
            ))}
          </div>
        </div>

        {/* BỘ TÍNH VẬT TƯ */}
        <div className="mb-4">
          <BoTinhVatTu sp={sp} />
        </div>

        {/* VIDEO & TÀI LIỆU */}
        <div className="mb-2 text-sm font-bold text-gray-800">🎬 Video & Tài liệu kỹ thuật</div>
        <div className="space-y-2">
          <a
            href={sp.video}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            <span>▶ Xem video hướng dẫn thi công</span>
            <span>→</span>
          </a>
          {sp.taiLieu.map((tl, i) => (
            <button
              key={i}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-300 hover:text-brand-600"
            >
              <span>📄 {tl}</span>
              <span className="text-xs text-gray-400">Tải xuống</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LookupScreen() {
  const [q, setQ] = useState('')
  const [chon, setChon] = useState(null)

  const ketQua = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return SAN_PHAM
    return SAN_PHAM.filter(
      (sp) =>
        sp.ten.toLowerCase().includes(key) ||
        sp.ma.toLowerCase().includes(key) ||
        sp.nhom.toLowerCase().includes(key) ||
        sp.tags.some((t) => t.toLowerCase().includes(key)),
    )
  }, [q])

  return (
    <div>
      <h2 className="mb-1 text-xl font-black text-gray-900">Tra cứu kỹ thuật</h2>
      <p className="mb-4 text-xs text-gray-500">Chạm vào sản phẩm để mở Flashcard kỹ thuật.</p>

      {/* Ô tìm kiếm */}
      <div className="sticky top-0 z-10 mb-4 bg-gray-50 pb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm: SikaLatex, Maxbond, PU, Ramset..."
            className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
      </div>

      {/* Danh sách */}
      <div className="space-y-3">
        {ketQua.map((sp) => (
          <button
            key={sp.id}
            onClick={() => setChon(sp)}
            className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
          >
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">
              {sp.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-gray-900">{sp.ten}</span>
                {sp.canhBao.length > 0 && (
                  <span className="flex-shrink-0 rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    ⚠ {sp.canhBao.length}
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-gray-500">{sp.nhom} · {sp.hangSX}</div>
            </div>
            <span className="text-gray-300">›</span>
          </button>
        ))}
        {ketQua.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-400">
            Không tìm thấy sản phẩm phù hợp.
          </div>
        )}
      </div>

      {chon && <Flashcard sp={chon} onClose={() => setChon(null)} />}
    </div>
  )
}
