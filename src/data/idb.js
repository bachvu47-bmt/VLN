// ============================================================
//  IndexedDB mini — lưu dữ liệu lớn (sản phẩm web, bộ nhớ vector)
//  localStorage chỉ ~5MB, không đủ cho 668 SP + hàng nghìn vector.
//  Chạy được trên web, Electron (.exe) và Android WebView (.apk).
// ============================================================
const DB_NAME = 'vln_sales'
const DB_VERSION = 2
export const STORE_KV = 'kv' // key-value chung (vd: danh sách sản phẩm web)
export const STORE_TRI_THUC = 'tri_thuc' // bộ nhớ vector của Maika
export const STORE_MEDIA = 'media' // ảnh & âm thoại gửi cho Maika (Blob + SKU)

let _db = null

// Xin quyền lưu trữ BỀN VỮNG (đọc/ghi lâu dài): không có quyền này, Android/Chrome có thể tự xoá
// IndexedDB khi máy đầy bộ nhớ → mất ảnh, việc cần làm, bộ nhớ Maika. Gọi 1 lần, im lặng nếu không hỗ trợ.
let _daXinBenVung = false
export async function xinLuuTruBenVung() {
  if (_daXinBenVung) return
  _daXinBenVung = true
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist()
  } catch {
    /* bỏ qua */
  }
}

function moDB() {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Thiết bị không hỗ trợ IndexedDB'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV)
      if (!db.objectStoreNames.contains(STORE_TRI_THUC)) db.createObjectStore(STORE_TRI_THUC, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      const db = req.result
      // Tab/bản app khác nâng cấp DB → đóng kết nối cũ, lần gọi sau tự mở lại (tránh lỗi "InvalidStateError")
      db.onversionchange = () => {
        db.close()
        _db = null
      }
      db.onclose = () => {
        _db = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('Cơ sở dữ liệu đang bị cửa sổ khác giữ — đóng bớt cửa sổ app rồi thử lại'))
    xinLuuTruBenVung()
  })
  // Mở lỗi (quyền bị chặn, bộ nhớ đầy...) → KHÔNG giữ promise lỗi, lần sau thử mở lại
  _db.catch(() => {
    _db = null
  })
  return _db
}

function ketQua(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Kết nối đã bị đóng (WebView vào nền lâu, versionchange) → transaction() ném InvalidStateError
// → mở lại DB và thử đúng 1 lần nữa
async function layTx(store, mode = 'readonly') {
  try {
    return (await moDB()).transaction(store, mode)
  } catch (e) {
    if (e?.name !== 'InvalidStateError') throw e
    _db = null
    return (await moDB()).transaction(store, mode)
  }
}

export async function idbGet(store, key) {
  return ketQua((await layTx(store)).objectStore(store).get(key))
}

export async function idbGetAll(store) {
  return ketQua((await layTx(store)).objectStore(store).getAll())
}

// key chỉ cần cho store không có keyPath (STORE_KV)
export async function idbPut(store, value, key) {
  const os = (await layTx(store, 'readwrite')).objectStore(store)
  return ketQua(key === undefined ? os.put(value) : os.put(value, key))
}

// Ghi nhiều bản ghi trong 1 transaction (nhanh hơn nhiều so với put từng cái)
export async function idbPutMany(store, values) {
  if (!values.length) return
  const tx = await layTx(store, 'readwrite')
  await new Promise((resolve, reject) => {
    const os = tx.objectStore(store)
    values.forEach((v) => os.put(v))
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Ghi dữ liệu bị huỷ (bộ nhớ máy đầy?)'))
  })
}

export async function idbDeleteMany(store, keys) {
  if (!keys.length) return
  const tx = await layTx(store, 'readwrite')
  await new Promise((resolve, reject) => {
    const os = tx.objectStore(store)
    keys.forEach((k) => os.delete(k))
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Ghi dữ liệu bị huỷ (bộ nhớ máy đầy?)'))
  })
}
