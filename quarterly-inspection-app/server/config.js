import dotenv from "dotenv";

dotenv.config();

function readEnv(name, fallback = "") {
  return (process.env[name] ?? fallback).toString().trim();
}

function requireEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireNumericId(name) {
  const value = requireEnv(name);
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a numeric monday.com board ID`);
  }
  return value;
}

function optionalNumericId(name) {
  const value = readEnv(name);
  if (!value) {
    return "";
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a numeric monday.com board ID`);
  }
  return value;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeCheckIdForEnv(checkId) {
  return (checkId || "")
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export const config = {
  port: parsePositiveInt(readEnv("PORT"), 3000),
  monday: {
    apiUrl: readEnv("MONDAY_API_URL", "https://api.monday.com/v2"),
    apiToken: requireEnv("MONDAY_API_TOKEN"),
    inventoryBoardId: requireNumericId("MONDAY_INVENTORY_BOARD_ID"),
    quarterlyBoardId: requireNumericId("MONDAY_QUARTERLY_BOARD_ID"),
    dailyBoardId: optionalNumericId("MONDAY_DAILY_BOARD_ID"),
    quarterlyGroupId: readEnv("MONDAY_QUARTERLY_GROUP_ID"),
    dailyGroupId: readEnv("MONDAY_DAILY_GROUP_ID"),
    passLabel: readEnv("MONDAY_PASS_LABEL", "Pass"),
    failLabel: readEnv("MONDAY_FAIL_LABEL", "Fail"),
    quarterlyIntervalMonths: parsePositiveInt(
      readEnv("MONDAY_QUARTERLY_INTERVAL_MONTHS"),
      3
    ),
    inventoryColumns: {
      equipmentId: readEnv("MONDAY_INVENTORY_EQUIPMENT_ID_COLUMN_ID"),
      make: readEnv("MONDAY_INVENTORY_MAKE_COLUMN_ID"),
      modelNumber: readEnv("MONDAY_INVENTORY_MODEL_COLUMN_ID"),
      type: readEnv("MONDAY_INVENTORY_TYPE_COLUMN_ID")
    },
    quarterlyColumns: {
      modelNumber: readEnv("MONDAY_QUARTERLY_MODEL_COLUMN_ID"),
      checkDate: readEnv("MONDAY_QUARTERLY_CHECK_DATE_COLUMN_ID"),
      passFail: readEnv("MONDAY_QUARTERLY_PASS_FAIL_COLUMN_ID"),
      comments: readEnv("MONDAY_QUARTERLY_COMMENTS_COLUMN_ID"),
      nextCheckDate: readEnv("MONDAY_QUARTERLY_NEXT_CHECK_DATE_COLUMN_ID")
    },
    dailyColumns: {
      serialNumber: readEnv("MONDAY_DAILY_SERIAL_COLUMN_ID"),
      equipmentId: readEnv("MONDAY_DAILY_EQUIPMENT_ID_COLUMN_ID"),
      make: readEnv("MONDAY_DAILY_MAKE_COLUMN_ID"),
      modelNumber: readEnv("MONDAY_DAILY_MODEL_COLUMN_ID"),
      type: readEnv("MONDAY_DAILY_TYPE_COLUMN_ID"),
      operatorName: readEnv("MONDAY_DAILY_OPERATOR_NAME_COLUMN_ID"),
      operatorId: readEnv("MONDAY_DAILY_OPERATOR_ID_COLUMN_ID"),
      checkDate: readEnv("MONDAY_DAILY_CHECK_DATE_COLUMN_ID"),
      checkTime: readEnv("MONDAY_DAILY_CHECK_TIME_COLUMN_ID"),
      overallResult: readEnv("MONDAY_DAILY_OVERALL_RESULT_COLUMN_ID"),
      failedCount: readEnv("MONDAY_DAILY_FAILED_COUNT_COLUMN_ID"),
      checklistDetails: readEnv("MONDAY_DAILY_CHECKLIST_DETAILS_COLUMN_ID"),
      generalComments: readEnv("MONDAY_DAILY_GENERAL_COMMENTS_COLUMN_ID")
    }
  }
};

function missingColumnKeys(columns) {
  return Object.entries(columns)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function getMissingInventoryColumns() {
  return missingColumnKeys(config.monday.inventoryColumns);
}

export function getMissingQuarterlyColumns() {
  return missingColumnKeys(config.monday.quarterlyColumns);
}

export function getProvidedDailyColumns() {
  return Object.entries(config.monday.dailyColumns)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
}

export function getDailyCheckResultColumnEnvName(checkId) {
  const normalized = normalizeCheckIdForEnv(checkId);
  if (!normalized) {
    return "";
  }
  return `MONDAY_DAILY_CHECK_${normalized}_COLUMN_ID`;
}

export function getDailyCheckResultColumnId(checkId) {
  const envName = getDailyCheckResultColumnEnvName(checkId);
  if (!envName) {
    return "";
  }
  return readEnv(envName);
}
