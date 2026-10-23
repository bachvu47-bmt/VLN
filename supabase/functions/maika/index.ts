// ============================================================
//  HÀM MÁY CHỦ "maika" (Supabase Edge Function, Deno) — MỘT Maika cho cả app và web
//  POST /functions/v1/maika
//    { cheDo: 'khach' | 'noi-bo', lichSu: [{tu, text, anh?, coAnh?}], khoNoiBo?, triThuc? }
//    → { text, nhaCungCap }  ·  lỗi: { loi, choGiay? }
//  - Lời dặn / model / cách ghép lịch sử: ../_shared/maikaNao.js (app import đúng file này)
//  - Tri thức: bảng tri_thuc (kho chung) — tìm theo vector (Gemini embedding 768 chiều),
//    lỗi embedding thì tìm theo từ khoá. App gửi sẵn triThuc đã truy xuất thì dùng luôn.
//  - 'khach' (web): bỏ qua khoNoiBo/triThuc do client gửi → chỉ tri thức đã duyệt trên máy chủ.
//  - Giới hạn lượt/ngày theo IP + tổng toàn hệ thống (bảng luot_hoi) để không cạn quota AI free.
//  Secrets: GEMINI_API_KEY, GROQ_API_KEY (đặt bằng scripts/setup-supabase.mjs). SUPABASE_DB_URL có sẵn.
// ============================================================
import postgres from 'npm:postgres@3.4.4'
import { cauTruyVan, GEMINI_MODELS, GROQ_MODELS, NHIET_DO, RE_CHE, RE_CHUA_CO, rutGonNguCanh, sangMessagesGroq, SO_CHIEU_VECTOR, soLa, systemPrompt, toContents } from '../_shared/maikaNao.js'

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GROQ_KEY = Deno.env.get('GROQ_API_KEY') || ''
const KHOA_NOI = Deno.env.get('MAIKA_KHOA_NOI') || '' // chỉ hàm "zalo" biết — xem functions/zalo
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const EMBED_MODEL = 'gemini-embedding-001'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2, idle_timeout: 20 })

// Lượt/ngày: [mỗi IP, tổng cả hệ thống]
const GIOI_HAN = { khach: [30, 600], 'noi-bo': [400, 6000] } as const

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const traVe = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })

class LoiAI extends Error {
  constructor(public status: number, chiTiet: string, public choGiay = 0) {
    super(`HTTP ${status}: ${String(chiTiet).slice(0, 200)}`)
  }
}
const NEN_DOI = (e: any) => [404, 429, 500, 502, 503, 504].includes(e?.status) || e?.name === 'TimeoutError' || e instanceof TypeError

// ---------- AI ----------
async function goiGemini(duongDan: string, body: unknown, timeoutMs = 30000) {
  const res = await fetch(`${GEMINI_BASE}/${duongDan}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    const m = t.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/)
    throw new LoiAI(res.status, t, m ? Math.ceil(Number(m[1])) : 0)
  }
  return res.json()
}

// nhanh: khách trên web — suy nghĩ mức thấp, chỉ thử 2 model, mỗi lần ≤ 15s rồi nhường Groq
// (đo 20/10/2026: gemini-3.8-flash mặc định 200s/câu, thinkingLevel 'low' ~16s)
async function geminiChat(system: string, lichSu: any[], nhanh = false) {
  let loiCuoi: any
  for (const m of nhanh ? GEMINI_MODELS.slice(0, 2) : GEMINI_MODELS) {
    try {
      const data = await goiGemini(`models/${m}:generateContent`, {
        systemInstruction: { parts: [{ text: system }] },
        contents: toContents(lichSu),
        generationConfig: { temperature: NHIET_DO, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'low' } },
      }, nhanh ? 15000 : 30000)
      const parts = data?.candidates?.[0]?.content?.parts || []
      const text = parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('').trim()
      if (text) return text
      loiCuoi = new LoiAI(502, 'Gemini không trả nội dung')
    } catch (e) {
      loiCuoi = e
      if (!NEN_DOI(e)) throw e
    }
  }
  throw loiCuoi
}

async function groqChat(system: string, lichSu: any[]) {
  const messages = sangMessagesGroq(system, lichSu)
  const coAnh = messages.some((m: any) => Array.isArray(m.content))
  let loiCuoi: any
  for (const { id, them, docAnh } of GROQ_MODELS as any[]) {
    if (coAnh && !docAnh) continue
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model: id, messages, temperature: NHIET_DO, max_tokens: 2048, ...them }),
        signal: AbortSignal.timeout(25000),
      })
      if (!res.ok) throw new LoiAI(res.status, await res.text().catch(() => ''), Number(res.headers.get('retry-after')) || 0)
      const data = await res.json()
      const text = (data?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (text) return text
      loiCuoi = new LoiAI(502, 'Groq không trả nội dung')
    } catch (e) {
      loiCuoi = e
      if (!NEN_DOI(e)) throw e
    }
  }
  throw loiCuoi || new LoiAI(429, 'Các model Groq đang hết lượt', 30)
}

// Nhân viên hỏi chữ: Groq trước (nhiều lượt free), Gemini dự phòng
// Khách trên web / có ảnh: Gemini trước — bám tri thức, ít trộn số liệu giữa các sản phẩm hơn
// (thử 20/10/2026: gpt-oss-120b vẫn tự thêm độ dày lớp/thời gian chờ), hết lượt thì Groq đỡ
async function traLoi(nguCanh: any, lichSu: any[]) {
  const coAnh = lichSu.some((m) => m.anh) || nguCanh.cheDo === 'khach'
  const quaGemini = async () => ({ text: await geminiChat(systemPrompt(nguCanh), lichSu, nguCanh.cheDo === 'khach'), nhaCungCap: 'gemini' })
  const quaGroq = async () => ({ text: await groqChat(systemPrompt(rutGonNguCanh(nguCanh)), lichSu), nhaCungCap: 'groq' })
  const thuTu = (coAnh ? [GEMINI_KEY && quaGemini, GROQ_KEY && quaGroq] : [GROQ_KEY && quaGroq, GEMINI_KEY && quaGemini]).filter(Boolean) as (() => Promise<any>)[]
  let loiCuoi: any
  for (const thu of thuTu) {
    try {
      return await thu()
    } catch (e) {
      loiCuoi = e
      console.warn('[maika] nhà cung cấp lỗi:', (e as Error).message)
    }
  }
  throw loiCuoi || new LoiAI(500, 'Chưa cấu hình key AI trên máy chủ')
}

// ---------- Tri thức (kho chung) ----------
async function vectorCauHoi(text: string): Promise<number[] | null> {
  if (!GEMINI_KEY || !text.trim()) return null
  try {
    const data = await goiGemini(`models/${EMBED_MODEL}:embedContent`, {
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: text.slice(0, 2000) }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: SO_CHIEU_VECTOR,
    }, 5000)
    const v: number[] = data?.embedding?.values || []
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
    return v.length === SO_CHIEU_VECTOR ? v.map((x) => x / n) : null
  } catch {
    return null
  }
}

const doiHang = (r: any) => ({ loai: r.loai, tieuDe: r.tieu_de, noiDung: r.noi_dung, nguon: r.nguon || '' })

// Từ khoá — tìm được cả đoạn CHƯA có vector (embedding free có hạn mức/ngày, kho mới nạp phải vài ngày mới đủ vector).
// Tiếng Việt: 1 từ đơn ("tấm", "công") khớp gần như mọi đoạn → chấm theo CỤM 2 TỪ liền nhau ("tấm ốp",
// "giả đá", "ốp tường") là chính, từ đơn chỉ cộng thêm. Giữ cả từ 2 ký tự ("ốp", "đá", "pu").
const TU_BO_QUA = new Set(['không', 'nào', 'bao', 'nhiêu', 'được', 'những', 'phù', 'hợp', 'shop', 'mình', 'cho', 'của', 'với', 'này', 'như', 'thế', 'loại', 'dùng', 'có', 'bị', 'gì', 'là', 'và', 'thì', 'sao', 'em', 'anh', 'chị', 'ạ', 'ơi', 'nhé', 'vậy', 'làm', 'hay', 'nên', 'cần', 'muốn', 'hỏi', 'giúp', 'tôi', 'bên', 'mấy', 'khi', 'đâu', 'ra', 'đi', 'lại', 'thể', 'các', 'một', 'cái'])
async function timTuKhoa(text: string, k: number) {
  const day = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !TU_BO_QUA.has(w))
  const tu = [...new Set(day)].slice(0, 8)
  if (!tu.length) return []
  const cum = [...new Set(day.slice(0, -1).map((w, i) => `${w} ${day[i + 1]}`))].slice(0, 8)
  const mauTu = tu.map((w) => `%${w}%`)
  const mauCum = cum.map((c) => `%${c}%`)
  const mauLoc = mauCum.length ? mauCum : mauTu // có cụm → bắt buộc khớp ít nhất 1 cụm
  return await sql`
    select loai, tieu_de, noi_dung, nguon,
      (select count(*) from unnest(${mauCum}::text[]) m where t.tieu_de ilike m) * 6 +
      (select count(*) from unnest(${mauCum}::text[]) m where t.noi_dung ilike m) * 3 +
      (select count(*) from unnest(${mauTu}::text[]) m where t.tieu_de ilike m) * 2 +
      (select count(*) from unnest(${mauTu}::text[]) m where t.noi_dung ilike m) as diem
    from public.tri_thuc t
    where trang_thai = 'da_duyet' and not da_xoa and (tieu_de ilike any(${mauLoc}) or noi_dung ilike any(${mauLoc}))
    order by (loai = 'sua_sai') desc, diem desc, cap_nhat_luc desc limit ${k}`
}

async function timTriThuc(text: string, k = 6) {
  const [vec, tuKhoa] = await Promise.all([vectorCauHoi(text), timTuKhoa(text, k)])
  const theoNghia = vec ? await sql`select * from public.tim_tri_thuc(${'[' + vec.join(',') + ']'}::extensions.vector, ${k}, 0.55)` : []
  // Xen kẽ: nghĩa, từ khoá, nghĩa... — bỏ trùng; đính chính của Admin luôn lên đầu
  const gop: any[] = []
  const daCo = new Set<string>()
  for (let i = 0; i < k; i++) {
    for (const r of [theoNghia[i], tuKhoa[i]]) {
      if (r && !daCo.has(r.tieu_de + r.noi_dung.slice(0, 50))) {
        daCo.add(r.tieu_de + r.noi_dung.slice(0, 50))
        gop.push(r)
      }
    }
  }
  return gop.sort((a, b) => Number(b.loai === 'sua_sai') - Number(a.loai === 'sua_sai')).slice(0, k).map(doiHang)
}

// ---------- Tự học: bài học (job đêm rút ra) & nhật ký hỏi đáp ----------
// Bảng chưa tạo / lỗi DB → bỏ qua, Maika vẫn trả lời bình thường
let _baiHoc = { gia: '', luc: 0 }
async function layBaiHoc() {
  if (Date.now() - _baiHoc.luc < 10 * 60 * 1000) return _baiHoc.gia
  try {
    const r = await sql`select gia_tri from public.cau_hinh where khoa = 'bai_hoc'`
    _baiHoc = { gia: String(r[0]?.gia_tri || '').slice(0, 3000), luc: Date.now() }
  } catch {
    _baiHoc = { gia: '', luc: Date.now() }
  }
  return _baiHoc.gia
}

function ghiNhatKy(cheDo: string, lichSu: any[], triThuc: any[], text: string, tuSua: boolean) {
  const cuoi = lichSu[lichSu.length - 1]
  const iTruoc = lichSu.map((m) => m.tu).lastIndexOf('maika', lichSu.length - 2)
  const biChe = iTruoc >= 0 && RE_CHE.test(cuoi?.text || '')
  const cauTruoc = biChe ? [...lichSu.slice(0, iTruoc)].reverse().find((m) => m.tu === 'user')?.text || '' : null
  const viec = sql`
    insert into public.nhat_ky (che_do, cau_hoi, tra_loi, tri_thuc, chua_co, bi_che, tu_sua, cau_hoi_truoc, tra_loi_truoc)
    values (${cheDo}, ${String(cuoi?.text || (cuoi?.anh ? '(ảnh)' : '')).slice(0, 2000)}, ${text.slice(0, 4000)},
            ${triThuc.map((t) => `[${t.tieuDe}] ${t.noiDung}`).join('\n\n').slice(0, 6000)},
            ${RE_CHUA_CO.test(text)}, ${biChe}, ${tuSua}, ${cauTruoc}, ${biChe ? lichSu[iTruoc].text.slice(0, 4000) : null})`
    .catch((e: any) => console.warn('[maika] ghi nhật ký lỗi:', e.message))
  // Không bắt người hỏi chờ việc ghi
  ;(globalThis as any).EdgeRuntime?.waitUntil?.(viec)
}

// ---------- KiotViet CÔNG KHAI cho khách web: giá bán lẻ + còn/hết hàng (không số lượng tồn) ----------
// Tệp do GitHub Actions (kiotviet-sync.mjs) đăng 30 phút/lần; KHÔNG chứa khách hàng / hoá đơn / công nợ.
const URL_KV_CONG_KHAI = Deno.env.get('KV_CONG_KHAI_URL') || 'https://raw.githubusercontent.com/bachvu47-bmt/VLN/du-lieu/kiotviet-cong-khai.json'
let _kv: { d: any; luc: number } = { d: null, luc: 0 }
async function kvCongKhai() {
  if (_kv.d && Date.now() - _kv.luc < 10 * 60 * 1000) return _kv.d
  try {
    const r = await fetch(URL_KV_CONG_KHAI, { signal: AbortSignal.timeout(8000) })
    if (r.ok) _kv = { d: await r.json(), luc: Date.now() }
  } catch (e: any) {
    console.warn('[maika] tải KiotViet công khai lỗi:', e.message)
  }
  return _kv.d
}
const boDauKV = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
// Giống src/services/kiotViet.js goiYSanPhamTuCau: khớp ≥ 2 từ "có nghĩa"
const TU_CHUNG_KV = new Set('con bao nhieu gia ton kho hang co khong cua the nao mot cai cuon thung bo tam thanh may loai'.split(' '))
async function giaChoKhach(cau: string) {
  const kv = await kvCongKhai()
  const tu = [...new Set(boDauKV(cau).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !TU_CHUNG_KV.has(w)))]
  if (!kv?.sanPham?.length || !tu.length) return ''
  const ds = kv.sanPham
    .map((p: any) => ({ p, diem: tu.filter((w) => boDauKV(`${p.ten} ${p.ma}`).includes(w)).length }))
    .filter((x: any) => x.diem >= Math.min(2, tu.length))
    .sort((a: any, b: any) => b.diem - a.diem || b.p.ton - a.p.ton)
    .slice(0, 6)
  if (!ds.length) return ''
  const luc = new Date(kv.capNhat).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
  // Nhãn mục khớp rutGonNguCanh (giữ trọn khi rút gọn cho Groq)
  return `\n\nGIÁ BÁN & TỒN KHO KIOTVIET (cập nhật ${luc} — giá bán lẻ tham khảo; chỉ nói còn/hết hàng, không nêu số lượng):\n${ds
    .map(({ p }: any) => `- ${p.ten} (mã ${p.ma}): ${(p.gia || 0).toLocaleString('vi-VN')}đ/${p.dvt} · ${p.ton > 0 ? 'còn hàng' : 'HẾT HÀNG'}`)
    .join('\n')}`
}

// ---------- Giới hạn lượt ----------
async function conLuot(cheDo: 'khach' | 'noi-bo', ip: string) {
  const [moiIp, tong] = GIOI_HAN[cheDo]
  const [{ ok }] = await sql`select public.dem_luot(${cheDo + ':' + ip}, ${moiIp}, ${cheDo + ':*'}, ${tong}) as ok`
  return ok as boolean
}

// ---------- Kiểm tra đầu vào ----------
function lamSachLichSu(raw: unknown) {
  if (!Array.isArray(raw)) return null
  const ds = raw.slice(-16).map((m: any, i: number, a: any[]) => {
    const tu = m?.tu === 'maika' ? 'maika' : 'user'
    const text = String(m?.text || '').slice(0, 4000)
    const laCuoi = i === a.length - 1
    const anh =
      laCuoi && m?.anh && /^image\/(jpeg|png|webp)$/.test(m.anh.mime) && typeof m.anh.base64 === 'string' && m.anh.base64.length < 4_500_000
        ? { mime: m.anh.mime, base64: m.anh.base64 }
        : undefined
    return { tu, text, coAnh: !!m?.coAnh, ...(anh ? { anh } : {}) }
  })
  return ds.some((m) => m.tu === 'user' && (m.text || m.anh)) ? ds : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return traVe({ loi: 'Chỉ nhận POST' }, 405)

  let body: any
  try {
    body = await req.json()
  } catch {
    return traVe({ loi: 'Dữ liệu gửi lên không hợp lệ' }, 400)
  }
  const cheDo: 'khach' | 'noi-bo' = body?.cheDo === 'noi-bo' ? 'noi-bo' : 'khach'
  const lichSu = lamSachLichSu(body?.lichSu)
  if (!lichSu) return traVe({ loi: 'Chưa có câu hỏi' }, 400)

  // Hàm "zalo" gọi thay khách Zalo (cùng 1 IP máy chủ) → đếm lượt theo từng khách Zalo, không theo IP
  const quaZalo = !!KHOA_NOI && req.headers.get('x-maika-khoa') === KHOA_NOI && typeof body?.khachId === 'string'
  const ip = quaZalo ? 'zalo:' + body.khachId.slice(0, 64) : (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'khong-ro'
  try {
    if (!(await conLuot(cheDo, ip))) {
      return traVe({ loi: cheDo === 'khach' ? 'Hôm nay Maika đã trả lời anh/chị nhiều câu rồi ạ. Anh/chị gọi 0947 844 446 hoặc nhắn Zalo để kỹ thuật viên hỗ trợ tiếp nhé!' : 'Đã hết lượt hỏi Maika hôm nay', choGiay: 3600 }, 429)
    }

    const truyVan = cauTruyVan(lichSu)
    const triThucApp = cheDo === 'noi-bo' && Array.isArray(body?.triThuc) ? body.triThuc.slice(0, 10).map((t: any) => ({ loai: String(t?.loai || ''), tieuDe: String(t?.tieuDe || '').slice(0, 300), noiDung: String(t?.noiDung || '').slice(0, 3000), nguon: String(t?.nguon || '').slice(0, 300) })) : null
    const triThuc = triThucApp ?? (await timTriThuc(truyVan).catch((e) => (console.warn('[maika] tìm tri thức lỗi:', e.message), [])))
    // App gửi kho nội bộ của máy; khách web/Zalo → máy chủ tự gắn giá bán + còn/hết hàng KiotViet công khai
    const khoNoiBo = cheDo === 'noi-bo' ? String(body?.khoNoiBo || '').slice(0, 20000) : await giaChoKhach(truyVan)

    const nguCanh = { cheDo, khoNoiBo, triThuc, baiHoc: await layBaiHoc() }
    let kq = await traLoi(nguCanh, lichSu)

    // Tự soát trước khi gửi: con số kỹ thuật không có trong ngữ cảnh → bắt Maika viết lại 1 lần
    const coSan = systemPrompt(nguCanh) + '\n' + lichSu.map((m) => m.text).join('\n')
    const la = soLa(kq.text, coSan)
    let tuSua = false
    if (la.length) {
      try {
        const sua = await traLoi(nguCanh, [
          ...lichSu,
          { tu: 'maika', text: kq.text },
          { tu: 'user', text: `(Kiểm tra nội bộ — không phải khách hỏi) Bản nháp có số liệu KHÔNG có trong tri thức: ${la.join(', ')}. Viết lại câu trả lời cho câu hỏi trước: bỏ hẳn các số đó (cần thì ghi "theo TDS"), giữ giọng và bố cục. Chỉ trả nội dung gửi người hỏi.` },
        ])
        if (soLa(sua.text, coSan).length < la.length) {
          kq = sua
          tuSua = true
        }
      } catch (e: any) {
        console.warn('[maika] tự sửa lỗi:', e?.message)
      }
    }
    ghiNhatKy(cheDo, lichSu, triThuc, kq.text, tuSua)
    return traVe(kq)
  } catch (e: any) {
    console.error('[maika] lỗi:', e?.message)
    if (e?.status === 429) return traVe({ loi: 'Maika đang hết lượt AI miễn phí, anh/chị thử lại sau ít phút ạ.', choGiay: e.choGiay || 60 }, 429)
    return traVe({ loi: 'Maika đang bận, anh/chị thử lại sau ít phút ạ.' }, 502)
  }
})
