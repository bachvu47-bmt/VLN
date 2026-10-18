import { useEffect, useRef, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { docFileBase64, geminiCoCauHinh, GIOI_HAN_FILE_MB, phanTichTaiLieu } from '../services/maikaChatbot'
import { danhSach, hocNen, napTaiLieu, xoaTriThuc } from '../services/vectorStore'
import { dongBoVaHoc } from '../services/webSyncService'

const LOAI = [
  { id: 'anh', nhan: 'Tải ảnh', meta: 'JPG, PNG', icon: '🖼️', accept: 'image/*' },
  { id: 'video', nhan: 'Tải video', meta: 'MP4, MOV', icon: '🎬', accept: 'video/*' },
  { id: 'pdf', nhan: 'Tải PDF', meta: 'TDS, catalogue', icon: '📄', accept: 'application/pdf' },
  { id: 'audio', nhan: 'Ghi âm', meta: 'MP3, M4A', icon: '🎙️', accept: 'audio/*' },
]

const NHAN_LOAI = { sua_sai: '✏️ Đính chính', tai_lieu: '📄 Tài liệu' }

// ---- Thẻ trạng thái bộ nhớ vector + đồng bộ website ----
function TheBoNho() {
  const { tk, hoc } = useBoNhoMaika()
  const toast = useToast()
  const [dangDongBo, setDangDongBo] = useState(false)
  const [soLay, setSoLay] = useState(0)
  const [bayGio, setBayGio] = useState(() => Date.now())

  // Đếm ngược khi Google tạm chặn vì vượt giới hạn tần suất
  useEffect(() => {
    if (!hoc.choDen) return
    const id = setInterval(() => setBayGio(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hoc.choDen])

  const dongBo = async () => {
    if (dangDongBo) return
    setDangDongBo(true)
    setSoLay(0)
    try {
      const kq = await dongBoVaHoc(setSoLay)
      toast(`Đã đồng bộ ${kq.soSanPham} SP · ${kq.doanMoi} đoạn tri thức mới đang được học`, 'success')
    } catch (e) {
      toast('Đồng bộ lỗi: ' + (e.message || e), 'error')
    } finally {
      setDangDongBo(false)
    }
  }

  const phanTram = hoc.tong ? Math.round((hoc.daXong / hoc.tong) * 100) : 0
  const choGiay = hoc.choDen ? Math.max(0, Math.round((hoc.choDen - bayGio) / 1000)) : 0

  return (
    <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-black text-gray-900">🧠 Bộ nhớ Maika (Vector DB)</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${geminiCoCauHinh() ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {geminiCoCauHinh() ? 'Gemini đã kết nối' : 'Chưa có API key'}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
        {[
          ['Website', tk.web],
          ['Đính chính', tk.suaSai],
          ['Tài liệu', tk.taiLieu],
          ['Chờ duyệt', tk.choDuyet],
        ].map(([nhan, so]) => (
          <div key={nhan} className="rounded-xl bg-gray-50 py-2">
            <div className="text-lg font-black text-gray-900">{so}</div>
            <div className="text-[10px] text-gray-500">{nhan}</div>
          </div>
        ))}
      </div>

      {hoc.dangHoc ? (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-gray-600">
            <span>{choGiay ? `⏸ Google giới hạn tần suất — tiếp tục sau ${choGiay}s` : '⚙️ Maika đang học…'}</span>
            <span>{hoc.daXong}/{hoc.tong}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${phanTram}%` }} />
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-gray-500">
          Đã học {tk.daNhung}/{tk.tong} mẩu tri thức.
          {tk.chuaNhung > 0 && (
            <button onClick={() => hocNen()} className="ml-1 font-bold text-brand-600 underline">Học tiếp {tk.chuaNhung} mẩu</button>
          )}
          {hoc.loi && <span className="mt-1 block text-red-600">Lần học trước dừng: {hoc.loi}</span>}
        </p>
      )}

      <button onClick={dongBo} disabled={dangDongBo}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-50 py-2.5 text-xs font-bold text-brand-700 disabled:opacity-60">
        {dangDongBo ? `⏳ Đang lấy dữ liệu… ${soLay} SP` : '🔄 Đồng bộ vatlieunha.vn → Flashcard + bộ nhớ Maika'}
      </button>
    </div>
  )
}

// ---- Danh sách tri thức Admin đã dạy (để rà soát / xoá) ----
function DaHoc() {
  useBoNhoMaika() // render lại khi bộ nhớ thay đổi
  const toast = useToast()
  const ds = [...danhSach({ loai: 'sua_sai', trangThai: 'da_duyet' }), ...danhSach({ loai: 'tai_lieu' })]
    .sort((a, b) => b.taoLuc - a.taoLuc)
    .slice(0, 20)
  if (!ds.length) return null
  return (
    <div className="mt-6">
      <div className="mb-2 text-sm font-black text-gray-900">Tri thức Admin đã dạy <span className="text-xs font-normal text-gray-400">({ds.length} gần nhất)</span></div>
      <div className="space-y-2">
        {ds.map((r) => (
          <div key={r.id} className="rounded-xl border border-gray-100 bg-white p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500">{NHAN_LOAI[r.loai]}</span>
              <span className={`text-[10px] font-semibold ${r.vec ? 'text-green-600' : 'text-amber-600'}`}>{r.vec ? '● Đã học' : '○ Chờ học'}</span>
              <span className="ml-auto text-[10px] text-gray-400">{r.nguoiTao} · {new Date(r.taoLuc).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="text-xs font-bold text-gray-900">{r.tieuDe}</div>
            <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-[11px] text-gray-600">{r.noiDung}</p>
            <button onClick={() => xoaTriThuc(r.id).then(() => toast('Đã xoá khỏi bộ nhớ Maika', 'info'))}
              className="tap mt-1 text-[11px] font-semibold text-red-500">Xoá khỏi bộ nhớ</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IngestionScreen({ onClose }) {
  const { user } = useAuth()
  const toast = useToast()
  const [loai, setLoai] = useState('pdf')
  const [file, setFile] = useState(null)
  const [noiDung, setNoiDung] = useState('')
  const [tt, setTt] = useState('idle') // idle | analyzing | done
  const [kq, setKq] = useState(null)
  const [banSua, setBanSua] = useState({ tieuDe: '', noiDung: '' })
  const [dangNap, setDangNap] = useState(false)
  const inputRef = useRef(null)

  const chonFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > GIOI_HAN_FILE_MB * 1024 * 1024) return toast(`Tệp quá lớn (tối đa ${GIOI_HAN_FILE_MB}MB)`, 'error')
    setFile(f)
  }

  const phanTich = async () => {
    if (tt === 'analyzing') return
    if (!noiDung.trim() && !file) return toast('Nhập nội dung hoặc chọn tệp để phân tích', 'error')
    if (!geminiCoCauHinh()) return toast('Chưa cấu hình VITE_GEMINI_API_KEY', 'error')
    setTt('analyzing')
    setKq(null)
    try {
      const tep = file ? await docFileBase64(file) : null
      const r = await phanTichTaiLieu({ text: noiDung.trim(), file: tep })
      setKq(r)
      setBanSua({ tieuDe: r.tieuDe, noiDung: [r.tomTat, ...r.cacY.map((y) => '• ' + y)].join('\n') })
      setTt('done')
    } catch (e) {
      setTt('idle')
      toast('Phân tích lỗi: ' + (e.status === 429 ? 'Google giới hạn tần suất, thử lại sau ít phút' : e.message || e), 'error')
    }
  }

  const duyetVaNap = async () => {
    if (dangNap || !banSua.noiDung.trim()) return
    setDangNap(true)
    try {
      const r = await napTaiLieu({
        tieuDe: banSua.tieuDe.trim() || 'Tri thức nạp thủ công',
        noiDung: banSua.noiDung.trim(),
        tags: kq?.tags || [],
        nguon: file?.name || 'Ghi chú Admin',
        nguoi: user.hoTen,
      })
      toast(r.daHoc ? 'Maika đã học tri thức mới ✓' : 'Đã lưu — Maika sẽ học khi có mạng', 'success')
      setKq(null)
      setTt('idle')
      setFile(null)
      setNoiDung('')
    } catch (e) {
      toast('Nạp lỗi: ' + (e.message || e), 'error')
    } finally {
      setDangNap(false)
    }
  }

  const loaiHt = LOAI.find((l) => l.id === loai)

  return (
    <ScreenShell title="AI Admin · Cổng dạy Maika" onClose={onClose}>
      <TheBoNho />

      <h2 className="text-2xl font-black text-gray-900">Hôm nay cần dạy Maika điều gì?</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Tải tài liệu, ảnh, video, ghi âm hoặc gõ ghi chú — Gemini trích xuất kiến thức, Admin duyệt rồi nạp thẳng vào bộ nhớ để Maika học ngay.</p>

      {/* Loại dữ liệu */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {LOAI.map((l) => (
          <button key={l.id} onClick={() => { setLoai(l.id); setFile(null) }}
            className={`tap flex flex-col items-center gap-1 rounded-xl border py-3 text-center transition ${loai === l.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
            <span className="text-xl">{l.icon}</span>
            <span className="text-[11px] font-bold">{l.nhan}</span>
            <span className="text-[9px] text-gray-400">{l.meta}</span>
          </button>
        ))}
      </div>

      {/* Ghi chú */}
      <textarea value={noiDung} onChange={(e) => setNoiDung(e.target.value)} rows={4}
        placeholder="vd: Điều kiện thi công PU: bề mặt khô ráo, độ ẩm < 8%, nhiệt độ 8–35°C, tránh thi công khi sắp mưa..."
        className="mb-3 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />

      {/* File */}
      <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 px-4 py-3 transition hover:bg-brand-50">
        <input ref={inputRef} type="file" accept={loaiHt.accept} className="hidden" onChange={chonFile} />
        <span className="text-2xl">{loaiHt.icon}</span>
        {file ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-800">{file.name}</div>
            <div className="text-[11px] text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-500">Chạm để tải {loaiHt.nhan.toLowerCase()} (≤ {GIOI_HAN_FILE_MB}MB)</span>
        )}
      </label>

      <button onClick={phanTich} disabled={tt === 'analyzing'}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-70">
        {tt === 'analyzing' ? '⏳ Gemini đang phân tích...' : '✨ Phân tích bằng Gemini'}
      </button>

      {/* Kết quả — Admin rà soát & chỉnh trước khi nạp (HITL) */}
      {tt === 'done' && kq && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-black text-white">M</span> Kiến thức trích xuất</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${kq.doTinCay >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>Độ tin cậy {kq.doTinCay}%</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[...new Set([...kq.tags, ...kq.sanPhamLienQuan])].map((t) => (
              <span key={t} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">{t}</span>
            ))}
          </div>
          <input value={banSua.tieuDe} onChange={(e) => setBanSua((b) => ({ ...b, tieuDe: e.target.value }))}
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500" />
          <textarea value={banSua.noiDung} onChange={(e) => setBanSua((b) => ({ ...b, noiDung: e.target.value }))} rows={8}
            className="mb-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs leading-relaxed outline-none focus:border-brand-500" />
          <p className="mb-3 text-[10px] text-gray-400">Sửa trực tiếp nếu Gemini trích sai — nội dung này sẽ thành tri thức chuẩn của Maika.</p>
          <button onClick={duyetVaNap} disabled={dangNap}
            className="tap w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-60">
            {dangNap ? 'Đang nạp…' : '✓ Duyệt & nạp vào bộ nhớ Maika'}
          </button>
        </div>
      )}

      <DaHoc />
    </ScreenShell>
  )
}
