# Instrucciones para Google Sheets

Siga estos pasos para conectar su aplicacion:

1. Abra su Google Sheet.
2. Vaya a `Extensiones > Apps Script`.
3. Borre el contenido actual y pegue este codigo:

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

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("OK");
}
```

4. Haga `Implementar > Nueva implementacion > Aplicacion web`.
5. En acceso, elija `Cualquiera`.
6. Copie la URL terminada en `/exec`.
7. Cree un archivo `.env.local` en la raiz del proyecto con este contenido:

```env
VITE_GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/SU_DEPLOYMENT_ID/exec"
```

8. Reinicie `npm run dev`.
