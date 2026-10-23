import { useEffect, useState } from 'react'
import PinAdminCard from '../components/PinAdminCard'
import ScreenShell from '../components/ScreenShell'
import SuaAnhSanPham from '../components/SuaAnhSanPham'
import TheDeXuat from '../components/TheDeXuat'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { coKhoChung, coPhienAdmin, coQuyenAdmin, EMAIL_ADMIN } from '../services/khoChung'
import { duLieuKV } from '../services/kiotViet'
import { coNguonBaoCao } from '../services/baoCaoSheets'
import { LICH_CAO, napTheCao, NGUON_CAO, NGUON_TIN, trangThaiCao, URL_NGUON_THE } from '../services/triThucCao'
import { danhSach, duyetDeXuat, keoKhoChung, thongTinTin } from '../services/vectorStore'


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
  const coPin = coQuyenAdmin()

  const KHOA = [
    {
      ten: 'KiotViet (giá, tồn kho, hoá đơn, khách hàng)',
      bat: !!kv?.coRieng,
      trangThai: kv?.coRieng
        ? `Admin — đủ hàng hoá, hoá đơn, khách hàng · dữ liệu lúc ${new Date(kv.capNhatRieng || kv.capNhat).toLocaleString('vi-VN')}`
        : kv ? 'Hàng hoá, tồn kho, giá bán · hoá đơn & khách hàng chưa tải (cần quyền Admin)' : 'Đang đồng bộ…',
      chiTiet: 'App KHÔNG chứa key KiotViet. GitHub Actions kết nối KiotViet bằng key trong GitHub Secrets (30 phút/lần), tách 2 phần: hàng hoá, tồn kho, giá bán công khai cho mọi máy và Maika trên web; khách hàng, hoá đơn, công nợ lưu riêng trên máy chủ — chỉ trả cho máy đã xác thực Admin, chỉ giữ trong RAM.',
    },
    {
      ten: 'Kho tri thức chung Maika (Supabase)',
      bat: chung && coPin,
      trangThai: !chung ? 'Chế độ lưu từng máy (chưa cấu hình kho chung)' : coPin ? `Máy này đã xác thực Admin${coPhienAdmin() ? ` (${EMAIL_ADMIN})` : ' (PIN)'} — được ghi` : `Chỉ đọc — đăng nhập email ${EMAIL_ADMIN} để ghi`,
      chiTiet: `Key công khai trong app chỉ ĐỌC được. Mọi thao tác ghi (duyệt, từ chối, nạp tri thức, gán vector) đi qua hàm máy chủ admin_* — máy chủ chỉ cho ghi khi có phiên đăng nhập đã xác minh của ${EMAIL_ADMIN} (mã gửi qua email) hoặc đúng PIN Admin dự phòng.`,
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
          {[...NGUON_CAO, ...NGUON_TIN].map((n) => (
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
  const [loc, setLoc] = useState('tat') // tat | nv | cao | tin
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
  const theTin = choDuyet.filter((r) => thongTinTin(r))
  const theNV = choDuyet.filter((r) => !r.tuDong && !thongTinTin(r))
  const hien = loc === 'cao' ? theCao : loc === 'tin' ? theTin : loc === 'nv' ? theNV : choDuyet
  const canPin = coKhoChung() && !coQuyenAdmin()
  const tenLoc = { tat: '', nv: ' đề xuất nhân viên', cao: ' thẻ Maika cào', tin: ' tin tức' }[loc]

  // Phê duyệt tất cả thẻ đang hiện (theo bộ lọc) — Admin bấm = đã duyệt (HITL), có hộp xác nhận
  const duyetHet = async () => {
    const ds = hien.filter((r) => (r.traLoiDung || '').trim())
    if (dangDuyet || !ds.length) return
    if (canPin) return toast('Xác thực máy Admin ở ô phía trên trước (chỉ 1 lần)', 'info')
    if (!window.confirm(`Phê duyệt tất cả ${ds.length}${tenLoc} đang chờ? Maika sẽ học toàn bộ nội dung này.`)) return
    setDangDuyet({ xong: 0, tong: ds.length })
    let ok = 0
    for (const r of ds) {
      try {
        await duyetDeXuat(r.id, { traLoiDung: r.traLoiDung, nguoi: user.hoTen })
        ok++
      } catch {
        /* bỏ qua thẻ lỗi, duyệt tiếp */
      }
      setDangDuyet({ xong: ok, tong: ds.length })
    }
    setDangDuyet(false)
    toast(ok === ds.length ? `Đã phê duyệt ${ok} thẻ — Maika đang học` : `Đã phê duyệt ${ok}/${ds.length} thẻ — ${ds.length - ok} thẻ lỗi, thử lại sau`, ok ? 'success' : 'error')
  }

  return (
    <ScreenShell title="Duyệt kiến thức · HITL" onClose={onClose}>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {[
          ['pending', `Pending (${choDuyet.length})`],
          ['anh', '🖼️ Ảnh SP'],
          ['nguon', '🔒 Nguồn'],
        ].map(([id, nhan]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`tap rounded-lg py-2 text-xs font-bold ${tab === id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            {nhan}
          </button>
        ))}
      </div>

      {tab === 'nguon' ? (
        <NguonVaBaoMat soChoCao={theCao.length} />
      ) : tab === 'anh' ? (
        <SuaAnhSanPham />
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">
            Thẻ chờ duyệt: tri thức Maika cào từ Sika, Jotun, Maxbond, tin tức ngành hằng ngày (dải public) và đề xuất của nhân viên. Phê duyệt = nạp vào bộ nhớ, Maika áp dụng ngay.{' '}
            <button onClick={() => setTab('nguon')} className="font-semibold text-brand-600 underline">Xem nguồn & cơ chế khoá</button>
          </p>

          {canPin && (
            <div className="mb-4">
              <PinAdminCard gon />
            </div>
          )}

          <div className="mb-4 flex gap-1.5">
            {[
              ['tat', `Tất cả (${choDuyet.length})`],
              ['nv', `Nhân viên (${theNV.length})`],
              ['cao', `Maika cào (${theCao.length})`],
              ['tin', `Tin tức (${theTin.length})`],
            ].map(([id, nhan]) => (
              <button key={id} onClick={() => setLoc(id)}
                className={`tap rounded-full border px-3 py-1 text-[11px] font-semibold ${loc === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                {nhan}
              </button>
            ))}
          </div>

          {hien.length > 1 && (
            <button onClick={duyetHet} disabled={!!dangDuyet}
              className="tap mb-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-700 disabled:opacity-60">
              {dangDuyet ? `⏳ Đang duyệt ${dangDuyet.xong}/${dangDuyet.tong}…` : `✓ Phê duyệt tất cả ${hien.length}${tenLoc}`}
            </button>
          )}

          {hien.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
              <div className="mb-2 text-3xl">✅</div>
              <div className="text-sm font-bold text-gray-700">Không có thẻ nào chờ duyệt</div>
              <p className="mt-1 text-xs text-gray-400">Maika cào tri thức mới lúc 5:30 và 12:30, tin tức ngành lúc 5:30 mỗi ngày; nhân viên gửi đề xuất từ khung chat.</p>
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
