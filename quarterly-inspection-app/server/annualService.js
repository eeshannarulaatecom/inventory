import {
  config,
  getAnnualCheckResultColumnEnvName,
  getAnnualCheckResultColumnId
} from "./config.js";
import { mondayRequest } from "./mondayClient.js";
import { fetchInventoryEquipment } from "./quarterlyService.js";
import {
  flattenAnnualTemplateItems,
  getAnnualTemplateForEquipment
} from "./annualFormTemplates.js";

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

function buildAnnualItemName(equipment, checkDate, checkTime) {
  const serialNumber = textValueOrEmpty(equipment?.serialNumber) || "Unknown Serial";
  const datePart = normalizeDate(checkDate) || currentDateString();
  const timePart = normalizeTime(checkTime) || currentTimeString();
  return `${serialNumber} - Annual Check - ${datePart} ${timePart}`;
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

function buildAnnualColumnValues({
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
  const { annualColumns } = config.monday;

  setColumnIfPresent(values, annualColumns.serialNumber, equipment.serialNumber);
  setColumnIfPresent(values, annualColumns.equipmentId, equipment.equipmentId);
  setColumnIfPresent(values, annualColumns.make, equipment.make);
  setColumnIfPresent(values, annualColumns.modelNumber, equipment.modelNumber);
  setColumnIfPresent(values, annualColumns.type, equipment.type);
  setColumnIfPresent(values, annualColumns.operatorName, operatorName);
  setColumnIfPresent(values, annualColumns.operatorId, operatorId);
  setColumnIfPresent(values, annualColumns.checkDate, { date: checkDate });
  setColumnIfPresent(values, annualColumns.checkTime, checkTime);
  setColumnIfPresent(values, annualColumns.overallResult, { label: overallResult });
  setColumnIfPresent(values, annualColumns.failedCount, String(failedCount));
  setColumnIfPresent(values, annualColumns.checklistDetails, checklistSummary);
  setColumnIfPresent(values, annualColumns.generalComments, generalComments);

  return values;
}

function buildChecklistResultColumnValues(checklistItems, entryMap) {
  const values = {};
  const missingMappings = [];
  const items = Array.isArray(checklistItems) ? checklistItems : [];

  for (const item of items) {
    const checkId = textValueOrEmpty(item?.id);
    if (!checkId) {
      continue;
    }

    const envName = getAnnualCheckResultColumnEnvName(checkId);
    const columnId = getAnnualCheckResultColumnId(checkId);
    if (!columnId) {
      missingMappings.push({
        label: textValueOrEmpty(item?.label) || checkId,
        envName: envName || "(invalid check id)"
      });
      continue;
    }

    const result = textValueOrEmpty(entryMap.get(checkId)?.result);
    if (!result) {
      continue;
    }

    values[columnId] = { label: result };
  }

  return { values, missingMappings };
}

function ensureAnnualBoardConfigured() {
  if (!config.monday.annualBoardId) {
    throw new Error(
      "Annual board is not configured. Set MONDAY_ANNUAL_BOARD_ID in your .env."
    );
  }
}

async function createAnnualItem(itemName, columnValues) {
  ensureAnnualBoardConfigured();

  if (config.monday.annualGroupId) {
    const query = `
      mutation CreateAnnualItemWithGroup(
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
      boardId: config.monday.annualBoardId,
      groupId: config.monday.annualGroupId,
      itemName,
      columnValues
    });

    return data?.create_item?.id;
  }

  const query = `
    mutation CreateAnnualItem(
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
    boardId: config.monday.annualBoardId,
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

export async function getAnnualFormForEquipment({ serialNumber, equipmentId }) {
  const serialKey = textValueOrEmpty(serialNumber);
  const equipmentIdKey = textValueOrEmpty(equipmentId);

  if (!serialKey && !equipmentIdKey) {
    throw new Error("Provide serialNumber or equipmentId to load the annual form.");
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

  const template = getAnnualTemplateForEquipment({
    serialNumber: selectedEquipment.serialNumber,
    type: selectedEquipment.type
  });
  const checklistItems = flattenAnnualTemplateItems(template);

  return {
    equipment: selectedEquipment,
    template,
    checklistItems,
    passLabel: config.monday.passLabel,
    failLabel: config.monday.failLabel
  };
}

export async function createAnnualCheck({
  serialNumber,
  equipmentId,
  checkDate,
  checkTime,
  operatorName,
  operatorId,
  generalComments,
  entries
}) {
  ensureAnnualBoardConfigured();

  const form = await getAnnualFormForEquipment({ serialNumber, equipmentId });
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

  const checklistResultColumns = buildChecklistResultColumnValues(
    form.checklistItems,
    entryMap
  );
  if (checklistResultColumns.missingMappings.length) {
    const details = checklistResultColumns.missingMappings
      .map((item) => `${item.envName} (${item.label})`)
      .join(", ");
    throw new Error(
      `Missing annual checklist result column IDs in .env: ${details}`
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

  const columnValuePayload = buildAnnualColumnValues({
    equipment: form.equipment,
    checkDate,
    checkTime,
    operatorName: safeOperatorName,
    operatorId: safeOperatorId,
    overallResult,
    failedCount,
    checklistSummary,
    generalComments: safeGeneralComments
  });
  Object.assign(columnValuePayload, checklistResultColumns.values);

  const columnValues = JSON.stringify(columnValuePayload);

  const itemName = buildAnnualItemName(form.equipment, checkDate, checkTime);
  const itemId = await createAnnualItem(itemName, columnValues);

  return {
    createdItemId: itemId || "",
    itemName,
    overallResult,
    failedCount,
    totalChecks: form.checklistItems.length,
    equipment: form.equipment
  };
}
