/**
 * API da planilha de governança — devolve TODAS as abas em JSON.
 *
 * Como usar:
 * 1. Na planilha: Extensões > Apps Script. Apague o código atual e cole este.
 * 2. Implantar > Gerenciar implantações > (lápis) Editar > Versão: Nova versão > Implantar.
 *    (ou Implantar > Nova implantação > App da Web)
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 3. Abra a URL /exec no navegador: deve aparecer um JSON com dIndicadores, fMedicoes,
 *    dRiscos e dDecisoes.
 *
 * Formato da resposta:
 * { "atualizadoEm": "...", "abas": { "dIndicadores": [ {ID:..., Indicador:...}, ... ], ... } }
 */
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abas = {};
  ss.getSheets().forEach(function (sh) {
    var valores = sh.getDataRange().getValues();
    if (valores.length < 2) return;
    var cab = valores[0].map(function (h) { return String(h).trim(); });
    abas[sh.getName()] = valores.slice(1)
      .filter(function (linha) { return linha.some(function (c) { return c !== "" && c !== null; }); })
      .map(function (linha) {
        var obj = {};
        cab.forEach(function (h, i) {
          if (!h) return;
          var v = linha[i];
          obj[h] = v instanceof Date ? v.toISOString() : v;
        });
        return obj;
      });
  });
  var saida = { atualizadoEm: new Date().toISOString(), abas: abas };
  return ContentService.createTextOutput(JSON.stringify(saida))
    .setMimeType(ContentService.MimeType.JSON);
}
