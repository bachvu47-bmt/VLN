import { useEffect, useState } from 'react'
import logoVLN from '../assets/logo-icon.svg'
import { dangKyAnh } from '../services/anhSanPham'
import { chuoiAnh, nhanDienThuongHieu } from '../services/traCuuSanPham'

// Ảnh sản phẩm thật theo thứ tự: Admin đặt → vatlieunha.vn → KiotViet. Ảnh lỗi → thử ảnh sau.
// Hết ảnh → ô logo thương hiệu (Sika, Maxbond, Neotex…) → logo Vật Liệu Nhà. Không còn emoji/mockup.
// co: 'lon' (thẻ Tra cứu / chi tiết) | 'vua' (Hôm nay) | 'nho' (chat)
const CO = {
  lon: { khung: 'h-28 w-24 rounded-xl', chu: 'text-base', logo: 'h-12 w-12' },
  vua: { khung: 'h-20 w-full rounded-lg', chu: 'text-sm', logo: 'h-10 w-10' },
  nho: { khung: 'h-10 w-10 rounded-lg', chu: 'text-[8px]', logo: 'h-7 w-7' },
}

export default function AnhSanPham({ sp, co = 'lon', className = '' }) {
  const [, setLai] = useState(0)
  useEffect(() => dangKyAnh(() => setLai((n) => n + 1)), []) // Admin vừa đặt ảnh → hiện ngay
  const ds = chuoiAnh(sp)
  const khoa = ds.join('|')
  const [hong, setHong] = useState({ khoa, n: 0 })
  const n = hong.khoa === khoa ? hong.n : 0 // đổi danh sách ảnh → thử lại từ đầu
  const c = CO[co] || CO.lon
  const url = ds[n]

  if (url) {
    return (
      <div className={`flex flex-shrink-0 items-center justify-center overflow-hidden border border-gray-100 bg-white ${c.khung} ${className}`}>
        <img src={url} alt={sp.ten} loading="lazy" referrerPolicy="no-referrer" onError={() => setHong({ khoa, n: n + 1 })} className="h-full w-full object-contain" />
      </div>
    )
  }

  const th = nhanDienThuongHieu(sp.hang, sp.ten)
  if (th) {
    return (
      <div className={`flex flex-shrink-0 items-center justify-center overflow-hidden px-1 ${c.khung} ${className}`} style={{ background: th.nen }} title={`${th.ten} — chưa có ảnh sản phẩm`}>
        <span className={`text-center font-black uppercase leading-tight tracking-wide ${c.chu}`} style={{ color: th.chu }}>{th.ten}</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-shrink-0 flex-col items-center justify-center gap-1 overflow-hidden border border-gray-100 bg-gray-50 ${c.khung} ${className}`} title="Vật Liệu Nhà — chưa có ảnh sản phẩm">
      <img src={logoVLN} alt="Vật Liệu Nhà" className={`${c.logo} opacity-80`} />
      {co !== 'nho' && <span className="text-[8px] font-semibold uppercase tracking-wide text-gray-400">Vật Liệu Nhà</span>}
    </div>
  )
}
