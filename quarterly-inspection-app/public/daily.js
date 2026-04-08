const elements = {
  form: document.querySelector("#dailyForm"),
  banner: document.querySelector("#banner"),
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
  equipment: null,
  template: null,
  passLabel: "Pass",
  failLabel: "Fail",
  isLoading: false,
  isSubmitting: false
};

function getQueryEquipmentIdentifier() {
  const params = new URLSearchParams(window.location.search);
  return {
    serial: (params.get("serial") || "").trim(),
    equipmentId: (params.get("equipmentId") || "").trim()
  };
}

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
}

function clearBanner() {
  elements.banner.classList.add("hidden");
  elements.banner.textContent = "";
}

function setBusyState() {
  elements.submitButton.disabled =
    state.isLoading || state.isSubmitting || !state.equipment || !state.template;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
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
          <th style="width:42%">Check Item</th>
          <th style="width:24%">Result</th>
          <th style="width:34%">Comments</th>
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
      itemCell.append(itemTitle);
      row.append(itemCell);

      const resultCell = document.createElement("td");
      resultCell.className = "result-cell";

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
      resultCell.append(resultOptions);
      row.append(resultCell);

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

async function submitDailyCheck(event) {
  event.preventDefault();
  clearBanner();

  if (!state.equipment || !state.template) {
    setBanner("error", "Daily form is not loaded yet.");
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
  setBanner("info", "Saving daily check to monday.com...");

  try {
    const payload = await fetchJson("/api/daily/submit", {
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
      `Daily check saved. Item ${payload.createdItemId || "created"} | Overall: ${
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

async function loadDailyForm() {
  const identifier = getQueryEquipmentIdentifier();
  if (!identifier.serial && !identifier.equipmentId) {
    setBanner(
      "error",
      "Missing query parameter. Open with ?serial=... or ?equipmentId=... from a QR code."
    );
    elements.checklistContainer.innerHTML =
      '<p class="placeholder-copy">No equipment identifier found in URL.</p>';
    setBusyState();
    return;
  }

  state.isLoading = true;
  setBusyState();
  setBanner("info", "Loading equipment and checklist template...");

  try {
    const query = new URLSearchParams();
    if (identifier.serial) {
      query.set("serial", identifier.serial);
    }
    if (identifier.equipmentId) {
      query.set("equipmentId", identifier.equipmentId);
    }

    const [configPayload, formPayload] = await Promise.all([
      fetchJson("/api/config"),
      fetchJson(`/api/daily/form?${query.toString()}`)
    ]);

    state.passLabel = configPayload.passLabel || "Pass";
    state.failLabel = configPayload.failLabel || "Fail";
    state.equipment = formPayload.equipment || null;
    state.template = formPayload.template || null;

    populateEquipmentCard();
    renderTemplate();

    elements.checkDate.value = todayDateString();
    elements.checkTime.value = currentTimeString();

    setBanner(
      "success",
      `Loaded daily form for ${safeText(state.equipment?.serialNumber, "selected equipment")}.`
    );
  } catch (error) {
    elements.checklistContainer.innerHTML =
      '<p class="placeholder-copy">Unable to load daily form. Check your equipment mapping.</p>';
    setBanner("error", error.message);
  } finally {
    state.isLoading = false;
    setBusyState();
  }
}

elements.form.addEventListener("submit", submitDailyCheck);

loadDailyForm();
