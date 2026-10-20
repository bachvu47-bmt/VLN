// ============================================================
//  HÀM MÁY CHỦ "thong-bao" — các job (GitHub Actions) gọi để đẩy thông báo xuống app
//  POST { pin, tieuDe, noiDung, kenh?, duLieu?, chiAdmin? }
//  Xác thực bằng PIN Admin (GitHub Secret MAIKA_ADMIN_PIN), kiểm qua hàm _pin_dung trên DB.
//  Dùng cho: "Có bản app mới" (workflow thong-bao-cap-nhat.yml), bản tin báo cáo sáng (sau này).
// ============================================================
import postgres from 'npm:postgres@3.4.4'
import { guiThongBao } from '../_shared/fcm.ts'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2, idle_timeout: 20 })
const traVe = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return traVe({ loi: 'Chỉ nhận POST' }, 405)
  let b: any
  try {
    b = await req.json()
  } catch {
    return traVe({ loi: 'Dữ liệu không hợp lệ' }, 400)
  }
  const [{ ok }] = await sql`select public._pin_dung(${String(b?.pin || '')}) as ok`
  if (!ok) return traVe({ loi: 'Sai PIN Admin' }, 401)
  if (!b?.tieuDe) return traVe({ loi: 'Thiếu tiêu đề' }, 400)
  const kenh = ['hoa-don', 'cap-nhat', 'ban-tin', 'chung'].includes(b.kenh) ? b.kenh : 'chung'
  const duLieu = Object.fromEntries(Object.entries(b.duLieu || {}).map(([k, v]) => [k, String(v)]))
  try {
    return traVe(await guiThongBao(sql, { tieuDe: String(b.tieuDe), noiDung: String(b.noiDung || ''), kenh, duLieu }, { chiAdmin: !!b.chiAdmin }))
  } catch (e: any) {
    return traVe({ loi: e?.message || String(e) }, 502)
  }
})
