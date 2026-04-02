# Quarterly Inspection App (monday.com)

Hosted quarterly inspection form that:

- Reads equipment details from your **Inventory** board.
- Requires a **Pass/Fail** choice for every equipment row.
- Allows optional comments per row.
- Creates or updates rows in your **Quarterly Check Tracker** board.

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

Open: `http://localhost:3000`

## 2. Find Column IDs Quickly

After setting token + board IDs, you can list columns:

- Inventory columns: `GET /api/boards/inventory/columns`
- Quarterly columns: `GET /api/boards/quarterly/columns`

Use the returned `id` values to fill the `.env` column variables.

## 3. Required Column Mapping

Inventory board must map:

- Equipment ID
- Make
- Model Number
- Type

Quarterly board must map:

- Model Number
- Check Date
- Pass/Fail
- Comments
- Next Check Date

Serial Number is taken from the item name (first column) on both boards.

## 4. Submission Behavior

On submit:

- App blocks submission if any row has no Pass/Fail selection.
- App computes `Next Check Date = Check Date + MONDAY_QUARTERLY_INTERVAL_MONTHS` (default `3`).
- If serial number exists in quarterly board, row is updated.
- If serial number does not exist, row is created.

## 5. Deployment

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
