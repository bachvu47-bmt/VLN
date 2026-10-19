import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { layMedia, layUrlMedia } from '../data/mediaStore'
import { duyetDeXuat, xoaTriThuc } from '../services/vectorStore'

// Ảnh / âm thoại đính kèm thẻ tri thức (đọc Blob từ IndexedDB)
function MediaXem({ md }) {
  const [url, setUrl] = useState(null)
  const [banGhi, setBanGhi] = useState('')
  const [mat, setMat] = useState(false)
  useEffect(() => {
    let huy = false
    layUrlMedia(md.id).then((u) => !huy && (u ? setUrl(u) : setMat(true)))
    if (md.loai === 'am_thanh') layMedia(md.id).then((r) => !huy && setBanGhi(r?.banGhi || ''))
    return () => {
      huy = true
    }
  }, [md.id, md.loai])
  if (mat) return <div className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] text-gray-400">Media không còn trên máy này</div>
  if (!url) return <div className="h-20 w-20 animate-pulse rounded-lg bg-gray-100" />
  if (md.loai === 'anh') {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="Ảnh hiện trường" className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
      </a>
    )
  }
  return (
    <div className="w-full">
      <audio src={url} controls className="h-9 w-full" />
      {banGhi && <p className="mt-0.5 text-[11px] italic text-gray-500">“{banGhi}”</p>}
    </div>
  )
}

const NHAN = {
  sua_sai: { ten: 'Báo sai từ nhân viên', mau: 'bg-amber-50 text-amber-700', cu: 'Maika đã trả lời (bị báo sai)', moi: 'Nội dung đề xuất (Admin có thể chỉnh trước khi duyệt)' },
  tai_lieu: { ten: 'Tri thức hiện trường', mau: 'bg-blue-50 text-blue-700', cu: 'Câu trả lời của Maika', moi: 'Giải pháp sẽ nạp vào Maika (chỉnh nếu cần)' },
}

// 1 thẻ tri thức chờ duyệt — Admin đối chiếu, chỉnh, rồi duyệt/từ chối
export default function TheDeXuat({ r }) {
  const { user } = useAuth()
  const toast = useToast()
  const [dung, setDung] = useState(r.traLoiDung)
  const [dangXuLy, setDangXuLy] = useState(false)
  const nhan = NHAN[r.loai] || NHAN.sua_sai

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
    try {
      await xoaTriThuc(r.id)
      toast('Đã từ chối đề xuất', 'info')
    } catch (e) {
      toast('Từ chối lỗi: ' + (e.message || e), 'error')
      setDangXuLy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${nhan.mau}`}>{nhan.ten}</span>
          {r.media?.length > 0 && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">Multimodal</span>}
          {r.sku && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">SKU {r.sku}</span>}
          <span className="ml-auto text-[10px] text-gray-400">{r.nguoiTao} · {new Date(r.taoLuc).toLocaleString('vi-VN')}</span>
        </div>
        <h3 className="text-sm font-black text-gray-900">❓ {r.cauHoi}</h3>
      </div>

      {r.media?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.media.map((md) => (
            <MediaXem key={md.id} md={md} />
          ))}
        </div>
      )}

      <div className="rounded-xl border-l-4 border-gray-300 bg-gray-50 p-3">
        <div className="mb-1 text-xs font-bold text-gray-700">{nhan.cu}</div>
        <p className="line-clamp-6 whitespace-pre-line text-xs text-gray-600">{r.traLoiSai}</p>
      </div>

      <div className="rounded-xl border-l-4 border-green-500 bg-green-50 p-3">
        <div className="mb-1 text-xs font-bold text-green-700">{nhan.moi}</div>
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
