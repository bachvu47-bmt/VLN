import { useEffect, useMemo, useState } from 'react'
import AnhSanPham from '../components/AnhSanPham'
import { DANH_MUC } from '../data/mockData'
import { dangKyTheoDoi, laySanPhamWeb } from '../data/productStore'
import { useKiotViet } from '../hooks/useKiotViet'
import { tienVN } from '../services/kiotViet'
import { danhSachTraCuu, timTraCuu } from '../services/traCuuSanPham'

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

// Giá & tồn KiotViet của quy cách đang chọn
function GiaTon({ bt }) {
  if (!bt) return null
  return (
    <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
      <span className="text-sm font-black tabular-nums text-gray-900">
        {bt.gia ? tienVN(bt.gia) : 'Liên hệ'}
        {bt.dvt && <span className="text-[11px] font-normal text-gray-400">/{bt.dvt}</span>}
      </span>
      <span className={`text-[11px] font-bold ${bt.ton > 0 ? 'text-green-700' : 'text-gray-400'}`}>
        {bt.ton > 0 ? `✓ Còn ${bt.ton.toLocaleString('vi-VN')}` : '✕ Hết hàng'}
      </span>
    </div>
  )
}

function ProductCard({ sp, onMo }) {
  const [size, setSize] = useState(sp.quyCachMacDinh)
  const bt = sp.bienThe?.find((b) => b.nhan === size) || sp.bienThe?.[0]
  const nguon = [sp.tuWeb && 'vatlieunha.vn', sp.bienThe?.length && 'KiotViet'].filter(Boolean).join(' · ')
  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <button onClick={() => onMo('detail', sp)} className="absolute right-3 top-3 text-gray-300">
        <Ico d="M9 6l6 6-6 6" className="h-5 w-5" />
      </button>

      <div className="flex gap-3">
        {/* Ảnh */}
        <button onClick={() => onMo('detail', sp)} className="flex-shrink-0 text-center">
          <AnhSanPham sp={sp} />
          <div className="mt-1 max-w-24 truncate text-[9px] text-gray-400">{nguon}</div>
        </button>

        {/* Nội dung */}
        <div className="min-w-0 flex-1 pr-5">
          <h3 className="text-lg font-black leading-tight text-gray-900">{sp.ten}</h3>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-gray-600">{sp.tenNgan}</p>
          <div className="mt-1.5">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{sp.hang}</span>
          </div>
          <ul className="mt-2 space-y-0.5">
            {sp.tinhNang.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-[12px] text-gray-600">
                <span className="text-gray-400">•</span>
                <span className="line-clamp-2">{t}</span>
              </li>
            ))}
          </ul>
          <GiaTon bt={bt} />
        </div>
      </div>

      {/* Nút pill */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onMo('detail', sp)} className="tap flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
          <Ico d={BTN_ICON.doc} className="h-4 w-4" /> {sp.nutTaiLieu}
        </button>
        {sp.dinhMuc?.giaTri > 0 && (
          <button onClick={() => onMo('detail', sp)} className="tap flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
            <Ico d={BTN_ICON.calc} className="h-4 w-4" /> Định mức {sp.dinhMuc.giaTri} {sp.dinhMuc.donVi}
          </button>
        )}
      </div>

      {/* Quy cách (theo KiotViet: mỗi loại có giá & tồn riêng) */}
      {sp.quyCach?.length > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <span className="flex-shrink-0 text-xs text-gray-500">Quy cách</span>
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
  const kv = useKiotViet()
  const [soHien, setSoHien] = useState(30)

  useEffect(() => dangKyTheoDoi(() => setWeb(laySanPhamWeb())), [])
  useEffect(() => setSoHien(30), [q, cat])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- danhSachTraCuu tự đọc web + KiotViet, tính lại khi 1 trong 2 đổi
  const tatCa = useMemo(() => danhSachTraCuu(), [web, kv?.capNhat])
  const ketQua = useMemo(() => timTraCuu(tatCa, q, cat), [tatCa, q, cat])

  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900">Tra cứu sản phẩm</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Giá & tồn kho KiotViet · hồ sơ, hướng dẫn, định mức từ vatlieunha.vn</p>

      {/* Tìm kiếm */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
        <Ico d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3" className="h-5 w-5 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên, thương hiệu, công dụng, mã hàng..."
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
        {ketQua.slice(0, soHien).map((sp) => (
          <ProductCard key={sp.id} sp={sp} onMo={onMo} />
        ))}
        {ketQua.length > soHien && (
          <button onClick={() => setSoHien((n) => n + 30)} className="tap w-full rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-bold text-gray-600">
            Xem thêm ({ketQua.length - soHien} sản phẩm)
          </button>
        )}
        {tatCa.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            <div className="text-sm font-bold text-gray-700">Đang đồng bộ sản phẩm…</div>
            <p className="mt-1 text-xs text-gray-400">Lấy hồ sơ từ vatlieunha.vn và giá, tồn kho từ KiotViet.</p>
          </div>
        )}
        {tatCa.length > 0 && ketQua.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400">Không tìm thấy sản phẩm phù hợp.</div>
        )}
      </div>
    </div>
  )
}
