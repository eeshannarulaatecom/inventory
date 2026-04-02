import {
  config,
  getMissingInventoryColumns,
  getMissingQuarterlyColumns
} from "./config.js";
import { mondayRequest } from "./mondayClient.js";

function toColumnLookup(columnValues = []) {
  return columnValues.reduce((accumulator, column) => {
    accumulator[column.id] = {
      text: column.text ?? "",
      value: column.value ?? null,
      type: column.type ?? ""
    };
    return accumulator;
  }, {});
}

function normalizeSerial(serialNumber) {
  return (serialNumber || "").trim().toLowerCase();
}

function formatDateParts(year, month, day) {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function calculateNextCheckDate(checkDate, intervalMonths) {
  const [yearText, monthText, dayText] = checkDate.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  const monthIndex = month - 1 + intervalMonths;
  const nextYear = year + Math.floor(monthIndex / 12);
  const nextMonthIndex = monthIndex % 12;
  const maxDay = new Date(Date.UTC(nextYear, nextMonthIndex + 1, 0)).getUTCDate();
  const nextDay = Math.min(day, maxDay);

  return formatDateParts(nextYear, nextMonthIndex + 1, nextDay);
}

function buildQuarterlyColumnValues(entry, checkDate, nextCheckDate) {
  const { quarterlyColumns } = config.monday;

  return {
    [quarterlyColumns.modelNumber]: entry.modelNumber || "",
    [quarterlyColumns.checkDate]: { date: checkDate },
    [quarterlyColumns.passFail]: { label: entry.passFail },
    [quarterlyColumns.comments]: entry.comments || "",
    [quarterlyColumns.nextCheckDate]: { date: nextCheckDate }
  };
}

async function fetchQuarterlyItemsBySerial() {
  const query = `
    query QuarterlyItems($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        items_page(limit: 500) {
          items {
            id
            name
          }
        }
      }
    }
  `;

  const data = await mondayRequest(query, {
    boardIds: [config.monday.quarterlyBoardId]
  });

  const items = data?.boards?.[0]?.items_page?.items ?? [];
  const serialToItemId = new Map();

  for (const item of items) {
    const serialKey = normalizeSerial(item.name);
    if (serialKey && !serialToItemId.has(serialKey)) {
      serialToItemId.set(serialKey, item.id);
    }
  }

  return serialToItemId;
}

async function updateQuarterlyItem(itemId, columnValues) {
  const query = `
    mutation UpdateQuarterlyItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(
        board_id: $boardId
        item_id: $itemId
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const data = await mondayRequest(query, {
    boardId: config.monday.quarterlyBoardId,
    itemId,
    columnValues
  });

  return data?.change_multiple_column_values?.id;
}

async function createQuarterlyItem(itemName, columnValues) {
  if (config.monday.quarterlyGroupId) {
    const query = `
      mutation CreateQuarterlyItemWithGroup(
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
      boardId: config.monday.quarterlyBoardId,
      groupId: config.monday.quarterlyGroupId,
      itemName,
      columnValues
    });

    return data?.create_item?.id;
  }

  const query = `
    mutation CreateQuarterlyItem(
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
    boardId: config.monday.quarterlyBoardId,
    itemName,
    columnValues
  });

  return data?.create_item?.id;
}

export async function fetchInventoryEquipment() {
  const missingColumns = getMissingInventoryColumns();
  if (missingColumns.length) {
    throw new Error(
      `Missing inventory column IDs in .env: ${missingColumns.join(", ")}`
    );
  }

  const query = `
    query InventoryEquipment($boardIds: [ID!], $columnIds: [String!]) {
      boards(ids: $boardIds) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values(ids: $columnIds) {
              id
              type
              text
              value
            }
          }
        }
      }
    }
  `;

  const inventoryColumnIds = Object.values(config.monday.inventoryColumns);
  const data = await mondayRequest(query, {
    boardIds: [config.monday.inventoryBoardId],
    columnIds: inventoryColumnIds
  });

  const items = data?.boards?.[0]?.items_page?.items ?? [];

  const equipment = items
    .map((item) => {
      const columnLookup = toColumnLookup(item.column_values);

      return {
        inventoryItemId: item.id,
        serialNumber: item.name || "",
        equipmentId:
          columnLookup[config.monday.inventoryColumns.equipmentId]?.text || "",
        make: columnLookup[config.monday.inventoryColumns.make]?.text || "",
        modelNumber:
          columnLookup[config.monday.inventoryColumns.modelNumber]?.text || "",
        type: columnLookup[config.monday.inventoryColumns.type]?.text || "",
        status: columnLookup[config.monday.inventoryColumns.status]?.text || ""
      };
    })
    .filter((item) => item.serialNumber)
    .sort((a, b) =>
      a.serialNumber.localeCompare(b.serialNumber, undefined, { numeric: true })
    );

  return equipment;
}

export async function upsertQuarterlyChecks({ checkDate, entries }) {
  const missingColumns = getMissingQuarterlyColumns();
  if (missingColumns.length) {
    throw new Error(
      `Missing quarterly column IDs in .env: ${missingColumns.join(", ")}`
    );
  }

  const existingQuarterlyItems = await fetchQuarterlyItemsBySerial();
  const nextCheckDate = calculateNextCheckDate(
    checkDate,
    config.monday.quarterlyIntervalMonths
  );

  let updated = 0;
  let created = 0;

  for (const entry of entries) {
    const serialNumber = (entry.serialNumber || "").trim();
    if (!serialNumber) {
      continue;
    }

    const serialKey = normalizeSerial(serialNumber);
    const columnValues = JSON.stringify(
      buildQuarterlyColumnValues(entry, checkDate, nextCheckDate)
    );

    if (existingQuarterlyItems.has(serialKey)) {
      const itemId = existingQuarterlyItems.get(serialKey);
      await updateQuarterlyItem(itemId, columnValues);
      updated += 1;
      continue;
    }

    const createdItemId = await createQuarterlyItem(serialNumber, columnValues);
    existingQuarterlyItems.set(serialKey, createdItemId);
    created += 1;
  }

  return { created, updated, nextCheckDate };
}

export async function fetchBoardColumns(boardId) {
  const query = `
    query BoardColumns($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        id
        name
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const data = await mondayRequest(query, {
    boardIds: [boardId]
  });

  return data?.boards?.[0] ?? null;
}
