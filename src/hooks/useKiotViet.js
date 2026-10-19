import { useEffect, useState } from 'react'
import { dangKyTheoDoi, duLieuKV } from '../services/kiotViet'

// Dữ liệu KiotViet đã giải mã (null nếu chưa nhập mã / chưa tải) — tự cập nhật khi đồng bộ
export function useKiotViet() {
  const [d, setD] = useState(duLieuKV)
  useEffect(() => dangKyTheoDoi(() => setD(duLieuKV())), [])
  return d
}
