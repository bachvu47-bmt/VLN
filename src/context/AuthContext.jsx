import { createContext, useContext, useMemo, useState } from 'react'
import { NGUOI_DUNG } from '../data/mockData'

const AuthContext = createContext(null)

const LS_USER = 'vln_user_id' // ghi nhớ đăng nhập (auto-login)
const LS_PW = 'vln_pw_overrides' // mật khẩu đã đổi: { userId: matKhauMoi }

// ---- localStorage helpers (an toàn khi không có window) ----
function lsGet(key, mac = null) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? mac : v
  } catch {
    return mac
  }
}
function lsGetJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}
function lsSet(key, val) {
  try {
    localStorage.setItem(key, val)
  } catch {
    /* bỏ qua */
  }
}
function lsDel(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* bỏ qua */
  }
}

// Mật khẩu hiệu lực của 1 user (ưu tiên mật khẩu đã đổi)
function matKhauHienLuc(u) {
  const overrides = lsGetJSON(LS_PW)
  return overrides[u.id] || u.matKhau
}

// Đăng nhập bằng Email (@vatlieunha.vn), Username hoặc SĐT
function timNguoiDung(dinhDanh) {
  const key = dinhDanh.trim().toLowerCase()
  return NGUOI_DUNG.find(
    (u) =>
      u.email.toLowerCase() === key ||
      u.emailPhu?.some((e) => e.toLowerCase() === key) ||
      u.username.toLowerCase() === key ||
      u.sdt === dinhDanh.trim(),
  )
}

export function AuthProvider({ children }) {
  // Tự khôi phục phiên đã ghi nhớ (auto-login giống Zalo)
  const [user, setUser] = useState(() => {
    const id = lsGet(LS_USER)
    return (id && NGUOI_DUNG.find((u) => u.id === id)) || null
  })

  const dangNhap = (dinhDanh, matKhau, ghiNho = true) => {
    const nd = timNguoiDung(dinhDanh)
    if (!nd) return { ok: false, loi: 'Không tìm thấy tài khoản (Email/Username/SĐT).' }
    if (matKhauHienLuc(nd) !== matKhau) return { ok: false, loi: 'Mật khẩu không đúng.' }
    setUser(nd)
    if (ghiNho) lsSet(LS_USER, nd.id)
    return { ok: true }
  }

  const dangXuat = () => {
    setUser(null)
    lsDel(LS_USER) // thoát hẳn — xoá ghi nhớ
  }

  // Đổi mật khẩu (lưu override vào localStorage)
  const doiMatKhau = (matKhauCu, matKhauMoi) => {
    if (!user) return { ok: false, loi: 'Chưa đăng nhập.' }
    if (matKhauHienLuc(user) !== matKhauCu) return { ok: false, loi: 'Mật khẩu cũ không đúng.' }
    if (!matKhauMoi || matKhauMoi.length < 6) return { ok: false, loi: 'Mật khẩu mới tối thiểu 6 ký tự.' }
    const overrides = lsGetJSON(LS_PW)
    overrides[user.id] = matKhauMoi
    lsSet(LS_PW, JSON.stringify(overrides))
    return { ok: true }
  }

  const value = useMemo(
    () => ({
      user,
      dangNhap,
      dangXuat,
      doiMatKhau,
      laAdmin: user?.vaiTro === 'admin',
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng trong <AuthProvider>')
  return ctx
}
