import { useState } from 'react'
import { DON_HANG, SAN_PHAM } from '../data/mockData'

const MAU_TRANG_THAI = {
  Mới: 'bg-blue-100 text-blue-700',
  'Đang xử lý': 'bg-amber-100 text-amber-700',
  'Đã giao': 'bg-green-100 text-green-700',
}

// Bot AI tạo các bước tư vấn dựa trên sản phẩm trong đơn.
function goiYTuVan(don) {
  const buoc = []
  don.sanPham.forEach((item) => {
    const sp = SAN_PHAM.find((p) => p.ma === item.ma)
    if (!sp) return
    buoc.push({
      sp,
      noiDung: `Gửi khách video thi công "${sp.ten}" và nhắc lại định mức ${sp.dinhMuc.giaTri} ${sp.dinhMuc.donVi}.`,
      canhBao: sp.canhBao[0],
    })
  })
  return buoc
}

function CardDon({ don }) {
  const [mo, setMo] = useState(false)
  const [daGui, setDaGui] = useState({}) // {ma: 'video'|'tailieu'}
  const buoc = goiYTuVan(don)

  const gui = (ma, loai) => {
    setDaGui((d) => ({ ...d, [`${ma}-${loai}`]: 'sending' }))
    setTimeout(() => setDaGui((d) => ({ ...d, [`${ma}-${loai}`]: 'sent' })), 1200)
  }

  const nutGui = (ma, loai, label) => {
    const tt = daGui[`${ma}-${loai}`]
    return (
      <button
        disabled={tt === 'sending' || tt === 'sent'}
        onClick={() => gui(ma, loai)}
        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
          tt === 'sent'
            ? 'bg-green-100 text-green-700'
            : tt === 'sending'
            ? 'bg-gray-100 text-gray-400'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {tt === 'sent' ? '✓ Đã gửi' : tt === 'sending' ? '⏳ Đang gửi...' : label}
      </button>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button onClick={() => setMo((v) => !v)} className="flex w-full items-center justify-between p-4 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-gray-400">{don.maDon}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${MAU_TRANG_THAI[don.trangThai]}`}>
              {don.trangThai}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-gray-900">{don.khach}</div>
          <div className="text-[11px] text-gray-500">
            {don.sanPham.map((s) => `${s.ten} ×${s.soLuong}`).join(' · ')}
          </div>
        </div>
        <span className={`ml-2 text-gray-300 transition ${mo ? 'rotate-90' : ''}`}>›</span>
      </button>

      {mo && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          {/* Phân tích đơn của Bot AI */}
          <div className="mb-3 rounded-xl border border-brand-100 bg-white p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-brand-600">
              🤖 Bot AI phân tích đơn hàng
            </div>
            <p className="text-xs text-gray-600">{don.goiY}</p>
            <div className="mt-2 text-[11px] text-gray-400">
              📞 {don.sdt} · Kênh: {don.kenh} · Ngày: {don.ngay}
            </div>
          </div>

          {/* Các bước tư vấn + gửi tài liệu */}
          <div className="space-y-3">
            {buoc.map((b) => (
              <div key={b.sp.ma} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{b.sp.icon}</span>
                  <span className="text-sm font-bold text-gray-800">{b.sp.ten}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{b.noiDung}</p>
                {b.canhBao && (
                  <p className="mt-2 rounded-lg bg-brand-50 px-2 py-1.5 text-[11px] font-semibold text-brand-700">
                    ⛔ Nhắc khách: {b.canhBao}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {nutGui(b.sp.ma, 'video', '▶ Gửi Video')}
                  {nutGui(b.sp.ma, 'tailieu', '📄 Gửi Tài liệu')}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] text-gray-400">
            Gửi qua Cổng Server tự động → Zalo / SMS / Email khách hàng
          </p>
        </div>
      )}
    </div>
  )
}

export default function ConsultScreen() {
  return (
    <div>
      <h2 className="mb-1 text-xl font-black text-gray-900">Tư vấn & CSKH sau bán</h2>
      <p className="mb-4 text-xs text-gray-500">
        Đơn đồng bộ từ <b>KiotViet</b>. Bot AI gợi ý & gửi tài liệu tới khách.
      </p>

      {/* Thẻ đồng bộ */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          Đã đồng bộ KiotViet
        </div>
        <span className="text-xs text-green-600">{DON_HANG.length} đơn mới hôm nay</span>
      </div>

      <div className="space-y-3">
        {DON_HANG.map((don) => (
          <CardDon key={don.id} don={don} />
        ))}
      </div>
    </div>
  )
}
