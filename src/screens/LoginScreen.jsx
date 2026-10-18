import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logoRound from '../assets/logo-round.png'

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

  const nhanh = (dd) => {
    setDinhDanh(dd)
    setMatKhau('123456')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gradient-to-b from-brand-600 to-brand-700">
      {/* Khối thương hiệu đỏ */}
      <div className="relative px-6 pb-16 pt-14 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
            <img src={logoRound} alt="Vật Liệu Nhà" className="h-full w-full object-contain" />
          </span>
          <span className="text-xl font-extrabold uppercase tracking-wide">Vật Liệu Nhà</span>
        </div>
        <h2 className="mt-6 text-lg font-semibold leading-snug">
          Tri thức vững vàng
          <br />
          Bán hàng dễ dàng hơn
        </h2>
        <span className="pointer-events-none absolute right-5 top-10 text-7xl opacity-20">🏠</span>
      </div>

      {/* Sheet trắng */}
      <div className="flex-1 rounded-t-3xl bg-white px-6 pb-10 pt-7 shadow-2xl">
        <h1 className="text-2xl font-black text-gray-900">Đăng nhập</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">Dành cho nhân viên nội bộ Vật Liệu Nhà</p>

        <form onSubmit={xuLy}>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 focus-within:border-brand-500 focus-within:bg-white">
            <span className="text-gray-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 20a7 7 0 0 1 14 0" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <input
              value={dinhDanh}
              onChange={(e) => setDinhDanh(e.target.value)}
              placeholder="Email / Username / Số điện thoại"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="mb-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 focus-within:border-brand-500 focus-within:bg-white">
            <span className="text-gray-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M6 10V8a6 6 0 1 1 12 0v2 M5 10h14v10H5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <input
              type={hienMK ? 'text' : 'password'}
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              placeholder="Mật khẩu"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            <button type="button" onClick={() => setHienMK((v) => !v)} className="text-gray-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {loi && <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">⚠ {loi}</div>}

          <button
            type="submit"
            className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
          >
            Đăng nhập <span>→</span>
          </button>

          <div className="mt-4 text-center">
            <button type="button" className="text-sm font-semibold text-brand-600">Quên mật khẩu?</button>
          </div>
        </form>

        {/* Đăng nhập nhanh (demo) */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">Tài khoản demo · mật khẩu 123456</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => nhanh('khoavb')} className="tap rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-700">👑 Admin</button>
            <button type="button" onClick={() => nhanh('tuantm')} className="tap rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-700">💼 Sales</button>
            <button type="button" onClick={() => nhanh('hoalt')} className="tap rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-700">📦 Thủ kho</button>
          </div>
        </div>
      </div>
    </div>
  )
}
