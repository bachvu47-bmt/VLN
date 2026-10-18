import { useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { danhSach, duyetDeXuat, xoaTriThuc } from '../services/vectorStore'

// 1 đề xuất đính chính từ nhân viên — Admin đối chiếu, chỉnh, rồi duyệt/từ chối
function TheDeXuat({ r }) {
  const { user } = useAuth()
  const toast = useToast()
  const [dung, setDung] = useState(r.traLoiDung)
  const [dangXuLy, setDangXuLy] = useState(false)

  const pheDuyet = async () => {
    if (dangXuLy || !dung.trim()) return
    setDangXuLy(true)
    try {
      const kq = await duyetDeXuat(r.id, { traLoiDung: dung, nguoi: user.hoTen })
      toast(kq.daHoc ? 'Đã phê duyệt — Maika đã học ✓' : 'Đã phê duyệt — Maika sẽ học khi có mạng', 'success')
    } catch (e) {
      toast('Duyệt lỗi: ' + (e.message || e), 'error')
      setDangXuLy(false)
    }
  }

  const tuChoi = async () => {
    setDangXuLy(true)
    await xoaTriThuc(r.id)
    toast('Đã từ chối đề xuất', 'info')
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Báo sai từ nhân viên</span>
          <span className="ml-auto text-[10px] text-gray-400">{r.nguoiTao} · {new Date(r.taoLuc).toLocaleString('vi-VN')}</span>
        </div>
        <h3 className="text-sm font-black text-gray-900">❓ {r.cauHoi}</h3>
      </div>

      <div className="rounded-xl border-l-4 border-gray-300 bg-gray-50 p-3">
        <div className="mb-1 text-xs font-bold text-gray-700">Maika đã trả lời (bị báo sai)</div>
        <p className="line-clamp-6 whitespace-pre-line text-xs text-gray-600">{r.traLoiSai}</p>
      </div>

      <div className="rounded-xl border-l-4 border-green-500 bg-green-50 p-3">
        <div className="mb-1 text-xs font-bold text-green-700">Nội dung đề xuất (Admin có thể chỉnh trước khi duyệt)</div>
        <textarea value={dung} onChange={(e) => setDung(e.target.value)} rows={4}
          className="w-full resize-none rounded-lg border border-green-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand-500" />
      </div>

      <div className="flex gap-2">
        <button onClick={tuChoi} disabled={dangXuLy} className="tap flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">Từ chối</button>
        <button onClick={pheDuyet} disabled={dangXuLy || !dung.trim()} className="tap flex-[2] rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">✓ Phê duyệt & dạy Maika</button>
      </div>
    </div>
  )
}

export default function DuyetScreen({ onClose }) {
  useBoNhoMaika() // render lại khi có đề xuất mới / vừa duyệt
  const choDuyet = danhSach({ trangThai: 'cho_duyet' })

  return (
    <ScreenShell title="Duyệt kiến thức" onClose={onClose}>
      <h2 className="text-2xl font-black text-gray-900">Duyệt đề xuất cập nhật kiến thức</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Nhân viên báo Maika trả lời sai → đề xuất nằm ở đây. Phê duyệt = nạp vào bộ nhớ vector, Maika áp dụng ngay cho mọi câu hỏi sau.
      </p>

      {choDuyet.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mb-2 text-3xl">✅</div>
          <div className="text-sm font-bold text-gray-700">Không có đề xuất nào chờ duyệt</div>
          <p className="mt-1 text-xs text-gray-400">Khi nhân viên bấm "Báo Maika trả lời sai" trong khung chat, đề xuất sẽ hiện ở đây.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {choDuyet.map((r) => (
            <TheDeXuat key={r.id} r={r} />
          ))}
        </div>
      )}
    </ScreenShell>
  )
}
