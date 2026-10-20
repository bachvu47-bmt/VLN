// ============================================================
//  MAIKA TỰ HỌC MỖI ĐÊM — chạy trên GitHub Actions (maika-tu-hoc.yml), chạy tay được:
//    node scripts/maika-tu-hoc.mjs        (cần .env.local + .admin-pin.local, hoặc biến môi trường)
//  Đọc nhật ký hỏi đáp trong ngày (bảng nhat_ky, máy chủ maika ghi) rồi:
//   1) TỰ NGHIÊN CỨU câu Maika phải nói "chưa có dữ liệu": tìm trong kho chung, vatlieunha.vn,
//      trang + TDS của nhà sản xuất → Groq soạn câu trả lời kèm TRÍCH DẪN NGUYÊN VĂN.
//   2) TỰ CHẤM BÀI mọi câu trả lời: số liệu không có trong tri thức (bịa), người hỏi chê,
//      giám khảo AI thấy sai/lạc đề → nghiên cứu lại để có câu trả lời đúng.
//   3) TỰ RÚT BÀI HỌC từ các đính chính đã duyệt → bảng cau_hinh 'bai_hoc' → máy chủ nạp vào
//      mọi câu trả lời, Maika không lặp lại lỗi cùng kiểu.
//  Chống tự học sai: câu trả lời tự soạn chỉ được NẠP THẲNG khi mọi trích dẫn có thật nguyên
//  văn trong nguồn và không có con số nào ngoài nguồn; còn lại → hàng chờ Admin duyệt.
// ============================================================
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapSanPham } from '../src/services/sanPhamWeb.js'
import { RE_CHUA_CO, soLa, systemPrompt } from '../supabase/functions/_shared/maikaNao.js'
import { docPdf, linkPdf } from './docPdf.mjs'
import { docSitemap, khoa, lay, NGUON, trichNoiDung, UA } from './nguonNSX.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : ''
const docEnv = (ten) => process.env[ten] || (env.match(new RegExp(`^${ten}=(.*)$`, 'm'))?.[1] || '').trim()
const URL_KHO = docEnv('VITE_SUPABASE_URL').replace(/\/$/, '')
const KEY = docEnv('VITE_SUPABASE_ANON_KEY')
const GROQ = docEnv('VITE_GROQ_API_KEY')
const PIN = process.env.ADMIN_PIN || (existsSync(join(ROOT, '.admin-pin.local')) ? readFileSync(join(ROOT, '.admin-pin.local'), 'utf8').trim() : '')
if (!URL_KHO || !KEY || !PIN || !GROQ) throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / PIN Admin / VITE_GROQ_API_KEY')

const TOI_DA_NGHIEN_CUU = Number(process.env.TOI_DA_NGHIEN_CUU || 20) // lượt nghiên cứu / đêm (Groq free ~8.000 token/phút)
const TOI_DA_GIAM_KHAO = Number(process.env.TOI_DA_GIAM_KHAO || 15) // câu trả lời bình thường được giám khảo AI chấm / đêm

const ngu = (ms) => new Promise((r) => setTimeout(r, ms))
const bam = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16)
const hdr = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
// Mạng chập chờn (ECONNRESET…) → thử lại tối đa 4 lần
async function goiLai(fn) {
  for (let lan = 1; ; lan++) {
    try {
      return await fn()
    } catch (e) {
      if (lan >= 4 || !(e instanceof TypeError)) throw e
      await ngu(5000 * lan)
    }
  }
}
async function rpc(ten, body) {
  const r = await goiLai(() => fetch(`${URL_KHO}/rest/v1/rpc/${ten}`, { method: 'POST', headers: hdr, body: JSON.stringify({ p_pin: PIN, ...body }) }))
  const t = await r.text()
  if (!r.ok) throw new Error(`${ten} HTTP ${r.status}: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}
const doc = (duongDan) => goiLai(() => fetch(`${URL_KHO}/rest/v1/${duongDan}`, { headers: hdr }).then((r) => r.json()))

// ---------- Groq (JSON) — xoay model khi chạm giới hạn token/phút ----------
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']
let vong = 0
async function groqJSON(sys, user, maxTokens = 1500) {
  for (let lan = 0; lan < 9; lan++) {
    const model = MODELS[vong % MODELS.length]
    let r
    try {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          ...(model.includes('qwen') ? { reasoning_format: 'hidden' } : { reasoning_effort: 'low' }),
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
        signal: AbortSignal.timeout(60000),
      })
    } catch {
      await ngu(10000)
      continue
    }
    if (r.status === 429) {
      vong++
      if (lan % MODELS.length === MODELS.length - 1) await ngu(Math.max(Number(r.headers.get('retry-after')) || 0, 20) * 1000)
      continue
    }
    if (!r.ok) throw new Error(`Groq ${model} HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`)
    const raw = (await r.json()).choices?.[0]?.message?.content || ''
    try {
      return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    } catch {
      return {}
    }
  }
  throw new Error('Groq bận quá lâu')
}

// ---------- Tìm nguồn cho một câu hỏi ----------
const TU_BO_QUA = new Set('không nào bao nhiêu được những phù hợp shop mình cho của với này như thế loại dùng có bị gì là và thì sao em anh chị ạ ơi nhé vậy làm hay nên cần muốn hỏi giúp tôi bên thể mấy lâu khi nào đâu'.split(' '))
const tuKhoa = (s) => [...new Set(String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !TU_BO_QUA.has(w)))].slice(0, 8)

let _trangNSX
async function trangNSX() {
  if (!_trangNSX) {
    _trangNSX = []
    for (const ng of NGUON) {
      const ds = await Promise.all(ng.sitemaps.map((s) => docSitemap(s).catch(() => [])))
      _trangNSX.push(...ds.flat().filter((x) => ng.loc.test(x.url) && !x.url.includes('?')).map((x) => ({ ...x, ten: ng.ten, k: khoa(x.url.split('/').pop()) })))
    }
  }
  return _trangNSX
}

async function timNguon(cauHoi) {
  const tu = tuKhoa(cauHoi)
  const k = tu.map(khoa).filter((x) => x.length >= 2)
  const nguon = []
  // a) kho chung (có khi tri thức có sẵn mà lúc hỏi tìm trượt)
  if (tu.length) {
    const hoac = tu.slice(0, 6).map((w) => `noi_dung.ilike.*${encodeURIComponent(w)}*`).join(',')
    const rows = await doc(`tri_thuc?select=tieu_de,noi_dung,nguon&trang_thai=eq.da_duyet&da_xoa=eq.false&or=(${hoac})&limit=40`).catch(() => [])
    const diem = (r) => tu.filter((w) => (r.tieu_de + ' ' + r.noi_dung).toLowerCase().includes(w)).length
    for (const r of (Array.isArray(rows) ? rows : []).sort((a, b) => diem(b) - diem(a)).slice(0, 3)) {
      if (diem(r) >= Math.min(2, tu.length)) nguon.push({ ten: r.tieu_de, url: r.nguon || '', text: r.noi_dung })
    }
  }
  // b) vatlieunha.vn — tìm sản phẩm theo từ khoá
  const timSP = (q) =>
    fetch(`https://vatlieunha.vn/wp-json/wc/store/v1/products?per_page=3&search=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
  let sp = await timSP(tu.slice(0, 4).join(' '))
  if (!sp?.length && tu.length > 2) sp = await timSP(tu.slice(0, 2).join(' ')) // tìm nhiều từ không ra → 2 từ chính
  for (const p of (Array.isArray(sp) ? sp : []).map(mapSanPham).slice(0, 2)) {
    let text = `${p.ten} (${p.nhom}). ${p.moTa}`
    for (const t of p.taiLieu.slice(0, 1)) text += '\nTDS: ' + (await docPdf(t.url, { toiDa: 2500, ua: UA }))
    nguon.push({ ten: p.ten, url: p.url, text })
  }
  // b2) bài viết hướng dẫn / tư vấn trên vatlieunha.vn
  const bai = await fetch(`https://vatlieunha.vn/wp-json/wp/v2/posts?per_page=2&_fields=link,title,content&search=${encodeURIComponent(tu.slice(0, 4).join(' '))}`, { headers: { 'User-Agent': UA } })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
  for (const p of Array.isArray(bai) ? bai : []) {
    nguon.push({ ten: trichNoiDung(p.title?.rendered || ''), url: p.link, text: trichNoiDung(p.content?.rendered || '').replace(/\n+/g, ' ') })
  }
  // c) trang nhà sản xuất khớp từ khoá trong đường dẫn + TDS gắn trên trang (mở rộng)
  const trang = (await trangNSX())
    .map((x) => ({ ...x, diem: k.filter((w) => x.k.includes(w)).length }))
    .filter((x) => x.diem >= Math.min(2, k.length))
    .sort((a, b) => b.diem - a.diem)
    .slice(0, 2)
  for (const x of trang) {
    try {
      const html = await lay(x.url)
      // Trang web ngắn gọn, nhường chỗ cho TDS (số liệu nằm ở TDS)
      let text = trichNoiDung(html).slice(0, 1500)
      for (const u of linkPdf(html, x.url)) text += '\nTDS: ' + (await docPdf(u, { toiDa: 3500, ua: UA }))
      nguon.push({ ten: `${x.ten} — ${x.url.split('/').pop()}`, url: x.url, text })
    } catch {}
    await ngu(1200)
  }
  // Groq free ~8.000 token/phút cho MỘT lần gọi → tổng nguồn ≤ ~14.000 ký tự;
  // ưu tiên trang + TDS nhà sản xuất, rồi vatlieunha.vn, rồi kho chung
  const thuTu = [...nguon].sort((a, b) => thuHang(a) - thuHang(b))
  let conLai = 14000
  return thuTu
    .map((n) => {
      const text = n.text.replace(/\nTDS: (?=\n|$)/g, '').slice(0, Math.min(5000, conLai))
      conLai -= text.length
      return { ...n, text }
    })
    .filter((n) => n.text.length >= 80)
    .map((n, i) => ({ ...n, id: `N${i + 1}` }))
}
// Nguồn của chính Vật Liệu Nhà trước (sản phẩm đang bán, bài viết), nhà sản xuất là phần mở rộng
const thuHang = (n) => (/vatlieunha\.vn\/san-pham/.test(n.url) ? 0 : /vatlieunha\.vn/.test(n.url) ? 1 : /vnm\.sika|jotun\.com|maxbond\.vn/.test(n.url) ? 2 : 3)

// ---------- Nghiên cứu → câu trả lời có trích dẫn, tự kiểm chứng ----------
const SYS_NGHIEN_CUU = `Bạn là Maika — chuyên gia kỹ thuật của Vật Liệu Nhà, đang TỰ NGHIÊN CỨU để trả lời lại một câu hỏi mà trước đó bạn trả lời chưa tốt.
Chỉ dùng thông tin trong các NGUỒN được cung cấp. Trả về DUY NHẤT JSON:
{"coTraLoi": true|false, "tieuDe": "chủ đề ngắn", "traLoi": "câu trả lời gửi người hỏi", "trichDan": [{"nguon": "N1", "doan": "chép NGUYÊN VĂN 1 câu/cụm ≤ 200 ký tự từ nguồn làm căn cứ"}], "baiHoc": "1 câu: lần trước sai ở đâu / cần nhớ gì (chung, không chứa số liệu)"}
traLoi theo phong cách Maika: xưng "mình", gọi "anh/chị" (không dùng "bạn"); câu đầu xác nhận ý hỏi; sau đó tối đa 6 ý đánh số, mỗi ý 1 dòng ngắn; tổng ≤ 120 từ; không mở bài/kết bài; không link.
Mọi con số trong traLoi phải có trong nguồn. Nguồn không đủ để trả lời đúng câu hỏi → coTraLoi=false.
trichDan: 2–5 mục; mỗi "doan" là MỘT đoạn LIỀN MẠCH chép y nguyên từng chữ trong nguồn (copy–paste) — KHÔNG dùng "…", "→", không gộp nhiều chỗ, không tóm tắt, không sửa chữ. Cần nhiều căn cứ thì tách nhiều mục.`

const chuan = (s) => String(s).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}%.,/]+/gu, ' ').replace(/\s+/g, ' ').trim()

async function nghienCuu({ cauHoi, traLoiCu = '', goiY = '' }) {
  // Tìm theo câu hỏi gốc; lời chê ("sai rồi…") chỉ là gợi ý cho model, trộn vào từ khoá dễ tìm lệch
  const nguon = await timNguon(cauHoi)
  if (process.env.THU_CAU) console.log('Nguồn:', nguon.map((n) => `${n.id} ${n.ten} (${n.text.length} ký tự)`))
  if (!nguon.length) return { ok: false, lyDo: 'không tìm thấy nguồn' }
  const user =
    `CÂU HỎI: ${cauHoi}\n` +
    (traLoiCu ? `CÂU TRẢ LỜI TRƯỚC (bị đánh giá chưa tốt): ${traLoiCu.slice(0, 1200)}\n` : '') +
    (goiY ? `GÓP Ý CỦA NGƯỜI HỎI (chưa chắc đúng, phải kiểm chứng bằng nguồn): ${goiY.slice(0, 400)}\n` : '') +
    `\nNGUỒN:\n${nguon.map((n) => `[${n.id}] ${n.ten}\n${n.text}`).join('\n\n')}`
  const kq = await groqJSON(SYS_NGHIEN_CUU, user)
  if (!kq.coTraLoi || !String(kq.traLoi || '').trim()) return { ok: false, lyDo: 'nguồn chưa đủ để trả lời' }
  // Kiểm chứng: trích dẫn phải có thật nguyên văn; không có số liệu ngoài nguồn
  const theoId = new Map(nguon.map((n) => [n.id, chuan(n.text)]))
  const trich = (Array.isArray(kq.trichDan) ? kq.trichDan : []).filter((t) => String(t?.doan || '').trim().length >= 12)
  // So khớp bỏ hết khoảng trắng: PDF hay tách/ghép khoảng trắng khác bản model chép lại
  const dinh = (s) => chuan(s).replace(/\s+/g, '')
  const theoIdDinh = new Map([...theoId].map(([k, v]) => [k, v.replace(/\s+/g, '')]))
  // Trích dẫn nối bằng "..." → mỗi phần (≥ 12 ký tự) đều phải có nguyên văn trong nguồn
  const khop = (t) => {
    const goc = theoIdDinh.get(String(t.nguon))
    const phan = String(t.doan).split(/\.{3,}|…/).map(dinh).filter((p) => p.length >= 12)
    return !!goc && phan.length > 0 && phan.every((p) => goc.includes(p))
  }
  const dung = trich.filter(khop)
  if (process.env.THU_CAU) for (const t of trich) if (!dung.includes(t)) console.log('  ✗ không khớp', t.nguon, '«' + t.doan + '»')
  const soNgoai = soLa(kq.traLoi, nguon.map((n) => n.text).join('\n') + '\n' + cauHoi)
  // Nạp thẳng chỉ khi: ≥ 2 trích dẫn khớp nguyên văn (1 câu ngắn thì 1), ≥ 2/3 số trích dẫn khớp,
  // và KHÔNG có con số nào ngoài nguồn (chốt chặn chính chống bịa)
  const traLoi = String(kq.traLoi)
    .trim()
    .replace(/(\d)️?⃣\s*/g, '$1. ') // 1️⃣ → "1. "
    .replace(/\s+(?=\d+[.)]\s)/g, '\n')
  const soY = (traLoi.match(/^\d+[.)]\s/gm) || []).length
  const daKiemChung = dung.length >= (soY > 1 ? 2 : 1) && dung.length * 3 >= trich.length * 2 && soNgoai.length === 0
  const nguonChinh = nguon.find((n) => n.id === String(dung[0]?.nguon || trich[0]?.nguon)) || nguon[0]
  return {
    ok: true,
    daKiemChung,
    lyDo: daKiemChung ? `${dung.length} trích dẫn khớp nguồn` : `trích dẫn khớp ${dung.length}/${trich.length}${soNgoai.length ? ` · số ngoài nguồn: ${soNgoai.join(', ')}` : ''}`,
    tieuDe: String(kq.tieuDe || cauHoi).slice(0, 100),
    traLoi,
    baiHoc: String(kq.baiHoc || '').trim(),
    nguon: nguonChinh?.url || '',
  }
}

// ---------- Ghi kết quả vào kho chung ----------
async function ghiDinhChinh({ cauHoi, traLoiSai, kq, loaiViec }) {
  const tuDuyet = kq.daKiemChung
  await rpc('admin_ghi', {
    p_rows: [{
      id: `tu-hoc:${bam(chuan(cauHoi))}`,
      loai: 'sua_sai',
      trang_thai: tuDuyet ? 'da_duyet' : 'cho_duyet',
      tieu_de: (tuDuyet ? 'Đính chính: ' : 'Đề xuất đính chính: ') + cauHoi.slice(0, 80),
      noi_dung: `Câu hỏi: ${cauHoi}\nTrả lời ĐÚNG: ${kq.traLoi}`,
      cau_hoi: cauHoi,
      tra_loi_sai: traLoiSai.slice(0, 4000),
      tra_loi_dung: kq.traLoi,
      tags: ['maika-tu-hoc', loaiViec],
      nguon: kq.nguon,
      nguoi_tao: `Maika tự học · ${loaiViec} · ${kq.lyDo}`.slice(0, 100),
      duyet_boi: tuDuyet ? 'Maika (đã kiểm chứng nguồn)' : null,
      duyet_luc: tuDuyet ? new Date().toISOString() : null,
      embedding: null,
    }],
  })
  return tuDuyet ? 'đã học' : 'chờ duyệt'
}

// ---------- Giám khảo ----------
const SYS_GIAM_KHAO = `Bạn là giám khảo chất lượng câu trả lời của Maika (trợ lý kỹ thuật vật liệu xây dựng của Vật Liệu Nhà).
Chấm câu trả lời theo: (1) đúng trọng tâm câu hỏi; (2) không có thông tin trái với TRI THỨC hoặc gán số liệu của sản phẩm này cho sản phẩm khác; (3) không có số liệu sản phẩm mà tri thức không có; (4) xúc tích (≤ 6 ý, không lan man).
Trả về DUY NHẤT JSON: {"dat": true|false, "loi": "nếu không đạt: lỗi chính trong 1 câu", "nghiemTrong": true|false}
nghiemTrong=true khi sai kỹ thuật / bịa số / sai sản phẩm (không phải chỉ dài dòng).`

// ============================================================
// Thử nghiên cứu 1 câu, không ghi gì: THU_CAU="định mức sika raintite" node scripts/maika-tu-hoc.mjs
if (process.env.THU_CAU) {
  console.log(JSON.stringify(await nghienCuu({ cauHoi: process.env.THU_CAU, traLoiCu: 'Maika chưa có dữ liệu về vấn đề này.' }), null, 2))
  process.exit(0)
}

const nhatKy = await rpc('admin_doc_nhat_ky', { p_gioi_han: 300 })
console.log(`• Nhật ký chờ xử lý: ${nhatKy.length} lượt`)
const thongKe = { nghienCuu: 0, daHoc: 0, choDuyet: 0, khongNguon: 0, cham: 0, loi: 0 }
const daLam = new Set()
const xong = []
const SYS_THUONG = systemPrompt({ cheDo: 'khach' }) + systemPrompt({ cheDo: 'noi-bo' })

for (const r of nhatKy) {
  let ketQua = 'ổn'
  try {
    // Xác định việc cần làm cho lượt này
    let viec = null
    if (r.bi_che && r.cau_hoi_truoc) {
      viec = { loaiViec: 'bi-che', cauHoi: r.cau_hoi_truoc, traLoiSai: r.tra_loi_truoc || '', goiY: r.cau_hoi }
    } else if (r.chua_co || RE_CHUA_CO.test(r.tra_loi)) {
      viec = { loaiViec: 'chua-co-du-lieu', cauHoi: r.cau_hoi, traLoiSai: r.tra_loi }
    } else if (r.cau_hoi && r.cau_hoi !== '(ảnh)') {
      const la = soLa(r.tra_loi, r.tri_thuc + '\n' + r.cau_hoi + '\n' + SYS_THUONG)
      if (la.length) {
        viec = { loaiViec: 'bia-so', cauHoi: r.cau_hoi, traLoiSai: r.tra_loi }
        ketQua = 'số lạ: ' + la.join(', ')
      } else if (r.tri_thuc && thongKe.cham < TOI_DA_GIAM_KHAO) {
        thongKe.cham++
        const gk = await groqJSON(SYS_GIAM_KHAO, `CÂU HỎI: ${r.cau_hoi}\n\nTRI THỨC MAIKA ĐƯỢC CẤP:\n${r.tri_thuc.slice(0, 4000)}\n\nCÂU TRẢ LỜI:\n${r.tra_loi}`, 400)
        if (gk.dat === false && gk.nghiemTrong) {
          viec = { loaiViec: 'giam-khao', cauHoi: r.cau_hoi, traLoiSai: r.tra_loi, goiY: '' }
          ketQua = 'giám khảo: ' + String(gk.loi || '').slice(0, 200)
        } else if (gk.dat === false) {
          ketQua = 'chưa gọn: ' + String(gk.loi || '').slice(0, 200)
        }
      }
    }

    const khoaViec = viec && chuan(viec.cauHoi)
    if (viec && !daLam.has(khoaViec) && thongKe.nghienCuu < TOI_DA_NGHIEN_CUU) {
      daLam.add(khoaViec)
      thongKe.nghienCuu++
      const kq = await nghienCuu(viec)
      if (!kq.ok) {
        thongKe.khongNguon++
        ketQua = `${viec.loaiViec}: ${kq.lyDo}`
      } else {
        const tt = await ghiDinhChinh({ ...viec, kq })
        tt === 'đã học' ? thongKe.daHoc++ : thongKe.choDuyet++
        ketQua = `${viec.loaiViec}: ${tt} (${kq.lyDo})`
        if (kq.baiHoc) ketQua += ' · bài học: ' + kq.baiHoc.slice(0, 150)
      }
      console.log(`  • [${viec.loaiViec}] ${viec.cauHoi.slice(0, 70)} → ${ketQua}`)
    } else if (viec) {
      // trùng câu đã nghiên cứu đêm nay / hết lượt → để đêm sau
      if (thongKe.nghienCuu >= TOI_DA_NGHIEN_CUU && !daLam.has(khoaViec)) continue
      ketQua = `${viec.loaiViec}: trùng câu đã nghiên cứu`
    }
  } catch (e) {
    thongKe.loi++
    ketQua = 'lỗi: ' + e.message
    console.warn(`  ✗ nhật ký #${r.id}: ${e.message}`)
    if (/bận quá lâu/.test(e.message)) break
  }
  xong.push({ id: r.id, ketQua })
}

// Đánh dấu đã xử lý (gom theo kết quả cho gọn)
const theoKQ = new Map()
for (const x of xong) theoKQ.set(x.ketQua, [...(theoKQ.get(x.ketQua) || []), x.id])
for (const [kq, ids] of theoKQ) await rpc('admin_xong_nhat_ky', { p_ids: ids, p_ket_qua: kq })

// ---------- 3) Rút bài học từ các đính chính đã duyệt ----------
const dinhChinh = await doc('tri_thuc?select=cau_hoi,tra_loi_sai,tra_loi_dung&loai=eq.sua_sai&trang_thai=eq.da_duyet&da_xoa=eq.false&order=cap_nhat_luc.desc&limit=60')
const ghiNhan = xong.map((x) => x.ketQua).filter((k) => /bài học:|giám khảo:|chưa gọn:/.test(k))
const dauVao = JSON.stringify([dinhChinh, ghiNhan])
const cu = await doc('cau_hinh?select=khoa,gia_tri&khoa=in.(bai_hoc,bai_hoc_hash)')
const hashCu = (Array.isArray(cu) ? cu : []).find((x) => x.khoa === 'bai_hoc_hash')?.gia_tri
if ((dinhChinh.length || ghiNhan.length) && hashCu !== bam(dauVao)) {
  const baiCu = (Array.isArray(cu) ? cu : []).find((x) => x.khoa === 'bai_hoc')?.gia_tri || ''
  const kq = await groqJSON(
    `Bạn giúp Maika (trợ lý kỹ thuật của Vật Liệu Nhà) rút BÀI HỌC từ các lần trả lời sai. Trả về DUY NHẤT JSON {"baiHoc": ["…"]}.
Tối đa 10 bài học, mỗi bài 1 câu mệnh lệnh ≤ 25 từ, áp dụng CHUNG cho nhiều câu hỏi (vd "Hỏi về PU luôn nhắc độ ẩm nền trước"). KHÔNG chép số liệu của sản phẩm cụ thể (số liệu đã nằm trong đính chính). Giữ bài học cũ còn đúng, gộp bài trùng, bỏ bài vụn vặt.`,
    `BÀI HỌC ĐANG CÓ:\n${baiCu || '(chưa có)'}\n\nĐÍNH CHÍNH ĐÃ DUYỆT (câu hỏi · trả lời sai · trả lời đúng):\n${dinhChinh
      .map((d) => `- ${d.cau_hoi} · SAI: ${String(d.tra_loi_sai || '').slice(0, 200)} · ĐÚNG: ${String(d.tra_loi_dung || '').slice(0, 300)}`)
      .join('\n')
      .slice(0, 9000)}\n\nGHI NHẬN ĐÊM NAY:\n${ghiNhan.join('\n').slice(0, 2000) || '(không có)'}`,
    1200,
  )
  const ds = (Array.isArray(kq.baiHoc) ? kq.baiHoc : []).map((x) => String(x).trim()).filter((x) => x && soLa(x).length === 0).slice(0, 10)
  if (ds.length) {
    await rpc('admin_dat_cau_hinh', { p_khoa: 'bai_hoc', p_gia_tri: ds.map((x) => '- ' + x).join('\n') })
    await rpc('admin_dat_cau_hinh', { p_khoa: 'bai_hoc_hash', p_gia_tri: bam(dauVao) })
    console.log(`• Bài học (${ds.length}):\n${ds.map((x) => '   - ' + x).join('\n')}`)
  }
}

await rpc('admin_dat_cau_hinh', { p_khoa: 'tu_hoc_bao_cao', p_gia_tri: JSON.stringify({ luc: new Date().toISOString(), daXem: xong.length, ...thongKe }) })
console.log(`✓ Xong: xem ${xong.length} lượt · nghiên cứu ${thongKe.nghienCuu} (tự học ${thongKe.daHoc} · chờ duyệt ${thongKe.choDuyet} · chưa có nguồn ${thongKe.khongNguon}) · giám khảo chấm ${thongKe.cham} · lỗi ${thongKe.loi}`)
