import { useEffect, useMemo, useState } from 'react'
import { DANH_MUC, SAN_PHAM } from '../data/mockData'
import { dangKyTheoDoi, laySanPhamWeb } from '../data/productStore'

function Ico({ d, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  )
}

const CAT_ICON = {
  brick: 'M3 7h18v4H3z M3 13h18v4H3z M9 7v4 M15 13v4 M15 7v4 M9 13v4',
  roller: 'M4 5h11v5H4z M15 7h3a2 2 0 0 1 2 2v2h-6 M11 11v3H9v6h3v-6', // sơn/con lăn
  sheets: 'M4 7l8-3 8 3-8 3-8-3Z M4 12l8 3 8-3 M4 17l8 3 8-3',
  block: 'M3 8h18v8H3z M9 8v8 M15 8v8 M3 12h18',
  paint: 'M4 5h11v5H4z M15 7h3a2 2 0 0 1 2 2v2h-6 M11 11v3H9v6h3v-6',
}

const BTN_ICON = {
  doc: 'M8 3h8l3 3v15H5V5a2 2 0 0 1 2-2h1 M9 12h6 M9 16h4',
  calc: 'M6 3h12v18H6z M9 7h6 M8 11h.01 M12 11h.01 M16 11h.01 M8 15h.01 M12 15h.01 M16 15h4',
  image: 'M4 5h16v14H4z M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M4 17l5-5 4 4 3-3 4 4',
}

function ProductCard({ sp, onMo }) {
  const [size, setSize] = useState(sp.quyCachMacDinh)
  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <button onClick={() => onMo('detail', sp)} className="absolute right-3 top-3 text-gray-300">
        <Ico d="M9 6l6 6-6 6" className="h-5 w-5" />
      </button>

      <div className="flex gap-3">
        {/* Ảnh */}
        <button onClick={() => onMo('detail', sp)} className="flex-shrink-0 text-center">
          <div className={`flex h-28 w-24 items-center justify-center overflow-hidden rounded-xl border border-gray-100 ${sp.anhBg}`}>
            {sp.anh ? (
              <img src={sp.anh} alt={sp.ten} loading="lazy" className="h-full w-full object-contain" />
            ) : (
              <span className="text-5xl">{sp.icon}</span>
            )}
          </div>
          <div className="mt-1 text-[9px] text-gray-400">{sp.tuWeb ? 'vatlieunha.vn' : 'Dữ liệu minh họa'}</div>
        </button>

        {/* Nội dung */}
        <div className="min-w-0 flex-1 pr-5">
          <h3 className="text-lg font-black leading-tight text-gray-900">{sp.ten}</h3>
          <p className="mt-0.5 text-[13px] leading-snug text-gray-600">{sp.tenNgan}</p>
          <div className="mt-1.5">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">
              <b>{sp.hang}</b>{' '}
              {sp.tuWeb ? (
                <span className="text-brand-500">(từ website)</span>
              ) : (
                <span className="text-brand-500">(Dữ liệu minh hoạ)</span>
              )}
            </span>
          </div>
          <ul className="mt-2 space-y-0.5">
            {sp.tinhNang.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-[12px] text-gray-600">
                <span className="text-gray-400">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Nút pill */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onMo('detail', sp)} className="tap flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
          <Ico d={BTN_ICON.doc} className="h-4 w-4" /> {sp.nutTaiLieu}
        </button>
        <button onClick={() => onMo(sp.nutPhu.icon === 'calc' ? 'tinhvattu' : 'detail', sp)} className="tap flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
          <Ico d={BTN_ICON[sp.nutPhu.icon]} className="h-4 w-4" /> {sp.nutPhu.label}
        </button>
      </div>

      {/* Quy cách */}
      {sp.quyCach?.length > 0 && (
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">Quy cách phổ biến</span>
        <div className="flex flex-wrap gap-1.5">
          {sp.quyCach.map((q) => (
            <button
              key={q}
              onClick={() => setSize(q)}
              className={`tap rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                size === q ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

export default function LookupScreen({ onMo }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [web, setWeb] = useState(laySanPhamWeb())

  useEffect(() => dangKyTheoDoi(() => setWeb(laySanPhamWeb())), [])

  const ketQua = useMemo(() => {
    const key = q.trim().toLowerCase()
    return [...SAN_PHAM, ...web].filter((sp) => {
      const hopCat = cat === 'all' || sp.danhMuc === cat
      const hopTim =
        !key ||
        sp.ten.toLowerCase().includes(key) ||
        sp.hang.toLowerCase().includes(key) ||
        sp.tenNgan.toLowerCase().includes(key) ||
        sp.tags.some((t) => t.toLowerCase().includes(key))
      return hopCat && hopTim
    })
  }, [q, cat, web])

  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900">Tra cứu sản phẩm</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Tìm thông tin, công dụng, quy cách và hướng dẫn sử dụng</p>

      {/* Tìm kiếm */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
        <Ico d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3" className="h-5 w-5 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên sản phẩm, thương hiệu, công dụng..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>

      {/* Chips danh mục */}
      <div className="-mx-4 mb-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {DANH_MUC.map((dm) => {
          const chon = dm.ma === cat
          return (
            <button
              key={dm.ma}
              onClick={() => setCat(dm.ma)}
              className={`tap flex w-[76px] flex-shrink-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center transition ${
                chon ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-gray-100 bg-gray-50 text-gray-500'
              }`}
            >
              <Ico d={CAT_ICON[dm.icon]} className="h-6 w-6" />
              <span className="text-[10px] font-semibold leading-tight">{dm.ten}</span>
            </button>
          )
        })}
      </div>

      {/* Danh sách sản phẩm */}
      <div className="space-y-4">
        {ketQua.map((sp) => (
          <ProductCard key={sp.id} sp={sp} onMo={onMo} />
        ))}
        {ketQua.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400">Không tìm thấy sản phẩm phù hợp.</div>
        )}
      </div>
    </div>
  )
}
