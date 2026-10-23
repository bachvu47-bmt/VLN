import { useEffect, useRef, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { aiCoCauHinh, chuyenGiongNoi, docFileBase64, geminiCoCauHinh, GIOI_HAN_FILE_MB, GIOI_HAN_TAI_LEN_MB, phanTichLink, phanTichTaiLieu, taiLenGemini } from '../services/maikaChatbot'
import { useGhiAm } from '../hooks/useGhiAm'
import { cheDoLuuTru, danhSach, hocNen, napTaiLieu, xoaTriThuc } from '../services/vectorStore'
import { coQuyenAdmin } from '../services/khoChung'
import { luuMedia } from '../data/mediaStore'
import TheDeXuat from '../components/TheDeXuat'
import { dongBoVaHoc } from '../services/webSyncService'

const MB = 1024 * 1024
const TOI_DA_NOI_GIAY = 300 // dạy bằng giọng nói: tối đa 5 phút/lần ghi
const GIOI_HAN_LUU_MEDIA_MB = 20 // tệp lớn hơn (video dài) không lưu bản gốc vào máy — chỉ lưu tri thức

const LOAI = [
  { id: 'chu', nhan: 'Gõ chữ', meta: 'Ghi chú nhanh', icon: '✍️' },
  { id: 'noi', nhan: 'Nói', meta: 'Như tin nhắn thoại', icon: '🎤' },
  { id: 'link', nhan: 'Dán link', meta: 'Web, YouTube', icon: '🔗' },
  { id: 'anh', nhan: 'Ảnh / Video', meta: 'Bao bì, TDS, công trình', icon: '🖼️', accept: 'image/*,video/*' },
  { id: 'pdf', nhan: 'PDF', meta: 'TDS, catalogue', icon: '📄', accept: 'application/pdf' },
  { id: 'audio', nhan: 'File ghi âm', meta: 'Zalo, M4A, MP3', icon: '🎧', accept: 'audio/*,.m4a,.aac,.amr,.mp3,.ogg,.opus,.wav' },
]

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
      toast(
        kq.boQua
          ? `Đã đồng bộ ${kq.soSanPham} SP · Nhập PIN Admin (màn Tài khoản) để nạp tri thức lên kho chung`
          : `Đã đồng bộ ${kq.soSanPham} SP · ${kq.doanMoi} đoạn tri thức mới đang được học`,
        'success',
      )
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
        <span className="text-sm font-black text-gray-900">
          🧠 Bộ nhớ Maika
          <span className="ml-1 text-[10px] font-semibold text-gray-500">
            {cheDoLuuTru() === 'chung' ? (coQuyenAdmin() ? '· Kho chung (Admin)' : '· Kho chung — chưa xác thực Admin') : '· Lưu trên máy này'}
          </span>
        </span>
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
            <button onClick={() => xoaTriThuc(r.id).then(() => toast('Đã xoá khỏi bộ nhớ Maika', 'info'), (e) => toast('Xoá lỗi: ' + e.message, 'error'))}
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
  const [loai, setLoai] = useState('chu')
  const [file, setFile] = useState(null)
  const [noiDung, setNoiDung] = useState('')
  const [tt, setTt] = useState('idle') // idle | analyzing | done
  const [tienDo, setTienDo] = useState('')
  const [kq, setKq] = useState(null)
  const [banSua, setBanSua] = useState({ tieuDe: '', noiDung: '' })
  const [dangNap, setDangNap] = useState(false)
  const [tab, setTab] = useState('nap')
  const [banGhi, setBanGhi] = useState([]) // [{ blob, url, text }] các đoạn ghi âm / file thoại đã chép
  const [dangChep, setDangChep] = useState(false)
  const ghiAm = useGhiAm(TOI_DA_NOI_GIAY)
  const inputRef = useRef(null)
  useBoNhoMaika() // cập nhật số thẻ chờ duyệt
  const choDuyetMM = danhSach({ trangThai: 'cho_duyet' }).filter((r) => r.media?.length)
  const soMM = choDuyetMM.length
  const [link, setLink] = useState('')
  const laTep = ['anh', 'pdf'].includes(loai)

  const datLai = () => {
    setKq(null)
    setTt('idle')
    setFile(null)
    setNoiDung('')
    setBanGhi((ds) => {
      ds.forEach((b) => URL.revokeObjectURL(b.url)) // giải phóng RAM của các đoạn thoại (tới 25MB/đoạn)
      return []
    })
    setLink('')
  }

  const phanTich = async (vanBan = noiDung, { tuGiongNoi = false } = {}) => {
    if (tt === 'analyzing') return
    const text = vanBan.trim()
    const tepGui = laTep ? file : null
    const url = loai === 'link' ? link.trim() : ''
    if (loai === 'link' && !/^https?:\/\/\S+\.\S+/i.test(url)) return toast('Dán link bắt đầu bằng http:// hoặc https://', 'error')
    if (!text && !tepGui && !url) return toast(laTep ? 'Chọn tệp hoặc gõ ghi chú để phân tích' : 'Gõ hoặc nói nội dung cần dạy Maika', 'error')
    if (tepGui ? !geminiCoCauHinh() : !aiCoCauHinh()) return toast(tepGui ? 'Phân tích ảnh/video/PDF cần VITE_GEMINI_API_KEY' : 'Chưa cấu hình AI', 'error')
    setTt('analyzing')
    setKq(null)
    try {
      let r
      if (url) {
        r = await phanTichLink(url, text, setTienDo)
      } else {
        let tep = null
        if (tepGui) {
          // ≤ 14MB gửi kèm thẳng (nhanh); lớn hơn → tải lên Gemini Files API
          tep = tepGui.size <= GIOI_HAN_FILE_MB * MB ? await docFileBase64(tepGui) : await taiLenGemini(tepGui, tepGui.name, setTienDo)
        }
        setTienDo(tepGui ? `Gemini đang ${tepGui.type.startsWith('video/') ? 'xem video' : 'đọc tệp'}…` : 'Maika đang hiểu & biên tập…')
        r = await phanTichTaiLieu({ text, file: tep })
      }
      // Ghi nguồn ngay lúc phân tích: đổi sang cách dạy khác trước khi bấm nạp vẫn giữ đúng nguồn
      setKq({ ...r, nguon: url || (tepGui && tepGui.name) || (tuGiongNoi || banGhi.length ? 'Giọng nói Admin' : 'Ghi chú Admin') })
      setBanSua({ tieuDe: r.tieuDe, noiDung: [r.tomTat, ...r.cacY.map((y) => '• ' + y)].filter(Boolean).join('\n') })
      setTt('done')
    } catch (e) {
      setTt('idle')
      toast('Phân tích lỗi: ' + (e.status === 429 ? 'AI đang giới hạn tần suất, thử lại sau ít phút' : e.message || e), 'error')
    } finally {
      setTienDo('')
    }
  }

  // Giọng nói (ghi trực tiếp hoặc file thoại Zalo) → chữ → nối vào ghi chú → tự phân tích
  const chepGiongNoi = async (blob) => {
    setDangChep(true)
    try {
      const text = (await chuyenGiongNoi(blob)).trim()
      if (!text) return toast('Không nghe rõ nội dung — thử nói gần micro hơn', 'error')
      setBanGhi((ds) => [...ds, { blob, url: URL.createObjectURL(blob), text }])
      const moi = noiDung.trim() ? `${noiDung.trim()}\n${text}` : text
      setNoiDung(moi)
      phanTich(moi, { tuGiongNoi: true })
    } catch (e) {
      toast('Chưa chuyển được giọng nói: ' + (e.message || e), 'error')
    } finally {
      setDangChep(false)
    }
  }

  const batTatGhiAm = async () => {
    if (ghiAm.dangGhi) {
      const blob = await ghiAm.ketThuc(false)
      if (blob) chepGiongNoi(blob)
      else toast('Đoạn ghi quá ngắn', 'info')
      return
    }
    try {
      await ghiAm.batDau()
    } catch (err) {
      toast(err.name === 'NotAllowedError' ? 'Chưa cấp quyền micro cho ứng dụng' : 'Không bật được micro: ' + (err.message || err), 'error')
    }
  }
  useEffect(() => {
    ghiAm.khiHetGio(() => ghiAm.ketThuc(false).then((b) => b && chepGiongNoi(b))) // chạm 5 phút → tự dừng & chép
  })

  const chonFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (loai === 'audio') {
      if (f.size > 25 * MB) return toast('File ghi âm tối đa 25MB', 'error')
      return chepGiongNoi(f)
    }
    if (f.size > GIOI_HAN_TAI_LEN_MB * MB) return toast(`Tệp quá lớn (tối đa ${GIOI_HAN_TAI_LEN_MB}MB)`, 'error')
    setFile(f)
  }

  const duyetVaNap = async () => {
    if (dangNap || !banSua.noiDung.trim()) return
    setDangNap(true)
    try {
      // Lưu bản gốc (ảnh/PDF/video nhỏ/ghi âm) vào kho media để đối chiếu — lỗi lưu không chặn việc dạy Maika
      const media = []
      const luu = async (blob, loaiMedia, them = {}) => {
        if (blob.size > GIOI_HAN_LUU_MEDIA_MB * MB) return
        try {
          const md = await luuMedia(blob, { loai: loaiMedia, nguoi: user.hoTen, ...them })
          media.push({ id: md.id, loai: loaiMedia })
        } catch (e) {
          console.warn('[Dạy Maika] Không lưu được bản gốc:', e.message)
        }
      }
      if (laTep && file) await luu(file, file.type.startsWith('image/') ? 'anh' : file.type.startsWith('video/') ? 'video' : 'tep')
      for (const b of banGhi) await luu(b.blob, 'am_thanh', { banGhi: b.text })
      const r = await napTaiLieu({
        tieuDe: banSua.tieuDe.trim() || 'Tri thức nạp thủ công',
        noiDung: banSua.noiDung.trim(),
        tags: kq?.tags || [],
        nguon: kq?.nguon || (loai === 'link' && link.trim()) || (laTep && file?.name) || (banGhi.length ? 'Giọng nói Admin' : 'Ghi chú Admin'),
        nguoi: user.hoTen,
        media,
      })
      toast(r.daHoc ? 'Maika đã học tri thức mới ✓' : 'Đã lưu — Maika sẽ học khi có mạng', 'success')
      datLai()
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

      {/* Tab */}
      <div className="mb-4 flex rounded-xl bg-gray-100 p-1">
        {[
          ['nap', '✨ Nạp tri thức'],
          ['mm', `🖼️ Phê duyệt Multimodal${soMM ? ` (${soMM})` : ''}`],
        ].map(([id, nhan]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`tap flex-1 rounded-lg py-2 text-xs font-bold transition ${tab === id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            {nhan}
          </button>
        ))}
      </div>

      {tab === 'mm' ? (
        <PheDuyetMultimodal ds={choDuyetMM} />
      ) : (
      <>
      <h2 className="text-2xl font-black text-gray-900">Hôm nay cần dạy Maika điều gì?</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Gõ, nói (như tin nhắn thoại Zalo), hoặc gửi ảnh / video / PDF / file ghi âm. Maika trích xuất kiến thức, bạn xem lại rồi bấm nạp — Maika học ngay.</p>

      {/* Cách dạy */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {LOAI.map((l) => (
          <button key={l.id} onClick={() => { if (ghiAm.dangGhi) return; setLoai(l.id); setFile(null) }}
            className={`tap flex flex-col items-center gap-0.5 rounded-xl border py-2.5 text-center transition ${loai === l.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
            <span className="text-xl">{l.icon}</span>
            <span className="text-[11px] font-bold">{l.nhan}</span>
            <span className="text-[9px] text-gray-400">{l.meta}</span>
          </button>
        ))}
      </div>

      {/* Nói — bấm để ghi, bấm lần nữa để dừng; ghi nhiều đoạn được (nối tiếp) */}
      {loai === 'noi' && (
        <div className="mb-3 flex flex-col items-center rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-5">
          {/* Đang phân tích đoạn trước → khoá ghi đoạn mới (đoạn mới sẽ bị bỏ khỏi kết quả phân tích) */}
          <button onClick={batTatGhiAm} disabled={dangChep || (tt === 'analyzing' && !ghiAm.dangGhi)}
            aria-label={ghiAm.dangGhi ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
            className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-lg transition disabled:opacity-50 ${ghiAm.dangGhi ? 'animate-pulse bg-red-600' : 'bg-brand-600'}`}>
            {ghiAm.dangGhi ? '■' : '🎤'}
          </button>
          <div className="mt-2 text-sm font-bold text-gray-800">
            {dangChep ? '⏳ Đang chuyển giọng nói thành chữ…' : tt === 'analyzing' && !ghiAm.dangGhi ? '⏳ Chờ Maika phân tích xong đoạn này…' : ghiAm.dangGhi ? `🔴 ${mmss(ghiAm.giay)} / ${mmss(TOI_DA_NOI_GIAY)} — bấm để dừng` : banGhi.length ? 'Bấm để nói tiếp (nối thêm)' : 'Bấm để nói'}
          </div>
          {ghiAm.dangGhi && (
            <button onClick={() => ghiAm.ketThuc(true)} className="tap mt-1 text-[11px] font-semibold text-gray-500 underline">Huỷ đoạn này</button>
          )}
          {!ghiAm.dangGhi && !banGhi.length && (
            <p className="mt-1 text-center text-[11px] text-gray-500">Nói tự nhiên như nhắn thoại, tối đa 5 phút/đoạn. Maika tự chép lời, sửa văn nói và trích kiến thức.</p>
          )}
        </div>
      )}

      {/* Đoạn thoại đã chép (nghe lại) */}
      {banGhi.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {banGhi.map((b, i) => (
            <div key={b.url} className="rounded-xl border border-gray-100 bg-white p-2">
              <audio src={b.url} controls className="h-8 w-full" />
              <p className="mt-1 line-clamp-2 text-[11px] italic text-gray-500">#{i + 1} “{b.text}”</p>
            </div>
          ))}
        </div>
      )}

      {/* Link: Maika tự vào đọc trang / xem video YouTube */}
      {loai === 'link' && (
        <div className="mb-3">
          <div className="flex gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && phanTich()}
              type="url" inputMode="url" placeholder="https://… (bài kỹ thuật, trang sản phẩm, YouTube)"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
            <button
              onClick={async () => {
                try {
                  const t = (await navigator.clipboard.readText()).trim()
                  if (t) setLink(t)
                } catch {
                  toast('Không đọc được bộ nhớ tạm — giữ ô để dán', 'info')
                }
              }}
              className="tap flex-shrink-0 rounded-xl border border-brand-200 bg-white px-3 text-xs font-bold text-brand-700">
              📋 Dán
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">
            Maika vào đọc trang, rút kiến thức kỹ thuật + ý áp dụng cho tư vấn bán hàng. Link YouTube: Gemini xem cả video. Trang cần đăng nhập (Facebook cá nhân, nhóm kín) thường không đọc được → chụp màn hình gửi ở mục Ảnh.
          </p>
        </div>
      )}

      {/* File thoại Zalo / ảnh / video / PDF */}
      {loaiHt.accept && (
        <label className={`mb-3 flex items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 px-4 py-3 transition hover:bg-brand-50 ${dangChep || tt === 'analyzing' ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
          <input ref={inputRef} type="file" accept={loaiHt.accept} className="hidden" onChange={chonFile} />
          <span className="text-2xl">{loaiHt.icon}</span>
          {laTep && file ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-gray-800">{file.name}</div>
              <div className="text-[11px] text-gray-400">
                {(file.size / MB).toFixed(1)} MB{file.size > GIOI_HAN_FILE_MB * MB ? ' · sẽ tải lên Gemini (tệp lớn, chờ lâu hơn)' : ''}
              </div>
            </div>
          ) : (
            <span className="text-sm font-semibold text-gray-500">
              {dangChep ? '⏳ Đang chép lời…' : loai === 'audio' ? 'Chạm để chọn file ghi âm (tin nhắn thoại Zalo đã lưu, ≤ 25MB)' : `Chạm để chọn ${loaiHt.nhan.toLowerCase()} (≤ ${GIOI_HAN_TAI_LEN_MB}MB)`}
            </span>
          )}
        </label>
      )}

      {/* Nội dung chữ: gõ trực tiếp / lời nói đã chép (sửa được) / ghi chú kèm tệp */}
      <textarea value={noiDung} onChange={(e) => setNoiDung(e.target.value)} rows={loai === 'chu' ? 7 : 4}
        placeholder={
          loai === 'chu'
            ? 'Gõ điều cần dạy Maika, vd: "Thi công PU chống thấm: sàn phải khô, độ ẩm < 8%, nhiệt độ 8–35°C. Khách hỏi giá Sika Latex thì báo kèm lưới thuỷ tinh."'
            : loai === 'noi' || loai === 'audio'
              ? 'Lời nói đã chép sẽ hiện ở đây — sửa lại nếu cần'
              : loai === 'link'
                ? 'Muốn Maika chú ý điều gì? (không bắt buộc), vd: "Chỉ lấy phần định mức & điều kiện thi công"'
                : 'Ghi chú thêm cho tệp (không bắt buộc), vd: "Ảnh bao bì Sika 107 — đọc thông số"'
        }
        className="mb-3 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />

      <button onClick={() => phanTich()} disabled={tt === 'analyzing' || dangChep || ghiAm.dangGhi}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-70">
        {tt === 'analyzing' ? `⏳ ${tienDo || 'Đang phân tích…'}` : '✨ Phân tích & trích xuất tri thức'}
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
      </>
      )}
    </ScreenShell>
  )
}

// ---- Tab "Phê duyệt Tri thức Multimodal": thẻ chờ duyệt có ảnh / âm thoại ----
function PheDuyetMultimodal({ ds }) {
  return (
    <div>
      <h2 className="text-xl font-black text-gray-900">Phê duyệt Tri thức Multimodal</h2>
      <p className="mb-4 mt-1 text-xs text-gray-500">
        Thẻ tri thức kèm ảnh hiện trường / ghi âm do nhân viên gửi từ khung chat Maika ("Báo sai" hoặc "Lưu thành tri thức"). Xem media, chỉnh giải pháp rồi phê duyệt để Maika học ngay.
      </p>
      {ds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mb-2 text-3xl">🖼️</div>
          <div className="text-sm font-bold text-gray-700">Chưa có thẻ Multimodal nào chờ duyệt</div>
          <p className="mt-1 text-xs text-gray-400">Đề xuất chỉ có chữ nằm ở màn "Duyệt kiến thức".</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ds.map((r) => (
            <TheDeXuat key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  )
}
