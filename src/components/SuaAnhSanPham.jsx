import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { dangKyTheoDoi, laySanPhamWeb } from '../data/productStore'
import { useKiotViet } from '../hooks/useKiotViet'
import { anhGhiDe, dangKyAnh, datAnhSanPham, napAnhSanPham } from '../services/anhSanPham'
import { coKhoChung, coQuyenAdmin } from '../services/khoChung'
import { danhSachTraCuu, thieuAnh, timTraCuu } from '../services/traCuuSanPham'
import AnhSanPham from './AnhSanPham'
import PinAdminCard from './PinAdminCard'

// 1 dòng: ảnh hiện tại · dán link https → xem trước → lưu (mọi máy thấy) / bỏ ảnh đã đặt
function DongAnh({ sp }) {
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [xemThu, setXemThu] = useState('') // '' | 'dang' | 'ok' | 'loi'
  const [dangLuu, setDangLuu] = useState(false)
  const daDat = anhGhiDe(sp.id)

  useEffect(() => {
    const u = url.trim()
    if (!/^https:\/\/\S+$/.test(u)) return setXemThu('')
    setXemThu('dang')
    const img = new Image()
    img.onload = () => setXemThu('ok')
    img.onerror = () => setXemThu('loi')
    img.src = u
    return () => {
      img.onload = img.onerror = null
    }
  }, [url])

  const luu = async (giaTri) => {
    setDangLuu(true)
    try {
      await datAnhSanPham(sp.id, giaTri)
      setUrl('')
      toast(giaTri ? 'Đã cập nhật ảnh — mọi máy thấy ngay' : 'Đã bỏ ảnh đã đặt', 'success')
    } catch (e) {
      toast(e.message || String(e), 'error')
    } finally {
      setDangLuu(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="flex items-center gap-3">
        <AnhSanPham sp={sp} co="nho" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-gray-900">{sp.ten}</div>
          <div className="truncate text-[10px] text-gray-400">
            {sp.hang} · {sp.tuWeb ? 'vatlieunha.vn' : 'chỉ có trên KiotViet'}
            {daDat ? ' · ảnh Admin đặt' : thieuAnh(sp) ? ' · chưa có ảnh' : ''}
          </div>
        </div>
        {daDat && (
          <button onClick={() => luu('')} disabled={dangLuu} className="text-[10px] font-semibold text-gray-500 underline disabled:opacity-50">Bỏ ảnh</button>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Dán link ảnh https://…" inputMode="url" autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500 focus:bg-white" />
        <button onClick={() => luu(url.trim())} disabled={dangLuu || xemThu !== 'ok'}
          className="tap rounded-lg bg-brand-600 px-3 text-xs font-bold text-white disabled:opacity-40">
          {dangLuu ? '…' : 'Lưu'}
        </button>
      </div>
      {xemThu && (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          {xemThu === 'ok' && <img src={url.trim()} alt="Xem trước" className="h-14 w-14 rounded-lg border border-gray-100 object-contain" />}
          <span className={xemThu === 'loi' ? 'text-red-600' : xemThu === 'ok' ? 'text-green-700' : 'text-gray-400'}>
            {xemThu === 'dang' ? 'Đang thử tải ảnh…' : xemThu === 'ok' ? '✓ Ảnh hợp lệ — bấm Lưu' : '✕ Không mở được ảnh từ link này (link trang web, không phải link ảnh?)'}
          </span>
        </div>
      )}
    </div>
  )
}

// Tab Admin: sản phẩm thiếu ảnh (lên đầu) + tìm sản phẩm bất kỳ để thay ảnh sai
export default function SuaAnhSanPham() {
  const kv = useKiotViet()
  const [web, setWeb] = useState(laySanPhamWeb())
  const [, setLai] = useState(0)
  const [q, setQ] = useState('')
  const [soHien, setSoHien] = useState(20)

  useEffect(() => dangKyTheoDoi(() => setWeb(laySanPhamWeb())), [])
  useEffect(() => dangKyAnh(() => setLai((n) => n + 1)), [])
  useEffect(() => {
    napAnhSanPham({ batBuoc: true }).catch(() => {})
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- danhSachTraCuu tự đọc web + KiotViet
  const tatCa = useMemo(() => danhSachTraCuu(), [web, kv?.capNhat])
  const thieu = tatCa.filter(thieuAnh)
  const ds = q.trim() ? timTraCuu(tatCa, q) : thieu

  if (coKhoChung() && !coQuyenAdmin()) return <PinAdminCard gon />

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        Ảnh hiển thị theo thứ tự: <b>ảnh Admin đặt</b> → ảnh vatlieunha.vn → ảnh KiotViet → logo thương hiệu → logo Vật Liệu Nhà.
        Hiện có <b className="text-gray-800">{thieu.length}</b>/{tatCa.length} sản phẩm chưa có ảnh thật.
      </p>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        <input value={q} onChange={(e) => { setQ(e.target.value); setSoHien(20) }} placeholder="Tìm sản phẩm để thay ảnh (để trống = sản phẩm thiếu ảnh)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>
      <div className="space-y-2">
        {ds.slice(0, soHien).map((sp) => <DongAnh key={sp.id} sp={sp} />)}
        {ds.length > soHien && (
          <button onClick={() => setSoHien((n) => n + 20)} className="tap w-full rounded-xl border border-gray-200 bg-white py-2 text-xs font-bold text-gray-600">Xem thêm ({ds.length - soHien})</button>
        )}
        {!ds.length && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            {q.trim() ? 'Không tìm thấy sản phẩm.' : '✅ Sản phẩm nào cũng đã có ảnh thật.'}
          </div>
        )}
      </div>
    </div>
  )
}
