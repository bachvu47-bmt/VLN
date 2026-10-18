import { useRef, useState } from 'react'
import { SAN_PHAM } from '../data/mockData'
import { PHIEN_BAN_HIEN_TAI } from '../data/appInfo'

const LOAI_FILE = [
  { id: 'anh', nhan: 'Ảnh', icon: '🖼️', accept: 'image/*' },
  { id: 'video', nhan: 'Video', icon: '🎥', accept: 'video/*' },
  { id: 'pdf', nhan: 'PDF', icon: '📄', accept: 'application/pdf' },
  { id: 'audio', nhan: 'Ghi âm', icon: '🎙️', accept: 'audio/*' },
]

// Bot AI giả lập: đoán sản phẩm từ tên file + loại dữ liệu.
function phanTichAI(tenFile, loai) {
  const key = tenFile.toLowerCase()
  let sp = SAN_PHAM.find((p) => p.tags.some((t) => key.includes(t.toLowerCase())))
  sp = sp || SAN_PHAM.find((p) => key.includes(p.ten.split(' ')[0].toLowerCase()))
  const doTinCay = sp ? 78 + ((tenFile.length * 7) % 20) : 42
  return {
    sp: sp || SAN_PHAM[0],
    doTinCay,
    chacChan: !!sp,
    nhan: {
      anh: 'Phát hiện nhãn mác & quy cách bao bì sản phẩm.',
      video: 'Nhận dạng cảnh thi công — trích xuất các bước & cảnh báo an toàn.',
      pdf: 'Bóc tách TDS: tỷ lệ pha, định mức, điều kiện thi công.',
      audio: 'Chuyển giọng nói → văn bản, tóm tắt tư vấn kỹ thuật.',
    }[loai],
  }
}

// Khu vực Admin phát hành bản cập nhật (.apk / .exe) & thông báo tới nhân viên
function PhatHanhCapNhat() {
  const [buildFile, setBuildFile] = useState(null)
  const [phienBan, setPhienBan] = useState('')
  const [thongBao, setThongBao] = useState('')
  const [dangPhatHanh, setDangPhatHanh] = useState(false)
  const [xong, setXong] = useState(false)
  const ref = useRef(null)

  const kieuFile = buildFile?.name.toLowerCase().endsWith('.apk')
    ? 'Mobile (.apk)'
    : buildFile?.name.toLowerCase().endsWith('.exe')
    ? 'PC (.exe)'
    : null

  const phatHanh = () => {
    if (!buildFile || !phienBan) return
    setDangPhatHanh(true)
    setTimeout(() => {
      setDangPhatHanh(false)
      setXong(true)
    }, 1800)
  }

  const lamLai = () => {
    setBuildFile(null)
    setPhienBan('')
    setThongBao('')
    setXong(false)
    if (ref.current) ref.current.value = ''
  }

  if (xong) {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-5 text-center">
        <div className="text-3xl">🚀</div>
        <div className="mt-2 text-sm font-black text-green-700">
          Đã phát hành v{phienBan} tới toàn bộ nhân viên!
        </div>
        <p className="mt-1 text-xs text-green-600">
          Thiết bị PC & Mobile sẽ nhận thông báo OTA trong vài phút.
        </p>
        <button onClick={lamLai} className="mt-3 rounded-lg border border-green-300 px-4 py-2 text-xs font-bold text-green-700">
          Phát hành bản khác
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">
        🚀 Phát hành bản cập nhật
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Admin tải lên file build mới (.apk / .exe) và gửi thông báo cập nhật tới toàn bộ nhân viên. Bản hiện tại: v{PHIEN_BAN_HIEN_TAI}
      </p>

      {/* Tải file build */}
      <label className="mb-3 flex cursor-pointer items-center justify-between rounded-xl border-2 border-dashed border-brand-300 px-4 py-3 transition hover:bg-brand-50">
        <input ref={ref} type="file" accept=".apk,.exe" className="hidden" onChange={(e) => setBuildFile(e.target.files?.[0] || null)} />
        {buildFile ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-800">{buildFile.name}</div>
            <div className="text-[11px] text-gray-400">
              {(buildFile.size / 1024 / 1024).toFixed(1)} MB · {kieuFile || 'Không rõ định dạng'}
            </div>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-500">📦 Chọn file build (.apk / .exe)</span>
        )}
        <span className="text-xs font-bold text-brand-600">{buildFile ? 'Đổi' : 'Chọn'}</span>
      </label>

      <label className="mb-1 block text-[11px] font-semibold text-gray-600">Phiên bản mới</label>
      <input
        value={phienBan}
        onChange={(e) => setPhienBan(e.target.value)}
        placeholder="vd: 1.1.0"
        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />

      <label className="mb-1 block text-[11px] font-semibold text-gray-600">Nội dung thông báo cập nhật</label>
      <textarea
        value={thongBao}
        onChange={(e) => setThongBao(e.target.value)}
        rows={3}
        placeholder="vd: Bổ sung Bot AI quét TikTok/YouTube, sửa lỗi đăng xuất từ xa..."
        className="mb-3 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />

      <button
        disabled={!buildFile || !phienBan || dangPhatHanh}
        onClick={phatHanh}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {dangPhatHanh ? '⏳ Đang đẩy bản cập nhật lên server...' : '📢 Phát hành & Thông báo toàn bộ nhân viên'}
      </button>
    </div>
  )
}

export default function IngestionScreen() {
  const [loai, setLoai] = useState('pdf')
  const [file, setFile] = useState(null)
  const [trangThai, setTrangThai] = useState('idle') // idle | analyzing | done
  const [kq, setKq] = useState(null)
  const [log, setLog] = useState([])
  const inputRef = useRef(null)

  const chonFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setTrangThai('analyzing')
    setKq(null)
    setLog(['📥 Đã nhận tệp. Đang tải lên Cổng AI...'])

    const buoc = [
      '🔎 Trích xuất nội dung & metadata...',
      '🧠 Bot AI phân tích ngữ cảnh kỹ thuật...',
      '🧭 Đối chiếu mã sản phẩm & định tuyến (routing)...',
    ]
    buoc.forEach((b, i) =>
      setTimeout(() => setLog((l) => [...l, b]), (i + 1) * 650),
    )
    setTimeout(() => {
      setKq(phanTichAI(f.name, loai))
      setTrangThai('done')
      setLog((l) => [...l, '✅ Hoàn tất. Đã có đề xuất phân loại.'])
    }, 2300)
  }

  const reset = () => {
    setFile(null)
    setKq(null)
    setTrangThai('idle')
    setLog([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const loaiHienTai = LOAI_FILE.find((l) => l.id === loai)

  return (
    <div>
      <h2 className="mb-1 text-xl font-black text-gray-900">Cổng AI — Nạp dữ liệu</h2>
      <p className="mb-4 text-xs text-gray-500">
        Chỉ Admin. Tải dữ liệu kỹ thuật, Bot AI tự phân tích & định tuyến vào mã sản phẩm.
      </p>

      {/* Chọn loại dữ liệu */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {LOAI_FILE.map((l) => (
          <button
            key={l.id}
            onClick={() => setLoai(l.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold transition ${
              loai === l.id
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            <span className="text-xl">{l.icon}</span>
            {l.nhan}
          </button>
        ))}
      </div>

      {/* Vùng tải lên */}
      <label
        className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-300 bg-white px-4 py-8 text-center transition hover:bg-brand-50"
      >
        <input ref={inputRef} type="file" accept={loaiHienTai.accept} className="hidden" onChange={chonFile} />
        <span className="text-4xl">{loaiHienTai.icon}</span>
        <span className="mt-2 text-sm font-bold text-gray-700">
          Chạm để tải {loaiHienTai.nhan.toLowerCase()} lên
        </span>
        <span className="mt-1 text-xs text-gray-400">hoặc kéo-thả tệp vào đây</span>
      </label>

      {/* Tệp đang xử lý */}
      {file && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-800">{file.name}</div>
            <div className="text-[11px] text-gray-400">
              {(file.size / 1024).toFixed(0)} KB · {loaiHienTai.nhan}
            </div>
          </div>
          <button onClick={reset} className="text-xs font-semibold text-brand-600">Xóa</button>
        </div>
      )}

      {/* Nhật ký Bot AI */}
      {log.length > 0 && (
        <div className="mb-4 rounded-2xl bg-gray-900 p-4 font-mono text-xs leading-relaxed text-green-300">
          <div className="mb-2 flex items-center gap-2 text-gray-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" /> Bot AI Ingestion
          </div>
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          {trangThai === 'analyzing' && <div className="animate-pulse">▌ đang xử lý...</div>}
        </div>
      )}

      {/* Kết quả định tuyến */}
      {kq && trangThai === 'done' && (
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-800">🧭 Đề xuất phân loại (Routing)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                kq.chacChan ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              Độ tin cậy {kq.doTinCay}%
            </span>
          </div>

          <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">🧠 {kq.nhan}</p>

          <div className="mb-3 flex items-center gap-3 rounded-xl bg-brand-50 p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-xl">{kq.sp.icon}</span>
            <div>
              <div className="text-[10px] font-mono text-gray-400">{kq.sp.ma}</div>
              <div className="text-sm font-bold text-gray-900">{kq.sp.ten}</div>
              <div className="text-[11px] text-gray-500">{kq.sp.nhom}</div>
            </div>
          </div>

          {!kq.chacChan && (
            <p className="mb-3 text-xs font-medium text-amber-600">
              ⚠ Độ tin cậy thấp — vui lòng kiểm tra lại trước khi duyệt.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { alert(`Đã lưu dữ liệu vào mã ${kq.sp.ma}`); reset() }}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              ✓ Duyệt & Lưu vào {kq.sp.ma}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600"
            >
              Chọn lại
            </button>
          </div>
        </div>
      )}

      {/* ---- Khu vực phát hành bản cập nhật (Admin) ---- */}
      <div className="my-6 border-t border-gray-200" />
      <PhatHanhCapNhat />
    </div>
  )
}
