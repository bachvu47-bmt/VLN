import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import AppHeader from './components/AppHeader'
import BottomNav from './components/BottomNav'
import AutoUpdateModal from './components/AutoUpdateModal'
import { kiemTraGitHub } from './services/githubUpdater'
import { dongBoVaHoc } from './services/webSyncService'
import { laySanPhamWeb, sanSang as khoSanPhamSanSang } from './data/productStore'
import { hocNen } from './services/vectorStore'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import LookupScreen from './screens/LookupScreen'
import KhachScreen from './screens/KhachScreen'
import ConsultScreen from './screens/ConsultScreen'
import ThemScreen from './screens/ThemScreen'
import ProductDetailScreen from './screens/ProductDetailScreen'
import TuVanAIScreen from './screens/TuVanAIScreen'
import TinhVatTuScreen from './screens/TinhVatTuScreen'
import GuiTaiLieuScreen from './screens/GuiTaiLieuScreen'
import IngestionScreen from './screens/IngestionScreen'
import DuyetScreen from './screens/DuyetScreen'
import UsersScreen from './screens/UsersScreen'

const TAB_LIST = [
  { id: 'home', nhan: 'Hôm nay', icon: 'home' },
  { id: 'lookup', nhan: 'Tra cứu', icon: 'search' },
  { id: 'khach', nhan: 'Khách', icon: 'khach' },
  { id: 'sauban', nhan: 'Sau bán', icon: 'sauban' },
  { id: 'them', nhan: 'Thêm', icon: 'them' },
]

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

  // Tự động đồng bộ sản phẩm từ vatlieunha.vn 1 lần (khi chưa có cache) + nạp bộ nhớ Maika;
  // đã có cache thì chỉ học tiếp các mẩu tri thức còn thiếu vector.
  useEffect(() => {
    if (!user) return
    khoSanPhamSanSang.then(() => {
      if (laySanPhamWeb().length === 0) {
        dongBoVaHoc(() => {}).catch(() => {
          /* im lặng — có thể do mạng/CORS; admin bấm nút để thử lại */
        })
      } else {
        hocNen()
      }
    })
  }, [user])

  if (!user) return <LoginScreen />

  const mo = (type, data) => setOverlay({ type, data })
  const dong = () => setOverlay(null)

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
        {tab === 'home' && <HomeScreen onTab={setTab} onMo={mo} />}
        {tab === 'lookup' && <LookupScreen onMo={mo} />}
        {tab === 'khach' && <KhachScreen />}
        {tab === 'sauban' && <ConsultScreen onMo={mo} />}
        {tab === 'them' && (
          <ThemScreen user={user} onMo={mo} onCapNhat={() => setHienCapNhat(true)} onLogout={dangXuat} />
        )}
      </main>

      <BottomNav tabs={TAB_LIST} active={tab} onChange={setTab} />

      {/* Overlays toàn màn hình */}
      {overlay?.type === 'detail' && <ProductDetailScreen sp={overlay.data} onClose={dong} />}
      {overlay?.type === 'tuvanai' && <TuVanAIScreen onClose={dong} onMo={mo} />}
      {overlay?.type === 'tinhvattu' && <TinhVatTuScreen sp={overlay.data} onClose={dong} />}
      {overlay?.type === 'guitailieu' && <GuiTaiLieuScreen onClose={dong} />}
      {overlay?.type === 'ingest' && <IngestionScreen onClose={dong} />}
      {overlay?.type === 'duyet' && <DuyetScreen onClose={dong} />}
      {overlay?.type === 'users' && <UsersScreen onClose={dong} />}

      {hienCapNhat && <AutoUpdateModal capNhatSan={capNhat} onClose={() => setHienCapNhat(false)} />}
    </div>
  )
}
