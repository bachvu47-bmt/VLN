import { useState } from 'react'
import { useToast } from '../context/ToastContext'

function Ico({ d, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  )
}

const TABS = ['Tổng quan', 'Công dụng', 'Thi công', 'Tài liệu']

function BoTinhNhanh({ sp }) {
  const [m2, setM2] = useState('')
  const dt = parseFloat(m2) || 0
  const sl = (dt * sp.dinhMuc.giaTri).toFixed(2)
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="mb-1 text-sm font-bold text-gray-800">🧮 Tính vật tư nhanh</div>
      <p className="mb-3 text-xs text-gray-500">Định mức {sp.dinhMuc.giaTri} {sp.dinhMuc.donVi}. {sp.dinhMuc.ghiChu}</p>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold text-gray-600">Diện tích (m²)</label>
          <input type="number" min="0" value={m2} onChange={(e) => setM2(e.target.value)} placeholder="vd: 25"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
        </div>
        <span className="pb-2 text-xl text-gray-300">→</span>
        <div className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-white">
          <div className="text-[10px] text-brand-100">Cần dùng</div>
          <div className="text-lg font-black leading-tight">{sl} <span className="text-xs">{sp.dinhMuc.donVi.split('/')[0]}</span></div>
        </div>
      </div>
    </div>
  )
}

export default function ProductDetailScreen({ sp, onClose }) {
  const [tab, setTab] = useState('Tổng quan')
  const [size, setSize] = useState(sp.quyCachMacDinh)
  const toast = useToast()

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-100 px-3 py-3">
        <button onClick={onClose} className="tap flex h-9 w-9 items-center justify-center rounded-full text-gray-700">
          <Ico d="M15 6l-6 6 6 6" className="h-6 w-6" />
        </button>
        <span className="text-sm font-bold text-gray-900">Hồ sơ kỹ thuật</span>
        <button className="tap flex h-9 w-9 items-center justify-center rounded-full text-gray-400">
          <Ico d="M12 21s-7-4.5-9.5-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" className="h-6 w-6" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
        {/* Hero */}
        <div className="flex gap-3">
          <div className="flex-shrink-0 text-center">
            <div className={`flex h-28 w-24 items-center justify-center rounded-xl border border-gray-100 ${sp.anhBg}`}>
              <span className="text-5xl">{sp.icon}</span>
            </div>
            <div className="mt-1 text-[9px] text-gray-400">Dữ liệu minh họa</div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-gray-900">{sp.ten}<span className="text-brand-600">®</span></h1>
            <p className="mt-0.5 text-sm text-gray-600">{sp.tenNgan}</p>
            <div className="mt-3">
              <div className="mb-1 text-[11px] font-semibold text-gray-500">Chọn quy cách</div>
              <div className="flex flex-wrap gap-1.5">
                {sp.quyCach.map((q) => (
                  <button key={q} onClick={() => setSize(q)}
                    className={`tap rounded-lg border px-2.5 py-1 text-xs font-semibold ${size === q ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600'}`}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex border-b border-gray-100">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 border-b-2 pb-2.5 text-sm font-semibold transition ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Nội dung tab */}
        <div className="mt-4 space-y-4">
          {tab === 'Tổng quan' && (
            <>
              <p className="text-sm leading-relaxed text-gray-600">{sp.moTa}</p>
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                  <span className="text-brand-600"><Ico d="M12 12a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M12 8a4 4 0 1 0 0 8 M12 12h.01" className="h-5 w-5" /></span>
                  Mục đích sử dụng
                </div>
                <ul className="space-y-1.5">
                  {sp.mucDich.map((m, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600"><span className="text-brand-500">•</span>{m}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border-l-4 border-brand-600 bg-brand-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-700">⚠️ Giới hạn sử dụng</div>
                <ul className="space-y-2">
                  {sp.canhBao.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm font-medium text-brand-800"><span>⛔</span>{c}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {tab === 'Công dụng' && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-2 text-sm font-bold text-gray-900">Tính năng nổi bật</div>
              <ul className="space-y-1.5">
                {sp.tinhNang.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-600"><span className="text-brand-500">✓</span>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'Thi công' && (
            <>
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-2 text-sm font-bold text-gray-900">⚗️ Tỷ lệ pha trộn chuẩn</div>
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  {sp.tyLePha.map((t, i) => (
                    <div key={i} className={`flex gap-3 p-2.5 text-sm ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                      <div className="w-28 flex-shrink-0 font-semibold text-brand-600">{t.buoc}</div>
                      <div className="text-gray-600">{t.noiDung}</div>
                    </div>
                  ))}
                </div>
              </div>
              <BoTinhNhanh sp={sp} />
            </>
          )}

          {tab === 'Tài liệu' && (
            <div className="space-y-2">
              <a href={sp.video} target="_blank" rel="noreferrer" className="tap flex items-center justify-between rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white">
                <span>▶ Xem video hướng dẫn</span><span>→</span>
              </a>
              {sp.taiLieu.map((tl, i) => (
                <button key={i} onClick={() => toast('Đang tải ' + tl, 'info')} className="tap flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
                  <span>📄 {tl}</span><span className="text-xs text-gray-400">Tải xuống</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nút cố định */}
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md border-t border-gray-100 bg-white p-3">
        <button onClick={() => toast('Đã tạo bộ tài liệu cho ' + sp.ten, 'success')}
          className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white hover:bg-brand-700">
          <Ico d="M8 3h8l3 3v15H5V5a2 2 0 0 1 2-2h1 M9 12h6 M9 16h4" className="h-5 w-5" /> Tạo bộ tài liệu
        </button>
      </div>
    </div>
  )
}
