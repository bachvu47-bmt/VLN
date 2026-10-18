import { DON_HANG, SAN_PHAM, SP_GAN_DAY, VIEC_HOM_NAY } from '../data/mockData'

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

const VIEC_ICON = {
  goi: 'M3 5a2 2 0 0 1 2-2h2l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v2a2 2 0 0 1-2 2A16 16 0 0 1 3 5Z',
  taolieu: 'M8 3h8l4 4v14H4V5a2 2 0 0 1 2-2h2 M9 13h6 M9 17h4',
  hen: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 20a7 7 0 0 1 14 0',
}

export default function HomeScreen({ onTab, onMo }) {
  const donTuVan = DON_HANG[0]
  const sp0 = SAN_PHAM.find((s) => s.ma === donTuVan.sanPham[0].ma)
  const ganDay = SP_GAN_DAY.map((ma) => SAN_PHAM.find((s) => s.ma === ma)).filter(Boolean)

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

      {/* 4 shortcut */}
      <div className="grid grid-cols-4 gap-2.5">
        {SHORTCUTS.map((s) => (
          <button key={s.ten} onClick={() => (s.overlay ? onMo(s.overlay) : onTab(s.tab))} className="tap flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-1 py-3 text-center">
            <span className="text-brand-600"><Ico d={s.d} className="h-6 w-6" /></span>
            <span className="text-[11px] font-semibold leading-tight text-gray-700">{s.ten}</span>
          </button>
        ))}
      </div>

      {/* Card AI — đơn cần tư vấn */}
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-black text-white">Maika</span>
            <span className="text-sm font-black text-gray-900">Đơn hoàn thành — cần tư vấn</span>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
        </div>

        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-gray-400">
            <Ico d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 20a7 7 0 0 1 14 0" className="h-5 w-5" />
          </span>
          <div className="text-sm leading-relaxed">
            <div className="font-bold text-gray-900">{donTuVan.khach} <span className="text-[11px] font-normal text-gray-400">(Dữ liệu minh họa)</span></div>
            <div className="text-gray-600">Đã mua: <b>{sp0?.ten}</b> <span className="text-[11px] text-gray-400">(Dữ liệu minh họa)</span></div>
            <div className="text-gray-500">Ngày bán: {donTuVan.ngay}</div>
          </div>
        </div>

        <div className="mt-3 flex gap-3 rounded-xl bg-white p-3">
          <div className="flex-shrink-0 text-center">
            <div className={`flex h-16 w-16 items-center justify-center rounded-lg ${sp0?.anhBg}`}><span className="text-3xl">{sp0?.icon}</span></div>
            <div className="mt-1 text-[9px] text-gray-400">Dữ liệu minh họa</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-sm font-bold text-brand-600">✦ Gợi ý tư vấn sau bán</div>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">{donTuVan.goiY}</p>
          </div>
        </div>

        <button onClick={() => onTab('sauban')} className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white hover:bg-brand-700">
          Xem gợi ý <span>›</span>
        </button>
      </div>

      {/* Sản phẩm tra cứu gần đây */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">Sản phẩm tra cứu gần đây</h3>
          <button onClick={() => onTab('lookup')} className="text-xs font-semibold text-brand-600">Xem tất cả ›</button>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {ganDay.map((sp) => (
            <button key={sp.ma} onClick={() => onMo('detail', sp)} className="tap w-32 flex-shrink-0 rounded-xl border border-gray-100 bg-white p-2 text-left shadow-sm">
              <div className={`flex h-20 items-center justify-center rounded-lg ${sp.anhBg}`}><span className="text-4xl">{sp.icon}</span></div>
              <div className="mt-2 truncate text-sm font-bold text-gray-900">{sp.ten}</div>
              <div className="truncate text-[11px] text-gray-500">{sp.tenNgan}</div>
              <div className="mt-0.5 text-[9px] text-gray-400">Dữ liệu minh họa</div>
            </button>
          ))}
        </div>
      </div>

      {/* Việc cần làm hôm nay */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">Việc cần làm hôm nay</h3>
          <button className="text-xs font-semibold text-brand-600">Xem tất cả ›</button>
        </div>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
          {VIEC_HOM_NAY.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Ico d={VIEC_ICON[v.loai]} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-gray-900">{v.tieuDe}</div>
                <div className="truncate text-[11px] text-gray-500">{v.phu}</div>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                {v.gio}
                <span className="text-gray-300">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
