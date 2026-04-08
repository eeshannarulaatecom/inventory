import { config } from "./config.js";
import { mondayRequest } from "./mondayClient.js";
import { fetchInventoryEquipment } from "./quarterlyService.js";
import {
  flattenDailyTemplateItems,
  getDailyTemplateForEquipment
} from "./dailyFormTemplates.js";

function normalizeKey(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeDate(value) {
  return (value || "").toString().trim();
}

function normalizeTime(value) {
  return (value || "").toString().trim();
}

function textValueOrEmpty(value) {
  return (value || "").toString().trim();
}

function currentDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTimeString() {
  const now = new Date();
  const hour = `${now.getHours()}`.padStart(2, "0");
  const minute = `${now.getMinutes()}`.padStart(2, "0");
  return `${hour}:${minute}`;
}

function buildDailyItemName(equipment, checkDate, checkTime) {
  const serialNumber = textValueOrEmpty(equipment?.serialNumber) || "Unknown Serial";
  const datePart = normalizeDate(checkDate) || currentDateString();
  const timePart = normalizeTime(checkTime) || currentTimeString();
  return `${serialNumber} - Daily Check - ${datePart} ${timePart}`;
}

function setColumnIfPresent(target, columnId, value) {
  if (!columnId) {
    return;
  }
  target[columnId] = value;
}

function normalizeResult(value) {
  return (value || "").toString().trim().toLowerCase();
}

function coerceResultLabel(value) {
  const normalized = normalizeResult(value);
  const passNormalized = normalizeResult(config.monday.passLabel);
  const failNormalized = normalizeResult(config.monday.failLabel);

  if (normalized === passNormalized) {
    return config.monday.passLabel;
  }
  if (normalized === failNormalized) {
    return config.monday.failLabel;
  }

  return "";
}

function buildChecklistSummary(template, entryMap) {
  const lines = [];
  const sections = Array.isArray(template?.sections) ? template.sections : [];

  for (const section of sections) {
    const sectionTitle = textValueOrEmpty(section?.title) || "Section";
    lines.push(`[${sectionTitle}]`);

    const items = Array.isArray(section?.items) ? section.items : [];
    for (const item of items) {
      const itemId = textValueOrEmpty(item?.id);
      const itemLabel = textValueOrEmpty(item?.label) || itemId;
      const entry = entryMap.get(itemId);
      if (!entry) {
        lines.push(`- ${itemLabel}: Missing`);
        continue;
      }

      const result = textValueOrEmpty(entry.result);
      const comments = textValueOrEmpty(entry.comments);
      lines.push(
        comments
          ? `- ${itemLabel}: ${result} | ${comments}`
          : `- ${itemLabel}: ${result}`
      );
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

function mapEntriesByCheckId(entries) {
  const map = new Map();
  const list = Array.isArray(entries) ? entries : [];

  for (const entry of list) {
    const checkId = textValueOrEmpty(entry?.checkId);
    if (!checkId) {
      continue;
    }

    const result = coerceResultLabel(entry?.result);
    const comments = textValueOrEmpty(entry?.comments);
    map.set(checkId, {
      checkId,
      result,
      comments
    });
  }

  return map;
}

function buildDailyColumnValues({
  equipment,
  checkDate,
  checkTime,
  operatorName,
  operatorId,
  overallResult,
  failedCount,
  checklistSummary,
  generalComments
}) {
  const values = {};
  const { dailyColumns } = config.monday;

  setColumnIfPresent(values, dailyColumns.serialNumber, equipment.serialNumber);
  setColumnIfPresent(values, dailyColumns.equipmentId, equipment.equipmentId);
  setColumnIfPresent(values, dailyColumns.make, equipment.make);
  setColumnIfPresent(values, dailyColumns.modelNumber, equipment.modelNumber);
  setColumnIfPresent(values, dailyColumns.type, equipment.type);
  setColumnIfPresent(values, dailyColumns.operatorName, operatorName);
  setColumnIfPresent(values, dailyColumns.operatorId, operatorId);
  setColumnIfPresent(values, dailyColumns.checkDate, { date: checkDate });
  setColumnIfPresent(values, dailyColumns.checkTime, checkTime);
  setColumnIfPresent(values, dailyColumns.overallResult, { label: overallResult });
  setColumnIfPresent(values, dailyColumns.failedCount, String(failedCount));
  setColumnIfPresent(values, dailyColumns.checklistDetails, checklistSummary);
  setColumnIfPresent(values, dailyColumns.generalComments, generalComments);

  return values;
}

function ensureDailyBoardConfigured() {
  if (!config.monday.dailyBoardId) {
    throw new Error(
      "Daily board is not configured. Set MONDAY_DAILY_BOARD_ID in your .env."
    );
  }
}

async function createDailyItem(itemName, columnValues) {
  ensureDailyBoardConfigured();

  if (config.monday.dailyGroupId) {
    const query = `
      mutation CreateDailyItemWithGroup(
        $boardId: ID!
        $groupId: String!
        $itemName: String!
        $columnValues: JSON!
      ) {
        create_item(
          board_id: $boardId
          group_id: $groupId
          item_name: $itemName
          column_values: $columnValues
        ) {
          id
        }
      }
    `;

    const data = await mondayRequest(query, {
      boardId: config.monday.dailyBoardId,
      groupId: config.monday.dailyGroupId,
      itemName,
      columnValues
    });

    return data?.create_item?.id;
  }

  const query = `
    mutation CreateDailyItem(
      $boardId: ID!
      $itemName: String!
      $columnValues: JSON!
    ) {
      create_item(
        board_id: $boardId
        item_name: $itemName
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const data = await mondayRequest(query, {
    boardId: config.monday.dailyBoardId,
    itemName,
    columnValues
  });

  return data?.create_item?.id;
}

function findEquipmentByIdentifier(items, { serialNumber, equipmentId }) {
  const serialKey = normalizeKey(serialNumber);
  const equipmentIdKey = normalizeKey(equipmentId);

  if (serialKey) {
    const matchBySerial = items.find(
      (item) => normalizeKey(item.serialNumber) === serialKey
    );
    if (matchBySerial) {
      return matchBySerial;
    }
  }

  if (equipmentIdKey) {
    const matchByEquipmentId = items.find(
      (item) => normalizeKey(item.equipmentId) === equipmentIdKey
    );
    if (matchByEquipmentId) {
      return matchByEquipmentId;
    }
  }

  return null;
}

export async function getDailyFormForEquipment({ serialNumber, equipmentId }) {
  const serialKey = textValueOrEmpty(serialNumber);
  const equipmentIdKey = textValueOrEmpty(equipmentId);

  if (!serialKey && !equipmentIdKey) {
    throw new Error("Provide serialNumber or equipmentId to load the daily form.");
  }

  const equipment = await fetchInventoryEquipment();
  const selectedEquipment = findEquipmentByIdentifier(equipment, {
    serialNumber: serialKey,
    equipmentId: equipmentIdKey
  });

  if (!selectedEquipment) {
    throw new Error(
      `Equipment not found for serial "${serialKey || "n/a"}" and equipmentId "${
        equipmentIdKey || "n/a"
      }".`
    );
  }

  const template = getDailyTemplateForEquipment({
    serialNumber: selectedEquipment.serialNumber,
    type: selectedEquipment.type
  });
  const checklistItems = flattenDailyTemplateItems(template);

  return {
    equipment: selectedEquipment,
    template,
    checklistItems,
    passLabel: config.monday.passLabel,
    failLabel: config.monday.failLabel
  };
}

export async function listDailyQrLinks(baseUrl) {
  const equipment = await fetchInventoryEquipment();
  const cleanedBaseUrl = textValueOrEmpty(baseUrl).replace(/\/+$/, "");

  return equipment.map((item) => {
    const serialNumber = textValueOrEmpty(item.serialNumber);
    const equipmentId = textValueOrEmpty(item.equipmentId);
    const url = serialNumber
      ? `${cleanedBaseUrl}/daily?serial=${encodeURIComponent(serialNumber)}`
      : `${cleanedBaseUrl}/daily?equipmentId=${encodeURIComponent(equipmentId)}`;

    return {
      serialNumber,
      equipmentId,
      make: textValueOrEmpty(item.make),
      modelNumber: textValueOrEmpty(item.modelNumber),
      type: textValueOrEmpty(item.type),
      url
    };
  });
}

export async function createDailyCheck({
  serialNumber,
  equipmentId,
  checkDate,
  checkTime,
  operatorName,
  operatorId,
  generalComments,
  entries
}) {
  ensureDailyBoardConfigured();

  const form = await getDailyFormForEquipment({ serialNumber, equipmentId });
  const requiredItems = form.checklistItems.filter((item) => item.required);
  const validItemIds = new Set(form.checklistItems.map((item) => item.id));
  const entryMap = mapEntriesByCheckId(entries);

  const invalidIds = [];
  for (const [checkId] of entryMap.entries()) {
    if (!validItemIds.has(checkId)) {
      invalidIds.push(checkId);
    }
  }
  if (invalidIds.length) {
    throw new Error(`Invalid check item IDs: ${invalidIds.join(", ")}`);
  }

  const missingRequired = [];
  const invalidResults = [];
  for (const item of requiredItems) {
    const entry = entryMap.get(item.id);
    if (!entry) {
      missingRequired.push(item.label);
      continue;
    }
    if (!entry.result) {
      invalidResults.push(item.label);
    }
  }

  if (missingRequired.length) {
    throw new Error(
      `Missing required check results for: ${missingRequired.join(", ")}`
    );
  }

  if (invalidResults.length) {
    throw new Error(
      `Invalid result value for: ${invalidResults.join(
        ", "
      )}. Use configured pass/fail labels.`
    );
  }

  const failedCount = Array.from(entryMap.values()).filter(
    (entry) => entry.result === config.monday.failLabel
  ).length;
  const overallResult =
    failedCount > 0 ? config.monday.failLabel : config.monday.passLabel;
  const checklistSummary = buildChecklistSummary(form.template, entryMap);
  const safeOperatorName = textValueOrEmpty(operatorName);
  const safeOperatorId = textValueOrEmpty(operatorId);
  const safeGeneralComments = textValueOrEmpty(generalComments);

  const columnValues = JSON.stringify(
    buildDailyColumnValues({
      equipment: form.equipment,
      checkDate,
      checkTime,
      operatorName: safeOperatorName,
      operatorId: safeOperatorId,
      overallResult,
      failedCount,
      checklistSummary,
      generalComments: safeGeneralComments
    })
  );

  const itemName = buildDailyItemName(form.equipment, checkDate, checkTime);
  const itemId = await createDailyItem(itemName, columnValues);

  return {
    createdItemId: itemId || "",
    itemName,
    overallResult,
    failedCount,
    totalChecks: form.checklistItems.length,
    equipment: form.equipment
  };
}
