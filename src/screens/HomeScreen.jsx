import { useEffect, useReducer, useState } from 'react'
import AnhSanPham from '../components/AnhSanPham'
import { laySpGanDay } from '../data/ganDayStore'
import { dangKyTheoDoi } from '../data/productStore'
import { DanhSachViec, MaikaNhacHomNay, ThemViecSheet } from '../components/TroLyChuDong'

function Ico({ d, className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  )
}

const SHORTCUTS = [
  { ten: 'Tra cứu sản phẩm', d: 'M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z M4 5a2 2 0 0 0 2 2h12', tab: 'lookup' },
  { ten: 'Hướng dẫn thi công', d: 'M6 3h9l4 4v14H6V3Z M14 3v4h4 M9 12h6 M9 16h6', tab: 'lookup' },
  { ten: 'Giải pháp theo nhu cầu', d: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.2-1 2.5H9c0-1.3-.3-1.8-1-2.5A6 6 0 0 1 12 3Z', overlay: 'tuvanai' },
  { ten: 'Tư vấn khách hàng', d: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M17 11a3 3 0 1 0 0-6 M21.5 20a5.5 5.5 0 0 0-5-5.5', tab: 'khach' },
]

export default function HomeScreen({ onTab, onMo }) {
  const [themViec, setThemViec] = useState(null) // 'viec' | 'baogia'
  // Sản phẩm web nạp từ IndexedDB sau lần render đầu → vẽ lại khi kho sẵn sàng / đồng bộ xong
  const [, veLai] = useReducer((x) => x + 1, 0)
  useEffect(() => dangKyTheoDoi(veLai), [])
  const ganDay = laySpGanDay()

  return (
    <div className="space-y-5">
      {/* Thanh tìm kiếm */}
      <button
        onClick={() => onTab('lookup')}
        className="tap flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-left"
      >
        <Ico d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3" className="h-5 w-5 text-gray-400" />
        <span className="flex-1 text-sm text-gray-400">Tìm sản phẩm, kỹ thuật, công dụng...</span>
        <Ico d="M4 8V6a2 2 0 0 1 2-2h2 M16 4h2a2 2 0 0 1 2 2v2 M20 16v2a2 2 0 0 1-2 2h-2 M8 20H6a2 2 0 0 1-2-2v-2" className="h-5 w-5 text-brand-600" />
      </button>

      {/* Trợ lý chủ động — Maika nhắc việc hôm nay */}
      <MaikaNhacHomNay onThem={setThemViec} onMo={onMo} />

      {/* Việc cần làm (dữ liệu thật, Maika tự nhắc đúng hạn) */}
      <DanhSachViec onThem={setThemViec} />

      {/* 4 shortcut */}
      <div className="grid grid-cols-4 gap-2.5">
        {SHORTCUTS.map((s) => (
          <button key={s.ten} onClick={() => (s.overlay ? onMo(s.overlay) : onTab(s.tab))} className="tap flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-1 py-3 text-center">
            <span className="text-brand-600"><Ico d={s.d} className="h-6 w-6" /></span>
            <span className="text-[11px] font-semibold leading-tight text-gray-700">{s.ten}</span>
          </button>
        ))}
      </div>

      {/* Sản phẩm tra cứu gần đây — sản phẩm người dùng đã thực sự mở */}
      {ganDay.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-black text-gray-900">Sản phẩm tra cứu gần đây</h3>
            <button onClick={() => onTab('lookup')} className="text-xs font-semibold text-brand-600">Xem tất cả ›</button>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {ganDay.map((sp) => (
              <button key={sp.id} onClick={() => onMo('detail', sp)} className="tap w-32 flex-shrink-0 rounded-xl border border-gray-100 bg-white p-2 text-left shadow-sm">
                <AnhSanPham sp={sp} co="vua" />
                <div className="mt-2 truncate text-sm font-bold text-gray-900">{sp.ten}</div>
                <div className="truncate text-[11px] text-gray-500">{sp.tenNgan}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {themViec && <ThemViecSheet cheDo={themViec} onClose={() => setThemViec(null)} />}
    </div>
  )
}
