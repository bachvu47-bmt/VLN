import { useEffect, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import TheDeXuat from '../components/TheDeXuat'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { napTheCao } from '../services/triThucCao'
import { danhSach, duyetDeXuat, keoKhoChung } from '../services/vectorStore'

const NGUONG_DUYET_NHANH = 90

export default function DuyetScreen({ onClose }) {
  useBoNhoMaika() // render lại khi có đề xuất mới / vừa duyệt
  const { user } = useAuth()
  const toast = useToast()
  const [loc, setLoc] = useState('tat') // tat | nv | cao
  const [dangDuyet, setDangDuyet] = useState(false)

  useEffect(() => {
    keoKhoChung() // lấy ngay đề xuất mới nhất từ máy nhân viên
    napTheCao({ batBuoc: true }).catch(() => {}) // và thẻ Maika vừa cào từ nhà sản xuất
  }, [])

  const choDuyet = danhSach({ trangThai: 'cho_duyet' })
  const theCao = choDuyet.filter((r) => r.tuDong)
  const theNV = choDuyet.filter((r) => !r.tuDong)
  const hien = loc === 'cao' ? theCao : loc === 'nv' ? theNV : choDuyet
  const duyetNhanh = theCao.filter((r) => (r.doTinCay || 0) >= NGUONG_DUYET_NHANH)

  const duyetHet = async () => {
    if (dangDuyet || !duyetNhanh.length) return
    setDangDuyet(true)
    let ok = 0
    for (const r of duyetNhanh) {
      try {
        await duyetDeXuat(r.id, { traLoiDung: r.traLoiDung, nguoi: user.hoTen })
        ok++
      } catch {
        /* bỏ qua thẻ lỗi, duyệt tiếp */
      }
    }
    setDangDuyet(false)
    toast(`Đã duyệt ${ok} thẻ — Maika đang học`, 'success')
  }

  return (
    <ScreenShell title="Duyệt kiến thức" onClose={onClose}>
      <h2 className="text-2xl font-black text-gray-900">Duyệt đề xuất cập nhật kiến thức</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Đề xuất từ nhân viên (báo sai, thẻ kèm ảnh/ghi âm) và tri thức Maika tự cào từ Sika, Jotun, Maxbond mỗi ngày. Phê duyệt = nạp vào bộ nhớ, Maika áp dụng ngay.
      </p>

      <div className="mb-4 flex gap-1.5">
        {[
          ['tat', `Tất cả (${choDuyet.length})`],
          ['nv', `Nhân viên (${theNV.length})`],
          ['cao', `Maika cào (${theCao.length})`],
        ].map(([id, nhan]) => (
          <button key={id} onClick={() => setLoc(id)}
            className={`tap rounded-full border px-3 py-1 text-[11px] font-semibold ${loc === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600'}`}>
            {nhan}
          </button>
        ))}
      </div>

      {loc !== 'nv' && duyetNhanh.length > 1 && (
        <button onClick={duyetHet} disabled={dangDuyet}
          className="tap mb-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-700 disabled:opacity-60">
          {dangDuyet ? '⏳ Đang duyệt…' : `✓ Duyệt nhanh ${duyetNhanh.length} thẻ cào có độ tin cậy ≥ ${NGUONG_DUYET_NHANH}%`}
        </button>
      )}

      {hien.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mb-2 text-3xl">✅</div>
          <div className="text-sm font-bold text-gray-700">Không có đề xuất nào chờ duyệt</div>
          <p className="mt-1 text-xs text-gray-400">Maika cào tri thức mới lúc 5:30 và 12:30 mỗi ngày; nhân viên gửi đề xuất từ khung chat.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hien.slice(0, 40).map((r) => (
            <TheDeXuat key={r.id} r={r} />
          ))}
          {hien.length > 40 && <p className="text-center text-xs text-gray-400">Còn {hien.length - 40} thẻ — duyệt bớt để xem tiếp.</p>}
        </div>
      )}
    </ScreenShell>
  )
}
