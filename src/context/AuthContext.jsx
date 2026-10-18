import { createContext, useContext, useMemo, useState } from 'react'
import { NGUOI_DUNG } from '../data/mockData'

const AuthContext = createContext(null)

// Cho phép đăng nhập bằng Email (@vatlieunha.vn), Username hoặc SĐT
function timNguoiDung(dinhDanh) {
  const key = dinhDanh.trim().toLowerCase()
  return NGUOI_DUNG.find(
    (u) =>
      u.email.toLowerCase() === key ||
      u.username.toLowerCase() === key ||
      u.sdt === dinhDanh.trim(),
  )
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const dangNhap = (dinhDanh, matKhau) => {
    const nd = timNguoiDung(dinhDanh)
    if (!nd) return { ok: false, loi: 'Không tìm thấy tài khoản (Email/Username/SĐT).' }
    if (nd.matKhau !== matKhau) return { ok: false, loi: 'Mật khẩu không đúng.' }
    setUser(nd)
    return { ok: true }
  }

  const dangXuat = () => setUser(null)

  const value = useMemo(
    () => ({
      user,
      dangNhap,
      dangXuat,
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
