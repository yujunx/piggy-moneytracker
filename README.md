# 🐷 Piggy: money tracker with screenshot logging

[![CI](https://github.com/yujunx/piggy-moneytracker/actions/workflows/ci.yml/badge.svg)](https://github.com/yujunx/piggy-moneytracker/actions/workflows/ci.yml)
![Expo SDK 57](https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

A personal finance app for Android and iOS. Logging every nasi lemak and Grab ride by hand gets tedious, so Piggy can also **read a screenshot** of a receipt, e-wallet payment or bank transfer and fill in the record for you. The text recognition runs entirely on the phone, and all data stays on the device.

Built for Malaysian users: amounts are in RM, and the parser understands Touch 'n Go, GrabPay, ShopeePay, Boost, MAE and local banks, plus Malay words like *jumlah*, *baki* and *gaji*.

<!--
## Screenshots

| Transactions | Stats | Scan review |
| :---: | :---: | :---: |
| <img src="docs/screenshots/transactions.png" width="250"> | <img src="docs/screenshots/stats.png" width="250"> | <img src="docs/screenshots/scan.png" width="250"> |
-->

## Features

- **Accounts:** cash, bank, e-wallet and card accounts with live balances, assets and liabilities, and archiving
- **Records:** income, expenses and transfers between accounts, with a category, note and description
- **Three views:** a daily list, a calendar with daily totals, and a month-by-month summary for the year
- **Stats:** a category breakdown by week, month or year (tap a category to see its records), a 6-month income vs expense chart, average daily spend and savings rate
- **Budgets:** monthly budgets overall and per category, with a pace marker showing whether you're overspending for this point in the month
- **Screenshot logging:** pick an image and get a pre-filled record to confirm
- **Backup:** JSON export and restore, and CSV export for spreadsheets
- Light and dark mode

## How screenshot logging works

```
screenshot ──► ML Kit OCR (on-device) ──► text lines + positions ──► parser ──► pre-filled form ──► user confirms
                                                                        ▲                             │
                                                                        └──── learned merchant rules ◄┘
```

1. **Text recognition.** [Google ML Kit](https://developers.google.com/ml-kit/vision/text-recognition/v2) reads the image offline and returns each line of text with its position and size ([`recognize.ts`](src/ocr/recognize.ts)).
2. **Parsing.** [`parse.ts`](src/ocr/parse.ts) is a set of pure, unit-tested functions that turn those lines into a draft record:
   - **Amount.** Every `RM 12.50`-style number is scored. Being labelled *Total*, *Amount paid* or *Jumlah* adds points. Being next to *Subtotal*, *SST*, *Change*, *Cash* or *Wallet balance* takes points away. Large text scores extra, since e-wallet apps show the paid amount in a big font. The highest score wins, and the runner-up amounts appear as one-tap alternatives.
   - **Type.** Weighted phrases decide between expense (*Paid to*, *DuitNow QR*), income (*Received from*, *Credited*, *Refund*) and transfer (*Reload*, *Top up*). A leading `-RM` or `+RM` also counts.
   - **Date.** Handles `18/09/2026`, `2026-09-18`, `18 Sep 2026`, `Sep 18, 2026` and dates with no year. It skips dates in the future (usually expiry dates) and ignores the phone's status-bar clock.
   - **Merchant.** The value after a label like *Paid to* or *Merchant*, otherwise the first line that looks like a store name.
   - **Category and account.** Matched against [keyword rules](src/ocr/rules.ts) for Malaysian merchants and wallets.
3. **Review.** Any field the parser isn't confident about gets a yellow outline, so you know what to check.
4. **Learning.** If you change the suggested category, Piggy saves a rule for that merchant, so its next receipt is categorised the way you chose. Learned rules take priority over the built-in ones.

For example, OCR text from a TNG payment:

```
Payment Successful
-RM12.50
Paid to
RESTORAN NASI KANDAR PELITA
17 Sep 2026, 1:05 PM
Touch 'n Go eWallet
Wallet Balance RM45.20
```

becomes an **RM 12.50 expense** at *RESTORAN NASI KANDAR PELITA*, dated 17 Sep 2026 at 13:05, categorised as **Food**, paid from the **TNG eWallet** account. The RM 45.20 wallet balance is ignored.

## Tech stack

| | |
| --- | --- |
| App | [Expo](https://expo.dev) SDK 57, React Native, TypeScript (strict), expo-router |
| Storage | SQLite via `expo-sqlite`, with versioned migrations |
| OCR | `@react-native-ml-kit/text-recognition` (on-device) |
| Charts | `react-native-gifted-charts` |
| Tests | Jest (`jest-expo`) |
| Builds | EAS Build |

A few design choices:
- **Money is stored as integer sen** (RM 12.50 = `1250`) to avoid floating-point rounding errors.
- **Account balances are calculated, not stored.** They're the starting balance plus the sum of the account's records, so they can never get out of sync.
- **Dates are stored as local `YYYY-MM-DD HH:mm` strings**, so date-range filters are fast indexed string comparisons and grouping by day or month is just a substring.

## Project structure

```
app/                   screens (file-based routing)
  (tabs)/              Transactions, Stats, Accounts, More
  record/              add/edit form and screenshot scan
src/
  db/                  schema, migrations, seed data, all SQL queries
  ocr/                 OCR wrapper, parser and merchant keyword rules
  components/          shared UI, including the record form
  utils/               money, date and summary helpers
__tests__/             parser and utility unit tests
scripts/make-icons.mjs generates the app icons from SVG
```

## Running it

```bash
npm install
npm test             # unit tests
npm run typecheck
```

**Quick look (no scanning):** install Expo Go on your phone, run `npx expo start --go` and scan the QR code.

**Full app with scanning:** ML Kit is a native module, so it needs a custom build:

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android   # standalone APK
```

## License

[MIT](LICENSE) © yujunx
