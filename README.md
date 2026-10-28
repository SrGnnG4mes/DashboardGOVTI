# Painel de Governança de TI · Prefeitura de Boa Esperança

Dashboard estático (HTML, CSS e JavaScript puro, sem dependências) que lê a planilha de governança do grupo
em tempo real por uma API do Google Apps Script. Pode ser hospedado no **GitHub Pages**.

> Protótipo acadêmico · Governança de TI · CSTSI6 · 2026.2 · Gabriel Nogueira, Miguel Bardales, Gabriel Diógenes.
> Os dados são hipotéticos ou estão a validar e não representam medição real da Prefeitura.

## Estrutura

```
index.html              página do painel
assets/css/style.css    visual (tema escuro/claro, responsivo, impressão)
assets/js/config.js     fontes de dados, links, intervalo, regra de situação  ← edite aqui
assets/js/data.js       busca o JSON e o converte (aceita vários formatos)
assets/js/app.js        desenha KPIs, série, barras, matriz de riscos, decisões e ficha
assets/js/exemplo.js    dados de exemplo, usados só se todas as fontes falharem (com aviso na tela)
assets/vendor/          SheetJS (leitor de .xlsx), usado pela fonte "planilha_publicada"
data/dados.json         cópia da planilha gerada pelo GitHub Actions
scripts/atualizar_dados.py   script que gera data/dados.json (usado pelo GitHub Actions)
configurar-actions/     workflow do GitHub Actions — mover para .github/workflows (ver LEIA-ME.txt)
assets/img/favicon.svg
.nojekyll               evita o processamento Jekyll do GitHub Pages
```

## Publicar no GitHub Pages

1. Crie um repositório (por exemplo `painel-governanca-ti`) e envie **o conteúdo desta pasta** para a raiz da
   branch `main` (`index.html` precisa ficar na raiz).
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. Em 1 a 2 minutos o site fica em `https://SEU-USUARIO.github.io/painel-governanca-ti/`.

Para testar no computador, abra a pasta com um servidor local (por exemplo `python -m http.server 8000` e acesse
`http://localhost:8000`). Abrir o `index.html` com dois cliques também funciona, mas alguns navegadores bloqueiam
`fetch` a partir de `file://`.

## De onde vêm os dados

O site tenta as fontes na ordem definida em `assets/js/config.js` (`FONTES`) e usa a primeira que responder.
A linha de status mostra qual fonte foi usada; se nenhuma responder, um aviso amarelo lista o motivo de cada falha
(o mesmo diagnóstico fica em **Configurações**).

| Fonte | O que precisa | Atualização |
|---|---|---|
| `planilha_publicada` | A planilha **publicada na Web** (Arquivo → Compartilhar → Publicar na Web → **Documento inteiro**). Não usa Apps Script: o site baixa o `.xlsx` publicado e lê todas as abas com o SheetJS (incluído em `assets/vendor`). | Quase em tempo real (o Google pode segurar o arquivo publicado por alguns minutos). |
| `apps_script` | A URL `/exec` do Apps Script, implantada como **App da Web**, executar como **Eu**, acesso **Qualquer pessoa**. | Tempo real. |
| `planilha_gviz` | `PLANILHA_ID` preenchido em `config.js` e a planilha compartilhada como "Qualquer pessoa com o link pode ver". Lê as abas listadas em `ABAS`. | Tempo real. |
| `json_local` | O arquivo `data/dados.json` do próprio repositório, gerado pelo **GitHub Actions** (abaixo). Mesmo domínio do site, então nunca é bloqueado por CORS. | A cada 30 minutos. |

### GitHub Actions (cópia automática da planilha)

O workflow `atualizar-dados.yml` (entregue em `configurar-actions/`; mova-o para `.github/workflows/`) roda a cada 30 minutos (e quando você clica em **Run workflow**),
baixa a planilha pelo Apps Script ou pelo `.xlsx` publicado e grava `data/dados.json` se algo mudou. Como roda no
servidor do GitHub, não depende de CORS.

Para funcionar:
0. Mova `configurar-actions/atualizar-dados.yml` para `.github/workflows/atualizar-dados.yml` (veja `configurar-actions/LEIA-ME.txt`).
1. **Settings → Actions → General → Workflow permissions → Read and write permissions → Save.**
2. Aba **Actions** → "Atualizar dados da planilha" → **Run workflow** para gerar a primeira cópia.
3. Agendamentos do GitHub podem atrasar alguns minutos, e o GitHub pausa agendamentos em repositórios sem
   atividade por 60 dias.

O `data/dados.json` que vem no repositório é uma cópia de exemplo (27/10/2026) até a primeira execução.

### Formatos de JSON aceitos

O leitor (`data.js`) procura as tabelas em qualquer um destes formatos:

```jsonc
// 1) objeto com uma lista de objetos por aba (o mais comum)
{ "dIndicadores": [ { "ID": "IND01", "Indicador": "...", "Meta": 99, ... } ], "fMedicoes": [ ... ] }

// 2) a mesma coisa com cada aba como matriz (primeira linha = cabeçalho)
{ "dIndicadores": [ ["ID", "Indicador", "Meta"], ["IND01", "...", 99] ] }

// 3) embrulhado em data / sheets / abas
{ "ok": true, "data": { "dIndicadores": [ ... ] } }

// 4) lista de abas
[ { "nome": "dIndicadores", "dados": [ ... ] } ]
```

As abas são reconhecidas pelo nome **ou** pelas colunas (sem diferenciar maiúsculas, acentos ou `_`):

| Aba | Colunas usadas |
|---|---|
| `dIndicadores` | `ID`, `Indicador`, `Unidade`, `Formato` (`pct`/`num`/`horas`), `Meta`, `Meta_Texto`, `Sentido` (`Maior`/`Menor`), `Fonte`, `Responsavel`, `Artefatos`, `Indice_Risco_Associado`, `Risco_Associado`, `Evidencia_a_Validar`, `Ordem_Exibicao` |
| `fMedicoes` | `ID`, `Periodo`, `Ordem_Periodo`, `Valor`, `Origem_Dado` |
| `dRiscos` | `ID_Risco`, `Risco`, `Risco_Curto`, `Probabilidade`, `Impacto`, `Indice`, `Faixa`, `Tratamento`, `Responsavel` |
| `dDecisoes` | `ID`, `Decisao`, `Gatilho`, `Artefatos`, `Responsavel`, `Prazo`, `Evidencia_Esperada` (opcional: `Prioridade`) |
| `dServicos` *(opcional)* | `Servico`, `Valor`, `Meta` → o painel lateral vira "Chamados no prazo por serviço" |

Números podem vir como número (`97.4`) ou texto em português (`"97,4"`, `"97,4%"`). Percentuais gravados como
fração (`0,974`) são convertidos automaticamente quando a meta também está em fração. Célula vazia em `Valor`
significa **sem medição** (o painel mostra "Sem dado"); zero é um resultado medido.

### Atualizar com um novo mês

Na aba `fMedicoes`, acrescente uma linha por indicador com o próximo `Ordem_Periodo` (1, 2, 3…), o rótulo em
`Periodo` (ex.: `Nov/2026`), o `Valor` e a `Origem_Dado`. O painel passa a usar o período mais recente, a linha do
gráfico ganha um ponto novo e o seletor de período permite voltar aos meses anteriores.

## Regra de situação

A mesma do PDF e do Power BI, configurável em `config.js`:

- **Sem dado**: não há valor medido no período.
- **No alvo**: a meta foi atingida (respeitando o `Sentido`).
- **Crítico**: abaixo da meta e ligado a risco de índice ≥ 13 (faixa alta/crítica), ou 15% ou mais longe da meta.
- **Atenção**: abaixo da meta nos demais casos.

Faixas da matriz de riscos (aula de 30/09): 1–5 baixo · 6–12 médio · 13–19 alto · 20–25 crítico.

## Funções do painel

- Menu lateral filtra os indicadores (Disponibilidade, Service Desk, PSI, PDTI, Riscos e alertas, DRP).
- Busca (`Ctrl+K`) em indicadores, decisões e riscos.
- Sino com os indicadores críticos e em atenção.
- Clique em um indicador para vê-lo no gráfico de série; passe o mouse para ver detalhes.
- **Exportar relatório** usa a impressão do navegador → "Salvar como PDF".
- **Configurações**: tema claro/escuro e intervalo de atualização (guardados no navegador).

## Se os dados não carregarem

- Abra **Configurações** no painel e veja o diagnóstico de cada fonte.
- Planilha publicada: confira em Arquivo → Compartilhar → Publicar na Web se está publicada como **Documento inteiro** e se a publicação não foi interrompida.
- No Apps Script, a implantação precisa ser **App da Web**, executar como **Eu** e acesso **Qualquer pessoa**.
- Depois de editar o script, faça **Implantar → Gerenciar implantações → Editar → Nova versão**; senão a URL
  continua servindo a versão antiga.
- Abra a URL da API no navegador: precisa aparecer JSON, não uma página de login.
- O console do navegador (F12) mostra a mensagem `[painel] falha ao ler a API` com o motivo.

### Exemplo de `doGet` compatível (opcional)

Se quiser padronizar a resposta, este script devolve todas as abas no formato 1:

```js
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = {};
  ss.getSheets().forEach(function (sh) {
    const v = sh.getDataRange().getValues();
    if (v.length < 2) return;
    const cab = v[0];
    out[sh.getName()] = v.slice(1)
      .filter(function (r) { return r.some(function (c) { return c !== ""; }); })
      .map(function (r) { const o = {}; cab.forEach(function (h, i) { o[h] = r[i]; }); return o; });
  });
  out.atualizadoEm = new Date().toISOString();
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
```
