# Hướng dẫn phát hành tự động (GitHub Actions)

Mỗi khi push 1 tag dạng `vX.Y.Z` lên GitHub, workflow `.github/workflows/release.yml` sẽ **tự build và publish**:
- 📱 `VatLieuNha-Sales-vX.Y.Z.apk` (Android — build trên runner Ubuntu)
- 🖥️ `VatLieuNha-Sales-Setup-X.Y.Z.exe` + `latest.yml` (Windows — phục vụ auto-update)

Tất cả được đính vào **GitHub Release** của tag đó. App sẽ tự phát hiện bản mới qua GitHub Releases API (`src/services/githubUpdater.js`).

---

## A. Cài đặt một lần

1. **Cài Git** (máy hiện chưa có):
   - Tải: https://git-scm.com/download/win — hoặc dùng **GitHub Desktop**: https://desktop.github.com
2. **Tạo repo trên GitHub** (vd `bachvu47-bmt/VLN` — repo hiện tại của Vật Liệu Nhà).
3. **Đồng bộ `owner/repo`** cho đúng repo thật ở 2 nơi:
   - `src/data/appInfo.js` → `GITHUB_REPO = { owner, repo }`
   - `package.json` → `build.publish[0].owner` / `repo`
4. **Đẩy mã nguồn lên GitHub:**
   ```powershell
   cd D:\VatLieuNha_Sales
   git init -b main
   git add -A
   git commit -m "Init VatLieuNha Sales app"
   git remote add origin https://github.com/<owner>/<repo>.git
   git push -u origin main
   ```

> Thư mục `android/` **được commit** (là source). `node_modules/`, `release/`, `android/build/`... đã bị bỏ qua trong `.gitignore`.

---

## B. Phát hành một phiên bản mới

1. **Tăng số phiên bản** cho khớp nhau:
   - `src/data/appInfo.js` → `PHIEN_BAN_HIEN_TAI = '1.1.0'`
   - `package.json` → `"version": "1.1.0"`
   - `android/app/build.gradle` → `versionName "1.1.0"` và `versionCode` +1
2. **Commit + tạo tag + push tag:**
   ```powershell
   git add -A
   git commit -m "Release v1.1.0"
   git tag v1.1.0
   git push origin main --tags
   ```
3. Mở tab **Actions** trên GitHub xem tiến trình. Xong → vào **Releases** thấy `.apk` + `.exe`.

Viết **changelog** trong phần mô tả Release (dạng gạch đầu dòng) — app sẽ tự bóc tách hiển thị trong popup cập nhật:
```
- Bổ sung Bot AI quét TikTok/YouTube
- Cải tiến tốc độ đồng bộ KiotViet
- Sửa lỗi đăng xuất từ xa trên iPad
```

---

## C. (Tùy chọn) Ký APK bản release

Workflow hiện build **APK debug** (tự ký bằng debug key — cài đặt được ngay cho nội bộ).
Muốn build **APK release đã ký** để phân phối rộng:

1. Tạo keystore và đưa nội dung (base64) + mật khẩu vào **GitHub Secrets**.
2. Sửa job `android` trong workflow: khôi phục keystore từ secret, cấu hình `signingConfigs` trong `android/app/build.gradle`, đổi `./gradlew assembleDebug` → `./gradlew assembleRelease`.

---

## D. Lưu ý token
- Workflow dùng `secrets.GITHUB_TOKEN` (GitHub cấp sẵn, không cần tạo thủ công) với quyền `contents: write` đã khai trong file.
- Không cần cấu hình thêm secret nào cho luồng cơ bản (.exe + .apk debug).
