import { useState } from 'react'
import { NGUOI_DUNG, PHIEN_DANG_NHAP, VAI_TRO } from '../data/mockData'
import ScreenShell from '../components/ScreenShell'
import { useToast } from '../context/ToastContext'

const ICON_NEN_TANG = { windows: '🖥️', ios: '📱', android: '🤖' }
const QUYEN_ADMIN = ['Toàn quyền hệ thống', 'Quản lý người dùng & vai trò', 'Duyệt kiến thức kỹ thuật', 'Đăng xuất thiết bị từ xa']

function vietTat(t = '') {
  const w = t.trim().split(/\s+/)
  return (w[0][0] + (w[w.length - 1][0] || '')).toUpperCase()
}

export default function UsersScreen({ onClose }) {
  const [vai, setVai] = useState('admin')
  const [phien, setPhien] = useState(PHIEN_DANG_NHAP)
  const [dangXuatId, setDangXuatId] = useState(null)
  const toast = useToast()

  const dsVai = Object.values(VAI_TRO).map((v) => ({ ...v, so: NGUOI_DUNG.filter((u) => u.vaiTro === v.ma).length }))
  const users = NGUOI_DUNG.filter((u) => u.vaiTro === vai)

  const dangXuatTuXa = (id) => {
    setDangXuatId(id)
    setTimeout(() => {
      setPhien((ps) => ps.map((p) => (p.id === id ? { ...p, active: false, hoatDong: 'Đã đăng xuất' } : p)))
      setDangXuatId(null)
      toast('Đã đăng xuất thiết bị từ xa', 'success')
    }, 800)
  }

  const right = (
    <button onClick={() => toast('Đã gửi lời mời người dùng mới', 'info')} className="tap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">
      + Mời
    </button>
  )

  return (
    <ScreenShell title="Nhân sự & tài khoản" onClose={onClose} right={right}>
      <h2 className="text-2xl font-black text-gray-900">Nhân sự và tài khoản</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Quản lý người dùng, vai trò và thiết bị đăng nhập</p>

      {/* Tab vai trò */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {dsVai.map((v) => (
          <button key={v.ma} onClick={() => setVai(v.ma)}
            className={`tap flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${vai === v.ma ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {v.ten} ({v.so})
          </button>
        ))}
      </div>

      {/* Danh sách user */}
      <div className="mb-6 space-y-2">
        {users.map((u) => {
          const vt = VAI_TRO[u.vaiTro]
          return (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${vt.mau} text-xs font-bold text-white`}>{vietTat(u.hoTen)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-gray-900">{u.hoTen}</div>
                <div className="truncate text-[11px] text-gray-500">{u.email}</div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Hoạt động
              </div>
            </div>
          )
        })}
      </div>

      {/* Phiên đăng nhập */}
      <div className="mb-6">
        <div className="mb-2 text-sm font-black text-gray-900">Phiên đăng nhập đang hoạt động</div>
        <div className="space-y-2">
          {phien.map((p) => (
            <div key={p.id} className={`rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg">{ICON_NEN_TANG[p.nenTang]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-900">{p.thietBi}</div>
                  <div className="truncate text-[11px] text-gray-500">{p.nguoiDung} · {p.ip}</div>
                  <div className="text-[11px] text-gray-400">{p.hoatDong}</div>
                </div>
                {p.active && (
                  <button disabled={dangXuatId === p.id} onClick={() => dangXuatTuXa(p.id)}
                    className="tap flex-shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-700 disabled:opacity-50">
                    {dangXuatId === p.id ? '...' : 'Đăng xuất'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vai trò & quyền */}
      <div>
        <div className="mb-2 text-sm font-black text-gray-900">Vai trò và quyền truy cập</div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">Quản trị viên (Admin)</span>
          </div>
          <ul className="space-y-1.5">
            {QUYEN_ADMIN.map((q) => (
              <li key={q} className="flex items-center gap-2 text-sm text-gray-600"><span className="text-green-600">✓</span>{q}</li>
            ))}
          </ul>
        </div>
      </div>
    </ScreenShell>
  )
}
