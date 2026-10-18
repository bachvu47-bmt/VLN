import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logoBlock from '../assets/logo-block.svg'

export default function LoginScreen() {
  const { dangNhap } = useAuth()
  const [dinhDanh, setDinhDanh] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [hienMK, setHienMK] = useState(false)
  const [loi, setLoi] = useState('')

  const xuLy = (e) => {
    e.preventDefault()
    setLoi('')
    if (!dinhDanh || !matKhau) return setLoi('Vui lòng nhập đầy đủ thông tin.')
    const kq = dangNhap(dinhDanh, matKhau)
    if (!kq.ok) setLoi(kq.loi)
  }

  const dangNhapNhanh = (dd) => {
    setDinhDanh(dd)
    setMatKhau('123456')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 text-center text-white">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
            <img src={logoBlock} alt="Vật Liệu Nhà" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight">Khôi Anh Home Center</h1>
          <p className="text-sm text-brand-100">Vật Liệu Nhà · Hệ thống bán hàng nội bộ</p>
        </div>

        {/* Form */}
        <form onSubmit={xuLy} className="rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Đăng nhập</h2>
          <p className="mb-4 text-xs text-gray-500">
            Dùng Email <b>@vatlieunha.vn</b>, Username hoặc Số điện thoại.
          </p>

          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Email / Username / SĐT
          </label>
          <input
            value={dinhDanh}
            onChange={(e) => setDinhDanh(e.target.value)}
            placeholder="vd: khoa.vb@vatlieunha.vn"
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />

          <label className="mb-1 block text-xs font-semibold text-gray-600">Mật khẩu</label>
          <div className="relative mb-2">
            <input
              type={hienMK ? 'text' : 'password'}
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-12 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <button
              type="button"
              onClick={() => setHienMK((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-600"
            >
              {hienMK ? 'Ẩn' : 'Hiện'}
            </button>
          </div>

          {loi && (
            <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
              ⚠ {loi}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.99]"
          >
            Đăng nhập
          </button>

          {/* Đăng nhập nhanh (demo) */}
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Tài khoản demo (mật khẩu: 123456)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => dangNhapNhanh('khoavb')} className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600">
                👑 Admin
              </button>
              <button type="button" onClick={() => dangNhapNhanh('linhtm')} className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600">
                💼 Sales
              </button>
              <button type="button" onClick={() => dangNhapNhanh('hoalt')} className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600">
                📦 Thủ kho
              </button>
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] text-brand-100">
          © 2026 Khôi Anh Home Center · Bảo mật nội bộ
        </p>
      </div>
    </div>
  )
}
