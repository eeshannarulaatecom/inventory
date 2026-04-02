import { EMPTY_VALUE, PASS_FAIL_PLACEHOLDER } from "./constants.js";

const elements = {
  form: document.querySelector("#inspectionForm"),
  checkDateInput: document.querySelector("#checkDate"),
  submitButton: document.querySelector("#submitButton"),
  refreshButton: document.querySelector("#refreshButton"),
  tableBody: document.querySelector("#equipmentBody"),
  banner: document.querySelector("#banner"),
  passLabel: document.querySelector("#passLabel"),
  failLabel: document.querySelector("#failLabel")
};

const state = {
  equipment: [],
  passLabel: "Pass",
  failLabel: "Fail",
  isLoading: false,
  isSubmitting: false
};

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setBanner(type, message) {
  elements.banner.classList.remove("hidden", "banner-info", "banner-error", "banner-success");
  elements.banner.classList.add(`banner-${type}`);
  elements.banner.textContent = message;
}

function clearBanner() {
  elements.banner.classList.add("hidden");
  elements.banner.textContent = "";
}

function setBusyState() {
  elements.submitButton.disabled = state.isLoading || state.isSubmitting || !state.equipment.length;
  elements.refreshButton.disabled = state.isLoading || state.isSubmitting;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

function makeTextCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value || EMPTY_VALUE;
  return cell;
}

function makePassFailCell() {
  const cell = document.createElement("td");
  const select = document.createElement("select");
  select.className = "pass-fail-select";
  select.required = true;

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = PASS_FAIL_PLACEHOLDER;
  select.append(defaultOption);

  const passOption = document.createElement("option");
  passOption.value = state.passLabel;
  passOption.textContent = state.passLabel;
  select.append(passOption);

  const failOption = document.createElement("option");
  failOption.value = state.failLabel;
  failOption.textContent = state.failLabel;
  select.append(failOption);

  cell.append(select);
  return cell;
}

function makeCommentsCell() {
  const cell = document.createElement("td");
  const textarea = document.createElement("textarea");
  textarea.className = "comments-input";
  textarea.rows = 2;
  textarea.maxLength = 1000;
  textarea.placeholder = "Optional comments";
  cell.append(textarea);
  return cell;
}

function renderEmptyRow(message) {
  elements.tableBody.innerHTML = "";
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 7;
  cell.className = "placeholder-cell";
  cell.textContent = message;
  row.append(cell);
  elements.tableBody.append(row);
}

function renderEquipmentRows() {
  if (!state.equipment.length) {
    renderEmptyRow("No equipment found in the Inventory board.");
    setBusyState();
    return;
  }

  elements.tableBody.innerHTML = "";

  for (const item of state.equipment) {
    const row = document.createElement("tr");
    row.dataset.inventoryItemId = item.inventoryItemId || "";
    row.dataset.serialNumber = item.serialNumber || "";
    row.dataset.modelNumber = item.modelNumber || "";

    row.append(makeTextCell(item.serialNumber));
    row.append(makeTextCell(item.equipmentId));
    row.append(makeTextCell(item.make));
    row.append(makeTextCell(item.modelNumber));
    row.append(makeTextCell(item.type));
    row.append(makePassFailCell());
    row.append(makeCommentsCell());

    elements.tableBody.append(row);
  }

  setBusyState();
}

async function loadPageData() {
  state.isLoading = true;
  setBusyState();
  setBanner("info", "Loading inventory equipment from monday.com...");

  try {
    const [configPayload, equipmentPayload] = await Promise.all([
      fetchJson("/api/config"),
      fetchJson("/api/equipment")
    ]);

    state.passLabel = configPayload.passLabel || "Pass";
    state.failLabel = configPayload.failLabel || "Fail";
    state.equipment = equipmentPayload.items || [];

    elements.passLabel.textContent = state.passLabel;
    elements.failLabel.textContent = state.failLabel;
    renderEquipmentRows();

    if (state.equipment.length) {
      setBanner(
        "success",
        `Loaded ${state.equipment.length} equipment records. Choose ${state.passLabel} or ${state.failLabel} for every row to submit.`
      );
    } else {
      setBanner("info", "Inventory board returned no equipment records.");
    }
  } catch (error) {
    renderEmptyRow("Unable to load equipment. Check API and .env configuration.");
    setBanner("error", error.message);
  } finally {
    state.isLoading = false;
    setBusyState();
  }
}

function collectEntries() {
  const rows = Array.from(
    elements.tableBody.querySelectorAll("tr[data-inventory-item-id]")
  );
  const entries = [];
  const missingRows = [];

  for (const row of rows) {
    row.classList.remove("row-missing");
    const passFailSelect = row.querySelector(".pass-fail-select");
    const commentsInput = row.querySelector(".comments-input");

    if (!passFailSelect?.value) {
      row.classList.add("row-missing");
      missingRows.push(row);
      continue;
    }

    entries.push({
      inventoryItemId: row.dataset.inventoryItemId || "",
      serialNumber: row.dataset.serialNumber || "",
      modelNumber: row.dataset.modelNumber || "",
      passFail: passFailSelect.value,
      comments: commentsInput?.value?.trim() || ""
    });
  }

  return { entries, missingRows };
}

async function submitChecks(event) {
  event.preventDefault();
  clearBanner();

  if (!state.equipment.length) {
    setBanner("error", "No equipment rows are available to submit.");
    return;
  }

  const checkDate = elements.checkDateInput.value;
  if (!checkDate) {
    setBanner("error", "Please select a check date.");
    elements.checkDateInput.focus();
    return;
  }

  const { entries, missingRows } = collectEntries();
  if (missingRows.length) {
    setBanner(
      "error",
      `Select ${state.passLabel} or ${state.failLabel} for all ${state.equipment.length} equipment rows before submitting.`
    );
    missingRows[0].querySelector(".pass-fail-select")?.focus();
    return;
  }

  state.isSubmitting = true;
  setBusyState();
  setBanner("info", "Submitting quarterly checks to monday.com...");

  try {
    const result = await fetchJson("/api/quarterly/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        checkDate,
        entries
      })
    });

    setBanner(
      "success",
      `Saved successfully. Updated ${result.updated} rows, created ${result.created} rows. Next check date: ${result.nextCheckDate}.`
    );
  } catch (error) {
    setBanner("error", error.message);
  } finally {
    state.isSubmitting = false;
    setBusyState();
  }
}

elements.form.addEventListener("submit", submitChecks);
elements.refreshButton.addEventListener("click", loadPageData);
elements.checkDateInput.value = todayString();

loadPageData();
