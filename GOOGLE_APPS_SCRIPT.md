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
function getSheetByName_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
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

    var sheet = getSheetByName_("Auditorias");
    ensureAuditHeader_(sheet);

    var scoresValues = Object.values(payload.scores || {});
    var totalPoints = scoresValues.length;
    var achievedPoints = scoresValues.reduce(function(a, b) { return a + b; }, 0);
    var percentage = totalPoints > 0 ? (achievedPoints / totalPoints) * 100 : 0;

    sheet.appendRow([
      new Date(),
      payload.sucursal || "",
      payload.legajoNombre || "",
      JSON.stringify(payload.scores || {}),
      JSON.stringify(payload.itemDetails || {}),
      payload.observaciones || "",
      (payload.evidencias || []).length + " img",
      percentage.toFixed(2) + "%",
      "",
      "",
      ""
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
