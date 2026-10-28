/* =========================================================================
   Camada de dados: busca o JSON da API e o transforma em um modelo único.
   Aceita vários formatos de JSON (ver README), porque cada script do
   Apps Script devolve a planilha de um jeito.
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- utilidades ---------- */
  const semAcento = (s) =>
    String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const chave = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "");

  function numero(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s || s === "-" || s === "—") return null;
    s = s.replace(/[%\s]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const texto = (v) => (v === null || v === undefined ? "" : String(v).trim());

  /** Lê um campo da linha aceitando vários nomes de coluna (sem acento/caixa/_). */
  function campo(linha, ...nomes) {
    const mapa = linha.__k || (linha.__k = Object.fromEntries(Object.keys(linha).map((k) => [chave(k), k])));
    for (const n of nomes) {
      const k = mapa[chave(n)];
      if (k !== undefined) return linha[k];
    }
    return undefined;
  }

  /* ---------- 1) achar as tabelas dentro do JSON, qualquer que seja o formato ---------- */
  function paraLinhas(x) {
    if (!Array.isArray(x) || !x.length) return Array.isArray(x) ? [] : null;
    if (Array.isArray(x[0])) {
      // matriz 2D: primeira linha = cabeçalho
      const [cab, ...resto] = x;
      return resto
        .filter((r) => r.some((c) => texto(c) !== ""))
        .map((r) => Object.fromEntries(cab.map((h, i) => [texto(h), r[i]])));
    }
    if (typeof x[0] === "object" && x[0] !== null) return x;
    return null;
  }

  function coletarTabelas(json) {
    const tabelas = [];
    const visitar = (no, nome, prof) => {
      if (prof > 4 || no === null || no === undefined) return;
      if (Array.isArray(no)) {
        // [{nome:'aba', dados:[...]}, ...]
        if (no.length && typeof no[0] === "object" && !Array.isArray(no[0])) {
          const n0 = no[0];
          const sub = campo(n0, "dados", "data", "rows", "linhas", "values", "valores");
          const nm = campo(n0, "nome", "name", "sheet", "aba", "titulo", "title");
          if (Array.isArray(sub) && nm !== undefined) {
            no.forEach((it) =>
              visitar(campo(it, "dados", "data", "rows", "linhas", "values", "valores"),
                texto(campo(it, "nome", "name", "sheet", "aba", "titulo", "title")), prof + 1));
            return;
          }
        }
        const linhas = paraLinhas(no);
        if (linhas) tabelas.push({ nome: nome || "", linhas });
        return;
      }
      if (typeof no === "object") {
        for (const [k, v] of Object.entries(no)) {
          const ck = chave(k);
          const embrulho = ["data", "dados", "sheets", "abas", "result", "resultado", "planilha", "tabelas", "values", "rows"].includes(ck);
          visitar(v, embrulho ? nome : k, prof + 1);
        }
      }
    };
    visitar(json, "", 0);
    return tabelas;
  }

  /* ---------- 2) classificar cada tabela pelo nome e pelas colunas ---------- */
  function classificar(tabelas) {
    const out = { indicadores: [], medicoes: [], riscos: [], decisoes: [], servicos: [] };
    for (const t of tabelas) {
      const nome = chave(t.nome);
      const cols = new Set(t.linhas.length ? Object.keys(t.linhas[0]).map(chave) : []);
      const tem = (...c) => c.every((x) => cols.has(x));
      if (tem("probrotulo") || nome === "dmatriz") continue; // grade auxiliar do Power BI
      if (nome.includes("indicador") || (tem("id", "meta") && (cols.has("indicador") || cols.has("nome")))) {
        out.indicadores.push(...t.linhas);
        if (cols.has("valor")) out.medicoes.push(...t.linhas); // planilha "achatada"
      } else if (nome.includes("medic") || (tem("id", "valor") && !cols.has("servico"))) {
        out.medicoes.push(...t.linhas);
      } else if (nome.includes("risco") || tem("probabilidade", "impacto")) {
        out.riscos.push(...t.linhas);
      } else if (nome.includes("decis") || cols.has("decisao")) {
        out.decisoes.push(...t.linhas);
      } else if (nome.includes("servic") || cols.has("servico")) {
        out.servicos.push(...t.linhas);
      }
    }
    return out;
  }

  /* ---------- 3) montar o modelo calculado ---------- */
  function situacao(v, meta, sentido, indiceRisco, cfg) {
    if (v === null) return "Sem evidência";
    if (meta === null) return "Sem meta";
    const desvio = sentido === "Menor" ? meta - v : v - meta;
    if (desvio >= 0) return "No alvo";
    const rel = meta ? desvio / meta : -1;
    if ((indiceRisco ?? 0) >= cfg.LIMIAR_INDICE_RISCO || rel <= cfg.LIMIAR_DESVIO) return "Crítica";
    return "Atenção";
  }

  function faixaRisco(ix) {
    if (ix >= 20) return "Crítico";
    if (ix >= 13) return "Alto";
    if (ix >= 6) return "Médio";
    return "Baixo";
  }

  function montarModelo(cls, cfg) {
    // medições por indicador
    const porId = new Map();
    cls.medicoes.forEach((m, i) => {
      const id = texto(campo(m, "ID", "id_indicador", "indicador_id", "codigo"));
      if (!id) return;
      const ordemBruta = numero(campo(m, "Ordem_Periodo", "ordem", "mes_ordem"));
      const periodo = texto(campo(m, "Periodo", "período", "mes", "mês", "competencia", "data")) || "Período";
      const item = {
        periodo,
        ordem: ordemBruta ?? i,
        valor: numero(campo(m, "Valor", "valor_atual", "resultado")),
        origem: texto(campo(m, "Origem_Dado", "origem", "observacao", "obs", "tipo_dado")),
      };
      if (!porId.has(id)) porId.set(id, []);
      porId.get(id).push(item);
    });
    porId.forEach((arr) => arr.sort((a, b) => a.ordem - b.ordem));

    // períodos disponíveis (rótulos) em ordem
    const periodos = [];
    const vistos = new Map();
    porId.forEach((arr) => arr.forEach((p) => { if (!vistos.has(p.ordem)) vistos.set(p.ordem, p.periodo); }));
    [...vistos.entries()].sort((a, b) => a[0] - b[0]).forEach(([ordem, rotulo]) => periodos.push({ ordem, rotulo }));

    const indicadores = cls.indicadores.map((r, i) => {
      const id = texto(campo(r, "ID", "codigo")) || `IND${String(i + 1).padStart(2, "0")}`;
      const unidade = texto(campo(r, "Unidade"));
      let formato = chave(campo(r, "Formato"));
      if (!formato) formato = unidade.includes("%") ? "pct" : /hora/i.test(unidade) ? "horas" : "num";
      let meta = numero(campo(r, "Meta", "meta_valor", "alvo"));
      const sentidoTxt = chave(campo(r, "Sentido", "polaridade"));
      const sentido = sentidoTxt.startsWith("men") || sentidoTxt.startsWith("low") ? "Menor" : "Maior";
      const serie = (porId.get(id) || []).map((p) => ({ ...p }));
      // percentuais gravados como fração (0,974) -> pontos (97,4)
      const escala = formato === "pct" && meta !== null && meta <= 1 ? 100 : 1;
      if (escala !== 1) { meta *= escala; serie.forEach((p) => { if (p.valor !== null) p.valor *= escala; }); }
      return {
        id,
        nome: texto(campo(r, "Indicador", "Nome", "titulo")) || id,
        unidade, formato, meta, sentido,
        metaTexto: texto(campo(r, "Meta_Texto", "meta_txt", "meta_descricao")),
        fonte: texto(campo(r, "Fonte")),
        responsavel: texto(campo(r, "Responsavel", "responsável", "dono")),
        artefatos: texto(campo(r, "Artefatos", "artefato")),
        indiceRisco: numero(campo(r, "Indice_Risco_Associado", "indice_risco", "risco_indice")),
        riscoAssociado: texto(campo(r, "Risco_Associado", "risco")),
        evidencia: texto(campo(r, "Evidencia_a_Validar", "evidencia", "evidência")),
        ordemExibicao: numero(campo(r, "Ordem_Exibicao", "ordem")) ?? i + 1,
        serie,
      };
    }).sort((a, b) => a.ordemExibicao - b.ordemExibicao);

    // indicadores que só aparecem nas medições
    porId.forEach((serie, id) => {
      if (!indicadores.some((x) => x.id === id))
        indicadores.push({ id, nome: id, unidade: "", formato: "num", meta: null, sentido: "Maior", metaTexto: "",
          fonte: "", responsavel: "", artefatos: "", indiceRisco: null, riscoAssociado: "", evidencia: "",
          ordemExibicao: 999, serie });
    });

    const riscos = cls.riscos.map((r, i) => {
      const p = numero(campo(r, "Probabilidade", "prob", "p"));
      const im = numero(campo(r, "Impacto", "imp", "i"));
      const ix = numero(campo(r, "Indice", "índice")) ?? (p && im ? p * im : null);
      return {
        id: texto(campo(r, "ID_Risco", "ID", "codigo")) || `R${i + 1}`,
        rotulo: `R${i + 1}`,
        nome: texto(campo(r, "Risco", "Evento", "nome")),
        curto: texto(campo(r, "Risco_Curto", "curto", "apelido")),
        prob: p, imp: im, indice: ix,
        faixa: texto(campo(r, "Faixa")) || (ix ? faixaRisco(ix) : ""),
        tratamento: texto(campo(r, "Tratamento")),
        responsavel: texto(campo(r, "Responsavel", "responsável")),
      };
    }).filter((r) => r.prob && r.imp);

    const decisoes = cls.decisoes.map((d, i) => ({
      id: texto(campo(d, "ID", "codigo")) || `D${i + 1}`,
      decisao: texto(campo(d, "Decisao", "decisão", "titulo")),
      gatilho: texto(campo(d, "Gatilho", "motivo", "justificativa")),
      artefatos: texto(campo(d, "Artefatos", "artefato")),
      responsavel: texto(campo(d, "Responsavel", "responsável")),
      prazo: texto(campo(d, "Prazo")),
      evidencia: texto(campo(d, "Evidencia_Esperada", "evidencia", "evidência")),
      prioridade: texto(campo(d, "Prioridade", "Severidade")),
    }));

    const servicos = cls.servicos.map((s) => ({
      nome: texto(campo(s, "Servico", "serviço", "nome")),
      valor: numero(campo(s, "Valor", "Percentual", "No_Prazo", "noprazo", "resultado")),
      meta: numero(campo(s, "Meta")),
    })).filter((s) => s.nome && s.valor !== null);

    return { indicadores, riscos, decisoes, servicos, periodos };
  }

  /** Valor de um indicador em um período (o mais recente <= período escolhido). */
  function valorNoPeriodo(ind, ordemMax) {
    const pts = ind.serie.filter((p) => ordemMax === null || p.ordem <= ordemMax);
    if (!pts.length) return { valor: null, periodo: "", origem: "" };
    return pts[pts.length - 1];
  }

  function avaliar(modelo, ordemMax, cfg) {
    modelo.indicadores.forEach((ind) => {
      const atual = valorNoPeriodo(ind, ordemMax);
      ind.atual = atual;
      ind.valor = atual.valor;
      ind.situacao = situacao(ind.valor, ind.meta, ind.sentido, ind.indiceRisco, cfg);
      if (ind.valor === null || ind.meta === null) ind.atingimento = null;
      else if (ind.sentido === "Menor") ind.atingimento = ind.valor <= 0 ? 1 : Math.min(ind.meta / ind.valor, 1);
      else ind.atingimento = ind.meta <= 0 ? 1 : Math.min(ind.valor / ind.meta, 1);
    });
    return modelo;
  }

  /* ---------- 4) buscar os dados (várias fontes, com reserva) ---------- */
  async function obter(url, cfg, tipo) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), cfg.TIMEOUT_MS);
    try {
      // GET simples, sem cabeçalhos extras: evita preflight de CORS
      const sep = url.includes("?") ? "&" : "?";
      const resp = await fetch(`${url}${sep}_=${Date.now()}`, { signal: ctrl.signal, redirect: "follow", cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return tipo === "bin" ? await resp.arrayBuffer() : await resp.text();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("tempo esgotado");
      if (e instanceof TypeError) throw new Error("bloqueado pelo navegador (CORS) ou sem conexão");
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  let xlsxPromessa = null;
  function carregarXLSX(cfg) {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromessa) {
      xlsxPromessa = new Promise((ok, erro) => {
        const s = document.createElement("script");
        s.src = cfg.XLSX_LIB_URL;
        s.onload = () => (window.XLSX ? ok(window.XLSX) : erro(new Error("leitor de planilha não carregou")));
        s.onerror = () => { xlsxPromessa = null; erro(new Error("não foi possível carregar o leitor de planilha")); };
        document.head.appendChild(s);
      });
    }
    return xlsxPromessa;
  }

  /** Converte um arquivo de planilha (xlsx/csv) em { aba: [linhas] }. */
  function livroParaJson(XLSX, wb) {
    const out = {};
    wb.SheetNames.forEach((n) => { out[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "", raw: true }); });
    return out;
  }

  function urlPublicada(cfg, formato) {
    const base = String(cfg.PLANILHA_PUBLICADA_URL || "").replace(/\/pub(html)?(\?.*)?$/, "");
    if (!base) return "";
    return `${base}/pub?output=${formato}`;
  }

  const FONTES = {
    async planilha_publicada(cfg) {
      const url = urlPublicada(cfg, "xlsx");
      if (!url) throw new Error("PLANILHA_PUBLICADA_URL vazia");
      const [XLSX, buf] = await Promise.all([carregarXLSX(cfg), obter(url, cfg, "bin")]);
      const head = new Uint8Array(buf.slice(0, 2));
      if (!(head[0] === 0x50 && head[1] === 0x4b)) throw new Error("o Google não devolveu um .xlsx (a planilha está publicada na Web?)");
      return livroParaJson(XLSX, XLSX.read(buf, { type: "array" }));
    },
    async planilha_gviz(cfg) {
      if (!cfg.PLANILHA_ID) throw new Error("PLANILHA_ID não configurado");
      const XLSX = await carregarXLSX(cfg);
      const out = {};
      const erros = [];
      await Promise.all((cfg.ABAS || []).map(async (aba) => {
        try {
          const csv = await obter(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(cfg.PLANILHA_ID)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(aba)}`, cfg, "txt");
          if (/^\s*</.test(csv)) throw new Error("resposta em HTML (compartilhe a planilha: qualquer pessoa com o link pode ver)");
          const wb = XLSX.read(csv, { type: "string", raw: false });
          out[aba] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        } catch (e) { erros.push(`${aba}: ${e.message}`); }
      }));
      if (!Object.keys(out).length) throw new Error(erros.join("; ") || "nenhuma aba lida");
      return out;
    },
    async apps_script(cfg) {
      if (!cfg.API_URL) throw new Error("API_URL vazia");
      const txt = await obter(cfg.API_URL, cfg, "txt");
      try { return JSON.parse(txt); } catch {
        throw new Error(/<html|<!doctype/i.test(txt)
          ? "o script devolveu uma página HTML, não JSON (implantação precisa ser 'Qualquer pessoa')"
          : "a resposta não é JSON");
      }
    },
    async json_local(cfg) {
      const txt = await obter(cfg.JSON_LOCAL_URL, cfg, "txt");
      return JSON.parse(txt);
    },
  };
  const NOMES_FONTE = {
    planilha_publicada: "planilha publicada (Google Sheets)",
    planilha_gviz: "Google Sheets (consulta por aba)",
    apps_script: "API do Apps Script",
    json_local: "arquivo do repositório (data/dados.json)",
  };

  /** Tenta as fontes na ordem configurada. Devolve { modelo, fonte, nome, json, tentativas }. */
  async function buscar(cfg) {
    const tentativas = [];
    for (const f of cfg.FONTES || ["apps_script"]) {
      if (!FONTES[f]) { tentativas.push({ fonte: f, erro: "fonte desconhecida" }); continue; }
      try {
        const json = await FONTES[f](cfg);
        const modelo = interpretar(json, cfg);
        tentativas.push({ fonte: f, ok: true });
        return { modelo, fonte: f, nome: NOMES_FONTE[f], json, tentativas };
      } catch (e) {
        console.warn(`[painel] fonte "${f}" falhou:`, e);
        tentativas.push({ fonte: f, nome: NOMES_FONTE[f], erro: e.message || String(e) });
      }
    }
    const err = new Error("nenhuma fonte de dados respondeu");
    err.tentativas = tentativas;
    throw err;
  }

  function interpretar(json, cfg) {
    const cls = classificar(coletarTabelas(json));
    if (!cls.indicadores.length && !cls.medicoes.length)
      throw new Error("o JSON chegou, mas não encontrei as colunas de indicadores (ID, Indicador, Meta, Valor)");
    return montarModelo(cls, cfg);
  }

  window.DadosPainel = { buscar, interpretar, avaliar, faixaRisco, numero, chave, NOMES_FONTE };
})();
