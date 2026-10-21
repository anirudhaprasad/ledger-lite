# aifico Ledger Lite

aifico Ledger Lite: a private, offline money tracker that runs in the browser. Your data is encrypted with your master password and stays on your device.

## What's included

- Dashboard and Core Ledger. You can exclude entries from totals and restore them, and select several at once.
- Accounts (up to 5), Budgets and Categories.
- Goals, with a planner for big purchases.
- Schedules: an automatic monthly salary entry and regular auto debits or transfers.
- Shared & Split for trips, events and shared households.
- SMS import and reconciliation.
- Encrypted backup and restore, and dark mode.

## Layout

- `app/index.html`: the page markup.
- `app/css/`: styles, loaded in order (later files override earlier ones).
- `app/js/`: setup scripts, storage and the encrypted vault, and startup.
- `app/js/app/`: the app, one file per feature. Each file's class extends the previous one, ending in `99-app.js`.

## Build a single file (for a phone)

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build.ps1 -App app -Out dist\aifico_money_manager_lite.html
```

## Run locally

```bash
powershell -NoProfile -Command "$env:PORT='8774'; $env:ROOT='app'; .\serve.ps1"
```

Then open http://localhost:8774.
