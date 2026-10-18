import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { VAI_TRO } from './data/mockData'
import BottomNav from './components/BottomNav'
import AutoUpdateModal from './components/AutoUpdateModal'
import logoBlock from './assets/logo-block.svg'
import { kiemTraGitHub } from './services/githubUpdater'
import LoginScreen from './screens/LoginScreen'
import LookupScreen from './screens/LookupScreen'
import IngestionScreen from './screens/IngestionScreen'
import ConsultScreen from './screens/ConsultScreen'
import UsersScreen from './screens/UsersScreen'

// Khai báo các tab. `quyen` = danh sách vai trò được phép truy cập.
const TABS = [
  { id: 'lookup', nhan: 'Tra cứu', icon: '📚', quyen: ['admin', 'sales', 'thukho'], comp: LookupScreen },
  { id: 'consult', nhan: 'Tư vấn', icon: '💬', quyen: ['admin', 'sales'], comp: ConsultScreen },
  { id: 'ingestion', nhan: 'AI Nạp liệu', icon: '🤖', quyen: ['admin'], comp: IngestionScreen },
  { id: 'users', nhan: 'Nhân sự', icon: '👥', quyen: ['admin'], comp: UsersScreen },
]

export default function App() {
  const { user, dangXuat } = useAuth()
  const [active, setActive] = useState('lookup')
  const [capNhatSan, setCapNhatSan] = useState(null) // bản mới phát hiện khi khởi động
  const [hienCapNhat, setHienCapNhat] = useState(false)

  // Tự động kiểm tra GitHub Releases khi ứng dụng khởi động
  useEffect(() => {
    let huy = false
    kiemTraGitHub().then((kq) => {
      if (!huy && kq.coCapNhat && kq.moi) {
        setCapNhatSan(kq)
        setHienCapNhat(true)
      }
    })
    return () => {
      huy = true
    }
  }, [])

  if (!user) return <LoginScreen />

  const tabsCho = TABS.filter((t) => t.quyen.includes(user.vaiTro))
  const tabHienTai = tabsCho.find((t) => t.id === active) ?? tabsCho[0]
  const ManHinh = tabHienTai.comp
  const vt = VAI_TRO[user.vaiTro]

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 shadow-xl">
      {/* Thanh tiêu đề (App bar) */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white p-1">
            <img src={logoBlock} alt="Vật Liệu Nhà" className="h-full w-full object-contain" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold">Khôi Anh Home Center</div>
            <div className="text-[10px] text-brand-100">Hệ thống bán hàng nội bộ</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right leading-tight">
            <div className="text-xs font-semibold">{user.hoTen}</div>
            <div className="text-[10px]">
              <span className={`rounded px-1.5 py-0.5 ${vt.mau} text-white`}>{vt.ten}</span>
            </div>
          </div>
          <button
            onClick={dangXuat}
            title="Đăng xuất"
            className="rounded-lg bg-brand-700 px-2 py-1.5 text-xs font-semibold transition hover:bg-brand-800"
          >
            Thoát
          </button>
        </div>
      </header>

      {/* Nội dung màn hình */}
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <ManHinh />
      </main>

      <BottomNav tabs={tabsCho} active={tabHienTai.id} onChange={setActive} />

      {/* Popup cập nhật tự bật khi khởi động nếu có bản mới trên GitHub */}
      {hienCapNhat && capNhatSan && (
        <AutoUpdateModal capNhatSan={capNhatSan} onClose={() => setHienCapNhat(false)} />
      )}
    </div>
  )
}
