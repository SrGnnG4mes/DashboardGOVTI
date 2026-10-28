/* =========================================================================
   Configuração do painel — é o único arquivo que normalmente precisa mudar.
   ========================================================================= */
window.CONFIG = {
  // Endpoint do Google Apps Script que devolve a planilha em JSON (GET)
  API_URL:
    "https://script.google.com/macros/s/AKfycbyVpUQ8Wy_Hjz5c6X63F-6H11TLa31LUJDDQ1xwKAFwHIBKdnJuHY1mjq0_FLbPnghTlw/exec",

  // Planilha publicada (usada no link "Ver planilha")
  PLANILHA_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7-JA1SfYMGei5qJcPNDMMGiO5zONhgdJ1YPCWltni253zeRRm-6_b73c8MswSaipsCL9rPORgWbeS/pubhtml",

  // Atualização automática (segundos). 0 desliga.
  ATUALIZAR_A_CADA_SEG: 60,

  // Tempo máximo de espera da API (milissegundos)
  TIMEOUT_MS: 20000,

  // Se a API falhar, mostrar os dados de exemplo (com aviso visível)?
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
