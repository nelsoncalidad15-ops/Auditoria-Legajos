
# Instrucciones para Google Sheets (CORREGIDO)

Siga estos pasos para conectar su aplicación:

1. Abra su Google Sheet.
2. Vaya a **Extensiones** > **Apps Script**.
3. **BORRE TODO** y pegue este código:

```javascript
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Fecha", "Sucursal", "Legajo", "Puntajes", "Observaciones", "Evidencias", "Resultado Final %"]);
    }
    
    var scoresValues = Object.values(data.scores);
    var totalPoints = scoresValues.length;
    var achievedPoints = scoresValues.reduce(function(a, b) { return a + b; }, 0);
    var percentage = totalPoints > 0 ? (achievedPoints / totalPoints) * 100 : 0;

    sheet.appendRow([
      new Date(),
      data.sucursal,
      data.legajoNombre,
      JSON.stringify(data.scores),
      data.observaciones,
      data.evidencias.length + " img",
      percentage.toFixed(2) + "%"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "error": err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("OK");
}
```

4. **Implementar** > **Nueva implementación** > **Aplicación web**.
5. Acceso: **Cualquiera**.
6. Copie la URL y péguela en `src/services/googleSheetsService.ts`.
