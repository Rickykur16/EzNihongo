# EzNihongo Kanji - Mobile App (Flutter)

Versi mobile dari fitur kanji EzNihongo. Target: Android (Play Store) terlebih dahulu, iOS opsional di kemudian hari.

## Status

**Fase 1 (selesai di sandbox):** scaffold + Home + Review + Detail + FSRS engine + 2229 kanji dari `app/kanji.html`.

**Belum dikerjakan (fase berikutnya):** auth & cloud sync, Search & List filter, Settings, Kana table, Google Play Billing untuk subscription, app icon launcher integration, ProGuard rules.

## Struktur Folder

```
mobile/
├── pubspec.yaml                ← dependencies + asset declaration
├── analysis_options.yaml
├── assets/
│   ├── kanji-data.json         ← 2229 kanji (N5-N1) hasil ekstrak dari app/kanji.html
│   └── icon.png                ← logo untuk launcher (512x512)
├── lib/
│   ├── main.dart               ← entry point + ProviderScope
│   ├── router.dart             ← go_router routes
│   ├── theme.dart              ← Material 3 light/dark
│   ├── models/
│   │   └── kanji.dart          ← model Kanji + Vocab + Sentence (handle inkonsistensi shape s)
│   ├── services/
│   │   ├── storage.dart        ← wrapper SharedPreferences
│   │   ├── fsrs.dart           ← FSRS v5 engine port dari app/fsrs.js
│   │   └── kanji_repository.dart
│   ├── providers/
│   │   └── app_providers.dart  ← Riverpod providers
│   ├── screens/
│   │   ├── home_screen.dart    ← progress ring + level tabs + grid
│   │   ├── review_screen.dart  ← flashcard + 4 rating buttons
│   │   └── detail_screen.dart  ← readings + vocab + sentences (TTS audio)
│   └── widgets/
│       ├── progress_ring.dart
│       ├── rating_buttons.dart
│       └── kanji_tile.dart
└── android/                    ← TIDAK ada di repo, di-generate via `flutter create`
```

## Setup Pertama Kali (Wajib Dijalankan di Laptop Anda)

Folder `android/` (dan `ios/`, `web/`) **tidak ada di repo** karena Flutter SDK harus generate file gradle yang sesuai dengan versi SDK lokal Anda.

### 1. Install Flutter SDK
- Download: <https://docs.flutter.dev/get-started/install>
- Verifikasi: `flutter doctor`

### 2. Generate Platform Folder Android
Dari folder `mobile/`:
```bash
flutter create --platforms=android \
  --org id.eznihongo \
  --project-name eznihongo_kanji \
  .
```

Ini akan generate `android/` dengan package name `id.eznihongo.eznihongo_kanji`. Untuk ganti jadi `id.eznihongo.kanji`, edit:
- `android/app/build.gradle.kts` (atau `.gradle`) → `applicationId`
- `android/app/src/main/AndroidManifest.xml` → `package` attribute & label
- `android/app/src/main/kotlin/...` → rename folder structure

### 3. Install Dependencies & Run
```bash
flutter pub get
flutter run                          # debug di device/emulator
flutter build apk --release          # build APK release (untuk testing)
flutter build appbundle --release    # build AAB (untuk upload Play Store)
```

## Konfigurasi Android yang Perlu Dilakukan Manual

Setelah `flutter create`, edit:

### `android/app/src/main/AndroidManifest.xml`
```xml
<application
    android:label="EzNihongo Kanji"
    android:icon="@mipmap/ic_launcher"
    ...>
```

### App Icon
Pakai package `flutter_launcher_icons`:
1. Tambah ke `pubspec.yaml`:
   ```yaml
   dev_dependencies:
     flutter_launcher_icons: ^0.14.1

   flutter_launcher_icons:
     android: true
     ios: false
     image_path: "assets/icon.png"
     adaptive_icon_background: "#FFFFFF"
     adaptive_icon_foreground: "assets/icon.png"
   ```
2. Generate:
   ```bash
   flutter pub get
   dart run flutter_launcher_icons
   ```

### Versioning
Edit `pubspec.yaml` field `version`. Format: `<semver>+<buildNumber>`
- `0.1.0+1` → version code 1, version name "0.1.0"
- Tiap upload ke Play Store, increment build number.

### Signing Release APK/AAB
1. Buat keystore:
   ```bash
   keytool -genkey -v -keystore ~/eznihongo-kanji.jks -keyalg RSA -keysize 2048 -validity 10000 -alias eznihongo
   ```
2. Buat `android/key.properties` (jangan di-commit, sudah di .gitignore):
   ```
   storePassword=...
   keyPassword=...
   keyAlias=eznihongo
   storeFile=/Users/you/eznihongo-kanji.jks
   ```
3. Edit `android/app/build.gradle.kts` untuk load signing config dari `key.properties`.

## Arsitektur Singkat

- **State management:** Riverpod (`flutter_riverpod`)
- **Routing:** go_router (deklaratif, deep-link ready)
- **Storage:** SharedPreferences untuk FSRS state (key: `eznihongo_fsrs_v1` — sama dengan web app, supaya nanti gampang sync)
- **TTS:** flutter_tts (Bahasa Jepang `ja-JP`)
- **Data kanji:** bundle JSON 763KB di `assets/kanji-data.json`

## Migrasi Data dari Web App

User yang sudah pakai web app punya progress di `localStorage` browser. Untuk fase 2, akan ditambah login → pull dari endpoint `/api/kanji-progress` yang sudah ada di backend.

Untuk fase 1 ini, mobile app standalone — tidak share data dengan web. User mulai dari nol.

## Roadmap

- [ ] **Fase 2 — Konten lengkap + auth**
  - List screen (filter level + search)
  - Search realtime
  - Settings (theme, daily goal, reset)
  - Kana table (hiragana/katakana)
  - Google sign-in via `google_sign_in` package
  - API client (`dio`) → endpoint `/api/kanji-auth/*` & `/api/kanji-progress`
  - Cloud sync FSRS state
- [ ] **Fase 3 — Monetisasi + release**
  - Backend: endpoint `POST /api/play-billing/verify` + RTDN webhook
  - Service account Google Play Developer API
  - Subscription product di Play Console (`kanji_premium_monthly`)
  - Integrasi `in_app_purchase` di Flutter
  - Privacy policy + data safety form
  - Internal testing → closed → production

## Testing FSRS Port

FSRS engine di-port dari `app/fsrs.js` dengan math identik. Untuk verifikasi, jalankan tes berikut secara manual setelah setup:
1. Review kanji `一` dengan rating 3 → harusnya `state=review`, `interval≈3` hari
2. Review lagi besok dengan rating 3 → interval grow (~7 hari)
3. Review dengan rating 1 → state turun ke `relearning`, interval = 1 menit

## Catatan Pengembangan

- **Hot reload:** simpan file → app refresh dalam <1 detik tanpa kehilangan state.
- **Bundle size estimasi:** APK release dengan ABI split ~12-15 MB per arsitektur.
- **Min SDK:** Android 21+ (Lollipop, 2014). Coverage ~99%.
- **Tidak ada landing page:** mobile app fokus 100% di fitur kanji. Marketing site (`index.html`, `welcome.html`, `src/*.jsx`) tetap di domain web.
