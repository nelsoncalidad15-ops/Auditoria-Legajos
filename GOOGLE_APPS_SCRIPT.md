  # Instrucciones para Google Sheets

Use este Apps Script para guardar:
- auditorias terminadas
- configuracion de preguntas
- sesiones y avances en curso

## 1. Crear hojas

En su archivo de Google Sheets cree estas hojas:
- `Auditorias`
- `Configuracion`
- `Sesiones`

## 2. Pegue este codigo en Apps Script

```javascript
var DRIVE_ROOT_FOLDER_ID = "";
var DRIVE_ROOT_FOLDER_NAME = "Audit Legajos Evidencias";

function getSheetByName_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function sanitizeDriveName_(value) {
  return String(value || "Sin dato")
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function getDriveRootFolder_() {
  if (DRIVE_ROOT_FOLDER_ID) {
    return DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  }

  var folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
}

function getOrCreateChildFolder_(parent, name) {
  var safeName = sanitizeDriveName_(name);
  var folders = parent.getFoldersByName(safeName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(safeName);
}

function buildEvidenceFileName_(payload) {
  var extByMime = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif"
  };

  var extension = extByMime[payload.mimeType] || "";
  var parts = [
    sanitizeDriveName_(payload.legajoNombre || "Legajo"),
    payload.itemId ? "Item-" + payload.itemId : "General",
    sanitizeDriveName_(payload.itemRequisito || "Evidencia"),
    new Date().getTime()
  ];

  return parts.join("_") + extension;
}

function uploadEvidenceToDrive_(payload) {
  if (!payload || !payload.dataBase64) {
    throw new Error("EVIDENCE_DATA_REQUIRED");
  }

  var rootFolder = getDriveRootFolder_();
  var auditFolderName = [
    sanitizeDriveName_(payload.sucursal || "Sucursal"),
    sanitizeDriveName_(payload.auditoriaNombre || "Auditoria"),
    sanitizeDriveName_(payload.auditoriaId || "sin-id")
  ].join(" - ");
  var auditFolder = getOrCreateChildFolder_(rootFolder, auditFolderName);

  var bytes = Utilities.base64Decode(payload.dataBase64);
  var blob = Utilities.newBlob(bytes, payload.mimeType || "application/octet-stream", buildEvidenceFileName_(payload));
  var file = auditFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    kind: "drive",
    fileId: file.getId(),
    name: file.getName(),
    mimeType: file.getMimeType(),
    url: "https://drive.google.com/uc?export=view&id=" + file.getId(),
    previewUrl: "https://drive.google.com/uc?export=view&id=" + file.getId(),
    openUrl: file.getUrl(),
    uploadedAt: new Date().getTime()
  };
}

function ensureAuditHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Fecha",
      "Sucursal",
      "Legajo",
      "Puntajes",
      "Detalle por item",
      "Observaciones",
      "Evidencias",
      "Resultado Final %",
      "Admin %",
      "Pre-Entrega %",
      "Ventas %"
    ]);
  }
}

function ensureConfigHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Requisito", "Descripcion", "Roles"]);
  }
}

function ensureSessionsHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "SessionId",
      "Nombre",
      "Sucursal",
      "Auditor",
      "Objetivo",
      "Estado",
      "CreatedAt",
      "UpdatedAt",
      "Legajos",
      "SessionJson"
    ]);
  }
}

function saveQuestionsConfig_(items) {
  var sheet = getSheetByName_("Configuracion");
  ensureConfigHeader_(sheet);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }

  if (!items || !items.length) return;

  var rows = items.map(function(item) {
    return [
      item.id,
      item.requisito,
      item.descripcion,
      (item.roles || []).join(", ")
    ];
  });

  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
}

function loadQuestionsConfig_() {
  var sheet = getSheetByName_("Configuracion");
  ensureConfigHeader_(sheet);

  if (sheet.getLastRow() <= 1) {
    return { items: [] };
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  var items = values
    .filter(function(row) { return row[0]; })
    .map(function(row) {
      return {
        id: Number(row[0]),
        requisito: row[1],
        descripcion: row[2],
        roles: row[3] ? String(row[3]).split(",").map(function(role) { return role.trim(); }) : []
      };
    });

  return { items: items };
}

function saveSessionRecord_(session) {
  var sheet = getSheetByName_("Sesiones");
  ensureSessionsHeader_(sheet);

  if (!session || !session.id) {
    throw new Error("SESSION_ID_REQUIRED");
  }

  var values = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues()
    : [];

  var targetRow = -1;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(session.id)) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow === -1) {
    targetRow = sheet.getLastRow() + 1;
  } else {
    var existingUpdatedAt = Number(values[targetRow - 2][7] || 0);
    var incomingUpdatedAt = Number(session.updatedAt || 0);
    if (existingUpdatedAt > incomingUpdatedAt) {
      return { skipped: true, reason: "OLDER_SESSION_VERSION" };
    }
  }

  sheet.getRange(targetRow, 1, 1, 10).setValues([[
    session.id,
    session.nombre || "",
    session.sucursal || "",
    session.auditor || "",
    Number(session.objetivo || 0),
    session.status || "en_curso",
    Number(session.createdAt || 0),
    Number(session.updatedAt || 0),
    JSON.stringify(session.legajos || []),
    JSON.stringify(session)
  ]]);

  return { skipped: false };
}

function loadSessionsSnapshot_() {
  var sheet = getSheetByName_("Sesiones");
  ensureSessionsHeader_(sheet);

  if (sheet.getLastRow() <= 1) {
    return { sessions: [] };
  }

  var header = sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), 10)).getValues()[0];
  var isLegacySnapshot = header[0] === "UpdatedAt" && header[1] === "SessionsJson";

  if (isLegacySnapshot) {
    var rawJson = sheet.getRange(2, 2).getValue();
    if (!rawJson) {
      return { sessions: [] };
    }

    return { sessions: JSON.parse(rawJson) };
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  var byId = {};

  values.forEach(function(row) {
    if (!row[0] || !row[9]) return;

    var session = JSON.parse(row[9]);
    var existing = byId[session.id];
    if (!existing || Number(session.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
      byId[session.id] = session;
    }
  });

  var sessions = Object.keys(byId)
    .map(function(key) { return byId[key]; })
    .sort(function(a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); });

  return { sessions: sessions };
}

function doGet(e) {
  var resource = e && e.parameter ? e.parameter.resource : "";

  if (resource === "questions") {
    return ContentService
      .createTextOutput(JSON.stringify(loadQuestionsConfig_()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (resource === "sessions") {
    return ContentService
      .createTextOutput(JSON.stringify(loadSessionsSnapshot_()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var type = body.type || "audit";
    var payload = body.payload || {};

    if (type === "questions_config") {
      saveQuestionsConfig_(payload.items || []);
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "sessions_snapshot") {
      (payload.sessions || []).forEach(function(session) {
        saveSessionRecord_(session);
      });
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "session_record") {
      saveSessionRecord_(payload.session || {});
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "upload_evidence") {
      var evidence = uploadEvidenceToDrive_(payload);
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", evidence: evidence }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = getSheetByName_("Auditorias");
    ensureAuditHeader_(sheet);

    var scoresValues = Object.values(payload.scores || {});
    var totalPoints = scoresValues.length;
    var achievedPoints = scoresValues.reduce(function(a, b) { return a + b; }, 0);
    var percentage = totalPoints > 0 ? (achievedPoints / totalPoints) * 100 : 0;
    var summary = payload.summary || {};
    var totalPercentage = summary.total != null ? Number(summary.total) : percentage;
    var adminPercentage = summary.admin != null ? Number(summary.admin) : "";
    var preEntregaPercentage = summary.preEntrega != null ? Number(summary.preEntrega) : "";
    var ventasPercentage = summary.ventas != null ? Number(summary.ventas) : "";

    sheet.appendRow([
      new Date(),
      payload.sucursal || "",
      payload.legajoNombre || "",
      JSON.stringify(payload.scores || {}),
      JSON.stringify(payload.itemDetails || {}),
      payload.observaciones || "",
      (payload.evidencias || []).length + " img",
      totalPercentage === "" ? "" : totalPercentage.toFixed(2) + "%",
      adminPercentage === "" ? "" : adminPercentage.toFixed(2) + "%",
      preEntregaPercentage === "" ? "" : preEntregaPercentage.toFixed(2) + "%",
      ventasPercentage === "" ? "" : ventasPercentage.toFixed(2) + "%"
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Implementar

1. Vaya a `Implementar > Nueva implementacion > Aplicacion web`
2. En acceso elija `Cualquiera`
3. Copie la URL terminada en `/exec`
4. Pegue la URL en `.env.local`

```env
VITE_GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/SU_DEPLOYMENT_ID/exec"
```

## 4. Reiniciar

Reinicie `npm run dev`.
