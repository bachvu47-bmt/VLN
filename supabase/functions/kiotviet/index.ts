// ============================================================
//  HÀM MÁY CHỦ "kiotviet" — webhook hoá đơn KiotViet → thông báo đẩy NGAY cho Admin
//  KiotViet (invoice.update, đăng ký trong scripts/kiotviet-sync.mjs) POST:
//    { Id, Attempt, Notifications: [{ Action: 'invoice.update.<retailer>', Data: [hoá đơn…] }] }
//  Chữ ký: X-Hub-Signature = HMAC SHA-256(body) với khoá bí mật KV_WEBHOOK_SECRET.
//  Tài liệu KiotViet không nói rõ khoá là chuỗi gốc hay bản Base64, kết quả hex hay Base64
//  → chấp nhận mọi tổ hợp đó (đều cần biết khoá bí mật).
//  LƯU Ý: trả 4xx là KiotViet NGỪNG gửi hẳn tới URL này → chỉ trả 401 khi sai chữ ký, mọi lỗi
//  khác vẫn trả 200 (ghi log). invoice.update bắn cả lúc tạo lẫn sửa → mỗi mã chỉ báo 1 lần.
// ============================================================
import postgres from 'npm:postgres@3.4.4'
import { guiThongBao } from '../_shared/fcm.ts'

const BI_MAT = Deno.env.get('KV_WEBHOOK_SECRET') || ''
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2, idle_timeout: 20 })

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)))
async function hmac(khoa: Uint8Array, data: string) {
  const k = await crypto.subtle.importKey('raw', khoa, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}
function bangNhau(a: string, b: string) {
  if (a.length !== b.length) return false
  let k = 0
  for (let i = 0; i < a.length; i++) k |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return k === 0
}
async function chuKyDung(raw: string, header: string) {
  if (!BI_MAT || !header) return false
  const nhan = header.replace(/^sha256=/i, '').trim()
  const khoaBase64 = btoa(BI_MAT)
  for (const khoa of [enc.encode(BI_MAT), enc.encode(khoaBase64)]) {
    const s = await hmac(khoa, raw)
    if (bangNhau(nhan.toLowerCase(), hex(s)) || bangNhau(nhan, b64(s))) return true
  }
  return false
}

const tien = (n: number) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ'

async function xuLy(ev: any) {
  for (const tb of ev?.Notifications || []) {
    if (!/^invoice\./i.test(String(tb?.Action || ''))) continue
    for (const hd of tb?.Data || []) {
      const ma = String(hd?.Code || '')
      if (!ma || Number(hd?.Status) === 2) continue // bỏ hoá đơn đã huỷ
      const moi = await sql`insert into public.hoa_don_da_bao (ma) values (${ma}) on conflict (ma) do nothing returning ma`
      if (!moi.length) continue
      const khach = hd?.CustomerName || 'Khách lẻ'
      const nv = String(hd?.SoldByName || '').replace(/^sales\d+\s*-\s*/i, '')
      const kq = await guiThongBao(sql, {
        tieuDe: `🧾 Hoá đơn mới ${ma} · ${tien(hd?.Total)}`,
        noiDung: [khach, nv && `NV ${nv}`, hd?.BranchName, hd?.StatusValue].filter(Boolean).join(' · '),
        kenh: 'hoa-don',
        duLieu: { man: 'baocao', hoaDon: ma },
      }, { chiAdmin: true })
      console.log(`[kiotviet] ${ma} → gửi ${kq.gui} máy Admin`)
    }
  }
  await sql`delete from public.hoa_don_da_bao where luc < now() - interval '90 days'`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const raw = await req.text()
  if (!raw.trim()) return new Response('ok')
  if (!(await chuKyDung(raw, req.headers.get('x-hub-signature') || ''))) {
    console.warn('[kiotviet] sai chữ ký webhook')
    return new Response('sai chữ ký', { status: 401 })
  }
  try {
    await xuLy(JSON.parse(raw))
  } catch (e: any) {
    console.error('[kiotviet] lỗi:', e?.message) // vẫn trả 200: trả 4xx thì KiotViet ngừng gửi hẳn
  }
  return new Response('ok')
})
