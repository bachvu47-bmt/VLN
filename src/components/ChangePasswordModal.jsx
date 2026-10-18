import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

function OManhKhau({ label, value, onChange, placeholder }) {
  const [hien, setHien] = useState(false)
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-gray-600">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 focus-within:border-brand-500 focus-within:bg-white">
        <span className="text-gray-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10V8a6 6 0 1 1 12 0v2 M5 10h14v10H5z" /></svg>
        </span>
        <input
          type={hien ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        <button type="button" onClick={() => setHien((v) => !v)} className="text-gray-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg>
        </button>
      </div>
    </div>
  )
}

export default function ChangePasswordModal({ onClose }) {
  const { doiMatKhau } = useAuth()
  const toast = useToast()
  const [cu, setCu] = useState('')
  const [moi, setMoi] = useState('')
  const [xacNhan, setXacNhan] = useState('')
  const [loi, setLoi] = useState('')
  const [xong, setXong] = useState(false)

  const luu = () => {
    setLoi('')
    if (!cu || !moi || !xacNhan) return setLoi('Vui lòng nhập đầy đủ thông tin.')
    if (moi !== xacNhan) return setLoi('Xác nhận mật khẩu mới không khớp.')
    const kq = doiMatKhau(cu, moi)
    if (!kq.ok) return setLoi(kq.loi)
    setXong(true)
    toast('Đổi mật khẩu thành công!', 'success')
    setTimeout(onClose, 1400)
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="anim-sheet w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-900">Đổi mật khẩu</h3>
            <p className="text-xs text-gray-500">Bảo mật tài khoản nội bộ</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-500">✕</button>
        </div>

        {xong ? (
          <div className="anim-pop rounded-2xl border border-green-200 bg-green-50 py-8 text-center">
            <div className="text-4xl">✅</div>
            <div className="mt-2 text-sm font-bold text-green-700">Đổi mật khẩu thành công!</div>
            <div className="mt-1 text-xs text-green-600">Lần đăng nhập tới dùng mật khẩu mới.</div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <OManhKhau label="Mật khẩu cũ" value={cu} onChange={setCu} placeholder="Nhập mật khẩu hiện tại" />
              <OManhKhau label="Mật khẩu mới" value={moi} onChange={setMoi} placeholder="Tối thiểu 6 ký tự" />
              <OManhKhau label="Xác nhận mật khẩu mới" value={xacNhan} onChange={setXacNhan} placeholder="Nhập lại mật khẩu mới" />
            </div>

            {loi && <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">⚠ {loi}</div>}

            <button onClick={luu} className="tap mt-4 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700">
              Cập nhật mật khẩu
            </button>
          </>
        )}
      </div>
    </div>
  )
}
