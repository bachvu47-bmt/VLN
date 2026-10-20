import { useEffect, useRef, useState } from 'react'

const TOI_DA_GIAY = 60
const TOI_THIEU_MS = 700

function chonMime() {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || ''
}

// Ghi âm kiểu "giữ để nói" (Zalo/Messenger): batDau() khi nhấn, ketThuc() khi thả tay.
// ketThuc(huy) trả về Blob (null nếu huỷ / nói quá ngắn).
// toiDaGiay: chat 60s; dạy Maika bằng giọng nói cho phép dài hơn (vd 5 phút)
export function useGhiAm(toiDaGiay = TOI_DA_GIAY) {
  const [dangGhi, setDangGhi] = useState(false)
  const [giay, setGiay] = useState(0)
  const ref = useRef({ rec: null, stream: null, chunks: [], batDauLuc: 0, timer: null, xong: null })

  const donDep = () => {
    const r = ref.current
    clearInterval(r.timer)
    r.stream?.getTracks().forEach((t) => t.stop())
    Object.assign(r, { rec: null, stream: null, timer: null })
    setDangGhi(false)
    setGiay(0)
  }

  useEffect(() => donDep, [])

  const batDau = async () => {
    if (ref.current.rec) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Thiết bị không hỗ trợ ghi âm')
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const mime = chonMime()
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const r = ref.current
    Object.assign(r, { rec, stream, chunks: [], batDauLuc: Date.now() })
    rec.ondataavailable = (e) => e.data.size && r.chunks.push(e.data)
    rec.start(250)
    setDangGhi(true)
    r.timer = setInterval(() => {
      const s = Math.floor((Date.now() - r.batDauLuc) / 1000)
      setGiay(s)
      if (s >= toiDaGiay) r.xong?.() // chạm giới hạn → tự dừng & gửi
    }, 250)
  }

  const ketThuc = (huy = false) =>
    new Promise((resolve) => {
      const r = ref.current
      if (!r.rec) return resolve(null)
      const ngan = Date.now() - r.batDauLuc < TOI_THIEU_MS
      r.rec.onstop = () => {
        const blob = new Blob(r.chunks, { type: r.rec?.mimeType || 'audio/webm' })
        donDep()
        resolve(huy || ngan || !blob.size ? null : blob)
      }
      r.rec.stop()
    })

  // Cho component đăng ký hành động khi chạm giới hạn 60s
  const khiHetGio = (fn) => {
    ref.current.xong = fn
  }

  return { dangGhi, giay, batDau, ketThuc, khiHetGio }
}
