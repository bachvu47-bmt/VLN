import { useState } from 'react'
import { DANH_MUC, SAN_PHAM } from '../data/mockData'
import ScreenShell from '../components/ScreenShell'

function Select({ label, value, onChange, children }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-gray-600">{label}</label>
      <div className="relative">
        <select value={value} onChange={onChange}
          className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:bg-white">
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</span>
      </div>
    </div>
  )
}

export default function TinhVatTuScreen({ onClose, sp = null }) {
  const [hangMuc, setHangMuc] = useState('')
  const [spMa, setSpMa] = useState(sp?.ma || '')
  const [dienTich, setDienTich] = useState('')
  const [doDay, setDoDay] = useState('')
  const [taiLieu, setTaiLieu] = useState('')
  const [kq, setKq] = useState(null)

  const spChon = SAN_PHAM.find((s) => s.ma === spMa)

  const tinh = () => {
    const dt = parseFloat(dienTich) || 0
    if (!spChon || dt <= 0) {
      setKq({ loi: true })
      return
    }
    const sl = dt * spChon.dinhMuc.giaTri
    setKq({ sl: sl.toFixed(2), donVi: spChon.dinhMuc.donVi, ghiChu: spChon.dinhMuc.ghiChu, ten: spChon.ten })
  }

  return (
    <ScreenShell title="Tính vật tư" onClose={onClose}>
      <h2 className="text-2xl font-black text-gray-900">Tính vật tư</h2>
      <p className="mb-5 mt-1 text-sm text-gray-500">Ước tính vật tư theo hạng mục và sản phẩm</p>

      <div className="space-y-4">
        <Select label="1. Chọn hạng mục ứng dụng" value={hangMuc} onChange={(e) => setHangMuc(e.target.value)}>
          <option value="">Chọn hạng mục</option>
          {DANH_MUC.filter((d) => d.ma !== 'all').map((d) => <option key={d.ma} value={d.ma}>{d.ten}</option>)}
        </Select>

        <Select label="2. Chọn sản phẩm" value={spMa} onChange={(e) => setSpMa(e.target.value)}>
          <option value="">Chọn sản phẩm (Dữ liệu minh họa)</option>
          {SAN_PHAM.map((s) => <option key={s.ma} value={s.ma}>{s.ten}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-gray-600">3. Diện tích thi công (m²)</label>
            <input type="number" min="0" value={dienTich} onChange={(e) => setDienTich(e.target.value)} placeholder="Nhập diện tích"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-gray-600">4. Độ dày (mm)</label>
            <input type="number" min="0" value={doDay} onChange={(e) => setDoDay(e.target.value)} placeholder="Nhập độ dày"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
          </div>
        </div>

        <Select label="5. Chọn tài liệu tham chiếu" value={taiLieu} onChange={(e) => setTaiLieu(e.target.value)}>
          <option value="">Hướng dẫn thi công (Dữ liệu minh họa)</option>
          <option value="tds">TDS sản phẩm</option>
          <option value="quytrinh">Quy trình thi công chuẩn</option>
        </Select>

        <button onClick={tinh} className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white hover:bg-brand-700">
          🧮 Tính vật tư
        </button>

        {/* Kết quả */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-bold text-gray-900">Kết quả ước tính</div>
          {!kq && (
            <div className="flex flex-col items-center py-6 text-center text-gray-400">
              <span className="text-4xl">🧮</span>
              <p className="mt-2 text-xs">Nhập đủ dữ liệu để tính<br />Vui lòng chọn hạng mục, sản phẩm và nhập thông số để xem kết quả.</p>
            </div>
          )}
          {kq?.loi && <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">⚠ Vui lòng chọn sản phẩm và nhập diện tích hợp lệ.</div>}
          {kq?.sl && (
            <div className="flex items-center justify-between rounded-xl bg-brand-50 p-4">
              <div>
                <div className="text-[11px] text-brand-600">Khối lượng cần dùng · {kq.ten}</div>
                <div className="text-2xl font-black text-brand-700">{kq.sl} <span className="text-sm">{kq.donVi.split('/')[0]}</span></div>
                <div className="mt-0.5 text-[11px] text-gray-500">{kq.ghiChu}</div>
              </div>
              <span className="text-3xl">📦</span>
            </div>
          )}
        </div>
      </div>
    </ScreenShell>
  )
}
