import { useState } from 'react'
import { vnd, vndDay } from '../services/baoCaoSheets'

// ============================================================
//  BIỂU ĐỒ 1 CHUỖI — theo bộ quy chuẩn dataviz:
//  1 màu (series-1 xanh), cột ≤ 24px bo 4px đầu cột, lưới hairline nhạt,
//  chữ dùng màu chữ (không dùng màu dữ liệu), nhãn chọn lọc (chỉ đỉnh),
//  chạm/rê để xem giá trị, có chế độ xem bảng. 1 chuỗi → không cần chú thích.
// ============================================================
const MAU = { series: '#2a78d6', luoi: '#e1e0d9', truc: '#c3c2b7', mo: '#898781' }

// Mốc trục tròn số sát giá trị lớn nhất (vd 107tr → 120tr, không nhảy lên 200tr)
function mocTron(max) {
  if (max <= 0) return 1
  const mu = 10 ** Math.floor(Math.log10(max))
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((x) => x * mu).find((x) => x >= max)
}

const dinhDang = (v, donVi, day = false) => (donVi === 'vnd' ? (day ? vndDay(v) : vnd(v)) : v.toLocaleString('vi-VN'))

function BangDuLieu({ diem, donVi }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {diem.map((d) => (
          <tr key={d.nhan} className="border-b border-gray-100 last:border-0">
            <td className="py-1 pr-2 text-gray-600">{d.nhan}</td>
            <td className="py-1 text-right font-semibold tabular-nums text-gray-900">{dinhDang(d.giaTri, donVi, true)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Cot({ diem, donVi }) {
  const [chon, setChon] = useState(null)
  const max = mocTron(Math.max(...diem.map((d) => d.giaTri)))
  const iDinh = diem.reduce((a, d, i) => (d.giaTri > diem[a].giaTri ? i : a), 0)
  const buocNhan = Math.ceil(diem.length / 7) // tối đa ~7 nhãn trục X, không chồng chữ
  const hien = chon ?? iDinh
  return (
    <div>
      <div className="mb-1 h-4 text-[11px] text-gray-600">
        <b className="text-gray-900">{diem[hien].nhan}</b>: {dinhDang(diem[hien].giaTri, donVi, true)}
        {chon == null && <span className="text-gray-400"> (cao nhất)</span>}
      </div>
      <div className="flex">
        <div className="relative mr-1 flex h-32 w-9 flex-col justify-between text-right text-[9px] tabular-nums" style={{ color: MAU.mo }}>
          <span>{dinhDang(max, donVi)}</span>
          <span>{dinhDang(max / 2, donVi)}</span>
          <span>0</span>
        </div>
        <div className="relative h-32 flex-1" onPointerLeave={() => setChon(null)}>
          {[0, 0.5, 1].map((t) => (
            <div key={t} className="absolute inset-x-0 h-px" style={{ top: `${t * 100}%`, background: t === 1 ? MAU.truc : MAU.luoi }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {diem.map((d, i) => (
              // Vùng chạm cả cột (rộng hơn thanh) → dễ chạm trên điện thoại
              <button key={d.nhan + i} onPointerEnter={() => setChon(i)} onClick={() => setChon(i)}
                aria-label={`${d.nhan}: ${dinhDang(d.giaTri, donVi, true)}`}
                className="flex h-full flex-1 items-end justify-center">
                <span className="block rounded-t" style={{
                  width: 'min(24px, 70%)',
                  height: `${(d.giaTri / max) * 100}%`,
                  minHeight: d.giaTri > 0 ? 2 : 0,
                  background: MAU.series,
                  opacity: chon == null || chon === i ? 1 : 0.45,
                }} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Nhãn trục X: căn giữa dưới cột, tràn ra khe bên cạnh (không cắt chữ); chỉ hiện mỗi buocNhan cột */}
      <div className="ml-10 flex h-3 text-[9px]" style={{ color: MAU.mo }}>
        {diem.map((d, i) => (
          <span key={d.nhan + i} className="relative flex-1">
            {i % buocNhan === 0 && <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap">{d.nhan}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function Ngang({ diem, donVi }) {
  const max = Math.max(...diem.map((d) => d.giaTri)) || 1
  return (
    <div className="space-y-1.5">
      {diem.map((d) => (
        <div key={d.nhan} className="flex items-center gap-2" title={`${d.nhan}: ${dinhDang(d.giaTri, donVi, true)}`}>
          <span className="w-24 flex-shrink-0 truncate text-[11px] text-gray-600">{d.nhan}</span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="block h-3.5 rounded-r" style={{ width: `${Math.max((d.giaTri / max) * 78, d.giaTri > 0 ? 1 : 0)}%`, background: MAU.series }} />
            <span className="flex-shrink-0 text-[10px] font-semibold tabular-nums text-gray-700">{dinhDang(d.giaTri, donVi)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BieuDo({ kieu = 'cot', tieuDe, diem = [], donVi = 'so' }) {
  const [bang, setBang] = useState(false)
  if (!diem.length) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-900">{tieuDe}</span>
        <button onClick={() => setBang((x) => !x)} className="text-[10px] font-semibold text-gray-500 underline">{bang ? 'Biểu đồ' : 'Bảng'}</button>
      </div>
      {bang ? <BangDuLieu diem={diem} donVi={donVi} /> : kieu === 'ngang' ? <Ngang diem={diem} donVi={donVi} /> : <Cot diem={diem} donVi={donVi} />}
    </div>
  )
}

// Thẻ số liệu (stat tile): nhãn · giá trị · ghi chú phụ
export function TheSo({ nhan, giaTri, phu }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="text-[11px] text-gray-500">{nhan}</div>
      <div className="text-lg font-black leading-tight text-gray-900">{giaTri}</div>
      {phu && <div className="mt-0.5 text-[10px] text-gray-400">{phu}</div>}
    </div>
  )
}
