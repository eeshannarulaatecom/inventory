import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config.js";
import {
  fetchBoardColumns,
  fetchInventoryEquipment,
  upsertQuarterlyChecks
} from "./quarterlyService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDirectory = path.join(__dirname, "..", "public");

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.use(express.static(clientDirectory));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/config", (_request, response) => {
    response.json({
      passLabel: config.monday.passLabel,
      failLabel: config.monday.failLabel,
      quarterlyIntervalMonths: config.monday.quarterlyIntervalMonths
    });
  });

  app.get("/api/equipment", async (_request, response, next) => {
    try {
      const items = await fetchInventoryEquipment();
      response.json({ items });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/boards/:boardType/columns", async (request, response, next) => {
    try {
      const boardType = request.params.boardType;

      if (boardType !== "inventory" && boardType !== "quarterly") {
        response.status(400).json({
          message: "boardType must be inventory or quarterly"
        });
        return;
      }

      const boardId =
        boardType === "inventory"
          ? config.monday.inventoryBoardId
          : config.monday.quarterlyBoardId;

      const board = await fetchBoardColumns(boardId);
      response.json({ board });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/quarterly/submit", async (request, response, next) => {
    try {
      const { checkDate, entries } = request.body ?? {};

      if (!isValidDateString(checkDate)) {
        response.status(400).json({
          message: "checkDate must be a valid date string (YYYY-MM-DD)"
        });
        return;
      }

      if (!Array.isArray(entries) || entries.length === 0) {
        response.status(400).json({
          message: "entries must be a non-empty array"
        });
        return;
      }

      const allowedPassFailValues = new Set([
        config.monday.passLabel,
        config.monday.failLabel
      ]);
      const invalidEntries = entries.filter(
        (entry) => !allowedPassFailValues.has(entry.passFail)
      );

      if (invalidEntries.length) {
        response.status(400).json({
          message: `Every entry must include passFail as ${config.monday.passLabel} or ${config.monday.failLabel}`
        });
        return;
      }

      const result = await upsertQuarterlyChecks({ checkDate, entries });
      response.json({
        message: "Quarterly checks saved successfully.",
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDirectory, "index.html"));
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({
      message: error.message || "Unexpected server error"
    });
  });

  return app;
}

const app = createApp();
export default app;
