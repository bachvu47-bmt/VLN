import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { layMedia, layUrlMedia } from '../data/mediaStore'
import { coKhoChung, coQuyenAdmin } from '../services/khoChung'
import { duyetDeXuat, thongTinTin, xoaTriThuc } from '../services/vectorStore'
import PinAdminCard from './PinAdminCard'

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
  cao: { ten: 'Maika cào từ nhà sản xuất', mau: 'bg-emerald-50 text-emerald-700', cu: 'Tóm tắt từ trang nguồn', moi: 'Tri thức sẽ nạp vào Maika (kiểm tra & chỉnh nếu cần)' },
  ktc: { ten: 'Câu hỏi chưa có dữ liệu', mau: 'bg-violet-50 text-violet-700', cu: 'Maika đã trả lời bằng kiến thức chung / tìm web', moi: 'Nội dung chuẩn nạp vào Maika (sửa, bổ sung từ vatlieunha.vn)' },
  tin: { ten: 'Tin tức ngành', mau: 'bg-sky-50 text-sky-700', cu: 'Tóm tắt bài báo + trích nguyên văn', moi: 'Tin sẽ nạp vào Maika kèm ngày đăng (chỉnh nếu cần)' },
  sua_sai: { ten: 'Báo sai từ nhân viên', mau: 'bg-amber-50 text-amber-700', cu: 'Maika đã trả lời (bị báo sai)', moi: 'Nội dung đề xuất (Admin có thể chỉnh trước khi duyệt)' },
  tai_lieu: { ten: 'Tri thức hiện trường', mau: 'bg-blue-50 text-blue-700', cu: 'Câu trả lời của Maika', moi: 'Giải pháp sẽ nạp vào Maika (chỉnh nếu cần)' },
}

// 1 thẻ tri thức chờ duyệt — Admin đối chiếu, chỉnh, rồi duyệt/từ chối
export default function TheDeXuat({ r }) {
  const { user } = useAuth()
  const toast = useToast()
  const [dung, setDung] = useState(r.traLoiDung)
  const [dangXuLy, setDangXuLy] = useState(false)
  // Kho chung cần quyền Admin do máy chủ kiểm tra (phiên email Admin hoặc PIN). Máy chưa xác thực →
  // đăng nhập email Admin ngay trên thẻ (1 lần/máy) rồi làm tiếp việc đang dở — không chặn bằng thông báo lỗi.
  const [hoiPin, setHoiPin] = useState(null) // null | 'duyet' | 'tuChoi'
  const tin = thongTinTin(r)
  const nhan = tin ? NHAN.tin : r.tuDong ? NHAN.cao : r.tags?.includes('kien-thuc-chung') ? NHAN.ktc : NHAN[r.loai] || NHAN.sua_sai
  const canPin = () => coKhoChung() && !coQuyenAdmin()

  const pheDuyet = async () => {
    if (dangXuLy || !dung.trim()) return
    if (canPin()) return setHoiPin('duyet')
    setDangXuLy(true)
    try {
      const kq = await duyetDeXuat(r.id, { traLoiDung: dung, nguoi: user.hoTen })
      toast(kq.daHoc ? 'Đã phê duyệt — Maika đã học ✓' : 'Đã phê duyệt — Maika sẽ học khi có mạng', 'success')
    } catch (e) {
      setDangXuLy(false)
      if (canPin()) return setHoiPin('duyet') // PIN vừa bị đổi trên máy chủ → hỏi lại
      toast('Duyệt lỗi: ' + (e.message || e), 'error')
    }
  }

  const xacThucRoiLamTiep = () => {
    const viec = hoiPin
    setHoiPin(null)
    if (viec === 'tuChoi') tuChoi()
    else pheDuyet()
  }

  const tuChoi = async () => {
    // Thẻ đã lên kho chung (có capNhatLuc) mới cần PIN để xoá; thẻ chỉ nằm trên máy thì xoá luôn
    if (canPin() && r.capNhatLuc) return setHoiPin('tuChoi')
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
          {r.tuDong && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">{r.capNhatNguon ? 'Trang vừa cập nhật' : 'Mới'} · tin cậy {r.doTinCay}%</span>}
          {tin && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">Đăng {tin.ngay} · tin cậy {tin.doTinCay}%</span>}
          <span className="ml-auto text-[10px] text-gray-400">{r.nguoiTao} · {new Date(r.taoLuc).toLocaleString('vi-VN')}</span>
        </div>
        <h3 className="text-sm font-black text-gray-900">{tin ? '📰' : r.tuDong ? '📘' : '❓'} {r.cauHoi}</h3>
        {(r.tuDong || tin) && r.nguon && (
          <div className="mt-1.5 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 text-[11px] text-gray-600">
            <div><span className="font-bold text-emerald-700">🌐 Nguồn public:</span> {tin ? tin.bao : r.nguonTen} · {(() => { try { return new URL(r.nguon).hostname } catch { return '' } })()}</div>
            <div>
              {tin
                ? `Báo đăng ${tin.ngay} · cào lúc ${new Date(r.taoLuc).toLocaleString('vi-VN')} · trích dẫn đã khớp nguyên văn bài`
                : `Cào lúc ${new Date(r.taoLuc).toLocaleString('vi-VN')} · ${r.capNhatNguon ? 'trang đã đổi nội dung' : 'trang mới'} · tin cậy ${r.doTinCay}%`}
            </div>
            <a href={r.nguon} target="_blank" rel="noreferrer" className="block truncate text-brand-600 underline">{r.nguon}</a>
            <div className="text-[10px] text-gray-400">🔒 Không chứa dữ liệu nội bộ (KiotViet, báo cáo bán hàng)</div>
          </div>
        )}
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
        <p className={`${tin ? 'line-clamp-[12]' : 'line-clamp-6'} whitespace-pre-line text-xs text-gray-600`}>{r.traLoiSai}</p>
      </div>

      <div className="rounded-xl border-l-4 border-green-500 bg-green-50 p-3">
        <div className="mb-1 text-xs font-bold text-green-700">{nhan.moi}</div>
        <textarea value={dung} onChange={(e) => setDung(e.target.value)} rows={4}
          className="w-full resize-none rounded-lg border border-green-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand-500" />
      </div>

      {hoiPin && <PinAdminCard gon onXong={xacThucRoiLamTiep} onHuy={() => setHoiPin(null)} />}

      <div className="flex gap-2">
        <button onClick={tuChoi} disabled={dangXuLy} className="tap flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">Từ chối</button>
        <button onClick={pheDuyet} disabled={dangXuLy || !dung.trim()} className="tap flex-[2] rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">✓ Phê duyệt & dạy Maika</button>
      </div>
    </div>
  )
}
