const elements = {
  banner: document.querySelector("#banner"),
  linksBody: document.querySelector("#linksBody"),
  copyCsvButton: document.querySelector("#copyCsvButton")
};

const state = {
  links: []
};

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

function safeText(value, fallback = "--") {
  const text = (value || "").toString().trim();
  return text || fallback;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

function renderRows() {
  elements.linksBody.innerHTML = "";

  if (!state.links.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="7">No equipment links were returned.</td>';
    elements.linksBody.append(row);
    return;
  }

  for (const link of state.links) {
    const row = document.createElement("tr");

    const serialCell = document.createElement("td");
    serialCell.textContent = safeText(link.serialNumber);
    row.append(serialCell);

    const equipmentCell = document.createElement("td");
    equipmentCell.textContent = safeText(link.equipmentId);
    row.append(equipmentCell);

    const makeCell = document.createElement("td");
    makeCell.textContent = safeText(link.make);
    row.append(makeCell);

    const modelCell = document.createElement("td");
    modelCell.textContent = safeText(link.modelNumber);
    row.append(modelCell);

    const typeCell = document.createElement("td");
    typeCell.textContent = safeText(link.type);
    row.append(typeCell);

    const urlCell = document.createElement("td");
    const urlText = document.createElement("span");
    urlText.className = "qr-url";
    urlText.textContent = safeText(link.url);
    urlCell.append(urlText);
    row.append(urlCell);

    const copyCell = document.createElement("td");
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "button-secondary";
    copyButton.textContent = "Copy URL";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(link.url || "");
        setBanner("success", `Copied QR URL for ${safeText(link.serialNumber)}.`);
      } catch (error) {
        setBanner("error", `Unable to copy URL: ${error.message}`);
      }
    });
    copyCell.append(copyButton);
    row.append(copyCell);

    elements.linksBody.append(row);
  }
}

function toCsvValue(value) {
  const text = (value || "").toString();
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function buildCsv() {
  const headers = [
    "serial_number",
    "equipment_id",
    "make",
    "model_number",
    "type",
    "daily_form_url"
  ];
  const rows = state.links.map((link) =>
    [
      link.serialNumber,
      link.equipmentId,
      link.make,
      link.modelNumber,
      link.type,
      link.url
    ]
      .map(toCsvValue)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

async function copyCsv() {
  if (!state.links.length) {
    setBanner("error", "No QR links available to copy.");
    return;
  }

  try {
    const csv = buildCsv();
    await navigator.clipboard.writeText(csv);
    setBanner("success", `Copied ${state.links.length} QR links as CSV.`);
  } catch (error) {
    setBanner("error", `Unable to copy CSV: ${error.message}`);
  }
}

async function loadLinks() {
  setBanner("info", "Loading equipment QR links...");

  try {
    const payload = await fetchJson("/api/daily/qr-links");
    state.links = Array.isArray(payload.links) ? payload.links : [];
    renderRows();
    setBanner("success", `Loaded ${state.links.length} QR links.`);
  } catch (error) {
    state.links = [];
    renderRows();
    setBanner("error", error.message);
  }
}

elements.copyCsvButton.addEventListener("click", copyCsv);

clearBanner();
loadLinks();
