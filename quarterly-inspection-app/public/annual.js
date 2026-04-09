const elements = {
  form: document.querySelector("#annualForm"),
  banner: document.querySelector("#banner"),
  bannerBottom: document.querySelector("#bannerBottom"),
  equipmentSelect: document.querySelector("#equipmentSelect"),
  serialNumber: document.querySelector("#serialNumber"),
  equipmentId: document.querySelector("#equipmentId"),
  make: document.querySelector("#make"),
  modelNumber: document.querySelector("#modelNumber"),
  type: document.querySelector("#type"),
  templateName: document.querySelector("#templateName"),
  checkDate: document.querySelector("#checkDate"),
  checkTime: document.querySelector("#checkTime"),
  operatorName: document.querySelector("#operatorName"),
  operatorId: document.querySelector("#operatorId"),
  generalComments: document.querySelector("#generalComments"),
  submitButton: document.querySelector("#submitButton"),
  checklistContainer: document.querySelector("#checklistContainer")
};

const state = {
  equipmentOptions: [],
  equipment: null,
  template: null,
  passLabel: "Pass",
  failLabel: "Fail",
  isLoadingList: false,
  isLoadingForm: false,
  isSubmitting: false
};

function todayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, "0");
  const dd = `${now.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function currentTimeString() {
  const now = new Date();
  const hh = `${now.getHours()}`.padStart(2, "0");
  const mm = `${now.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm}`;
}

function safeText(value, fallback = "--") {
  const text = (value || "").toString().trim();
  return text || fallback;
}

function setBanner(type, message) {
  elements.banner.classList.remove(
    "hidden",
    "banner-info",
    "banner-success",
    "banner-error"
  );
  elements.banner.classList.add(`banner-${type}`);
  elements.banner.textContent = message;

  if (type === "success" || type === "error") {
    elements.bannerBottom.classList.remove(
      "hidden",
      "banner-info",
      "banner-success",
      "banner-error"
    );
    elements.bannerBottom.classList.add(`banner-${type}`);
    elements.bannerBottom.textContent = message;
  } else {
    elements.bannerBottom.classList.add("hidden");
    elements.bannerBottom.textContent = "";
  }
}

function clearBanner() {
  elements.banner.classList.add("hidden");
  elements.banner.textContent = "";
  elements.bannerBottom.classList.add("hidden");
  elements.bannerBottom.textContent = "";
}

function setBusyState() {
  const isBusy = state.isLoadingList || state.isLoadingForm || state.isSubmitting;
  elements.equipmentSelect.disabled = isBusy || !state.equipmentOptions.length;
  elements.submitButton.disabled =
    isBusy || !state.equipment || !state.template || !state.equipmentOptions.length;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

function equipmentOptionValue(item) {
  const equipmentId = (item?.equipmentId || "").toString().trim();
  const serialNumber = (item?.serialNumber || "").toString().trim();
  if (equipmentId) {
    return `equipmentId:${equipmentId}`;
  }
  return `serial:${serialNumber}`;
}

function parseEquipmentOptionValue(value) {
  const text = (value || "").toString();
  if (!text) {
    return { serialNumber: "", equipmentId: "" };
  }

  if (text.startsWith("equipmentId:")) {
    return {
      serialNumber: "",
      equipmentId: text.slice("equipmentId:".length).trim()
    };
  }

  if (text.startsWith("serial:")) {
    return {
      serialNumber: text.slice("serial:".length).trim(),
      equipmentId: ""
    };
  }

  return { serialNumber: "", equipmentId: "" };
}

function equipmentOptionLabel(item) {
  const equipmentId = safeText(item.equipmentId, "No Equipment ID");
  const serialNumber = safeText(item.serialNumber, "No Serial");
  const make = safeText(item.make, "");
  const modelNumber = safeText(item.modelNumber, "");
  const type = safeText(item.type, "");
  const modelPart = [make, modelNumber].filter(Boolean).join(" ");
  const suffix = [modelPart, type].filter(Boolean).join(" | ");
  return suffix
    ? `${equipmentId} (${serialNumber}) - ${suffix}`
    : `${equipmentId} (${serialNumber})`;
}

function populateEquipmentOptions() {
  elements.equipmentSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select equipment";
  elements.equipmentSelect.append(placeholder);

  for (const item of state.equipmentOptions) {
    const option = document.createElement("option");
    option.value = equipmentOptionValue(item);
    option.textContent = equipmentOptionLabel(item);
    elements.equipmentSelect.append(option);
  }
}

function renderTemplate() {
  elements.checklistContainer.innerHTML = "";

  if (!state.template || !Array.isArray(state.template.sections)) {
    elements.checklistContainer.innerHTML =
      '<p class="placeholder-copy">No checklist template was returned for this equipment.</p>';
    return;
  }

  for (const section of state.template.sections) {
    const sectionCard = document.createElement("section");
    sectionCard.className = "checklist-card";

    const heading = document.createElement("h3");
    heading.textContent = section.title || "Checklist";
    sectionCard.append(heading);

    const tableShell = document.createElement("div");
    tableShell.className = "checklist-table-shell";

    const table = document.createElement("table");
    table.className = "checklist-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:64%">Check Item (Pass/Fail)</th>
          <th style="width:36%">Comments</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    const items = Array.isArray(section.items) ? section.items : [];

    for (const item of items) {
      const row = document.createElement("tr");
      row.dataset.checkId = (item.id || "").toString();
      row.dataset.required = item.required === false ? "false" : "true";

      const itemCell = document.createElement("td");
      const itemTitle = document.createElement("div");
      itemTitle.className = "item-title";
      itemTitle.textContent = item.label || item.id || "Checklist Item";
      const itemResultInline = document.createElement("div");
      itemResultInline.className = "item-result-inline";

      const resultOptions = document.createElement("div");
      resultOptions.className = "result-options";
      const radioGroupName = `result_${item.id}`;

      const passLabel = document.createElement("label");
      passLabel.className = "result-choice";
      const passInput = document.createElement("input");
      passInput.type = "radio";
      passInput.name = radioGroupName;
      passInput.value = state.passLabel;
      const passText = document.createElement("span");
      passText.textContent = state.passLabel;
      passLabel.append(passInput, passText);

      const failLabel = document.createElement("label");
      failLabel.className = "result-choice";
      const failInput = document.createElement("input");
      failInput.type = "radio";
      failInput.name = radioGroupName;
      failInput.value = state.failLabel;
      const failText = document.createElement("span");
      failText.textContent = state.failLabel;
      failLabel.append(failInput, failText);

      resultOptions.append(passLabel, failLabel);
      itemResultInline.append(resultOptions);
      itemCell.append(itemTitle, itemResultInline);
      row.append(itemCell);

      const commentCell = document.createElement("td");
      const commentsInput = document.createElement("textarea");
      commentsInput.className = "check-comment";
      commentsInput.rows = 2;
      commentsInput.maxLength = 500;
      commentsInput.placeholder = "Optional notes";
      commentCell.append(commentsInput);
      row.append(commentCell);

      tbody.append(row);
    }

    tableShell.append(table);
    sectionCard.append(tableShell);
    elements.checklistContainer.append(sectionCard);
  }
}

function populateEquipmentCard() {
  const equipment = state.equipment || {};
  elements.serialNumber.value = safeText(equipment.serialNumber);
  elements.equipmentId.value = safeText(equipment.equipmentId);
  elements.make.value = safeText(equipment.make);
  elements.modelNumber.value = safeText(equipment.modelNumber);
  elements.type.value = safeText(equipment.type);
  elements.templateName.value = safeText(state.template?.title);
}

function collectEntries() {
  const rows = Array.from(elements.checklistContainer.querySelectorAll("tr[data-check-id]"));
  const entries = [];
  const missingRows = [];

  for (const row of rows) {
    row.classList.remove("check-row-missing");
    const checkId = row.dataset.checkId || "";
    const required = row.dataset.required !== "false";

    const selected = row.querySelector('input[type="radio"]:checked');
    if (required && !selected) {
      row.classList.add("check-row-missing");
      missingRows.push(row);
      continue;
    }

    const commentsInput = row.querySelector(".check-comment");
    entries.push({
      checkId,
      result: selected ? selected.value : "",
      comments: (commentsInput?.value || "").trim()
    });
  }

  return { entries, missingRows };
}

async function loadSelectedEquipmentForm() {
  const selected = parseEquipmentOptionValue(elements.equipmentSelect.value);
  if (!selected.serialNumber && !selected.equipmentId) {
    state.equipment = null;
    state.template = null;
    elements.checklistContainer.innerHTML =
      '<p class="placeholder-copy">Select equipment to load checklist...</p>';
    populateEquipmentCard();
    setBusyState();
    return;
  }

  state.isLoadingForm = true;
  setBusyState();
  setBanner("info", "Loading annual checklist template...");

  try {
    const query = new URLSearchParams();
    if (selected.equipmentId) {
      query.set("equipmentId", selected.equipmentId);
    }
    if (selected.serialNumber) {
      query.set("serial", selected.serialNumber);
    }

    const formPayload = await fetchJson(`/api/annual/form?${query.toString()}`);
    state.equipment = formPayload.equipment || null;
    state.template = formPayload.template || null;

    populateEquipmentCard();
    renderTemplate();
    setBanner(
      "success",
      `Loaded annual form for ${safeText(state.equipment?.serialNumber, "selected equipment")}.`
    );
  } catch (error) {
    state.equipment = null;
    state.template = null;
    elements.checklistContainer.innerHTML =
      '<p class="placeholder-copy">Unable to load annual form. Check your equipment mapping.</p>';
    populateEquipmentCard();
    setBanner("error", error.message);
  } finally {
    state.isLoadingForm = false;
    setBusyState();
  }
}

async function submitAnnualCheck(event) {
  event.preventDefault();
  clearBanner();

  if (!state.equipment || !state.template) {
    setBanner("error", "Annual form is not loaded yet.");
    return;
  }

  const checkDate = elements.checkDate.value;
  const checkTime = elements.checkTime.value;
  const operatorName = elements.operatorName.value.trim();
  const operatorId = elements.operatorId.value.trim();
  const generalComments = elements.generalComments.value.trim();

  if (!checkDate) {
    setBanner("error", "Please select a check date.");
    elements.checkDate.focus();
    return;
  }

  if (!checkTime) {
    setBanner("error", "Please select a check time.");
    elements.checkTime.focus();
    return;
  }

  if (!operatorName) {
    setBanner("error", "Operator name is required.");
    elements.operatorName.focus();
    return;
  }

  const { entries, missingRows } = collectEntries();
  if (missingRows.length) {
    setBanner(
      "error",
      `Please mark ${state.passLabel} or ${state.failLabel} for every required checklist item.`
    );
    const firstMissingRadio = missingRows[0].querySelector('input[type="radio"]');
    firstMissingRadio?.focus();
    return;
  }

  state.isSubmitting = true;
  setBusyState();
  setBanner("info", "Saving annual check to monday.com...");

  try {
    const payload = await fetchJson("/api/annual/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        serialNumber: state.equipment.serialNumber || "",
        equipmentId: state.equipment.equipmentId || "",
        checkDate,
        checkTime,
        operatorName,
        operatorId,
        generalComments,
        entries
      })
    });

    setBanner(
      "success",
      `Annual check saved. Item ${payload.createdItemId || "created"} | Overall: ${
        payload.overallResult
      } | Failed checks: ${payload.failedCount}.`
    );
  } catch (error) {
    setBanner("error", error.message);
  } finally {
    state.isSubmitting = false;
    setBusyState();
  }
}

async function initializePage() {
  state.isLoadingList = true;
  setBusyState();
  setBanner("info", "Loading equipment list...");

  try {
    const [configPayload, equipmentPayload] = await Promise.all([
      fetchJson("/api/config"),
      fetchJson("/api/equipment")
    ]);

    state.passLabel = configPayload.passLabel || "Pass";
    state.failLabel = configPayload.failLabel || "Fail";
    state.equipmentOptions = Array.isArray(equipmentPayload.items)
      ? equipmentPayload.items
      : [];

    populateEquipmentOptions();
    if (!elements.checkDate.value) {
      elements.checkDate.value = todayDateString();
    }
    if (!elements.checkTime.value) {
      elements.checkTime.value = currentTimeString();
    }

    if (!state.equipmentOptions.length) {
      setBanner("error", "No equipment found in Inventory board.");
      return;
    }

    elements.equipmentSelect.value = equipmentOptionValue(state.equipmentOptions[0]);
    await loadSelectedEquipmentForm();
  } catch (error) {
    setBanner("error", error.message);
    elements.checklistContainer.innerHTML =
      '<p class="placeholder-copy">Unable to initialize annual form.</p>';
  } finally {
    state.isLoadingList = false;
    setBusyState();
  }
}

elements.form.addEventListener("submit", submitAnnualCheck);
elements.equipmentSelect.addEventListener("change", () => {
  loadSelectedEquipmentForm();
});

initializePage();
