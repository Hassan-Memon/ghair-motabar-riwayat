# Google Play release

Everything needed to publish the Android app. The store account belongs to a friend of the project; every step that needs the account is marked **(account)**. Everything else can be done before they have it.

## Ready in the repository

- Package name `com.tehqeqatehadees.app` (`apps/app/app.json`). **Confirm with the owner before the first upload: it can never change after that.**
- Permissions: internet and network state only. Storage, overlay, vibration and microphone permissions that libraries add by default are removed (`android.blockedPermissions`).
- Builds: `eas build --platform android --profile production` makes the `.aab` file Play needs. Version codes go up automatically (`appVersionSource: remote`, `autoIncrement`).
- Upload: `eas submit --platform android --profile production` sends the build to the **internal testing** track as a draft (`eas.json` → `submit.production.android`). It reads the Play upload key from `apps/app/play-service-account.json`, which git ignores.
- Privacy policy: [`docs/privacy.md`](privacy.md). Play needs a public URL; once this is on `main`, use
  `https://github.com/Hassan-Memon/ghair-motabar-riwayat/blob/main/docs/privacy.md`.

## Testing without a store account

`eas build --platform android --profile preview` makes an `.apk` with a download link. Anyone can install it on an Android phone (Android asks to allow installs from that source). Use this to collect feedback while the account is not ready.

## Still needed before the first upload

| What | Who | Notes |
|---|---|---|
| App icon 512 × 512 PNG | owner | Also replaces the in-app icon (1024 × 1024 source preferred). |
| Feature graphic 1024 × 500 PNG/JPG | owner or us | Banner at the top of the store page. |
| Phone screenshots, 2–8 | us | From a real phone, 9:16, e.g. search, a narration, footnote, books, narrators. |
| Package name confirmed | owner | See above. |
| Testers' Gmail addresses (see below) | us | Only if the account is a new personal account. |

## Store listing text

Default language **Urdu (ur)**, with an **English (en-US)** translation. Limits: title 30 characters, short description 80, full description 4000.

### Urdu

**Title**: تحقیقاتِ حدیث

**Short description**: غیر معتبر روایات کی تحقیق: بغیر انٹرنیٹ تلاش اور مطالعہ

**Full description**:

تحقیقاتِ حدیث (tehqeqatehadees.com) کی تمام تحقیق اب آپ کے فون پر، انٹرنیٹ کے بغیر۔

• مکمل ذخیرہ ایپ کے اندر: پہلی بار کھولتے ہی بغیر انٹرنیٹ کے کام کرتی ہے
• تیز تلاش: اردو اور عربی الفاظ سے، کتاب اور باب کے لحاظ سے
• ہر روایت کی مکمل تحقیق، حکم، حوالہ جات اور حواشی
• کتب، ابواب اور رواۃ کے صفحات
• محفوظ روایات اور پڑھنے کی تاریخ
• متن کا سائز، روشن اور تاریک انداز
• نئی تحقیق خود بخود: دن میں ایک بار، صرف وائی فائی پر (آپ کی اجازت سے موبائل ڈیٹا پر بھی)

ایپ کوئی ذاتی معلومات جمع نہیں کرتی: نہ اکاؤنٹ، نہ اشتہارات، نہ ٹریکنگ۔

### English

**Title**: Tehqeeqat-e-Hadees

**Short description**: Research on unreliable hadith narrations: search and read offline

**Full description**:

All the research from tehqeqatehadees.com on your phone, without internet.

• The full collection is inside the app: works offline from the first launch
• Fast search in Urdu and Arabic, filtered by book and chapter
• Each narration with its full research, verdict, references and footnotes
• Books, chapters and narrators
• Bookmarks and reading history
• Text size, light and dark themes
• New research arrives on its own: once a day, on Wi-Fi only (mobile data if you allow it)

The app collects no personal data: no account, no ads, no tracking.

## Play Console answers

**Category**: Books & Reference. **Tags**: reference, religion. **Contains ads**: No. **In-app purchases**: No.

**Data safety**:
- Does the app collect or share any of the required user data types? **No.**
- (Bookmarks, history and settings stay on the device and are never sent, so they are not "collected" under Play's definition.)
- Is all data encrypted in transit? **Yes** (HTTPS downloads from GitHub).
- Account deletion: not applicable (no accounts).

**Content rating** (IARC questionnaire): category *Reference, news or educational*. Answer **No** to violence, sexuality, language, controlled substances, gambling, user interaction/sharing, location sharing and purchases. Expected rating: Everyone / PEGI 3.

**Target audience**: 13 and older (not designed for children; avoids the Families policy requirements).

**News app**: No. **Government app**: No. **Health / financial features**: None.

**App access**: All functionality is available without login.

## Steps for the account owner (account)

1. Play Console → **Create app**: name «تحقیقاتِ حدیث», default language Urdu, App, Free.
2. Fill the **App content** section with the answers above, and the **Store listing** with the text and graphics.
3. Upload key for `eas submit`: Google Cloud → service account with a JSON key → Play Console → Users and permissions → invite the service account email with release permissions. Save the key as `apps/app/play-service-account.json` (never commit it). Expo guide: https://docs.expo.dev/submit/android/
4. Upload: `cd apps/app && npx eas-cli@latest submit --platform android --profile production` sends the latest build to internal testing as a draft. (Uploading the first `.aab` by hand in Play Console also works.)
5. **Personal accounts created after 13 Nov 2023**: Google requires a closed test with at least **12 testers** opted in continuously for the last **14 days** before production access can be requested ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)). Start this as early as possible: add the testers' Gmail addresses to a closed testing track and send them the opt-in link. Organisation accounts are not covered by this rule.
6. Production: Play Console → Production → promote the tested release → submit for review (usually a few days for a new app).
