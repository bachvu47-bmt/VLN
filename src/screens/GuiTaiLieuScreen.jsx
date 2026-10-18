import { useState } from 'react'
import { KHACH_HANG } from '../data/mockData'
import ScreenShell from '../components/ScreenShell'
import { useToast } from '../context/ToastContext'

const TAI_LIEU = [
  { id: 't1', ten: 'Hướng dẫn thi công tấm xi măng', loai: 'pdf', meta: 'PDF · 2.4 MB', icon: '📄' },
  { id: 't2', ten: 'Hình ảnh công trình thực tế', loai: 'img', meta: '6 ảnh · JPG', icon: '🖼️' },
  { id: 't3', ten: 'Video hướng dẫn lắp đặt thạch cao', loai: 'video', meta: 'MP4 · 03:28', icon: '🎬' },
  { id: 't4', ten: 'Catalogue tấm xi măng', loai: 'pdf', meta: 'PDF · 3.1 MB', icon: '📄' },
]
const TABS = [
  { ma: 'all', ten: 'Tất cả' },
  { ma: 'img', ten: 'Hình ảnh' },
  { ma: 'video', ten: 'Video' },
  { ma: 'pdf', ten: 'PDF' },
]

export default function GuiTaiLieuScreen({ onClose }) {
  const kh = KHACH_HANG[0]
  const [tab, setTab] = useState('all')
  const [chon, setChon] = useState({ t1: true })
  const toast = useToast()

  const ds = TAI_LIEU.filter((t) => tab === 'all' || t.loai === tab)
  const soChon = Object.values(chon).filter(Boolean).length
  const toggle = (id) => setChon((c) => ({ ...c, [id]: !c[id] }))

  const footer = (
    <div className="flex gap-2">
      <button onClick={() => soChon && (toast(`Đã gửi ${soChon} tài liệu tới ${kh.ten}`, 'success'), onClose())}
        className="tap flex-1 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!soChon}>
        Gửi tài liệu{soChon ? ` (${soChon})` : ''}
      </button>
      <button onClick={() => toast('Đã sao chép link chia sẻ', 'info')} className="tap rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
        Sao chép link
      </button>
    </div>
  )

  return (
    <ScreenShell title="Gửi tài liệu cho khách" onClose={onClose} footer={footer}>
      <h2 className="text-2xl font-black text-gray-900">Gửi tài liệu cho khách</h2>
      <p className="mb-5 mt-1 text-sm text-gray-500">Chọn tài liệu phù hợp và gửi cho khách qua kênh OA</p>

      {/* 1. Chọn khách hàng */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-black text-gray-900">1. Chọn khách hàng</span>
          <button className="text-xs font-semibold text-brand-600">Chọn khác</button>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">NP</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-gray-900">{kh.ten}</div>
              <div className="truncate text-[11px] text-gray-500">{kh.maKH} · {kh.sdt}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
            <span className="text-[11px] font-semibold text-green-700">✓ Đã đồng bộ kênh gửi Zalo OA</span>
            <button className="text-[11px] font-semibold text-green-700 underline">Kiểm tra quyền chia sẻ</button>
          </div>
        </div>
      </div>

      {/* 2. Chọn tài liệu */}
      <div className="mb-5">
        <div className="mb-2 text-sm font-black text-gray-900">2. Chọn tài liệu gửi</div>
        <div className="mb-3 flex gap-2">
          {TABS.map((t) => (
            <button key={t.ma} onClick={() => setTab(t.ma)}
              className={`tap rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === t.ma ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t.ten}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {ds.map((t) => (
            <button key={t.id} onClick={() => toggle(t.id)}
              className={`tap flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${chon[t.id] ? 'border-brand-400 bg-brand-50' : 'border-gray-100 bg-white'}`}>
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-gray-900">{t.ten}</div>
                <div className="text-[11px] text-gray-500">{t.meta}</div>
              </div>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${chon[t.id] ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'}`}>
                {chon[t.id] && <span className="text-[11px]">✓</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Xem trước */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-black text-gray-900">3. Xem trước và gửi</span>
          <span className="text-xs text-gray-500">{soChon} tài liệu</span>
        </div>
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs text-gray-500">
          {soChon ? `Sẽ gửi ${soChon} tài liệu qua Zalo OA tới ${kh.ten}.` : 'Chọn ít nhất 1 tài liệu để gửi.'}
        </div>
      </div>
    </ScreenShell>
  )
}
