import ScreenShell from '../components/ScreenShell'
import { useToast } from '../context/ToastContext'

const ANH_HUONG = ['PU Seal 300', 'PU Bond Pro', 'PU Coating VN']

export default function DuyetScreen({ onClose }) {
  const toast = useToast()
  const act = (msg) => {
    toast(msg, 'success')
    onClose()
  }

  const footer = (
    <div className="flex gap-2">
      <button onClick={() => toast('Đã lưu nháp', 'info')} className="tap rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">Lưu nháp</button>
      <button onClick={() => act('Đã gửi yêu cầu bổ sung nguồn')} className="tap flex-1 rounded-xl border border-amber-300 bg-amber-50 py-3 text-sm font-bold text-amber-700">Yêu cầu bổ sung</button>
      <button onClick={() => act('Đã phê duyệt cập nhật kiến thức')} className="tap flex-1 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white">Phê duyệt</button>
    </div>
  )

  return (
    <ScreenShell title="Duyệt kiến thức" onClose={onClose} footer={footer}>
      <h2 className="text-2xl font-black text-gray-900">Duyệt đề xuất cập nhật kiến thức</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Đối chiếu nội dung đề xuất với kiến thức hiện tại trước khi phê duyệt</p>

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">PU</span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">Cần bổ sung nguồn</span>
          </div>
          <h3 className="text-base font-black text-gray-900">Thi công PU trên bề mặt ẩm</h3>
          <p className="text-[11px] text-gray-500">Đề xuất bởi Nguyễn Văn A (NV05) · Ngày đề xuất: 12/04/2025</p>
        </div>

        <div className="rounded-xl border-l-4 border-green-500 bg-green-50 p-4">
          <div className="mb-1 text-sm font-bold text-green-700">Nội dung đề xuất (mới)</div>
          <p className="text-sm text-gray-700">Có thể thi công PU trên bề mặt ẩm nếu dùng lớp lót chuyên dụng kháng ẩm và bề mặt không đọng nước.</p>
        </div>

        <div className="rounded-xl border-l-4 border-gray-300 bg-gray-50 p-4">
          <div className="mb-1 text-sm font-bold text-gray-700">Nội dung hiện tại</div>
          <p className="text-sm text-gray-600">Nên thi công PU trên bề mặt khô ráo, sạch, độ ẩm bề mặt &lt; 8% để đảm bảo bám dính.</p>
        </div>

        <div>
          <div className="mb-2 text-sm font-black text-gray-900">Phạm vi ảnh hưởng <span className="text-xs font-normal text-gray-400">(3 sản phẩm)</span></div>
          <div className="space-y-2">
            {ANH_HUONG.map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-lg">🛢️</span>
                <span className="text-sm font-semibold text-gray-800">{t}</span>
                <span className="ml-auto text-[10px] text-gray-400">Dữ liệu minh họa</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-l-4 border-brand-600 bg-brand-50 p-4">
          <div className="text-sm font-bold text-brand-700">⚠️ Cần bổ sung nguồn</div>
          <p className="mt-1 text-xs text-brand-800">Vui lòng đính kèm TDS/nghiên cứu của nhà sản xuất chứng minh PU thi công được trên bề mặt ẩm trước khi phê duyệt.</p>
        </div>
      </div>
    </ScreenShell>
  )
}
