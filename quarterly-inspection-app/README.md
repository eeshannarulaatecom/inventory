# Equipment Inspection App (monday.com)

Hosted inspection forms that:

- Reads equipment details from your **Inventory** board.
- Supports a **Quarterly** bulk check page.
- Supports a **Daily** per-equipment checklist page (QR friendly).
- Supports an **Annual** checklist page with equipment dropdown selection.
- Uses configurable pass/fail labels.
- Saves results into monday.com boards.

## Requirements

- Node.js 18 or newer (for native `fetch`)

## 1. Setup

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `MONDAY_API_TOKEN`
   - `MONDAY_INVENTORY_BOARD_ID`
   - `MONDAY_QUARTERLY_BOARD_ID`
3. Install and run:

```bash
npm install
npm run dev
```

Open:

- Quarterly page: `http://localhost:3000/`
- Daily page (QR target): `http://localhost:3000/daily?serial=SERIAL_NUMBER`
- Daily QR link list: `http://localhost:3000/daily-links`
- Annual page (equipment dropdown): `http://localhost:3000/annual`

## 2. Find Column IDs Quickly

After setting token + board IDs, you can list board columns:

- Inventory columns: `GET /api/boards/inventory/columns`
- Quarterly columns: `GET /api/boards/quarterly/columns`
- Daily columns: `GET /api/boards/daily/columns`
- Annual columns: `GET /api/boards/annual/columns`

Use the returned `id` values to fill the `.env` column variables.

## 3. Required Column Mapping

Inventory board must map:

- Equipment ID
- Make
- Model Number
- Type

Quarterly board should map:

- Model Number
- Check Date
- Pass/Fail
- Comments
- Next Check Date

Serial Number is taken from the item name (first column) on both boards.

Daily board can map any of these (all optional, but useful):

- Serial Number
- Equipment ID
- Make
- Model Number
- Type
- Operator Name
- Operator ID
- Check Date
- Check Time
- Overall Result (status)
- Failed Count
- Checklist Details
- General Comments

For per-item Pass/Fail tracking, add one **Status** column per checklist item and map
its monday column ID in `.env` using:

- `MONDAY_DAILY_CHECK_<CHECK_ID_IN_UPPER_SNAKE_CASE>_COLUMN_ID`

The complete set for the default forklift checklist is included in `.env.example`.
Each of those Status columns should support your configured pass/fail labels
(`MONDAY_PASS_LABEL`, `MONDAY_FAIL_LABEL`).

Annual board can map the same field set as Daily (Serial, Equipment ID, Make, Model,
Type, Operator, Date/Time, Overall Result, Failed Count, Checklist Details, Comments)
using `MONDAY_ANNUAL_*` variables from `.env.example`.

For per-item Pass/Fail tracking on annual checks, map annual status columns using:

- `MONDAY_ANNUAL_CHECK_<CHECK_ID_IN_UPPER_SNAKE_CASE>_COLUMN_ID`

## 4. Quarterly Submission Behavior

On submit:

- App blocks submission if any row has no Pass/Fail selection.
- App computes `Next Check Date = Check Date + MONDAY_QUARTERLY_INTERVAL_MONTHS` (default `3`).
- If serial number exists in quarterly board, row is updated.
- If serial number does not exist, row is created.

## 5. Daily Check + QR Flow

1. Put a QR code on each equipment item.
2. The QR should point to:
   - `https://your-domain/daily?serial=SERIAL_NUMBER`
   - or `https://your-domain/daily?equipmentId=EQUIPMENT_ID`
3. Operator scans code and fills the checklist.
4. App creates a new row in the configured Daily board.

Daily API endpoints:

- `GET /api/daily/form?serial=...` (or `equipmentId=...`)
- `POST /api/daily/submit`
- `GET /api/daily/qr-links` (returns direct URLs for all inventory items)

Annual API endpoints:

- `GET /api/annual/form?equipmentId=...` (or `serial=...`)
- `POST /api/annual/submit`

## 6. Annual Board Auto-Setup

If monday AI does not create the annual board structure correctly, run:

```bash
npm run setup:annual-board
```

This script will:

- Create groups:
  - `Annual Checks - Open`
  - `Annual Checks - Completed`
- Create all annual metadata + checklist status columns (if missing)
- Print `MONDAY_ANNUAL_*` env assignments you can paste into `.env`

Important:

- monday columns are board-level (shared across all groups). Groups do not have separate columns.
- Before running the script, set at least:
  - `MONDAY_API_TOKEN`
  - `MONDAY_ANNUAL_BOARD_ID`

## 7. Checklist Templates

Daily checklist template defaults to the forklift visual + operational checklist from your paper form.
You can customize per-equipment templates in:

- `server/dailyFormTemplates.js`
  - `TEMPLATE_OVERRIDES_BY_SERIAL`
  - `TEMPLATE_OVERRIDES_BY_TYPE`

## 8. Deployment

### Vercel

1. Push this folder to GitHub.
2. In Vercel, import the repository.
3. If this app is in a subfolder, set **Root Directory** to `quarterly-inspection-app`.
4. Add all variables from `.env` into **Project Settings -> Environment Variables**.
5. Deploy.

Notes:

- The backend runs as an Express Vercel Function.
- Static files are served from `public/`.

### Other Node hosts

You can also host on Render, Railway, Azure Web App, etc:

- Set all `.env` values in the host's environment variables.
- Run command: `npm start`
