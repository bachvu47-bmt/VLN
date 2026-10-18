// ============================================================
//  IndexedDB mini — lưu dữ liệu lớn (sản phẩm web, bộ nhớ vector)
//  localStorage chỉ ~5MB, không đủ cho 668 SP + hàng nghìn vector.
//  Chạy được trên web, Electron (.exe) và Android WebView (.apk).
// ============================================================
const DB_NAME = 'vln_sales'
const DB_VERSION = 1
export const STORE_KV = 'kv' // key-value chung (vd: danh sách sản phẩm web)
export const STORE_TRI_THUC = 'tri_thuc' // bộ nhớ vector của Maika

let _db = null

function moDB() {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Thiết bị không hỗ trợ IndexedDB'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV)
      if (!db.objectStoreNames.contains(STORE_TRI_THUC)) db.createObjectStore(STORE_TRI_THUC, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _db
}

function ketQua(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet(store, key) {
  const db = await moDB()
  return ketQua(db.transaction(store).objectStore(store).get(key))
}

export async function idbGetAll(store) {
  const db = await moDB()
  return ketQua(db.transaction(store).objectStore(store).getAll())
}

// key chỉ cần cho store không có keyPath (STORE_KV)
export async function idbPut(store, value, key) {
  const db = await moDB()
  const os = db.transaction(store, 'readwrite').objectStore(store)
  return ketQua(key === undefined ? os.put(value) : os.put(value, key))
}

// Ghi nhiều bản ghi trong 1 transaction (nhanh hơn nhiều so với put từng cái)
export async function idbPutMany(store, values) {
  if (!values.length) return
  const db = await moDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    values.forEach((v) => os.put(v))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDeleteMany(store, keys) {
  if (!keys.length) return
  const db = await moDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    keys.forEach((k) => os.delete(k))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
