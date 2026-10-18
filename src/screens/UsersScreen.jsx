import { useState } from 'react'
import { NGUOI_DUNG, PHIEN_DANG_NHAP, VAI_TRO } from '../data/mockData'
import { PHIEN_BAN_HIEN_TAI } from '../data/appInfo'
import AutoUpdateModal from '../components/AutoUpdateModal'

const ICON_NEN_TANG = { windows: '🖥️', ios: '📱', android: '🤖' }

export default function UsersScreen() {
  const [tab, setTab] = useState('nhansu') // nhansu | session
  const [phien, setPhien] = useState(PHIEN_DANG_NHAP)
  const [dangXuatId, setDangXuatId] = useState(null)
  const [moCapNhat, setMoCapNhat] = useState(false)

  const dangXuatTuXa = (id) => {
    setDangXuatId(id)
    setTimeout(() => {
      setPhien((ps) => ps.map((p) => (p.id === id ? { ...p, active: false, hoatDong: 'Đã đăng xuất' } : p)))
      setDangXuatId(null)
    }, 900)
  }

  const soActive = phien.filter((p) => p.active).length

  return (
    <div>
      <h2 className="mb-1 text-xl font-black text-gray-900">Quản lý Nhân sự & Phiên</h2>
      <p className="mb-4 text-xs text-gray-500">Chỉ Admin — quản lý người dùng và thiết bị đăng nhập.</p>

      {/* Cập nhật phần mềm (OTA) */}
      <button
        onClick={() => setMoCapNhat(true)}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-brand-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-400"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">🔄</span>
          <div>
            <div className="text-sm font-bold text-gray-900">Cập nhật phần mềm</div>
            <div className="text-[11px] text-gray-500">Phiên bản hiện tại v{PHIEN_BAN_HIEN_TAI}</div>
          </div>
        </div>
        <span className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">Kiểm tra</span>
      </button>

      {/* Tab switch */}
      <div className="mb-4 flex rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setTab('nhansu')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === 'nhansu' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          👥 Nhân sự ({NGUOI_DUNG.length})
        </button>
        <button
          onClick={() => setTab('session')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === 'session' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          📡 Thiết bị ({soActive})
        </button>
      </div>

      {tab === 'nhansu' && (
        <div className="space-y-3">
          {NGUOI_DUNG.map((u) => {
            const vt = VAI_TRO[u.vaiTro]
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${vt.mau} text-sm font-black text-white`}>
                  {u.hoTen.split(' ').pop()[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-900">{u.hoTen}</div>
                  <div className="truncate text-[11px] text-gray-500">{u.chucVu}</div>
                  <div className="truncate text-[11px] text-gray-400">{u.email}</div>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${vt.mau}`}>
                  {vt.ten}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'session' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-brand-50 px-4 py-2.5 text-xs font-semibold text-brand-700">
            🔒 Có {soActive} thiết bị đang hoạt động. Admin có thể đăng xuất từ xa.
          </div>
          {phien.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                p.active ? 'border-gray-100' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl">
                  {ICON_NEN_TANG[p.nenTang]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-gray-900">{p.thietBi}</span>
                    {p.active ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Online
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400">Offline</span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-gray-500">{p.nguoiDung}</div>
                  <div className="truncate text-[11px] text-gray-400">
                    {p.ip} · {p.diaDiem} · {p.hoatDong}
                  </div>
                </div>
              </div>

              {p.active && (
                <button
                  disabled={dangXuatId === p.id}
                  onClick={() => dangXuatTuXa(p.id)}
                  className="mt-3 w-full rounded-lg border border-brand-200 bg-brand-50 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                >
                  {dangXuatId === p.id ? '⏳ Đang ngắt kết nối...' : '⏏ Đăng xuất từ xa (1-Click)'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {moCapNhat && <AutoUpdateModal onClose={() => setMoCapNhat(false)} />}
    </div>
  )
}
