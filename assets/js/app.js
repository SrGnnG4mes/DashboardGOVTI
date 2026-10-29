/* =========================================================================
   Renderização e interação do painel
   ========================================================================= */
(function () {
  "use strict";
  const CFG = window.CONFIG;
  const D = window.DadosPainel;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- ícones (traço, estilo lucide) ---------- */
  const ICONS = {
    building: '<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    activity: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    headset: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2.5" y="14" width="4" height="6" rx="1.5"/><rect x="17.5" y="14" width="4" height="6" rx="1.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  $$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));

  /* ---------- formatação ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const fmtNum = (v) => (Number.isInteger(v) ? nf0.format(v) : nf1.format(v));
  function fmtValor(ind, v = ind.valor) {
    if (v === null || v === undefined) return "—";
    if (ind.formato === "pct") return `${Number.isInteger(v) ? nf0.format(v) : nf1.format(v)}%`;
    if (ind.formato === "horas") return `${nf1.format(v)} h`;
    return fmtNum(v);
  }
  function unidadeCurta(ind) {
    if (ind.formato === "pct" || ind.formato === "horas") return "";
    return ind.unidade;
  }
  function metaTxt(ind) {
    if (ind.metaTexto) return ind.metaTexto;
    if (ind.meta === null) return "sem meta";
    return `${ind.sentido === "Menor" ? "≤" : "≥"} ${fmtValor(ind, ind.meta)}`;
  }
  const ST = {
    "Crítica": { cls: "crit", chip: "✖ Crítico", ico: "!" },
    "Atenção": { cls: "warn", chip: "▲ Atenção", ico: "▲" },
    "No alvo": { cls: "ok", chip: "✔ No alvo", ico: "✔" },
    "Sem evidência": { cls: "sem", chip: "○ Sem dado", ico: "○" },
    "Sem meta": { cls: "sem", chip: "◇ Sem meta", ico: "◇" },
  };
  const chip = (sit) => `<span class="chip st-${ST[sit].cls}">${ST[sit].chip}</span>`;
  const RANK = { "Crítica": 0, "Atenção": 1, "Sem meta": 2, "Sem evidência": 3, "No alvo": 4 };

  /* ---------- estado ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("gov-" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gov-" + k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };
  const state = {
    modelo: null,
    origem: null,           // "api" | "exemplo"
    ultimaAtualizacao: null,
    periodo: null,          // ordem máxima selecionada (null = mais recente)
    serieId: store.get("serie", CFG.INDICADOR_SERIE_PADRAO),
    filtro: "todos",
    busca: "",
    intervalo: store.get("intervalo", CFG.ATUALIZAR_A_CADA_SEG),
    timer: null,
    carregando: false,
  };
  document.documentElement.dataset.theme = store.get("tema", "dark");

  /* ---------- tooltip ---------- */
  const tip = $("#tooltip");
  function mostrarTip(html, ev) {
    tip.innerHTML = html;
    tip.hidden = false;
    moverTip(ev);
  }
  function moverTip(ev) {
    const pad = 14, r = tip.getBoundingClientRect();
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  }
  const esconderTip = () => (tip.hidden = true);
  function ligarTip(el, htmlFn) {
    el.addEventListener("mouseenter", (e) => mostrarTip(htmlFn(), e));
    el.addEventListener("mousemove", moverTip);
    el.addEventListener("mouseleave", esconderTip);
    el.addEventListener("focus", () => { const r = el.getBoundingClientRect(); mostrarTip(htmlFn(), { clientX: r.right, clientY: r.top }); });
    el.addEventListener("blur", esconderTip);
  }
  function tipIndicador(ind) {
    return `<b>${esc(ind.nome)}</b>
      <div class="tt-row"><span>Valor</span><span>${esc(fmtValor(ind))}</span></div>
      <div class="tt-row"><span>Meta</span><span>${esc(metaTxt(ind))}</span></div>
      <div class="tt-row"><span>Situação</span><span>${esc(ind.situacao)}</span></div>
      ${ind.atual?.periodo ? `<div class="tt-row"><span>Período</span><span>${esc(ind.atual.periodo)}</span></div>` : ""}
      ${ind.responsavel ? `<div class="tt-row"><span>Responsável</span><span>${esc(ind.responsavel)}</span></div>` : ""}
      ${ind.atual?.origem ? `<div style="margin-top:4px;opacity:.8">${esc(ind.atual.origem)}</div>` : ""}`;
  }

  /* ---------- filtros ---------- */
  const FILTROS = {
    todos: { nome: "Visão geral", teste: () => true },
    disponibilidade: { nome: "Disponibilidade", teste: (t) => /disponib|recupera|portal/i.test(t) },
    servicedesk: { nome: "Service Desk", teste: (t) => /\bSLA\b|\bOLA\b|chamad|escalon|service desk/i.test(t) },
    psi: { nome: "Segurança (PSI)", teste: (t) => /\bPSI\b|acesso|seguran/i.test(t) },
    pdti: { nome: "PDTI / Projetos", teste: (t) => /PDTI/i.test(t) },
    riscos: { nome: "Riscos e alertas", teste: (t, ind) => ind && (ind.situacao === "Crítica" || ind.situacao === "Atenção") },
    drp: { nome: "DRP / Contingência", teste: (t) => /\bDRP\b|restaura|recupera|backup|continuidade/i.test(t) },
  };
  const textoInd = (i) => `${i.id} ${i.nome} ${i.artefatos} ${i.fonte} ${i.responsavel} ${i.riscoAssociado}`;
  const passaBusca = (txt) => !state.busca || txt.toLowerCase().includes(state.busca.toLowerCase());
  const passaFiltro = (ind) => FILTROS[state.filtro].teste(textoInd(ind), ind);

  /* ---------- links entre decisões, indicadores e riscos ---------- */
  const TOKENS = /\b(I\d+|O\d+|P\d+|SLA|OLA|DRP|PSI|DORA)\b/g;
  const tokens = (s) => new Set((String(s).match(TOKENS) || []).map((x) => x.toUpperCase()));
  function ligacoesDecisao(dec, m) {
    const tk = tokens(`${dec.artefatos} ${dec.gatilho}`);
    // preferir as iniciativas/objetivos (I1, O2...), que são específicos; senão, os artefatos (SLA, PSI...)
    const especificos = new Set([...tk].filter((t) => /^[IOP]\d+$/.test(t)));
    const usar = especificos.size ? especificos : tk;
    const inds = m.indicadores.filter((i) => [...tokens(i.artefatos)].some((t) => usar.has(t)))
      .sort((a, b) => RANK[a.situacao] - RANK[b.situacao]);
    const riscos = m.riscos.filter((r) => inds.some((i) => i.riscoAssociado && D.chave(i.riscoAssociado) === D.chave(r.nome)));
    const pior = inds.reduce((p, i) => (RANK[i.situacao] < RANK[p] ? i.situacao : p), "No alvo");
    return { inds, riscos, pior };
  }

  /* ================= RENDER ================= */
  function renderTudo() {
    const m = state.modelo;
    if (!m) return;
    D.avaliar(m, state.periodo, CFG);
    renderPeriodos(m);
    renderKPIs(m);
    renderSerie(m);
    renderAtingimento(m);
    renderMatriz(m);
    renderDecisoes(m);
    renderFicha(m);
    renderAlertas(m);
    aplicarFiltroVisual();
  }

  function renderPeriodos(m) {
    const sel = $("#selPeriodo");
    const ops = m.periodos.length ? m.periodos : [{ ordem: 0, rotulo: "Período atual" }];
    const atual = state.periodo ?? ops[ops.length - 1].ordem;
    sel.innerHTML = ops.slice().reverse().map((p, k) =>
      `<option value="${p.ordem}" ${p.ordem === atual ? "selected" : ""}>${esc(p.rotulo)}${k === 0 ? " (mais recente)" : ""}</option>`).join("");
  }

  function barra(ind) {
    const s = ST[ind.situacao].cls;
    if (ind.valor === null || ind.meta === null) return `<div class="bar"></div>`;
    if (ind.formato === "pct" && ind.sentido === "Maior") {
      const w = Math.max(0, Math.min(100, ind.valor));
      const mk = Math.max(0, Math.min(100, ind.meta));
      return `<div class="bar"><i class="f-${s}" style="width:${w}%"></i><em style="left:calc(${mk}% - 1px)"></em></div>`;
    }
    return `<div class="bar"><i class="f-${s}" style="width:${Math.round((ind.atingimento ?? 0) * 100)}%"></i><em style="left:calc(100% - 2px)"></em></div>`;
  }

  function renderKPIs(m) {
    const box = $("#kpis");
    box.innerHTML = m.indicadores.map((ind) => {
      const s = ST[ind.situacao];
      return `<article class="kpi" tabindex="0" data-id="${esc(ind.id)}" data-txt="${esc(textoInd(ind))}">
        <div class="kpi-top"><div class="kpi-name">${esc(ind.nome)}</div>${chip(ind.situacao)}</div>
        <div class="kpi-val t-${s.cls}">${esc(fmtValor(ind))}${unidadeCurta(ind) && ind.valor !== null ? `<small>${esc(unidadeCurta(ind))}</small>` : ""}</div>
        <div class="kpi-meta">Meta <b>${esc(metaTxt(ind))}</b>${ind.fonte ? ` · Fonte: ${esc(ind.fonte)}` : ""}</div>
        ${barra(ind)}
        ${ind.atual?.origem ? `<div class="kpi-origem">${esc(ind.atual.origem)}</div>` : ""}
      </article>`;
    }).join("");
    $$(".kpi", box).forEach((el) => {
      const ind = m.indicadores.find((i) => i.id === el.dataset.id);
      ligarTip(el, () => tipIndicador(ind));
      el.addEventListener("click", () => { state.serieId = ind.id; store.set("serie", ind.id); renderSerie(m); $("#secSerie").scrollIntoView({ behavior: "smooth", block: "center" }); });
    });
    const nCrit = m.indicadores.filter((i) => i.situacao === "Crítica").length;
    $("#navBadge").hidden = !nCrit;
    $("#navBadge").textContent = nCrit;
    $("#pipAlertas").hidden = !nCrit;
  }

  /* ----- gráfico de série (linha: mudança no tempo) ----- */
  function renderSerie(m) {
    const sel = $("#selSerie");
    if (!m.indicadores.some((i) => i.id === state.serieId)) state.serieId = m.indicadores[0]?.id;
    sel.innerHTML = m.indicadores.map((i) => `<option value="${esc(i.id)}" ${i.id === state.serieId ? "selected" : ""}>${esc(i.nome)}</option>`).join("");
    const ind = m.indicadores.find((i) => i.id === state.serieId);
    const box = $("#chartSerie");
    if (!ind) { box.innerHTML = `<div class="empty">Sem indicadores.</div>`; return; }
    $("#serieTitulo").textContent = ind.nome;
    $("#serieSub").textContent = `Série por período · Fonte: ${ind.fonte || "não informada"} · Meta ${metaTxt(ind)}`;
    const pts = ind.serie.filter((p) => p.valor !== null && (state.periodo === null || p.ordem <= state.periodo));
    $("#serieFoot").textContent = pts.length < 2
      ? "Só há um período com valor registrado. A linha aparece quando a planilha (fMedicoes) tiver mais meses deste indicador."
      : `${pts.length} períodos registrados · o último ponto usa a cor da situação atual.`;
    if (!pts.length) { box.innerHTML = `<div class="empty">Sem medição registrada para este indicador.<br>${esc(ind.atual?.origem || "")}</div>`; return; }

    const W = Math.max(300, Math.round(box.clientWidth || 640)), H = 250, L = 52, R = 16, T = 22, B = 34;
    const vals = pts.map((p) => p.valor).concat(ind.meta !== null ? [ind.meta] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (ind.formato === "pct") { hi = Math.min(100, hi); }
    const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1);
    lo = lo - span * 0.25; hi = hi + span * 0.25;
    if (ind.formato === "pct") { lo = Math.max(0, lo); hi = Math.min(100, hi); }
    if (lo < 0 && Math.min(...vals) >= 0) lo = 0;
    const x = (k) => (pts.length === 1 ? L + (W - L - R) / 2 : L + (k * (W - L - R)) / (pts.length - 1));
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
    const ticks = 4;
    let g = `<g class="grid">`;
    for (let k = 0; k <= ticks; k++) {
      const v = lo + ((hi - lo) * k) / ticks;
      g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
    }
    g += `</g><g class="axis">`;
    for (let k = 0; k <= ticks; k++) {
      const v = lo + ((hi - lo) * k) / ticks;
      g += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmtValor(ind, Math.round(v * 10) / 10))}</text>`;
    }
    const curto = (W - L - R) / Math.max(1, pts.length) < 90;
    pts.forEach((p, k) => {
      const rot = curto && p.periodo.length > 8 ? p.periodo.split(/\s[-–]\s/)[0] : p.periodo;
      const anc = pts.length > 1 && k === 0 ? "start" : pts.length > 1 && k === pts.length - 1 ? "end" : "middle";
      g += `<text x="${x(k)}" y="${H - 10}" text-anchor="${anc}">${esc(rot)}</text>`;
    });
    g += `</g>`;
    if (ind.meta !== null && ind.meta >= lo && ind.meta <= hi)
      g += `<line class="meta-line" x1="${L}" x2="${W - R}" y1="${y(ind.meta)}" y2="${y(ind.meta)}"/>
            <text class="meta-txt" x="${W - R}" y="${y(ind.meta) - 6}" text-anchor="end">Meta ${esc(metaTxt(ind))}</text>`;
    if (pts.length > 1) g += `<polyline class="serie" points="${pts.map((p, k) => `${x(k)},${y(p.valor)}`).join(" ")}"/>`;
    const corAtual = getComputedStyle(document.documentElement).getPropertyValue(`--${ST[ind.situacao].cls === "sem" ? "sem" : ST[ind.situacao].cls}`).trim();
    pts.forEach((p, k) => {
      const ultimo = k === pts.length - 1;
      const fill = ultimo ? corAtual : "var(--txt-2)";
      g += `<circle cx="${x(k)}" cy="${y(p.valor)}" r="${ultimo ? 6 : 4.5}" fill="${fill}" stroke="var(--card)" stroke-width="2"/>`;
      g += `<text class="val" x="${x(k)}" y="${y(p.valor) - 11}" text-anchor="middle">${esc(fmtValor(ind, p.valor))}</text>`;
      g += `<rect class="hit" data-k="${k}" x="${x(k) - 22}" y="${T}" width="44" height="${H - T - B}"/>`;
    });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Série de ${esc(ind.nome)}">${g}</svg>`;
    $$(".hit", box).forEach((r) => {
      const p = pts[+r.dataset.k];
      ligarTip(r, () => `<b>${esc(p.periodo)}</b><div class="tt-row"><span>${esc(ind.nome)}</span><span>${esc(fmtValor(ind, p.valor))}</span></div>
        <div class="tt-row"><span>Meta</span><span>${esc(metaTxt(ind))}</span></div>${p.origem ? `<div style="margin-top:4px;opacity:.8">${esc(p.origem)}</div>` : ""}`);
    });
  }

  /* ----- barras horizontais ----- */
  function renderAtingimento(m) {
    const box = $("#listaAting");
    if (m.servicos.length) {
      // a planilha tem uma aba de serviços: comparar serviços (como no protótipo)
      $("#atTitulo").textContent = "Chamados no prazo por serviço";
      $("#atSub").textContent = "Mesmo período · Fonte: Service Desk e SLA";
      const ord = m.servicos.slice().sort((a, b) => a.valor - b.valor);
      box.innerHTML = ord.map((s) => {
        const meta = s.meta ?? 90;
        const sit = s.valor >= meta ? "No alvo" : (s.valor - meta) / meta <= CFG.LIMIAR_DESVIO ? "Crítica" : "Atenção";
        const c = ST[sit].cls;
        return `<div class="hb"><span class="hb-name">${esc(s.nome)}</span>
          <span class="hb-val t-${c}">${esc(nf1.format(s.valor).replace(",0", ""))}% ${sit === "Crítica" ? chip(sit) : ""}</span>
          <div class="bar"><i class="f-${c}" style="width:${Math.min(100, s.valor)}%"></i><em style="left:calc(${Math.min(100, meta)}% - 1px)"></em></div></div>`;
      }).join("");
      $("#atFoot").textContent = "Marcador vertical = meta do serviço.";
      return;
    }
    $("#atTitulo").textContent = "Distância da meta por indicador";
    $("#atSub").textContent = "Quanto da meta foi atingido (100% = no alvo)";
    const com = m.indicadores.filter((i) => i.atingimento !== null && passaFiltro(i) && passaBusca(textoInd(i)));
    const sem = m.indicadores.filter((i) => i.atingimento === null && passaFiltro(i) && passaBusca(textoInd(i)));
    com.sort((a, b) => a.atingimento - b.atingimento);
    box.innerHTML = com.map((i) => {
      const c = ST[i.situacao].cls;
      return `<div class="hb" tabindex="0" data-id="${esc(i.id)}"><span class="hb-name">${esc(i.nome)}</span>
        <span class="hb-val t-${c}">${Math.round(i.atingimento * 100)}% ${i.situacao === "Crítica" ? chip(i.situacao) : ""}</span>
        <div class="bar"><i class="f-${c}" style="width:${Math.round(i.atingimento * 100)}%"></i><em style="left:calc(100% - 2px)"></em></div></div>`;
    }).join("") || `<div class="empty">Nenhum indicador com valor e meta neste filtro.</div>`;
    $$(".hb", box).forEach((el) => { const ind = m.indicadores.find((i) => i.id === el.dataset.id); ligarTip(el, () => tipIndicador(ind)); });
    $("#atFoot").textContent = sem.length ? `Sem valor medido: ${sem.map((i) => i.nome).join(" · ")}.` : "Todos os indicadores do filtro têm valor medido.";
  }

  /* ----- matriz de riscos ----- */
  const BANDA = { "Baixo": "baixo", "Médio": "medio", "Alto": "alto", "Crítico": "crit" };
  function renderMatriz(m) {
    $("#legMatriz").innerHTML = [["Crítico", "20–25", "crit"], ["Alto", "13–19", "alto"], ["Médio", "6–12", "medio"], ["Baixo", "1–5", "baixo"]]
      .map(([n, r, c]) => `<span><i class="b-${c}"></i>${n} (${r})</span>`).join("");
    let h = `<span class="mx-ylab">PROB.</span>`;
    for (let p = 5; p >= 1; p--) {
      h += `<div class="mx-axis">P${p}</div>`;
      for (let i = 1; i <= 5; i++) {
        const ix = p * i, b = BANDA[D.faixaRisco(ix)];
        const aqui = m.riscos.filter((r) => r.prob === p && r.imp === i);
        h += `<div class="mx-cell b-${b}"><span class="ix">${ix}</span>${aqui.map((r) =>
          `<span class="dotr r-${BANDA[D.faixaRisco(r.indice)]}" tabindex="0" data-id="${esc(r.id)}" data-txt="${esc(`${r.nome} ${r.tratamento} ${r.responsavel}`)}">${esc(r.rotulo)}</span>`).join("")}</div>`;
      }
    }
    h += `<div></div>` + [1, 2, 3, 4, 5].map((i) => `<div class="mx-axis">I${i}</div>`).join("") + `<div class="mx-xlab">IMPACTO →</div>`;
    const box = $("#matriz");
    box.innerHTML = h;
    $$(".dotr", box).forEach((el) => {
      const r = m.riscos.find((x) => x.id === el.dataset.id);
      ligarTip(el, () => `<b>${esc(r.rotulo)} · ${esc(r.nome)}</b>
        <div class="tt-row"><span>Probabilidade × impacto</span><span>${r.prob} × ${r.imp} = ${r.indice}</span></div>
        <div class="tt-row"><span>Faixa</span><span>${esc(r.faixa)}</span></div>
        ${r.tratamento ? `<div style="margin-top:4px">${esc(r.tratamento)}</div>` : ""}
        ${r.responsavel ? `<div style="opacity:.8">Responsável: ${esc(r.responsavel)}</div>` : ""}`);
    });
    $("#matrizFoot").textContent = m.riscos.length
      ? m.riscos.map((r) => `${r.rotulo}: ${r.nome} (${r.indice})`).join(" · ")
      : "A planilha não trouxe uma aba de riscos com Probabilidade e Impacto.";
  }

  /* ----- decisões ----- */
  function renderDecisoes(m) {
    $("#qtdDecisoes").textContent = `${m.decisoes.length} proposta${m.decisoes.length === 1 ? "" : "s"}`;
    const box = $("#listaDecisoes");
    if (!m.decisoes.length) { box.innerHTML = `<div class="empty">A planilha não trouxe a aba de decisões.</div>`; return; }
    box.innerHTML = m.decisoes.map((d) => {
      const lk = ligacoesDecisao(d, m);
      let sev = lk.inds.length ? lk.pior : "Sem evidência";
      const p = D.chave(d.prioridade);
      if (p.startsWith("alt") || p.startsWith("crit")) sev = "Crítica";
      else if (p.startsWith("med") || p.startsWith("aten")) sev = "Atenção";
      const cls = sev === "Crítica" ? "crit" : sev === "Atenção" ? "warn" : "sem";
      const idsInd = lk.inds.map((i) => i.id);
      const links = [...idsInd.slice(0, 3), ...(idsInd.length > 3 ? [`+${idsInd.length - 3}`] : []), ...lk.riscos.map((r) => r.rotulo)];
      const txt = `${d.id} ${d.decisao} ${d.gatilho} ${d.artefatos} ${d.responsavel}`;
      return `<div class="dec" data-txt="${esc(txt)}">
        <div class="dec-ico ${cls}" title="${esc(sev)}">${cls === "crit" ? "!" : cls === "warn" ? "▲" : "○"}</div>
        <div>
          <div class="dec-t">${esc(d.id)} · ${esc(d.decisao)}</div>
          <div class="dec-d">${esc(d.gatilho)}${d.evidencia ? ` Evidência esperada: ${esc(d.evidencia)}.` : ""}</div>
          <div class="dec-m"><b>Responsável:</b> ${esc(d.responsavel || "a definir")}${d.prazo ? ` · Prazo: ${esc(d.prazo)}` : ""}${d.artefatos ? ` · Artefatos: ${esc(d.artefatos)}` : ""}</div>
        </div>
        <div class="dec-links">${links.length ? "↔ " + esc(links.join(" · ")) : ""}</div>
      </div>`;
    }).join("");
  }

  /* ----- ficha ----- */
  function renderFicha(m) {
    const cab = ["Indicador", "Valor", "Meta", "Situação", "Período", "Fonte", "Responsável", "Origem do dado", "Artefatos", "Evidência a validar"];
    const larg = [15, 8, 9, 9, 7, 12, 10, 12, 9, 9];
    $("#tabFicha").innerHTML = `<colgroup>${larg.map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${m.indicadores.map((i) =>
      `<tr data-txt="${esc(textoInd(i))}" data-id="${esc(i.id)}"><td>${esc(i.id)} · ${esc(i.nome)}</td><td class="num">${esc(fmtValor(i))}${i.valor !== null && unidadeCurta(i) ? `<br><small>${esc(unidadeCurta(i))}</small>` : ""}</td>
        <td>${esc(metaTxt(i))}</td><td>${chip(i.situacao)}</td><td>${esc(i.atual?.periodo || "—")}</td><td>${esc(i.fonte)}</td>
        <td>${esc(i.responsavel)}</td><td>${esc(i.atual?.origem || "")}</td><td>${esc(i.artefatos)}</td><td>${esc(i.evidencia)}</td></tr>`).join("")}</tbody>`;
  }

  /* ----- alertas ----- */
  function renderAlertas(m) {
    const crit = m.indicadores.filter((i) => i.situacao === "Crítica" || i.situacao === "Atenção").sort((a, b) => RANK[a.situacao] - RANK[b.situacao]);
    $("#dropAlertas").innerHTML = `<h4>Alertas (${crit.length})</h4>` + (crit.length
      ? crit.map((i) => `<div class="dd-item" data-id="${esc(i.id)}">${chip(i.situacao)}<div><b>${esc(i.nome)}</b><br><span class="t-${ST[i.situacao].cls}">${esc(fmtValor(i))}</span> · meta ${esc(metaTxt(i))}</div></div>`).join("")
      : `<div class="dd-empty">Nenhum indicador fora da meta.</div>`);
    $$("#dropAlertas .dd-item").forEach((el) => el.addEventListener("click", () => {
      $("#dropAlertas").hidden = true;
      const k = $(`.kpi[data-id="${CSS.escape(el.dataset.id)}"]`);
      if (k) { k.scrollIntoView({ behavior: "smooth", block: "center" }); k.focus({ preventScroll: true }); }
    }));
  }

  /* ----- aplicar filtro + busca ----- */
  function aplicarFiltroVisual() {
    const m = state.modelo; if (!m) return;
    $$(".empty", $("#kpis")).forEach((x) => x.remove());
    const f = FILTROS[state.filtro];
    $$(".kpi").forEach((el) => {
      const ind = m.indicadores.find((i) => i.id === el.dataset.id);
      el.classList.toggle("hide-filter", !(passaFiltro(ind) && passaBusca(el.dataset.txt)));
    });
    $$("#tabFicha tbody tr").forEach((el) => {
      const ind = m.indicadores.find((i) => i.id === el.dataset.id);
      el.classList.toggle("hide-filter", !(passaFiltro(ind) && passaBusca(el.dataset.txt)));
    });
    $$(".dec").forEach((el) => el.classList.toggle("hide-filter", !(passaBusca(el.dataset.txt) && (state.filtro === "todos" || state.filtro === "riscos" || f.teste(el.dataset.txt)))));
    $$(".dotr").forEach((el) => el.classList.toggle("dim", !passaBusca(el.dataset.txt)));
    renderAtingimento(m);
    const chipF = $("#chipFiltro");
    const ativos = [];
    if (state.filtro !== "todos") ativos.push(`Filtro: <b>${esc(f.nome)}</b>`);
    if (state.busca) ativos.push(`Busca: <b>${esc(state.busca)}</b>`);
    chipF.hidden = !ativos.length;
    chipF.innerHTML = `${ativos.join(" · ")} <button aria-label="Limpar filtro">✕</button>`;
    $("button", chipF).onclick = () => { definirFiltro("todos"); $("#busca").value = ""; state.busca = ""; aplicarFiltroVisual(); };
    const visiveis = $$(".kpi:not(.hide-filter)").length;
    if (!visiveis && m.indicadores.length) $("#kpis").insertAdjacentHTML("beforeend", `<div class="empty" style="grid-column:1/-1;min-height:90px">Nenhum indicador neste filtro.</div>`);
  }

  function definirFiltro(f, alvo) {
    state.filtro = f;
    $$(".nav-item[data-filtro]").forEach((a) => a.classList.toggle("active", a.dataset.filtro === f && (!alvo || a.dataset.alvo === alvo || !a.dataset.alvo)));
    $("#crumbAtual").textContent = FILTROS[f].nome;
    $$(".empty", $("#kpis")).forEach((e) => e.remove());
    aplicarFiltroVisual();
  }

  /* ================= DADOS ================= */
  function status(txt, tipo) {
    $("#statusTxt").textContent = txt;
    $("#liveDot").className = "live" + (tipo ? " " + tipo : "");
  }
  function banner(html, tipo) {
    const b = $("#banner");
    b.hidden = !html;
    b.className = "banner " + (tipo || "");
    b.innerHTML = html || "";
  }

  function listaTentativas(ts) {
    return `<ul class="diag">${(ts || []).map((x) =>
      `<li>${x.ok ? "✔" : "✖"} <b>${esc(x.nome || x.fonte)}</b> — ${esc(x.ok ? x.detalhe || "funcionou" : x.erro)}</li>`).join("")}</ul>`;
  }

  async function carregar(manual) {
    if (state.carregando) return;
    state.carregando = true;
    status(state.modelo ? "Atualizando…" : "Carregando dados da planilha…");
    try {
      const r = await D.buscar(CFG);
      state.modelo = r.modelo;
      state.origem = r.fonte;
      state.tentativas = r.tentativas;
      state.ultimaAtualizacao = new Date();
      const hora = state.ultimaAtualizacao.toLocaleTimeString("pt-BR");
      const avisos = [];
      if (r.fontes.includes("json_local")) {
        const j = r.jsonPorFonte.json_local;
        const quando = j && j.atualizadoEm ? new Date(j.atualizadoEm) : null;
        const qtxt = quando && !isNaN(quando) ? quando.toLocaleString("pt-BR") : "data não informada";
        const tabs = Object.entries(r.origemPorTabela).filter(([, f]) => f === "json_local").map(([k]) => D.NOMES_TABELA[k]);
        avisos.push(`Parte dos dados (${esc(tabs.join(", "))}) veio da cópia salva no repositório, gerada em ${esc(qtxt)}.`);
      }
      if (r.faltando.length) avisos.push(`Nenhuma fonte trouxe: ${esc(r.faltando.join(", "))}.`);
      banner(avisos.length ? `${avisos.join(" ")}<details><summary>Ver diagnóstico</summary>${listaTentativas(r.tentativas)}</details>` : "", "warn");
      status(`${r.nome[0].toUpperCase() + r.nome.slice(1)} · atualizado às ${hora}`, "on");
    } catch (err) {
      console.error("[painel] nenhuma fonte respondeu:", err);
      state.tentativas = err.tentativas || [{ fonte: "?", erro: err.message || String(err) }];
      const diag = `<details open><summary>Diagnóstico das fontes</summary>${listaTentativas(state.tentativas)}</details>`;
      if (state.modelo && state.origem !== "exemplo") {
        banner(`Não foi possível atualizar agora. Exibindo a última leitura (${state.ultimaAtualizacao.toLocaleTimeString("pt-BR")}).${diag}`, "warn");
        status(`Última leitura às ${state.ultimaAtualizacao.toLocaleTimeString("pt-BR")} · falha na atualização`, "err");
      } else if (CFG.USAR_EXEMPLO_SE_FALHAR && window.DADOS_EXEMPLO) {
        state.modelo = D.interpretar(window.DADOS_EXEMPLO, CFG);
        state.origem = "exemplo";
        banner(`<b>Nenhuma fonte de dados respondeu.</b> Exibindo <b>dados de exemplo</b> salvos no site (cópia da planilha de 27/10/2026) — não são os dados atuais.${diag}`, "warn");
        status("Dados de exemplo · fontes indisponíveis", "err");
      } else {
        banner(`<b>Não foi possível carregar a planilha.</b>${diag}`, "err");
        status("Sem dados", "err");
      }
    } finally {
      state.carregando = false;
      renderTudo();
    }
  }

  function agendar() {
    clearInterval(state.timer);
    if (state.intervalo > 0) state.timer = setInterval(() => { if (!document.hidden) carregar(false); }, state.intervalo * 1000);
  }

  /* ================= EVENTOS ================= */
  $$(".nav-item[data-filtro]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    definirFiltro(a.dataset.filtro, a.dataset.alvo);
    $$(".nav-item[data-filtro]").forEach((x) => x.classList.toggle("active", x === a));
    if (a.dataset.alvo) $("#" + a.dataset.alvo).scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    fecharMenu();
  }));
  $("#busca").addEventListener("input", (e) => { state.busca = e.target.value.trim(); $$(".empty", $("#kpis")).forEach((x) => x.remove()); aplicarFiltroVisual(); });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#busca").focus(); }
    if (e.key === "Escape") { if (document.activeElement === $("#busca")) { $("#busca").value = ""; state.busca = ""; aplicarFiltroVisual(); } $("#dropAlertas").hidden = true; esconderTip(); }
  });
  $("#selPeriodo").addEventListener("change", (e) => {
    const v = Number(e.target.value);
    const ultimo = state.modelo.periodos.length ? state.modelo.periodos[state.modelo.periodos.length - 1].ordem : v;
    state.periodo = v === ultimo ? null : v;
    renderTudo();
  });
  $("#selSerie").addEventListener("change", (e) => { state.serieId = e.target.value; store.set("serie", state.serieId); renderSerie(state.modelo); });
  $("#btnAtualizar").addEventListener("click", () => carregar(true));
  $("#btnExportar").addEventListener("click", () => window.print());
  $("#btnAlertas").addEventListener("click", (e) => { e.stopPropagation(); $("#dropAlertas").hidden = !$("#dropAlertas").hidden; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".alert-wrap")) $("#dropAlertas").hidden = true; });

  // menu móvel
  const fecharMenu = () => { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("open"); };
  $("#btnMenu").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("open"); });
  $("#scrim").addEventListener("click", fecharMenu);

  // configurações e ajuda
  $("#btnConfig").addEventListener("click", (e) => {
    e.preventDefault();
    $("#cfgApi").value = (CFG.FONTES || []).join(" → ");
    $("#cfgDiag").innerHTML = state.tentativas ? listaTentativas(state.tentativas) : "Ainda não carregou.";
    $("#cfgIntervalo").value = String(state.intervalo);
    $("#cfgTema").value = document.documentElement.dataset.theme;
    $("#dlgConfig").showModal();
  });
  $("#cfgIntervalo").addEventListener("change", (e) => { state.intervalo = Number(e.target.value); store.set("intervalo", state.intervalo); agendar(); });
  $("#cfgTema").addEventListener("change", (e) => { document.documentElement.dataset.theme = e.target.value; store.set("tema", e.target.value); renderTudo(); });
  $("#btnAjuda").addEventListener("click", (e) => { e.preventDefault(); $("#dlgAjuda").showModal(); });

  // textos configuráveis
  $("#brandName").textContent = CFG.ORGANIZACAO;
  $("#userName").textContent = CFG.USUARIO;
  $("#userSub").textContent = CFG.USUARIO_SUB;
  $("#linkPlanilha").href = CFG.PLANILHA_URL;

  // esqueleto enquanto carrega
  $("#kpis").innerHTML = Array.from({ length: 8 }, () => `<div class="sk"></div>`).join("");

  let rz;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => state.modelo && renderSerie(state.modelo), 150); });

  carregar(false).then(agendar);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.intervalo > 0 && state.ultimaAtualizacao && Date.now() - state.ultimaAtualizacao > state.intervalo * 1000) carregar(false); });
})();
