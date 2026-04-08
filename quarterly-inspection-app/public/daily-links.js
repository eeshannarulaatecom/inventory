const elements = {
  banner: document.querySelector("#banner"),
  linksBody: document.querySelector("#linksBody"),
  copyCsvButton: document.querySelector("#copyCsvButton")
};

const state = {
  links: [],
  qrDataUrlByUrl: new Map(),
  qrLoadErrorShown: false
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

function ensureQrGenerator() {
  if (window.QRCode && typeof window.QRCode.toDataURL === "function") {
    return window.QRCode;
  }
  throw new Error("QR generator failed to load.");
}

function toSafeFileNamePart(value, fallback) {
  const text = (value || "").toString().trim().toLowerCase();
  if (!text) {
    return fallback;
  }
  return text.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function qrFileName(link) {
  const serial = toSafeFileNamePart(link.serialNumber, "");
  const equipment = toSafeFileNamePart(link.equipmentId, "equipment");
  const key = serial || equipment;
  return `${key}-daily-qr.png`;
}

function triggerDownload(dataUrl, fileName) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function generateQrDataUrl(text, width = 180) {
  return new Promise((resolve, reject) => {
    try {
      const qr = ensureQrGenerator();
      qr.toDataURL(
        text,
        {
          width,
          margin: 1,
          errorCorrectionLevel: "M"
        },
        (error, url) => {
          if (error || !url) {
            reject(error || new Error("Unable to generate QR code."));
            return;
          }
          resolve(url);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function getQrDataUrl(url) {
  const key = (url || "").toString();
  if (state.qrDataUrlByUrl.has(key)) {
    return state.qrDataUrlByUrl.get(key);
  }
  const dataUrl = await generateQrDataUrl(key);
  state.qrDataUrlByUrl.set(key, dataUrl);
  return dataUrl;
}

async function populateQrPreview(link, previewImage, previewStatus, downloadButton) {
  try {
    const dataUrl = await getQrDataUrl(link.url);
    previewImage.src = dataUrl;
    previewImage.classList.remove("hidden");
    previewStatus.classList.add("hidden");
    previewStatus.textContent = "";
    downloadButton.disabled = false;
  } catch (error) {
    previewStatus.classList.remove("hidden");
    previewStatus.textContent = "QR unavailable";
    downloadButton.disabled = true;
    if (!state.qrLoadErrorShown) {
      state.qrLoadErrorShown = true;
      setBanner("error", `Unable to generate QR images: ${error.message}`);
    }
  }
}

async function downloadQr(link, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing...";

  try {
    const dataUrl = await getQrDataUrl(link.url);
    triggerDownload(dataUrl, qrFileName(link));
    setBanner("success", `Downloaded QR image for ${safeText(link.serialNumber)}.`);
  } catch (error) {
    setBanner("error", `Unable to download QR image: ${error.message}`);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
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
    row.innerHTML = '<td colspan="8">No equipment links were returned.</td>';
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

    const previewCell = document.createElement("td");
    const previewImage = document.createElement("img");
    previewImage.className = "qr-preview hidden";
    previewImage.alt = `QR for ${safeText(link.serialNumber, link.equipmentId)}`;
    previewImage.loading = "lazy";
    previewImage.decoding = "async";
    previewImage.width = 120;
    previewImage.height = 120;
    const previewStatus = document.createElement("div");
    previewStatus.className = "qr-status";
    previewStatus.textContent = "Generating...";
    previewCell.append(previewImage, previewStatus);
    row.append(previewCell);

    const actionCell = document.createElement("td");
    actionCell.className = "link-actions";

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

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "button-secondary";
    downloadButton.textContent = "Download QR";
    downloadButton.disabled = true;
    downloadButton.addEventListener("click", () => {
      downloadQr(link, downloadButton);
    });

    actionCell.append(copyButton, downloadButton);
    row.append(actionCell);

    elements.linksBody.append(row);
    populateQrPreview(link, previewImage, previewStatus, downloadButton);
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
