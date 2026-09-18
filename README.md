# 🐷 Piggy

A personal money manager (in the style of Money Manager) for Android/iOS, built with Expo. All data stays on the phone. Currency: MYR.

- **Records**: income, expense and transfers, with account, category, date, note and description
- **Views**: daily list, calendar and monthly summary
- **Stats**: category donut (week/month/year), 6-month income vs expense bars, average spend per day, savings rate, budgets
- **Accounts**: grouped balances, assets and liabilities, archiving
- **Scan a screenshot**: pick a receipt or e-wallet/bank screenshot and Piggy reads it offline (Google ML Kit), then pre-fills the amount, date, merchant, type, account and category. Guessed fields are outlined in yellow. When you correct a category, Piggy remembers it for that merchant.
- **Backup**: JSON export/restore and CSV export

## Run it on your Android phone (EAS cloud build)

The screenshot scanner uses a native module, so the app has to be built. It won't run in Expo Go.

```bash
npm install -g eas-cli
eas login            # free Expo account
eas build:configure  # first time only
eas build --profile development --platform android
```

Install the APK from the link EAS gives you, then start the dev server and open Piggy on the phone:

```bash
npm start
```

For a standalone APK that doesn't need the dev server, use `eas build --profile preview --platform android`.

## Develop

```bash
npm test           # parser + money/date/summary unit tests
npm run typecheck
npm run icons      # regenerate the pig icons from scripts/make-icons.mjs
```

| Where | What |
| --- | --- |
| `app/` | Screens (expo-router). Tabs are in `app/(tabs)` |
| `src/db/` | SQLite schema/migrations (`client.ts`) and all queries (`queries.ts`) |
| `src/ocr/parse.ts` | Screenshot text → draft record (pure and unit-tested) |
| `src/ocr/rules.ts` | Malaysian merchant, e-wallet and bank keyword rules. Add merchants here |
| `src/components/RecordForm.tsx` | Add/edit form shared by manual entry and scanning |

Money is stored as integer sen. Dates are stored as local `YYYY-MM-DD HH:mm` strings.
