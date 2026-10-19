import { useEffect } from 'react'
import ScreenShell from '../components/ScreenShell'
import TheDeXuat from '../components/TheDeXuat'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { danhSach, keoKhoChung } from '../services/vectorStore'

export default function DuyetScreen({ onClose }) {
  useBoNhoMaika() // render lại khi có đề xuất mới / vừa duyệt
  useEffect(() => {
    keoKhoChung() // lấy ngay đề xuất mới nhất từ máy nhân viên
  }, [])
  const choDuyet = danhSach({ trangThai: 'cho_duyet' })

  return (
    <ScreenShell title="Duyệt kiến thức" onClose={onClose}>
      <h2 className="text-2xl font-black text-gray-900">Duyệt đề xuất cập nhật kiến thức</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Nhân viên báo Maika trả lời sai hoặc gửi thẻ tri thức kèm ảnh/ghi âm → đề xuất nằm ở đây. Phê duyệt = nạp vào bộ nhớ, Maika áp dụng ngay cho mọi câu hỏi sau.
      </p>

      {choDuyet.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mb-2 text-3xl">✅</div>
          <div className="text-sm font-bold text-gray-700">Không có đề xuất nào chờ duyệt</div>
          <p className="mt-1 text-xs text-gray-400">Khi nhân viên bấm "Báo Maika trả lời sai" hoặc "Lưu thành tri thức" trong khung chat, đề xuất sẽ hiện ở đây.</p>
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
