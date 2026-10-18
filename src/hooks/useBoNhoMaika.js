import { useEffect, useState } from 'react'
import { dangKyTheoDoi, thongKe, trangThaiHoc } from '../services/vectorStore'

// Theo dõi bộ nhớ vector của Maika: số tri thức + tiến độ học nền
export function useBoNhoMaika() {
  const doc = () => ({ tk: thongKe(), hoc: trangThaiHoc() })
  const [st, setSt] = useState(doc)
  useEffect(() => dangKyTheoDoi(() => setSt(doc())), [])
  return st
}
