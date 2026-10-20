// ============================================================
//  KHO CHUNG — bộ nhớ Maika dùng chung giữa mọi máy (Supabase REST)
//  Không cấu hình VITE_SUPABASE_URL/KEY → app chạy chế độ lưu từng máy.
//  Key public chỉ ĐỌC được; ghi qua RPC (đề xuất: ai cũng gửi; admin_*: cần PIN).
// ============================================================
const URL_KHO = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KEY_KHO = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const LS_PIN = 'vln_admin_pin'

export function coKhoChung() {
  return !!(URL_KHO && KEY_KHO)
}

// ---- PIN Admin (ghi nhớ trên máy Admin sau khi xác thực với máy chủ) ----
export function layPinAdmin() {
  try {
    return localStorage.getItem(LS_PIN) || ''
  } catch {
    return ''
  }
}

export async function luuPinAdmin(pin) {
  const dung = await rpc('kiem_tra_pin', { p_pin: pin })
  if (!dung) throw new Error('Sai mã PIN Admin')
  try {
    localStorage.setItem(LS_PIN, pin)
  } catch {
    /* bỏ qua */
  }
  // Máy đã đăng ký thông báo đẩy trước khi nhập PIN → đăng ký lại để nhận tin chỉ dành cho Admin
  const token = docLS(LS_FCM)
  if (token) dangKyThietBi(token, docLS(LS_FCM_TEN)).catch(() => {})
}

export const LS_FCM = 'vln_fcm_token'
export const LS_FCM_TEN = 'vln_fcm_ten'
function docLS(k) {
  try {
    return localStorage.getItem(k) || ''
  } catch {
    return ''
  }
}

export function xoaPinAdmin() {
  try {
    localStorage.removeItem(LS_PIN)
  } catch {
    /* bỏ qua */
  }
}

function canPin() {
  const pin = layPinAdmin()
  if (!pin) throw new Error('Máy này chưa nhập PIN Admin (Tài khoản → PIN Admin kho chung)')
  return pin
}

// ---- HTTP ----
async function goi(duongDan, { method = 'GET', body } = {}) {
  const res = await fetch(`${URL_KHO}/rest/v1/${duongDan}`, {
    method,
    headers: { apikey: KEY_KHO, Authorization: `Bearer ${KEY_KHO}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    let msg = t
    try {
      msg = JSON.parse(t).message || t
    } catch {
      /* giữ nguyên */
    }
    if (/Sai mã PIN/.test(msg)) xoaPinAdmin() // PIN đã bị đổi trên máy chủ → bắt nhập lại
    throw new Error(`Kho chung HTTP ${res.status}: ${String(msg).slice(0, 200)}`)
  }
  const t = await res.text()
  return t ? JSON.parse(t) : null
}

const rpc = (ten, thamSo) => goi(`rpc/${ten}`, { method: 'POST', body: thamSo })

// ---- Thông báo đẩy: đăng ký token FCM của máy (kèm PIN Admin nếu có → nhận cả tin chỉ dành cho Admin) ----
export function dangKyThietBi(token, ten, nenTang = 'android') {
  return rpc('dang_ky_thiet_bi', { p_token: token, p_ten: ten, p_nen_tang: nenTang, p_pin: layPinAdmin() || null })
}

// ---- Chuyển đổi bản ghi máy chủ (snake_case) ↔ app (camelCase) ----
export function tuMayChu(r) {
  return {
    id: r.id,
    loai: r.loai,
    trangThai: r.trang_thai,
    tieuDe: r.tieu_de,
    noiDung: r.noi_dung,
    cauHoi: r.cau_hoi || undefined,
    traLoiSai: r.tra_loi_sai || undefined,
    traLoiDung: r.tra_loi_dung || undefined,
    tags: r.tags || [],
    nguon: r.nguon || '',
    spId: r.sp_id || undefined,
    hash: r.hash || undefined,
    nguoiTao: r.nguoi_tao || '',
    duyetBoi: r.duyet_boi || undefined,
    taoLuc: Date.parse(r.tao_luc),
    duyetLuc: r.duyet_luc ? Date.parse(r.duyet_luc) : undefined,
    coVec: !!r.co_vector,
    daXoa: !!r.da_xoa,
    capNhatLuc: r.cap_nhat_luc,
  }
}

function lenMayChu(r) {
  return {
    id: r.id,
    loai: r.loai,
    trang_thai: r.trangThai,
    tieu_de: r.tieuDe,
    noi_dung: r.noiDung,
    cau_hoi: r.cauHoi ?? null,
    tra_loi_sai: r.traLoiSai ?? null,
    tra_loi_dung: r.traLoiDung ?? null,
    tags: r.tags || [],
    nguon: r.nguon || null,
    sp_id: r.spId ?? null,
    hash: r.hash ?? null,
    nguoi_tao: r.nguoiTao || null,
    duyet_boi: r.duyetBoi ?? null,
    tao_luc: r.taoLuc ? new Date(r.taoLuc).toISOString() : null,
    duyet_luc: r.duyetLuc ? new Date(r.duyetLuc).toISOString() : null,
    embedding: r.vec ? Array.from(r.vec) : null,
  }
}

// ============================================================
//  ĐỌC
// ============================================================
const COT = 'id,loai,trang_thai,tieu_de,noi_dung,cau_hoi,tra_loi_sai,tra_loi_dung,tags,nguon,sp_id,hash,nguoi_tao,duyet_boi,tao_luc,duyet_luc,cap_nhat_luc,da_xoa,co_vector'

// Kéo mọi bản ghi thay đổi sau mốc `tu` (ISO) — phân trang 1000/lần
export async function keoThayDoi(tu, onTrang) {
  let moc = tu || '1970-01-01T00:00:00Z'
  for (;;) {
    const rows = await goi(`tri_thuc?select=${COT}&cap_nhat_luc=gt.${encodeURIComponent(moc)}&order=cap_nhat_luc.asc&limit=1000`)
    if (!rows.length) return moc
    await onTrang(rows.map(tuMayChu))
    moc = rows[rows.length - 1].cap_nhat_luc
    if (rows.length < 1000) return moc
  }
}

// Tìm kiếm vector trên máy chủ (pgvector)
export async function timTrenMayChu(vec, k) {
  const rows = await rpc('tim_tri_thuc', { p_embedding: `[${Array.from(vec).join(',')}]`, p_k: k, p_nguong: 0.55 })
  return rows.map((r) => ({ id: r.id, loai: r.loai, tieuDe: r.tieu_de, noiDung: r.noi_dung, nguon: r.nguon, spId: r.sp_id, diem: r.diem }))
}

// ============================================================
//  GHI
// ============================================================
export function guiDeXuat(r) {
  return rpc('de_xuat_sua_sai', {
    p_id: r.id,
    p_cau_hoi: r.cauHoi,
    p_tra_loi_sai: r.traLoiSai || '',
    p_tra_loi_dung: r.traLoiDung,
    p_nguoi: r.nguoiTao || '',
  })
}

export async function adminGhi(recs) {
  const pin = canPin()
  for (let i = 0; i < recs.length; i += 200) {
    await rpc('admin_ghi', { p_pin: pin, p_rows: recs.slice(i, i + 200).map(lenMayChu) })
  }
}

export function adminGanVector(cap) {
  return rpc('admin_gan_vector', { p_pin: canPin(), p_rows: cap.map(({ id, vec }) => ({ id, embedding: Array.from(vec) })) })
}

export async function adminXoa(ids) {
  const pin = canPin()
  for (let i = 0; i < ids.length; i += 500) {
    await rpc('admin_xoa', { p_pin: pin, p_ids: ids.slice(i, i + 500) })
  }
}
