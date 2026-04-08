# Equipment Inspection App (monday.com)

Hosted inspection forms that:

- Reads equipment details from your **Inventory** board.
- Supports a **Quarterly** bulk check page.
- Supports a **Daily** per-equipment checklist page (QR friendly).
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

## 2. Find Column IDs Quickly

After setting token + board IDs, you can list board columns:

- Inventory columns: `GET /api/boards/inventory/columns`
- Quarterly columns: `GET /api/boards/quarterly/columns`

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

Daily checklist template defaults to the forklift visual + operational checklist from your paper form.
You can customize per-equipment templates in:

- `server/dailyFormTemplates.js`
  - `TEMPLATE_OVERRIDES_BY_SERIAL`
  - `TEMPLATE_OVERRIDES_BY_TYPE`

## 6. Deployment

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
