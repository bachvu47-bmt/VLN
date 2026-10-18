// Khung màn phụ toàn màn hình: header (nút quay lại + tiêu đề + phải) + nội dung + footer cố định
export default function ScreenShell({ title, onClose, right = null, footer = null, children }) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-gray-50">
      <header className="flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-3">
        <button onClick={onClose} className="tap flex h-9 w-9 items-center justify-center rounded-full text-gray-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="flex-1 truncate text-sm font-bold text-gray-900">{title}</span>
        {right}
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">{children}</div>
      {footer && <div className="mx-auto w-full max-w-md border-t border-gray-100 bg-white p-3">{footer}</div>}
    </div>
  )
}
