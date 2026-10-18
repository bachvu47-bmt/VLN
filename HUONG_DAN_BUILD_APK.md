# Hướng dẫn cài tooling & build file .apk (Android)

Project Android đã được dựng sẵn tại thư mục `android/` (Capacitor). Để xuất ra file `.apk`, máy cần cài **JDK 17** + **Android Studio / Android SDK**. Máy hiện tại **chưa có** các công cụ này — làm theo các bước dưới đây.

---

## Bước 1 — Cài JDK 17

**Cách nhanh (winget):**
```powershell
winget install EclipseAdoptium.Temurin.17.JDK
```
Sau khi cài, mở PowerShell **mới** và kiểm tra:
```powershell
java -version    # phải thấy "17.x"
```
> Nếu chưa nhận, đặt biến môi trường `JAVA_HOME` trỏ tới thư mục JDK (vd `C:\Program Files\Eclipse Adoptium\jdk-17...`).

---

## Bước 2 — Cài Android Studio + SDK

1. Tải Android Studio: https://developer.android.com/studio
2. Cài đặt, mở lên, vào **More Actions → SDK Manager**, cài:
   - **Android SDK Platform 34** (hoặc mới hơn)
   - **Android SDK Build-Tools**
   - **Android SDK Platform-Tools**
   - **Android SDK Command-line Tools**
3. Đặt biến môi trường (PowerShell, chạy 1 lần):
```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx ANDROID_SDK_ROOT "$env:LOCALAPPDATA\Android\Sdk"
```
Mở PowerShell mới sau khi chạy.

---

## Bước 3 — Build .apk

Có 2 cách:

### Cách A — Dùng Android Studio (dễ nhất)
```powershell
cd D:\VatLieuNha_Sales
npm run cap:sync          # build web + đồng bộ sang android/
npm run cap:open:android  # mở project trong Android Studio
```
Trong Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
File xuất ra: `android\app\build\outputs\apk\debug\app-debug.apk`

### Cách B — Dòng lệnh (Gradle)
```powershell
cd D:\VatLieuNha_Sales
npm run cap:sync
cd android
.\gradlew.bat assembleDebug      # ra bản debug
# hoặc
.\gradlew.bat assembleRelease    # ra bản release (cần ký app)
```
File `.apk` nằm ở `android\app\build\outputs\apk\`.

---

## Bước 4 — Ký APK bản release (để phát hành thật)

1. Tạo keystore:
```powershell
keytool -genkey -v -keystore vatlieunha.keystore -alias vatlieunha -keyalg RSA -keysize 2048 -validity 10000
```
2. Thêm vào `android\app\build.gradle` phần `signingConfigs` trỏ tới keystore trên.
3. Build: `.\gradlew.bat assembleRelease`

---

## Liên quan cập nhật OTA (.apk qua GitHub)

- Sau khi có `app-release.apk`, tải nó lên **GitHub Release** làm asset (cùng tag với bản `.exe`).
- App sẽ tự lấy link `.apk` từ GitHub Releases API (`src/services/githubUpdater.js`) → tải về → mở trình cài đặt đè.
- Nhớ tăng `versionName`/`versionCode` trong `android\app\build.gradle` **và** `PHIEN_BAN_HIEN_TAI` trong `src\data\appInfo.js` mỗi lần phát hành.

---

## Kiểm tra nhanh tooling đã sẵn sàng chưa
```powershell
java -version
echo $env:ANDROID_HOME
```
Cả hai có kết quả → chạy được `npm run cap:sync` và build APK.
