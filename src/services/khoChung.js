// ============================================================
//  KHO CHUNG — bộ nhớ Maika dùng chung giữa mọi máy (Supabase REST)
//  Không cấu hình VITE_SUPABASE_URL/KEY → app chạy chế độ lưu từng máy.
//  Key public chỉ ĐỌC được; ghi qua RPC (đề xuất: ai cũng gửi; admin_*: cần quyền Admin).
//  Quyền Admin trên máy chủ = phiên đăng nhập email Admin (mã 6 số gửi qua email, nhập 1 lần/máy)
//  HOẶC PIN Admin (dự phòng; GitHub Actions/script dùng PIN).
// ============================================================
const URL_KHO = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const KEY_KHO = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const LS_PIN = 'vln_admin_pin'
const LS_PHIEN = 'vln_phien_admin' // { access_token, refresh_token, het_han, email }

// Email Admin mặc định — máy chủ kiểm tra lại đúng email này (schema.sql: _la_email_admin)
export const EMAIL_ADMIN = 'bachvu47@gmail.com'

export function coKhoChung() {
  return !!(URL_KHO && KEY_KHO)
}

// ---- Phiên đăng nhập email Admin (Supabase Auth, mã OTP qua email) ----
function docPhien() {
  try {
    return JSON.parse(localStorage.getItem(LS_PHIEN) || 'null')
  } catch {
    return null
  }
}
function ghiPhien(p) {
  try {
    if (p) localStorage.setItem(LS_PHIEN, JSON.stringify(p))
    else localStorage.removeItem(LS_PHIEN)
  } catch {
    /* bỏ qua */
  }
}
const tuPhanHoi = (j) => ({ access_token: j.access_token, refresh_token: j.refresh_token, het_han: Date.now() + (j.expires_in || 3600) * 1000, email: j.user?.email || EMAIL_ADMIN })

export function coPhienAdmin() {
  return !!docPhien()?.refresh_token
}
// Máy này ghi được kho chung (phiên email Admin hoặc PIN)
export function coQuyenAdmin() {
  return coPhienAdmin() || !!layPinAdmin()
}

async function auth(duongDan, body) {
  const res = await fetch(`${URL_KHO}/auth/v1/${duongDan}`, {
    method: 'POST',
    headers: { apikey: KEY_KHO, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.msg || j.error_description || j.message || `HTTP ${res.status}`)
  return j
}

// Máy chủ gửi được email có MÃ 6 số chưa (setup-supabase đặt cau_hinh.dang_nhap_email; gói Free không có SMTP riêng → '0')
let _coEmail = null
export async function coDangNhapEmail() {
  if (_coEmail !== null) return _coEmail
  try {
    const r = await goi('cau_hinh?select=gia_tri&khoa=eq.dang_nhap_email')
    _coEmail = r?.[0]?.gia_tri === '1'
  } catch {
    _coEmail = false
  }
  return _coEmail
}

// Bước 1: gửi mã 6 số tới email Admin (không tạo tài khoản mới — máy chủ đã tạo sẵn cho email này)
export async function guiMaEmailAdmin() {
  try {
    await auth('otp', { email: EMAIL_ADMIN, create_user: false })
  } catch (e) {
    if (/rate|seconds|giây/i.test(e.message)) throw new Error('Vừa gửi mã rồi — đợi khoảng 1 phút rồi gửi lại')
    throw new Error('Không gửi được mã: ' + e.message)
  }
}

// Bước 2: nhập mã → phiên lưu trên máy, tự gia hạn → không hỏi lại
export async function xacMinhMaEmailAdmin(ma) {
  let j
  try {
    j = await auth('verify', { type: 'email', email: EMAIL_ADMIN, token: String(ma).trim() })
  } catch {
    throw new Error('Mã không đúng hoặc đã hết hạn — gửi mã mới')
  }
  ghiPhien(tuPhanHoi(j))
  const laAdmin = await rpc('la_admin', {}).catch(() => false)
  if (!laAdmin) {
    ghiPhien(null)
    throw new Error('Máy chủ chưa nhận email này là Admin (cần chạy lại setup-supabase)')
  }
  const token = docLS(LS_FCM)
  if (token) dangKyThietBi(token, docLS(LS_FCM_TEN)).catch(() => {}) // nhận cả thông báo chỉ dành cho Admin
}

export function dangXuatEmailAdmin() {
  ghiPhien(null)
}

// Token phiên còn hạn (gia hạn trước 2 phút); 1 lần gia hạn tại một thời điểm (refresh token dùng 1 lần)
let _dangGiaHan = null
async function tokenPhien() {
  const p = docPhien()
  if (!p?.refresh_token) return ''
  if (p.het_han - Date.now() > 120000) return p.access_token
  _dangGiaHan ||= auth('token?grant_type=refresh_token', { refresh_token: p.refresh_token })
    .then((j) => {
      ghiPhien(tuPhanHoi(j))
      return j.access_token
    })
    .catch((e) => {
      // Phiên bị thu hồi / refresh token hỏng → bỏ phiên, máy quay về chế độ chỉ đọc; mất mạng → giữ để thử lại
      if (!/fetch|network|Failed/i.test(e.message)) ghiPhien(null)
      return ''
    })
    .finally(() => {
      _dangGiaHan = null
    })
  return _dangGiaHan
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

// PIN gửi kèm lệnh admin_* — có phiên email Admin thì máy chủ không cần PIN ('' là đủ)
function canPin() {
  const pin = layPinAdmin()
  if (!pin && !coPhienAdmin()) throw new Error(`Máy này chưa xác thực Admin — đăng nhập email ${EMAIL_ADMIN} (Tài khoản → Kho tri thức chung)`)
  return pin
}

// ---- HTTP ----
async function goi(duongDan, { method = 'GET', body } = {}, lanThu = 0) {
  const token = await tokenPhien()
  const res = await fetch(`${URL_KHO}/rest/v1/${duongDan}`, {
    method,
    headers: { apikey: KEY_KHO, Authorization: `Bearer ${token || KEY_KHO}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  // Token phiên bị máy chủ từ chối (hết hạn sớm / bị thu hồi) → bỏ phiên, thử lại bằng key public
  if (res.status === 401 && token && lanThu === 0) {
    ghiPhien(null)
    return goi(duongDan, { method, body }, 1)
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    let msg = t
    try {
      msg = JSON.parse(t).message || t
    } catch {
      /* giữ nguyên */
    }
    if (/Sai mã PIN/.test(msg)) {
      xoaPinAdmin() // PIN đã bị đổi trên máy chủ → bắt nhập lại
      if (!coPhienAdmin()) msg = `Máy này chưa xác thực Admin — đăng nhập email ${EMAIL_ADMIN}`
    }
    throw new Error(`Kho chung HTTP ${res.status}: ${String(msg).slice(0, 200)}`)
  }
  const t = await res.text()
  return t ? JSON.parse(t) : null
}

const rpc = (ten, thamSo) => goi(`rpc/${ten}`, { method: 'POST', body: thamSo })

// ---- Ảnh sản phẩm Admin đặt: mọi máy đọc, chỉ Admin ghi (url rỗng = xoá) ----
export async function docAnhSanPham() {
  return (await goi('anh_san_pham?select=khoa,url&limit=5000')) || []
}
export async function adminDatAnh(khoa, url) {
  await rpc('admin_dat_anh', { p_pin: canPin() || null, p_khoa: khoa, p_url: url || '' })
}

// ---- KiotViet phần riêng tư (khách hàng, hoá đơn, công nợ) — máy chủ chỉ trả cho Admin ----
// → base64(gzip(JSON)) hoặc null nếu chưa có bản đồng bộ nào
export async function docKiotVietRieng() {
  const rows = await rpc('admin_doc_kiotviet', { p_pin: canPin() || null })
  return rows?.[0]?.du_lieu || null
}

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
