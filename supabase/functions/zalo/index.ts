// ============================================================
//  HÀM MÁY CHỦ "zalo" (Supabase Edge Function) — Maika trả lời khách trên Zalo OA Vật Liệu Nhà
//  Webhook Zalo OA → kiểm chữ ký → gọi hàm "maika" (cùng bộ não với web/app: tri thức, tự soát,
//  nhật ký tự học) → gửi lại bằng API tin tư vấn của OA.
//    POST /functions/v1/zalo            ← Zalo gửi sự kiện (user_send_text, user_send_image, oa_send_*)
//    GET  /functions/v1/zalo?code=&state= ← Zalo gọi lại sau khi Admin cấp quyền (scripts/zalo-cap-quyen.mjs)
//  - Chữ ký: X-ZEvent-Signature: mac=sha256(appId + body gốc + timestamp + khoá bí mật OA)
//  - Token: access token ~25 giờ; refresh token dùng 1 lần (90 ngày) → refresh tuần tự (khoá dòng)
//  - Nhân viên trả lời tay trong OA → Maika im với khách đó TAM_DUNG_GIO giờ
//  - Zalo chỉ cho OA trả lời trong 48 giờ sau lần khách tương tác cuối — Maika trả lời ngay nên không vướng
//  Secrets: ZALO_APP_ID, ZALO_APP_SECRET, ZALO_OA_SECRET, MAIKA_KHOA_NOI (scripts/setup-supabase.mjs)
// ============================================================
import postgres from 'npm:postgres@3.4.4'

const APP_ID = Deno.env.get('ZALO_APP_ID') || ''
const APP_SECRET = Deno.env.get('ZALO_APP_SECRET') || ''
const OA_SECRET = Deno.env.get('ZALO_OA_SECRET') || ''
const KHOA_NOI = Deno.env.get('MAIKA_KHOA_NOI') || ''
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || ''
const URL_MAIKA = `${SUPABASE_URL}/functions/v1/maika`
const URL_TOKEN = 'https://oauth.zaloapp.com/v4/oa/access_token'
const URL_GUI = 'https://openapi.zalo.me/v3.0/oa/message/cs'
const TAM_DUNG_GIO = 4
const SO_TIN_NGU_CANH = 12

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2, idle_timeout: 20 })

// ---------- Chữ ký webhook ----------
async function sha256hex(s: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function bangNhau(a: string, b: string) {
  if (a.length !== b.length) return false
  let k = 0
  for (let i = 0; i < a.length; i++) k |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return k === 0
}

// ---------- Token OA ----------
async function goiToken(form: Record<string, string>) {
  const r = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: APP_SECRET },
    body: new URLSearchParams({ app_id: APP_ID, ...form }).toString(),
    signal: AbortSignal.timeout(15000),
  })
  const d = await r.json().catch(() => ({}))
  if (!d?.access_token || !d?.refresh_token) throw new Error(`Zalo token lỗi: ${JSON.stringify(d).slice(0, 200)}`)
  return d as { access_token: string; refresh_token: string; expires_in: string | number }
}

async function luuToken(d: { access_token: string; refresh_token: string; expires_in: string | number }, tx = sql) {
  const giay = Number(d.expires_in) || 90000
  await tx`
    insert into public.zalo_token (id, access_token, refresh_token, het_han, cap_nhat_luc)
    values (1, ${d.access_token}, ${d.refresh_token}, now() + make_interval(secs => ${giay}), now())
    on conflict (id) do update set access_token = excluded.access_token, refresh_token = excluded.refresh_token,
      het_han = excluded.het_han, cap_nhat_luc = now()`
}

// Refresh token chỉ dùng được 1 lần → khoá dòng để 2 tin đến cùng lúc không refresh 2 lần
async function layToken(): Promise<string> {
  return await sql.begin(async (tx: any) => {
    const [t] = await tx`select access_token, refresh_token, het_han from public.zalo_token where id = 1 for update`
    if (!t) throw new Error('Chưa cấp quyền Zalo OA — chạy node scripts/zalo-cap-quyen.mjs')
    if (new Date(t.het_han).getTime() - Date.now() > 5 * 60 * 1000) return t.access_token
    const moi = await goiToken({ refresh_token: t.refresh_token, grant_type: 'refresh_token' })
    await luuToken(moi, tx)
    return moi.access_token
  })
}

// ---------- Gửi tin ----------
// Zalo không hiển thị markdown → bỏ **, #; tin dài cắt theo dòng (giới hạn ~2000 ký tự/tin)
function choZalo(text: string) {
  const sach = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,4}\s*/gm, '').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2').trim()
  const phan: string[] = []
  let cur = ''
  for (const dong of sach.split('\n')) {
    if ((cur + '\n' + dong).length > 1900 && cur) {
      phan.push(cur)
      cur = ''
    }
    cur = cur ? cur + '\n' + dong : dong
  }
  if (cur) phan.push(cur)
  return phan.map((p) => p.slice(0, 1990))
}

async function guiTin(userId: string, text: string) {
  const token = await layToken()
  for (const doan of choZalo(text)) {
    // Ghi trước khi gửi: tiếng vọng oa_send_text của chính tin này không bị tưởng là nhân viên
    const [{ id }] = await sql`insert into public.zalo_tin (user_id, tu, text) values (${userId}, 'maika', ${doan}) returning id`
    const r = await fetch(URL_GUI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: token },
      body: JSON.stringify({ recipient: { user_id: userId }, message: { text: doan } }),
      signal: AbortSignal.timeout(15000),
    })
    const d = await r.json().catch(() => ({}))
    // Zalo báo lỗi bằng HTTP 200 + error ≠ 0
    if (d?.error !== 0) throw new Error(`Gửi Zalo lỗi ${d?.error}: ${String(d?.message || '').slice(0, 150)}`)
    if (d?.data?.message_id) await sql`update public.zalo_tin set msg_id = ${String(d.data.message_id)} where id = ${id}`.catch(() => {})
  }
}

// ---------- Ảnh khách gửi → base64 cho Maika phân tích ----------
async function taiAnh(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0]
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(mime)) return null
    const buf = new Uint8Array(await r.arrayBuffer())
    if (buf.length > 3_000_000) return null
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { mime, base64: btoa(s) }
  } catch {
    return null
  }
}

// ---------- Xử lý 1 sự kiện ----------
async function xuLy(ev: any) {
  const ten = String(ev?.event_name || '')
  const msgId = ev?.message?.msg_id ? String(ev.message.msg_id) : null

  // OA gửi đi: tin của Maika (đã ghi) hoặc nhân viên trả lời tay → Maika tạm im với khách này
  if (ten.startsWith('oa_send_')) {
    const userId = String(ev?.recipient?.id || '')
    const text = String(ev?.message?.text || '')
    if (!userId) return
    const [cuaMaika] = await sql`
      select id from public.zalo_tin where user_id = ${userId} and tu = 'maika'
        and ((${msgId}::text is not null and msg_id = ${msgId}) or (text = ${text} and luc > now() - interval '3 minutes')) limit 1`
    if (cuaMaika) return
    await sql`insert into public.zalo_tin (user_id, tu, text, msg_id) values (${userId}, 'nhan_vien', ${text}, ${msgId}) on conflict (msg_id) do nothing`
    await sql`
      insert into public.zalo_khach (user_id, tam_dung_den) values (${userId}, now() + make_interval(hours => ${TAM_DUNG_GIO}))
      on conflict (user_id) do update set tam_dung_den = excluded.tam_dung_den`
    return
  }

  if (ten !== 'user_send_text' && ten !== 'user_send_image') return
  const userId = String(ev?.sender?.id || '')
  if (!userId) return
  const text = String(ev?.message?.text || '').slice(0, 2000)
  const urlAnh = (ev?.message?.attachments || []).find((a: any) => a?.type === 'image')?.payload?.url || ''

  // Zalo gửi lại webhook khi chậm → msg_id trùng thì bỏ qua
  const moi = await sql`
    insert into public.zalo_tin (user_id, tu, text, msg_id) values (${userId}, 'khach', ${text || (urlAnh ? '(ảnh)' : '')}, ${msgId})
    on conflict (msg_id) do nothing returning id`
  if (!moi.length) return
  const [kh] = await sql`
    insert into public.zalo_khach (user_id) values (${userId})
    on conflict (user_id) do update set lan_cuoi = now() returning tam_dung_den`
  if (kh?.tam_dung_den && new Date(kh.tam_dung_den).getTime() > Date.now()) return // nhân viên đang tư vấn

  // Ngữ cảnh: các tin gần nhất trong 2 ngày (tin nhân viên coi như lời của phía cửa hàng)
  const ganDay = await sql`
    select tu, text from public.zalo_tin where user_id = ${userId} and luc > now() - interval '2 days'
    order by luc desc limit ${SO_TIN_NGU_CANH}`
  const lichSu: any[] = ganDay.reverse().map((m: any) => ({ tu: m.tu === 'khach' ? 'user' : 'maika', text: m.tu === 'khach' && m.text === '(ảnh)' ? '' : m.text, coAnh: m.text === '(ảnh)' }))
  if (urlAnh) {
    const anh = await taiAnh(urlAnh)
    if (anh) lichSu[lichSu.length - 1] = { ...lichSu[lichSu.length - 1], anh }
  }

  const r = await fetch(URL_MAIKA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}`, 'x-maika-khoa': KHOA_NOI },
    body: JSON.stringify({ cheDo: 'khach', lichSu, khachId: userId }),
    signal: AbortSignal.timeout(90000),
  })
  const d = await r.json().catch(() => ({}))
  const traLoi = d?.text || d?.loi || 'Maika đang bận một chút, anh/chị đợi ít phút hoặc gọi 0947 844 446 để kỹ thuật hỗ trợ ngay nhé ạ.'
  await guiTin(userId, traLoi)
}

// ---------- Cấp quyền (Zalo gọi lại kèm code) ----------
const trang = (noiDung: string, status = 200) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maika · Zalo OA</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px">${noiDung}</body>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

async function capQuyen(url: URL) {
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''
  const [cho] = await sql`delete from public.zalo_cap_quyen where state = ${state} and luc > now() - interval '1 day' returning verifier`
  if (!cho) return trang('<h2>Link cấp quyền đã hết hạn</h2><p>Chạy lại <code>node scripts/zalo-cap-quyen.mjs</code> để lấy link mới.</p>', 400)
  try {
    await luuToken(await goiToken({ code, grant_type: 'authorization_code', code_verifier: cho.verifier }))
  } catch (e: any) {
    console.error('[zalo] cấp quyền lỗi:', e?.message)
    return trang(`<h2>Chưa kết nối được</h2><p>${String(e?.message || e).replace(/[<>&]/g, '')}</p>`, 502)
  }
  return trang('<h2>✅ Đã kết nối Maika với Zalo OA Vật Liệu Nhà</h2><p>Từ giờ khách nhắn OA sẽ được Maika trả lời. Nhân viên trả lời tay thì Maika tự im với khách đó 4 giờ.</p>')
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'GET') return url.searchParams.get('code') ? await capQuyen(url) : new Response('ok')
  if (req.method !== 'POST') return new Response('Chỉ nhận POST', { status: 405 })

  const raw = await req.text()
  if (!raw.trim()) return new Response('ok') // Zalo thử URL khi lưu cấu hình webhook
  let ev: any
  try {
    ev = JSON.parse(raw)
  } catch {
    return new Response('ok')
  }
  const chuKy = (req.headers.get('x-zevent-signature') || '').replace(/^\s*mac\s*=\s*/i, '').trim().toLowerCase()
  const mongDoi = await sha256hex(`${APP_ID}${raw}${String(ev?.timestamp ?? '')}${OA_SECRET}`)
  if (!OA_SECRET || !bangNhau(chuKy, mongDoi)) {
    console.warn('[zalo] sai chữ ký webhook')
    return new Response('sai chữ ký', { status: 401 })
  }
  // Trả 200 ngay (Zalo chờ ngắn rồi gửi lại); Maika trả lời ở nền
  const viec = xuLy(ev).catch((e) => console.error('[zalo] xử lý lỗi:', e?.message))
  ;(globalThis as any).EdgeRuntime?.waitUntil?.(viec)
  return new Response('ok')
})
