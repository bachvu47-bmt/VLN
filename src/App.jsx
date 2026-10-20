import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import AppHeader from './components/AppHeader'
import BottomNav from './components/BottomNav'
import AutoUpdateModal from './components/AutoUpdateModal'
import { kiemTraGitHub } from './services/githubUpdater'
import { dongBoVaHoc } from './services/webSyncService'
import { laySanPhamWeb, sanSang as khoSanPhamSanSang } from './data/productStore'
import { datQuyenHocWeb, hocNen } from './services/vectorStore'
import { batDauTheoDoi, dongBoLichNhac, xinQuyenThongBao } from './services/troLyChuDong'
import { useToast } from './context/ToastContext'
import { napKiotViet } from './services/kiotViet'
import { napTheCao } from './services/triThucCao'
import { batDauJobFollowUp, SO_NGAY_FOLLOW_UP } from './services/followUpTuDong'
import { batDauThongBaoDay } from './services/thongBaoDay'
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
import BaoCaoScreen from './screens/BaoCaoScreen'

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
  const toast = useToast()

  // Trợ lý chủ động: xin quyền thông báo, đặt lại lịch nhắc (Android), đếm việc đến hạn khi app mở
  useEffect(() => {
    if (!user) return
    xinQuyenThongBao()
    dongBoLichNhac(user.id)
    const dung = batDauTheoDoi(user.id, (v) => {
      toast(`⏰ Maika nhắc: ${v.tieuDe}`, 'info')
      setTab('home')
    })
    // Android: chạm vào thông báo nhắc việc → mở màn Hôm nay
    let listener
    if (window.Capacitor?.isNativePlatform?.()) {
      import('@capacitor/local-notifications')
        .then(({ LocalNotifications }) => LocalNotifications.addListener('localNotificationActionPerformed', () => setTab('home')))
        .then((l) => (listener = l))
        .catch(() => {})
    }
    return () => {
      dung()
      listener?.remove?.()
    }
  }, [user, toast])

  // Thông báo đẩy (Android): hoá đơn KiotViet mới (Admin), có bản app mới — chạm vào mở đúng màn
  useEffect(() => {
    if (!user) return
    let go = () => {}
    batDauThongBaoDay(user, {
      onMo: (d) => {
        if (d.man === 'cap-nhat') setHienCapNhat(true)
        else if (d.man === 'baocao' && user.vaiTro === 'admin') setOverlay({ type: 'baocao' })
        else setTab('home')
      },
      onDen: (n) => toast(`${n.title || 'Maika'}${n.body ? ' — ' + n.body : ''}`, 'info'),
    })
      .then((f) => (go = f))
      .catch((e) => console.warn('[Thông báo đẩy]', e.message))
    return () => go()
  }, [user, toast])

  // Proactive: báo giá trên Google Sheet quá 2 ngày chưa chốt → Maika tự tạo việc follow-up cho sales phụ trách
  useEffect(() => {
    if (!user) return
    return batDauJobFollowUp(user, (ds) => {
      toast(`📑 Maika vừa thêm ${ds.length} việc follow-up báo giá (quá ${SO_NGAY_FOLLOW_UP} ngày chưa chốt)`, 'info')
      setTab('home')
    })
  }, [user, toast])

  // KiotViet (bản sao mã hoá, GitHub Actions đồng bộ ~30 phút): nạp khi đăng nhập + làm mới 15 phút/lần
  useEffect(() => {
    if (!user) return
    const nap = () => napKiotViet().catch((e) => console.warn('[KiotViet]', e.message))
    nap()
    const id = setInterval(nap, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [user])

  // Admin: nhận thẻ tri thức Maika cào từ nhà sản xuất (2 lần/ngày) vào hàng chờ duyệt
  useEffect(() => {
    if (user?.vaiTro !== 'admin') return
    const nap = () =>
      napTheCao()
        .then((n) => n && toast(`📘 Maika vừa cào ${n} tri thức mới từ nhà sản xuất — chờ bạn duyệt`, 'info'))
        .catch((e) => console.warn('[Tri thức cào]', e.message))
    nap()
    const id = setInterval(nap, 3 * 3600 * 1000)
    return () => clearInterval(id)
  }, [user, toast])

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
    datQuyenHocWeb(user.vaiTro === 'admin') // chỉ máy Admin tốn quota embedding cho dữ liệu web
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
      {overlay?.type === 'baocao' && <BaoCaoScreen onClose={dong} />}

      {hienCapNhat && <AutoUpdateModal capNhatSan={capNhat} onClose={() => setHienCapNhat(false)} />}
    </div>
  )
}
