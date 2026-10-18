import { useState } from 'react'
import { SAN_PHAM } from '../data/mockData'
import ScreenShell from '../components/ScreenShell'
import { useToast } from '../context/ToastContext'

const PHAN_TICH = [
  { ten: 'Mục đích sử dụng', mo: 'Khách dùng chống thấm, dán gạch hay làm lớp kết nối?' },
  { ten: 'Bề mặt thi công', mo: 'Tình trạng bề mặt: mới, cũ, ẩm hay đã có lớp phủ?' },
  { ten: 'Điều kiện công trình', mo: 'Trong nhà hay ngoài trời, nhiệt độ và độ ẩm hiện tại?' },
]

export default function TuVanAIScreen({ onClose }) {
  const sp = SAN_PHAM.find((s) => s.ma === 'SIKA-LTX-TH')
  const [tin, setTin] = useState('')
  const toast = useToast()

  const gui = () => {
    if (!tin.trim()) return
    toast('Đã gửi câu hỏi tới Trợ lý AI', 'info')
    setTin('')
  }

  const footer = (
    <div className="flex items-center gap-2">
      <input value={tin} onChange={(e) => setTin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && gui()}
        placeholder="Nhập tin nhắn tư vấn..." className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white" />
      <button onClick={gui} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
      </button>
    </div>
  )

  return (
    <ScreenShell title="Trợ lý AI" onClose={onClose} footer={footer}>
      {/* Bong bóng AI */}
      <div className="rounded-2xl rounded-tl-sm border border-brand-100 bg-brand-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-brand-600">✦ Trợ lý AI · Vật Liệu Nhà</div>
        <p className="text-sm leading-relaxed text-gray-700">
          Để tư vấn đúng và chính xác cho khách mua <b>{sp?.ten}</b>, anh/chị nên hỏi thêm các thông tin:
        </p>
        <div className="mt-3 space-y-2">
          {PHAN_TICH.map((p, i) => (
            <div key={p.ten} className="flex gap-2.5 rounded-xl bg-white p-3">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{i + 1}</span>
              <div>
                <div className="text-sm font-bold text-gray-800">{p.ten}</div>
                <div className="text-xs text-gray-600">{p.mo}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700">
          ⚠ Xác nhận mục đích sử dụng trước khi chọn hướng dẫn
        </div>
      </div>

      {/* Sản phẩm liên quan */}
      <div className="mt-5">
        <div className="mb-2 text-sm font-black text-gray-900">Sản phẩm liên quan</div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg ${sp?.anhBg}`}><span className="text-2xl">{sp?.icon}</span></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-gray-900">{sp?.ten}</div>
            <div className="truncate text-[12px] text-gray-500">{sp?.tenNgan}</div>
          </div>
          <span className="text-gray-300">›</span>
        </div>
      </div>

      {/* Nguồn tham khảo */}
      <div className="mt-5">
        <div className="mb-2 text-sm font-black text-gray-900">Nguồn tham khảo</div>
        <div className="space-y-2">
          {sp?.taiLieu.map((tl, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-sm text-gray-700">
              <span>📄 {tl}</span><span className="text-xs text-gray-400">Tài liệu đã duyệt</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ngữ cảnh khách hàng */}
      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-1 text-sm font-black text-gray-900">Ngữ cảnh khách hàng</div>
        <p className="text-xs leading-relaxed text-gray-600">
          Khách: Lương Minh Phát <span className="text-gray-400">(Dữ liệu minh họa)</span><br />
          Lịch sử mua: SikaLatex 5L · 12/04/2025 · Nhà ở dân dụng, Quận 7.
        </p>
      </div>
    </ScreenShell>
  )
}
