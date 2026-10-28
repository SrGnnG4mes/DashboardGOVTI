/* =========================================================================
   Configuração do painel — é o único arquivo que normalmente precisa mudar.
   ========================================================================= */
window.CONFIG = {
  /* ---------------------------------------------------------------------
     FONTES DE DADOS, tentadas nesta ordem. A primeira que responder vence.
       "planilha_publicada" -> arquivo .xlsx da planilha "Publicada na Web"
                               (não precisa de Apps Script; lê todas as abas)
       "planilha_gviz"      -> API de consulta do Google Sheets, aba por aba
                               (precisa de PLANILHA_ID e compartilhamento por link)
       "apps_script"        -> URL /exec do Google Apps Script (JSON)
       "json_local"         -> data/dados.json no próprio repositório
                               (atualizado pelo GitHub Actions)
     ------------------------------------------------------------------- */
  FONTES: ["planilha_publicada", "apps_script", "planilha_gviz", "json_local"],

  // Link da planilha publicada (Arquivo > Compartilhar > Publicar na Web)
  PLANILHA_PUBLICADA_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7-JA1SfYMGei5qJcPNDMMGiO5zONhgdJ1YPCWltni253zeRRm-6_b73c8MswSaipsCL9rPORgWbeS/pubhtml",

  // ID da planilha (o trecho entre /d/ e /edit no link de edição). Opcional:
  // só é usado pela fonte "planilha_gviz". Ex.: "1AbCdEf...xyz"
  PLANILHA_ID: "",
  // Abas lidas pela fonte "planilha_gviz" (precisa listar os nomes)
  ABAS: ["dIndicadores", "fMedicoes", "dRiscos", "dDecisoes", "dServicos"],

  // Endpoint do Google Apps Script que devolve a planilha em JSON (GET)
  API_URL:
    "https://script.google.com/macros/s/AKfycbyVpUQ8Wy_Hjz5c6X63F-6H11TLa31LUJDDQ1xwKAFwHIBKdnJuHY1mjq0_FLbPnghTlw/exec",

  // Arquivo gerado pelo GitHub Actions (mesmo domínio do site, sem CORS)
  JSON_LOCAL_URL: "data/dados.json",

  // Leitor de .xlsx incluído no repositório (SheetJS)
  XLSX_LIB_URL: "assets/vendor/xlsx.full.min.js",

  // Atualização automática (segundos). 0 desliga.
  ATUALIZAR_A_CADA_SEG: 60,

  // Tempo máximo de espera de cada fonte (milissegundos)
  TIMEOUT_MS: 20000,

  // Se todas as fontes falharem, mostrar os dados de exemplo (com aviso)?
  USAR_EXEMPLO_SE_FALHAR: true,

  // Regra de situação (a mesma do PDF e do Power BI)
  LIMIAR_INDICE_RISCO: 13,   // risco associado com índice >= 13 (faixa alta/crítica)
  LIMIAR_DESVIO: -0.15,      // ou 15% (ou mais) abaixo da meta  -> "Crítica"

  // Indicador exibido por padrão no gráfico de série
  INDICADOR_SERIE_PADRAO: "IND01",

  ORGANIZACAO: "Boa Esperança",
  USUARIO: "Coordenação de TI",
  USUARIO_SUB: "CSTSI6 · Gestão de TI",
};
