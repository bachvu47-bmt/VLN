import { useEffect, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import TheDeXuat from '../components/TheDeXuat'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { coKhoChung, layPinAdmin } from '../services/khoChung'
import { coMaDuLieu, duLieuKV } from '../services/kiotViet'
import { coNguonBaoCao } from '../services/baoCaoSheets'
import { LICH_CAO, napTheCao, NGUON_CAO, trangThaiCao, URL_NGUON_THE } from '../services/triThucCao'
import { danhSach, duyetDeXuat, keoKhoChung } from '../services/vectorStore'

const NGUONG_DUYET_NHANH = 90

// ============================================================
//  NGUỒN CÀO PUBLIC + CƠ CHẾ SECURE API (Ổ KHOÁ) — giải thích cho Admin trước khi duyệt
// ============================================================
function Den({ bat }) {
  return <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${bat ? 'bg-green-500' : 'bg-gray-300'}`} />
}

function NguonVaBaoMat({ soChoCao }) {
  const cao = trangThaiCao()
  const kv = duLieuKV()
  const chung = coKhoChung()
  const coPin = !!layPinAdmin()

  const KHOA = [
    {
      ten: 'KiotViet (giá, tồn kho, hoá đơn, khách hàng)',
      bat: coMaDuLieu(),
      trangThai: coMaDuLieu() ? `Đã mở khoá trên máy này${kv?.capNhat ? ` · dữ liệu lúc ${new Date(kv.capNhat).toLocaleString('vi-VN')}` : ''}` : 'Máy này chưa nhập Mã dữ liệu cửa hàng',
      chiTiet: 'App KHÔNG chứa key KiotViet. GitHub Actions đọc KiotViet bằng key trong GitHub Secrets rồi xuất bản sao mã hoá AES-256-GCM (khoá dẫn xuất PBKDF2-SHA256, 150.000 vòng). Máy nhân viên chỉ tải tệp đã mã hoá, giải mã trong RAM bằng "Mã dữ liệu cửa hàng" — không lưu bản giải mã xuống máy.',
    },
    {
      ten: 'Kho tri thức chung Maika (Supabase)',
      bat: chung && coPin,
      trangThai: !chung ? 'Chế độ lưu từng máy (chưa cấu hình kho chung)' : coPin ? 'Máy này đã xác thực PIN Admin — được ghi' : 'Chỉ đọc — nhập PIN Admin ở Tài khoản để ghi',
      chiTiet: 'Key công khai trong app chỉ ĐỌC được. Mọi thao tác ghi (duyệt, từ chối, nạp tri thức, gán vector) đi qua hàm máy chủ admin_* — PIN được kiểm tra trên máy chủ, sai PIN thì máy tự xoá PIN đã lưu.',
    },
    {
      ten: 'Báo cáo bán hàng (Google Sheets)',
      bat: coNguonBaoCao(),
      trangThai: coNguonBaoCao() ? 'Đã kết nối · quyền Người xem' : 'Chưa cấu hình',
      chiTiet: 'Chỉ đọc. Doanh thu, khách, SĐT được tính ngay trên máy và dùng cho nhắc follow-up — KHÔNG bao giờ được đưa vào thẻ tri thức hay gửi cho máy cào.',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-white p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">🌐 Dải PUBLIC — nguồn Maika tự cào</div>
        <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
          Lịch: {LICH_CAO}. Bot tự xưng "VLN-Maika-Bot", đọc sitemap, nghỉ 1,2s/trang, bỏ URL có tham số, tối đa 8 trang/nguồn/lần. Chỉ trang <b>mới</b> hoặc <b>đổi nội dung</b> (so mã băm) mới thành thẻ. Groq tóm tắt thành ý kỹ thuật kèm độ tin cậy 0–100%.
        </p>
        <div className="space-y-2">
          {NGUON_CAO.map((n) => (
            <div key={n.ten} className="rounded-xl bg-gray-50 px-3 py-2">
              <div className="text-xs font-bold text-gray-900">{n.ten} <span className="font-normal text-gray-400">· {n.mien}</span></div>
              <div className="text-[11px] text-gray-500">{n.phamVi}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-0.5 text-[11px] text-gray-500">
          <div>Tệp thẻ: <span className="break-all text-gray-700">{URL_NGUON_THE}</span></div>
          <div>
            {cao.loi
              ? <span className="text-red-600">Lần tải gần nhất lỗi: {cao.loi}</span>
              : cao.lanTai
                ? `Tải lúc ${new Date(cao.lanTai).toLocaleTimeString('vi-VN')} · lần cào gần nhất ${cao.capNhatNguon ? new Date(cao.capNhatNguon).toLocaleString('vi-VN') : '?'} · ${cao.tongThe} thẻ trong tệp`
                : 'Chưa tải trong phiên này'}
          </div>
          <div>Đang chờ duyệt: <b className="text-gray-800">{soChoCao}</b> thẻ cào</div>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">🔒 Dải NỘI BỘ — Secure API (Ổ khoá)</div>
        <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
          Dữ liệu nội bộ và tri thức public đi 2 đường tách biệt: máy cào chỉ thấy trang công khai; dữ liệu nội bộ chỉ mở được trên máy đã có khoá.
        </p>
        <div className="space-y-2.5">
          {KHOA.map((k) => (
            <div key={k.ten} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-900"><Den bat={k.bat} /> {k.ten}</div>
              <div className={`mt-0.5 text-[11px] font-semibold ${k.bat ? 'text-green-700' : 'text-gray-500'}`}>{k.trangThai}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{k.chiTiet}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[11px] leading-relaxed text-gray-600">
        <div className="mb-1 text-sm font-black text-gray-900">✅ Quy trình duyệt (HITL)</div>
        Thẻ cào và đề xuất của nhân viên <b>không</b> vào bộ nhớ Maika cho tới khi Admin bấm "Phê duyệt". Admin có thể chỉnh nội dung trước khi duyệt; "Từ chối" thì thẻ không hiện lại. Duyệt xong Maika học ngay và các câu trả lời cũ trong bộ nhớ đệm được làm mới.
      </div>
    </div>
  )
}

export default function DuyetScreen({ onClose }) {
  useBoNhoMaika() // render lại khi có đề xuất mới / vừa duyệt
  const { user, laAdmin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('pending') // pending | nguon
  const [loc, setLoc] = useState('tat') // tat | nv | cao
  const [dangDuyet, setDangDuyet] = useState(false)
  const [, setDaTai] = useState(0)

  useEffect(() => {
    keoKhoChung() // lấy ngay đề xuất mới nhất từ máy nhân viên
    napTheCao({ batBuoc: true }) // và thẻ Maika vừa cào từ nhà sản xuất
      .catch(() => {})
      .finally(() => setDaTai((n) => n + 1))
  }, [])

  if (!laAdmin) {
    return (
      <ScreenShell title="Pending Cards" onClose={onClose}>
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">🔒 Chỉ Admin được duyệt tri thức.</div>
      </ScreenShell>
    )
  }

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
    <ScreenShell title="Duyệt kiến thức · HITL" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {[
          ['pending', `Pending Cards (${choDuyet.length})`],
          ['nguon', '🔒 Nguồn & Bảo mật'],
        ].map(([id, nhan]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`tap rounded-lg py-2 text-xs font-bold ${tab === id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            {nhan}
          </button>
        ))}
      </div>

      {tab === 'nguon' ? (
        <NguonVaBaoMat soChoCao={theCao.length} />
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">
            Thẻ chờ duyệt: tri thức Maika cào từ Sika, Jotun, Maxbond (dải public) và đề xuất của nhân viên. Phê duyệt = nạp vào bộ nhớ, Maika áp dụng ngay.{' '}
            <button onClick={() => setTab('nguon')} className="font-semibold text-brand-600 underline">Xem nguồn & cơ chế khoá</button>
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
              <div className="text-sm font-bold text-gray-700">Không có thẻ nào chờ duyệt</div>
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
        </>
      )}
    </ScreenShell>
  )
}
