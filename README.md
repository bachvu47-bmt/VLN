# Vật Liệu Nhà — Ứng dụng bán hàng nội bộ

Ứng dụng bán hàng **nội bộ** cho cửa hàng vật liệu xây dựng, xây bằng **React + Vite + Tailwind CSS v4**.
Tone màu thương hiệu: **Đỏ `#DC2626` + Trắng `#FFFFFF`**. Giao diện tối ưu dạng **mobile app**, đóng gói được cho **PC (.exe)** qua Electron và **Android (.apk)** qua Capacitor.

## 5 màn hình chính

| # | Màn hình | Quyền | Mô tả |
|---|----------|-------|-------|
| 1 | **Đăng nhập & Phân quyền** | — | Đăng nhập bằng Email `@vatlieunha.vn` / Username / SĐT. Vai trò: Admin, Sales, Thủ kho. |
| 2 | **Tra cứu kỹ thuật & Flashcard** | Tất cả | Flashcard sản phẩm: 🚨 Thẻ Cảnh báo Đỏ, ⚗️ tỷ lệ pha trộn, 🧮 bộ tính vật tư (m² → số lượng), video & tài liệu. |
| 3 | **Cổng AI Admin Ingestion** | Admin | Tải Ảnh/Video/PDF/Audio → Bot AI phân tích & đề xuất định tuyến vào mã sản phẩm. Kèm khu vực **Phát hành bản cập nhật** (.apk/.exe). |
| 4 | **Gợi ý tư vấn & CSKH sau bán** | Admin, Sales | Đồng bộ đơn KiotViet → Bot AI gợi ý bước tư vấn & gửi tài liệu/video cho khách qua cổng server. |
| 5 | **Quản lý Nhân sự & Session** | Admin | Danh sách người dùng, thiết bị đang active, đăng xuất từ xa 1-Click, **kiểm tra cập nhật phần mềm (OTA)**. |

## Tài khoản demo (mật khẩu: `123456`)

| Vai trò | Đăng nhập bằng |
|---------|----------------|
| 👑 Admin (Vũ Bạch Khoa) | `khoavb` · `khoa.vb@vatlieunha.vn` · `0909123456` |
| 💼 Sales (Trần Mỹ Linh) | `linhtm` |
| 📦 Thủ kho (Lê Thị Hoa) | `hoalt` |

## Chạy & build

```bash
npm install          # cài dependencies
npm run dev          # chạy web dev tại http://localhost:5173
npm run build        # build web tĩnh ra thư mục dist/
```

### 🖥️ Đóng gói PC (.exe) — Electron

```bash
npm run electron:dev   # chạy app desktop ở chế độ dev (nạp từ Vite)
npm run dist:win       # build .exe → release/VatLieuNha-Sales-Setup-<version>.exe
```

Bản cài đặt nằm trong thư mục `release/`.

### 📱 Đóng gói Android (.apk) — Capacitor

```bash
npm run cap:add:android   # tạo project android/ (chạy 1 lần đầu)
npm run cap:sync          # build web + đồng bộ sang Android
npm run cap:open:android  # mở Android Studio để Build > Build APK
```

> Yêu cầu: đã cài **Android Studio + JDK 17**. File `.apk` xuất ra tại
> `android/app/build/outputs/apk/`.

## Module Cập nhật tự động (Auto Update / OTA)

- **PC (.exe):** dùng `electron-updater`. Cấu hình server tại `package.json → build.publish` (`https://ota.vatlieunha.vn/pc/`). App kiểm tra → tải → `quitAndInstall` tự khởi động lại.
- **Mobile (.apk):** tải `.apk` mới từ server nội bộ rồi mở trình cài đặt đè (in-app update).
- **Admin phát hành:** Màn hình 3 → *Phát hành bản cập nhật*: tải file build mới + nhập changelog + đẩy thông báo tới toàn bộ nhân viên.
- Phiên bản hiện tại & dữ liệu cập nhật mock: `src/data/appInfo.js`. Logic đa nền tảng: `src/services/updateService.js`. Giao diện: `src/components/AutoUpdateModal.jsx`.

## Cấu trúc thư mục

```
src/
├─ data/
│  ├─ mockData.js      # Người dùng, sản phẩm, đơn hàng, phiên đăng nhập
│  └─ appInfo.js       # Phiên bản & dữ liệu cập nhật OTA
├─ context/AuthContext.jsx     # Đăng nhập & phân quyền
├─ services/updateService.js   # Luồng OTA (PC/Mobile/Web)
├─ components/
│  ├─ BottomNav.jsx
│  └─ AutoUpdateModal.jsx
├─ screens/
│  ├─ LoginScreen.jsx          # Màn 1
│  ├─ LookupScreen.jsx         # Màn 2
│  ├─ IngestionScreen.jsx      # Màn 3 (+ phát hành cập nhật)
│  ├─ ConsultScreen.jsx        # Màn 4
│  └─ UsersScreen.jsx          # Màn 5 (+ kiểm tra cập nhật)
├─ App.jsx             # Khung app + điều hướng theo vai trò
└─ main.jsx
electron/
├─ main.cjs            # Electron main + electron-updater
└─ preload.cjs         # Cầu nối API an toàn
capacitor.config.json  # Cấu hình đóng gói Android
```

> ⚠️ **Lưu ý:** Dữ liệu AI, KiotViet, server OTA hiện là **mock** phục vụ demo. Khi triển khai thật cần thay bằng API/endpoint thực tế.

© 2026 Vật Liệu Nhà.
