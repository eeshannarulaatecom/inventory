import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config.js";
import {
  createDailyCheck,
  getDailyFormForEquipment,
  listDailyQrLinks
} from "./dailyService.js";
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

function isValidTimeString(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
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

      if (
        boardType !== "inventory" &&
        boardType !== "quarterly" &&
        boardType !== "daily"
      ) {
        response.status(400).json({
          message: "boardType must be inventory, quarterly, or daily"
        });
        return;
      }

      const boardId =
        boardType === "inventory"
          ? config.monday.inventoryBoardId
          : boardType === "quarterly"
          ? config.monday.quarterlyBoardId
          : config.monday.dailyBoardId;

      if (!boardId) {
        response.status(400).json({
          message: "Daily board is not configured. Set MONDAY_DAILY_BOARD_ID."
        });
        return;
      }

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

  app.get("/api/daily/form", async (request, response, next) => {
    try {
      const serialNumber = (request.query.serial || "").toString().trim();
      const equipmentId = (request.query.equipmentId || "").toString().trim();

      if (!serialNumber && !equipmentId) {
        response.status(400).json({
          message: "Provide serial or equipmentId query parameter."
        });
        return;
      }

      const payload = await getDailyFormForEquipment({
        serialNumber,
        equipmentId
      });
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/daily/qr-links", async (request, response, next) => {
    try {
      const forwardedProto = (request.headers["x-forwarded-proto"] || "")
        .toString()
        .split(",")[0]
        .trim();
      const protocol = forwardedProto || request.protocol;
      const host = request.get("host");
      const baseUrl = `${protocol}://${host}`;
      const links = await listDailyQrLinks(baseUrl);
      response.json({ links });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/daily/submit", async (request, response, next) => {
    try {
      const {
        serialNumber,
        equipmentId,
        checkDate,
        checkTime,
        operatorName,
        operatorId,
        generalComments,
        entries
      } = request.body ?? {};

      if (!serialNumber && !equipmentId) {
        response.status(400).json({
          message: "serialNumber or equipmentId is required."
        });
        return;
      }

      if (!isValidDateString(checkDate)) {
        response.status(400).json({
          message: "checkDate must be a valid date string (YYYY-MM-DD)."
        });
        return;
      }

      if (!isValidTimeString(checkTime)) {
        response.status(400).json({
          message: "checkTime must be a valid time string (HH:mm)."
        });
        return;
      }

      if (!(operatorName || "").toString().trim()) {
        response.status(400).json({
          message: "operatorName is required."
        });
        return;
      }

      if (!Array.isArray(entries) || entries.length === 0) {
        response.status(400).json({
          message: "entries must be a non-empty array."
        });
        return;
      }

      const result = await createDailyCheck({
        serialNumber: (serialNumber || "").toString().trim(),
        equipmentId: (equipmentId || "").toString().trim(),
        checkDate: checkDate.toString().trim(),
        checkTime: checkTime.toString().trim(),
        operatorName: operatorName.toString().trim(),
        operatorId: (operatorId || "").toString().trim(),
        generalComments: (generalComments || "").toString().trim(),
        entries
      });

      response.json({
        message: "Daily check saved successfully.",
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/daily", (_request, response) => {
    response.sendFile(path.join(clientDirectory, "daily.html"));
  });

  app.get("/daily-links", (_request, response) => {
    response.sendFile(path.join(clientDirectory, "daily-links.html"));
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
