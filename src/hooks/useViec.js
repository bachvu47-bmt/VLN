import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { dangKyTheoDoi, layViec } from '../data/viecStore'

// Danh sách việc của người dùng + "bây giờ" cập nhật mỗi phút (việc chuyển sang quá hạn đúng lúc)
export function useViec() {
  const { user } = useAuth()
  const [, setTick] = useState(0)
  const [bayGio, setBayGio] = useState(() => Date.now())
  useEffect(() => dangKyTheoDoi(() => setTick((t) => t + 1)), [])
  useEffect(() => {
    const id = setInterval(() => setBayGio(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  return { user, ds: layViec(user?.id), bayGio }
}
