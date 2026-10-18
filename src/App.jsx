import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import AppHeader from './components/AppHeader'
import BottomNav from './components/BottomNav'
import AutoUpdateModal from './components/AutoUpdateModal'
import { kiemTraGitHub } from './services/githubUpdater'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import LookupScreen from './screens/LookupScreen'
import KhachScreen from './screens/KhachScreen'
import ConsultScreen from './screens/ConsultScreen'
import ThemScreen from './screens/ThemScreen'
import ProductDetailScreen from './screens/ProductDetailScreen'
import IngestionScreen from './screens/IngestionScreen'
import UsersScreen from './screens/UsersScreen'

const TAB_LIST = [
  { id: 'home', nhan: 'Hôm nay', icon: 'home' },
  { id: 'lookup', nhan: 'Tra cứu', icon: 'search' },
  { id: 'khach', nhan: 'Khách', icon: 'khach' },
  { id: 'sauban', nhan: 'Sau bán', icon: 'sauban' },
  { id: 'them', nhan: 'Thêm', icon: 'them' },
]

// Màn phụ (overlay) toàn màn hình, có nút quay lại
function OverlayScreen({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-gray-50">
      <header className="flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-3">
        <button onClick={onClose} className="tap flex h-9 w-9 items-center justify-center rounded-full text-gray-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="text-sm font-bold text-gray-900">{title}</span>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">{children}</div>
    </div>
  )
}

export default function App() {
  const { user, dangXuat } = useAuth()
  const [tab, setTab] = useState('home')
  const [overlay, setOverlay] = useState(null)
  const [capNhat, setCapNhat] = useState(null)
  const [hienCapNhat, setHienCapNhat] = useState(false)
  const [coBaoMoi, setCoBaoMoi] = useState(false)

  // Tự động kiểm tra bản mới trên GitHub (khi mở app + định kỳ 30 phút)
  useEffect(() => {
    let huy = false
    const chay = () =>
      kiemTraGitHub().then((kq) => {
        if (!huy && kq.coCapNhat && kq.moi) {
          setCapNhat(kq)
          setCoBaoMoi(true)
        }
      })
    chay()
    const id = setInterval(chay, 30 * 60 * 1000)
    return () => {
      huy = true
      clearInterval(id)
    }
  }, [])

  if (!user) return <LoginScreen />

  const mo = (type, data) => setOverlay({ type, data })
  const dongOverlay = () => setOverlay(null)

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 shadow-xl">
      <AppHeader
        user={user}
        variant={tab === 'home' ? 'home' : 'default'}
        coBaoMoi={coBaoMoi}
        onBell={() => setHienCapNhat(true)}
        onAvatar={() => setTab('them')}
      />

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {tab === 'home' && <HomeScreen user={user} onTab={setTab} onMo={mo} />}
        {tab === 'lookup' && <LookupScreen onMo={mo} />}
        {tab === 'khach' && <KhachScreen />}
        {tab === 'sauban' && <ConsultScreen />}
        {tab === 'them' && (
          <ThemScreen user={user} onMo={mo} onCapNhat={() => setHienCapNhat(true)} onLogout={dangXuat} />
        )}
      </main>

      <BottomNav tabs={TAB_LIST} active={tab} onChange={setTab} />

      {/* Overlays */}
      {overlay?.type === 'detail' && <ProductDetailScreen sp={overlay.data} onClose={dongOverlay} />}
      {overlay?.type === 'ingest' && (
        <OverlayScreen title="Cổng AI — Nạp dữ liệu" onClose={dongOverlay}><IngestionScreen /></OverlayScreen>
      )}
      {overlay?.type === 'users' && (
        <OverlayScreen title="Nhân sự & Tài khoản" onClose={dongOverlay}><UsersScreen /></OverlayScreen>
      )}

      {hienCapNhat && <AutoUpdateModal capNhatSan={capNhat} onClose={() => setHienCapNhat(false)} />}
    </div>
  )
}
