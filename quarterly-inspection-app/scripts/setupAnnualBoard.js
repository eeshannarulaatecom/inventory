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

function normalizeTitle(value) {
  return (value || "").toString().trim().toLowerCase();
}

const apiUrl = readEnv("MONDAY_API_URL", "https://api.monday.com/v2");
const apiToken = requireEnv("MONDAY_API_TOKEN");
const annualBoardId = requireNumericId("MONDAY_ANNUAL_BOARD_ID");

const groupDefinitions = [
  {
    title: "Annual Checks - Open",
    env: "MONDAY_ANNUAL_GROUP_ID"
  },
  {
    title: "Annual Checks - Completed"
  }
];

const statusDefaults = JSON.stringify({
  labels: {
    "1": "Pass",
    "2": "Fail"
  }
});

const columnDefinitions = [
  {
    title: "Serial Number",
    type: "text",
    env: "MONDAY_ANNUAL_SERIAL_COLUMN_ID"
  },
  {
    title: "Equipment ID",
    type: "text",
    env: "MONDAY_ANNUAL_EQUIPMENT_ID_COLUMN_ID"
  },
  {
    title: "Make",
    type: "text",
    env: "MONDAY_ANNUAL_MAKE_COLUMN_ID"
  },
  {
    title: "Model Number",
    type: "text",
    env: "MONDAY_ANNUAL_MODEL_COLUMN_ID"
  },
  {
    title: "Type",
    type: "text",
    env: "MONDAY_ANNUAL_TYPE_COLUMN_ID"
  },
  {
    title: "Operator Name",
    type: "text",
    env: "MONDAY_ANNUAL_OPERATOR_NAME_COLUMN_ID"
  },
  {
    title: "Operator ID",
    type: "text",
    env: "MONDAY_ANNUAL_OPERATOR_ID_COLUMN_ID"
  },
  {
    title: "Check Date",
    type: "date",
    env: "MONDAY_ANNUAL_CHECK_DATE_COLUMN_ID"
  },
  {
    title: "Check Time",
    type: "text",
    env: "MONDAY_ANNUAL_CHECK_TIME_COLUMN_ID"
  },
  {
    title: "Overall Result",
    type: "status",
    env: "MONDAY_ANNUAL_OVERALL_RESULT_COLUMN_ID"
  },
  {
    title: "Failed Count",
    type: "numbers",
    env: "MONDAY_ANNUAL_FAILED_COUNT_COLUMN_ID"
  },
  {
    title: "Checklist Details",
    type: "long_text",
    env: "MONDAY_ANNUAL_CHECKLIST_DETAILS_COLUMN_ID"
  },
  {
    title: "General Comments",
    type: "long_text",
    env: "MONDAY_ANNUAL_GENERAL_COMMENTS_COLUMN_ID"
  },
  {
    title: "01 Chains - measure of wear",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_CHAINS_MEASURE_WEAR_COLUMN_ID"
  },
  {
    title: "02 Forks - welds, lock pins, and fork bars",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_FORKS_WELDS_LOCK_PINS_FORK_BARS_COLUMN_ID"
  },
  {
    title: "03 Fork wear - measure",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_FORK_WEAR_MEASURE_COLUMN_ID"
  },
  {
    title: "04 Carriage - welds, backrest, bearings, bars",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_CARRIAGE_WELDS_BACKREST_BEARINGS_BARS_COLUMN_ID"
  },
  {
    title: "05 Mast - trunnions, crosshead bars, welds, bearings",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_MAST_TRUNNIONS_CROSSHEAD_BARS_WELDS_BEARINGS_COLUMN_ID"
  },
  {
    title: "06 Lift cylinders - leaks, hosing, anchors, drift, lines",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_LIFT_CYLINDERS_LEAKS_HOSING_ANCHORS_DRIFT_LINES_COLUMN_ID"
  },
  {
    title: "07 Tilt cylinders - leaks, hosing, tilt range, drift",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_TILT_CYLINDERS_LEAKS_HOSING_TILT_RANGE_DRIFT_COLUMN_ID"
  },
  {
    title: "08 Frame welds - alignment",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_FRAME_WELDS_ALIGNMENT_COLUMN_ID"
  },
  {
    title: "09 Vehicle capacity rating plate",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_VEHICLE_CAPACITY_RATING_PLATE_COLUMN_ID"
  },
  {
    title: "10 Counterweight mounts",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_COUNTERWEIGHT_MOUNTS_COLUMN_ID"
  },
  {
    title: "11 Overhead guard - corners, welds, mounts",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_OVERHEAD_GUARD_CORNERS_WELDS_MOUNTS_COLUMN_ID"
  },
  {
    title: "12 Cab - welds, mounts, guards",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_CAB_WELDS_MOUNTS_GUARDS_COLUMN_ID"
  },
  {
    title: "13 Tires, wheels, tread, and rim",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_TIRES_WHEELS_TREAD_RIM_COLUMN_ID"
  },
  {
    title: "14 Attachments - welds, capacity",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_ATTACHMENTS_WELDS_CAPACITY_COLUMN_ID"
  },
  {
    title: "15 Hydraulics - control valve returns to neutral",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_HYDRAULICS_CONTROL_VALVE_NEUTRAL_COLUMN_ID"
  },
  {
    title: "16 Brakes - operational",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_BRAKES_OPERATIONAL_COLUMN_ID"
  },
  {
    title: "17 Emergency brake",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_BRAKE_EMERGENCY_COLUMN_ID"
  },
  {
    title: "18 Steering",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_STEERING_COLUMN_ID"
  },
  {
    title: "19 Electrical - warning systems, lights, horn",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_ELECTRICAL_WARNING_LIGHTS_HORN_COLUMN_ID"
  },
  {
    title: "20 Batteries",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_BATTERIES_COLUMN_ID"
  },
  {
    title: "21 Emissions check",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_EMISSIONS_CHECK_COLUMN_ID"
  },
  {
    title: "22 Engine oil level",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_ENGINE_OIL_LEVEL_COLUMN_ID"
  },
  {
    title: "23 Scissor only - platform rails, chains, latches",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_SCISSOR_PLATFORM_RAILS_CHAINS_LATCHES_COLUMN_ID"
  },
  {
    title: "24 Scissor only - hydraulics and control portion pipes",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_SCISSOR_HYDRAULICS_CONTROL_PORTION_PIPES_COLUMN_ID"
  },
  {
    title: "25 Scissor only - pump fittings",
    type: "status",
    env: "MONDAY_ANNUAL_CHECK_ANNUAL_SCISSOR_PUMP_FITS_COLUMN_ID"
  }
];

async function mondayRequest(query, variables = {}) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `monday.com API request failed (${response.status}): ${
        payload.error_message || payload.error || "Unknown error"
      }`
    );
  }

  if (payload.errors?.length) {
    const message = payload.errors.map((error) => error.message).join("; ");
    throw new Error(`monday.com GraphQL error: ${message}`);
  }

  return payload.data;
}

async function fetchBoardSnapshot() {
  const query = `
    query AnnualBoardSnapshot($boardIds: [ID!]) {
      boards(ids: $boardIds) {
        id
        name
        groups {
          id
          title
        }
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const data = await mondayRequest(query, {
    boardIds: [annualBoardId]
  });

  const board = data?.boards?.[0];
  if (!board) {
    throw new Error(`Board not found for MONDAY_ANNUAL_BOARD_ID=${annualBoardId}.`);
  }

  return board;
}

async function createGroup(title) {
  const query = `
    mutation CreateAnnualGroup($boardId: ID!, $groupName: String!) {
      create_group(board_id: $boardId, group_name: $groupName) {
        id
        title
      }
    }
  `;

  const data = await mondayRequest(query, {
    boardId: annualBoardId,
    groupName: title
  });

  return data?.create_group ?? null;
}

async function createColumn(definition) {
  const type = definition.type;
  const isStatus = type === "status";

  const statusQuery = `
    mutation CreateAnnualStatusColumn(
      $boardId: ID!
      $title: String!
      $defaults: JSON!
    ) {
      create_column(
        board_id: $boardId
        title: $title
        column_type: status
        defaults: $defaults
      ) {
        id
        title
        type
      }
    }
  `;

  const genericQuery = `
    mutation CreateAnnualColumn(
      $boardId: ID!
      $title: String!
    ) {
      create_column(
        board_id: $boardId
        title: $title
        column_type: ${type}
      ) {
        id
        title
        type
      }
    }
  `;

  const data = await mondayRequest(
    isStatus ? statusQuery : genericQuery,
    isStatus
      ? {
          boardId: annualBoardId,
          title: definition.title,
          defaults: statusDefaults
        }
      : {
          boardId: annualBoardId,
          title: definition.title
        }
  );
  return data?.create_column ?? null;
}

function findByTitle(items, title) {
  const key = normalizeTitle(title);
  return items.find((item) => normalizeTitle(item.title) === key) ?? null;
}

async function run() {
  console.log("Setting up annual board groups and columns...");
  console.log(
    "Note: monday columns are board-level and shared by all groups. Groups do not have separate column sets."
  );

  let board = await fetchBoardSnapshot();
  const createdGroups = [];
  const createdColumns = [];

  for (const groupDefinition of groupDefinitions) {
    const existingGroup = findByTitle(board.groups || [], groupDefinition.title);
    if (existingGroup) {
      continue;
    }

    const created = await createGroup(groupDefinition.title);
    if (created) {
      createdGroups.push(created.title || groupDefinition.title);
      board = await fetchBoardSnapshot();
    }
  }

  for (const columnDefinition of columnDefinitions) {
    const existingColumn = findByTitle(board.columns || [], columnDefinition.title);
    if (existingColumn) {
      continue;
    }

    const created = await createColumn(columnDefinition);
    if (created) {
      createdColumns.push(created.title || columnDefinition.title);
      board = await fetchBoardSnapshot();
    }
  }

  const envAssignments = [];
  for (const groupDefinition of groupDefinitions) {
    if (!groupDefinition.env) {
      continue;
    }
    const group = findByTitle(board.groups || [], groupDefinition.title);
    if (group?.id) {
      envAssignments.push(`${groupDefinition.env}=${group.id}`);
    }
  }

  for (const columnDefinition of columnDefinitions) {
    const column = findByTitle(board.columns || [], columnDefinition.title);
    if (column?.id) {
      envAssignments.push(`${columnDefinition.env}=${column.id}`);
    }
  }

  console.log("");
  console.log(`Board: ${board.name} (${board.id})`);
  console.log(`Groups created: ${createdGroups.length}`);
  if (createdGroups.length) {
    for (const title of createdGroups) {
      console.log(`  + ${title}`);
    }
  }
  console.log(`Columns created: ${createdColumns.length}`);
  if (createdColumns.length) {
    for (const title of createdColumns) {
      console.log(`  + ${title}`);
    }
  }

  console.log("");
  console.log("Paste these into your .env:");
  for (const assignment of envAssignments) {
    console.log(assignment);
  }
}

run().catch((error) => {
  console.error("");
  console.error("Annual board setup failed.");
  console.error(error.message || error);
  process.exitCode = 1;
});
