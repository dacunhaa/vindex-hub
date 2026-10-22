/*
  Vindex Hub — protótipo navegável.
  IMPORTANTE: não há servidor, login nem banco aqui. Tudo roda no navegador e as
  alterações ficam salvas só neste navegador (localStorage). Ver ARQUITETURA.md.
*/
(function () {
  'use strict';

  const SEED = window.VINDEX_SEED;
  const STORE_KEY = 'vindexhub.demo.v1';
  const DAY = 864e5;
  const DONE_STAGES = ['publicado'];
  const READY_STAGES = ['aprovado', 'agendado', 'publicado'];
  const NEXT_STEP = {
    pauta: 'Escrever o roteiro',
    roteiro: 'Finalizar roteiro e marcar gravação',
    aguardando_gravacao: 'Gravar o conteúdo',
    gravado: 'Enviar para edição',
    em_edicao: 'Finalizar edição e enviar para aprovação',
    aguardando_aprovacao: 'Aprovar ou pedir ajustes',
    ajustes: 'Aplicar ajustes e reenviar',
    aprovado: 'Agendar a publicação',
    agendado: 'Publicar na data marcada',
    publicado: 'Acompanhar resultados'
  };
  const PROFILES = {
    equipe: { label: 'Equipe', person: 'marina' },
    ceo: { label: 'CEO', person: 'ceo' },
    cliente: { label: 'Cliente', person: null }
  };
  const CLIENT_NAME = 'Loja Aurora';

  /* ---------------- Datas ---------------- */
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const TODAY = startOfDay(new Date());
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const offset = (n) => iso(addDays(TODAY, n));
  const diff = (s) => Math.round((parse(s) - TODAY) / DAY);
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const fmt = (s) => { const d = parse(s); return `${WD[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
  const rel = (s) => {
    const n = diff(s);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
  };

  /* ---------------- Estado ---------------- */
  function freshState() {
    const contents = SEED.CONTENTS.map((c) => ({
      id: c.id, title: c.title, format: c.format, channel: c.channel, stage: c.stage, owner: c.owner,
      due: offset(c.due), publish: offset(c.publish), pillar: c.pillar, video: c.video || null,
      version: c.version || 1, script: c.script || '',
      comments: c.comments.map((m) => ({ by: m.by, date: offset(m.d), text: m.text, decision: m.decision || null })),
      history: [{ date: offset(Math.min(c.publish, c.due) - 12), text: 'Pauta criada' }]
        .concat(c.stage !== 'pauta' ? [{ date: offset(Math.min(c.due, 0) - 1), text: `Movido para ${stageLabel(c.stage)}` }] : [])
    }));
    const tasks = SEED.TASKS.map((t) => ({ ...t, due: offset(t.due), ceo: !!t.ceo, content: t.content || null, note: t.note || '' }));
    return { v: 1, seededOn: iso(TODAY), profile: 'equipe', contents, tasks, watched: ['L-1'], seq: { c: 121, t: 16 } };
  }

  // Desloca todas as datas para o protótipo continuar "atual" em outro dia.
  function shiftDates(st, days) {
    const sh = (s) => iso(addDays(parse(s), days));
    st.contents.forEach((c) => {
      c.due = sh(c.due); c.publish = sh(c.publish);
      c.comments.forEach((m) => { m.date = sh(m.date); });
      c.history.forEach((h) => { h.date = sh(h.date); });
    });
    st.tasks.forEach((t) => { t.due = sh(t.due); });
    st.seededOn = iso(TODAY);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const st = JSON.parse(raw);
      if (st.v !== 1) return null;
      const delta = Math.round((TODAY - parse(st.seededOn)) / DAY);
      if (delta) shiftDates(st, delta);
      return st;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* navegador sem armazenamento: segue só em memória */ }
  }

  /* ---------------- Utilidades ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const person = (id) => SEED.PEOPLE.find((p) => p.id === id) || { id, name: id, initials: '?', color: '#999', role: '' };
  const stageLabel = (id) => (SEED.STAGES.find((s) => s.id === id) || {}).label || id;
  const content = (id) => state.contents.find((c) => c.id === id);
  const me = () => PROFILES[state.profile].person;
  const isCEO = () => state.profile === 'ceo';
  const avatar = (id, cls = '') => { const p = person(id); return `<span class="avatar ${cls}" style="background:${p.color}" title="${esc(p.name)}">${esc(p.initials)}</span>`; };
  const who = (id, sub) => { const p = person(id); return `<span class="who">${avatar(id)}<span style="min-width:0"><div class="n">${esc(p.name)}</div>${sub ? `<div class="r">${esc(sub)}</div>` : ''}</span></span>`; };
  const stageBadge = (id) => `<span class="badge st st-${id}"><span class="dot"></span>${esc(stageLabel(id))}</span>`;
  const nextOwner = (c) => (c.stage === 'aguardando_aprovacao' ? 'ceo' : c.owner);
  const contentLate = (c) => !['publicado', 'agendado', 'aprovado'].includes(c.stage) && diff(c.due) < 0;
  const taskLate = (t) => t.status !== 'Concluída' && diff(t.due) < 0;
  const dueTag = (s, done) => {
    if (done) return `<span class="mono muted">${fmt(s)}</span>`;
    const n = diff(s);
    if (n < 0) return `<span class="badge late">Atrasado ${-n}d</span>`;
    if (n === 0) return `<span class="badge today">Hoje</span>`;
    return `<span class="mono" style="font-size:12px">${fmt(s)}</span>`;
  };
  const prioClass = (p) => ({ Alta: 'p-alta', 'Média': 'p-media', Baixa: 'p-baixa' }[p]);
  const options = (list, sel, all) => (all ? `<option value="">${all}</option>` : '') +
    list.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
  const peopleOpts = (sel, all) => options(SEED.PEOPLE.map((p) => ({ value: p.id, label: p.name + (p.id === 'ceo' ? ' (CEO)' : '') })), sel, all);

  let state = load() || freshState();
  const ui = {
    kanban: { q: '', owner: '', format: '', channel: '', late: false },
    tasks: { q: '', owner: '', status: '', priority: '', ceo: false, late: false, hideDone: true },
    cal: { month: TODAY.getMonth(), year: TODAY.getFullYear(), owner: '', format: '', stage: '', view: 'mes' },
    approval: { tab: 'aguardando', selected: null },
    portal: { tab: 'videos', cat: '' },
    localVideo: {},
    navOpen: false
  };

  const I = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 6 2 2 4-4M3 14l2 2 4-4M13 6h8M13 14h8M13 20h8"/></svg>',
    clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="m10 8.5 4.5 2.5L10 13.5z"/><path d="M8 21h8"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'
  };

  let toastTimer;
  function toast(msg, sub = 'salvo só neste navegador') {
    const el = document.getElementById('toast');
    el.innerHTML = `<span>${esc(msg)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  /* ---------------- Ações sobre os dados ---------------- */
  function moveStage(id, stage, opts = {}) {
    const c = content(id);
    if (!c || c.stage === stage) return false;
    if (stage === 'aprovado' && !isCEO() && !opts.force) {
      toast('Só a CEO pode aprovar. Use a Central de aprovação.', 'regra de permissão');
      return false;
    }
    if (stage === 'aguardando_aprovacao' && c.stage === 'ajustes') c.version += 1;
    c.stage = stage;
    c.history.push({ date: iso(TODAY), text: `Movido para ${stageLabel(stage)} por ${person(me()).name}` });
    save();
    return true;
  }

  function decide(id, decision, text) {
    const c = content(id);
    c.comments.push({ by: 'ceo', date: iso(TODAY), text: text || 'Aprovado.', decision });
    c.stage = decision === 'aprovado' ? 'aprovado' : 'ajustes';
    c.history.push({ date: iso(TODAY), text: decision === 'aprovado' ? `Versão ${c.version} aprovada pela CEO` : `CEO pediu ajustes na versão ${c.version}` });
    state.tasks.filter((t) => t.content === id && t.ceo && t.status !== 'Concluída').forEach((t) => { t.status = 'Concluída'; });
    save();
  }

  function addComment(id, text) {
    const c = content(id);
    c.comments.push({ by: me(), date: iso(TODAY), text, decision: null });
    save();
  }

  /* ---------------- Contadores ---------------- */
  function counts() {
    const approvals = state.contents.filter((c) => c.stage === 'aguardando_aprovacao').length;
    const lateTasks = state.tasks.filter(taskLate).length;
    const ceoTasks = state.tasks.filter((t) => t.ceo && t.status !== 'Concluída').length;
    return { approvals, lateTasks, ceoTasks };
  }

  /* ---------------- Estrutura (shell) ---------------- */
  const ROUTES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dash', render: pageDashboard },
    { id: 'producao', label: 'Produção', icon: 'board', render: pageKanban },
    { id: 'aprovacoes', label: 'Central de aprovação', icon: 'check', render: pageApproval },
    { id: 'calendario', label: 'Calendário editorial', icon: 'cal', render: pageCalendar },
    { id: 'tarefas', label: 'Tarefas', icon: 'tasks', render: pageTasks },
    { id: 'clientes', label: 'Área de clientes', icon: 'clients', render: pageClientsPreview }
  ];

  function currentRoute() {
    const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.find((r) => r.id === h) || ROUTES[0];
  }

  function shell(route) {
    const n = counts();
    const badge = { aprovacoes: n.approvals ? `<span class="count">${n.approvals}</span>` : '', tarefas: n.lateTasks ? `<span class="count alert" title="tarefas atrasadas">${n.lateTasks}</span>` : '' };
    const link = (r) => `<a href="#/${r.id}" class="${r.id === route.id ? 'active' : ''}">${I[r.icon]}<span>${r.label}</span>${badge[r.id] || ''}</a>`;
    return `
    <div class="shell ${ui.navOpen ? 'nav-open' : ''}">
      <aside class="sidebar">
        <div class="brand">
          <img src="assets/img/logo_on_dark.png" alt="Vindex">
          <div class="hub-tag"><b>HUB</b> · operação de conteúdo</div>
        </div>
        <nav class="nav">
          <div class="nav-label">Operação</div>
          ${ROUTES.slice(0, 5).map(link).join('')}
          <div class="nav-label">Clientes</div>
          ${link(ROUTES[5])}
        </nav>
        <div class="bars"><span></span><span></span><span></span></div>
        <div class="side-foot">@vindex.ecomm<br>protótipo v1</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost menu-btn" data-act="nav" aria-label="Abrir menu">${I.menu}</button>
          <button class="demo-pill" data-act="about" title="O que é real e o que é demonstração"><i></i>Protótipo · dados fictícios</button>
          <span class="spacer"></span>
          ${viewAs()}
        </header>
        <main class="page" id="page">${route.render()}</main>
      </div>
    </div>`;
  }

  function viewAs() {
    return `<div class="viewas"><label>Visualizar como</label><div class="seg" role="group" aria-label="Visualizar como (demonstração, não é login)">
      ${Object.entries(PROFILES).map(([k, p]) => `<button data-act="profile" data-id="${k}" class="${state.profile === k ? 'on' : ''}">${p.label}</button>`).join('')}
    </div></div>`;
  }

  function head(eyebrow, title, desc, actions = '') {
    return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  }

  /* ---------------- 1. Dashboard ---------------- */
  function attentionItems() {
    const items = [];
    state.contents.forEach((c) => {
      if (c.stage === 'aguardando_aprovacao') items.push({ who: 'ceo', title: c.title, step: 'Aprovar ou pedir ajustes', date: c.due, tag: stageBadge(c.stage), act: 'review', id: c.id });
      else if (c.stage === 'ajustes') items.push({ who: c.owner, title: c.title, step: 'Aplicar ajustes pedidos pela CEO', date: c.due, tag: stageBadge(c.stage), act: 'content', id: c.id });
      else if (contentLate(c)) items.push({ who: c.owner, title: c.title, step: NEXT_STEP[c.stage], date: c.due, tag: stageBadge(c.stage), act: 'content', id: c.id });
    });
    state.tasks.filter(taskLate).forEach((t) => items.push({ who: t.owner, title: t.title, step: t.status === 'Bloqueada' ? `Bloqueada: ${t.note || 'sem motivo'}` : 'Tarefa atrasada', date: t.due, tag: '<span class="badge">Tarefa</span>', act: 'task', id: t.id, ceo: t.ceo }));
    items.sort((a, b) => {
      if (isCEO()) { const ca = a.who === 'ceo' ? 0 : 1; const cb = b.who === 'ceo' ? 0 : 1; if (ca !== cb) return ca - cb; }
      return a.date.localeCompare(b.date);
    });
    return items;
  }

  function pageDashboard() {
    const n = counts();
    const mon = addDays(TODAY, -((TODAY.getDay() + 6) % 7));
    const sun = addDays(mon, 6);
    const inWeek = (s) => parse(s) >= mon && parse(s) <= sun;
    const week = state.contents.filter((c) => inWeek(c.publish));
    const weekReady = week.filter((c) => READY_STAGES.includes(c.stage)).length;
    const pending = state.contents.filter((c) => !DONE_STAGES.includes(c.stage) && c.stage !== 'agendado').length;
    const att = attentionItems();
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const meP = person(me());
    const mine = att.filter((a) => a.who === me());
    const first = mine[0] || att[0];
    const todayTasks = state.tasks.filter((t) => t.status !== 'Concluída' && diff(t.due) === 0).length;
    const summary = isCEO()
      ? `Você tem <b>${n.approvals} ${n.approvals === 1 ? 'aprovação' : 'aprovações'}</b> e <b>${n.ceoTasks} ${n.ceoTasks === 1 ? 'tarefa' : 'tarefas'}</b> esperando sua decisão. O resto da operação está com a equipe.`
      : `A equipe tem <b>${todayTasks} tarefas para hoje</b>, <b>${n.lateTasks} atrasadas</b> e <b>${n.approvals} conteúdos</b> esperando a CEO.`;

    const upcoming = []
      .concat(state.contents.filter((c) => c.stage !== 'publicado').map((c) => ({ date: c.stage === 'agendado' ? c.publish : c.due, title: c.title, kind: c.stage === 'agendado' ? 'Publicação' : NEXT_STEP[c.stage], who: nextOwner(c), act: 'content', id: c.id })))
      .concat(state.tasks.filter((t) => t.status !== 'Concluída').map((t) => ({ date: t.due, title: t.title, kind: 'Tarefa', who: t.owner, act: 'task', id: t.id })))
      .filter((u) => diff(u.date) >= 0 && diff(u.date) <= 7)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);

    const total = state.contents.length;
    const stageCounts = SEED.STAGES.map((s) => ({ ...s, n: state.contents.filter((c) => c.stage === s.id).length }));

    const team = SEED.PEOPLE.map((p) => {
      const cs = state.contents.filter((c) => nextOwner(c) === p.id && !DONE_STAGES.includes(c.stage)).length;
      const ts = state.tasks.filter((t) => t.owner === p.id && t.status !== 'Concluída');
      const late = ts.filter(taskLate).length;
      return { p, cs, ts: ts.length - late, late, total: cs + ts.length };
    });
    const maxLoad = Math.max(...team.map((t) => t.total), 1);

    const kpi = (icon, k, v, h, go, extra = '', cls = '') => `<div class="card kpi ${cls}" data-act="go" data-id="${go}" role="link" tabindex="0"><div class="k">${I[icon]}${k}</div><div class="v">${v}</div><div class="h">${h}</div>${extra}</div>`;

    return `
    <section class="greet">
      <div class="slash"><span></span><span></span><span></span></div>
      <div>
        <div class="date">${WD[TODAY.getDay()]} · ${TODAY.getDate()} de ${MONTHS[TODAY.getMonth()]}</div>
        <h1>${hello}, ${esc(meP.id === 'ceo' ? 'Diretoria' : meP.name.split(' ')[0])}.</h1>
        <p>${summary}</p>
      </div>
      ${first ? `<div class="next"><div class="k">Próximo passo</div><div class="v">${esc(first.title)}</div><div style="font-size:12px;color:#B9C1DA;margin:-6px 0 10px">${esc(first.step)}</div>
        <div style="display:flex;align-items:center;gap:10px;justify-content:space-between">${who(first.who)}<button class="btn primary sm" data-act="${first.act}" data-id="${first.id}">Abrir ${I.arrow}</button></div></div>` : ''}
    </section>

    <section class="kpis">
      ${kpi('cal', 'Produção da semana', `${weekReady}<small>/${week.length}</small>`, 'prontos (aprovados, agendados ou publicados)', 'calendario', `<div class="bar"><i style="width:${week.length ? (weekReady / week.length) * 100 : 0}%"></i></div>`)}
      ${kpi('board', 'Conteúdos pendentes', pending, 'em produção, ainda sem data garantida', 'producao')}
      ${kpi('alert', 'Tarefas atrasadas', n.lateTasks, n.lateTasks ? 'precisam de atenção hoje' : 'nada atrasado', 'tarefas?late', '', n.lateTasks ? 'alert' : '')}
      ${kpi('check', 'Aprovações necessárias', n.approvals, 'esperando a CEO', 'aprovacoes')}
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h2>Precisa de atenção</h2><span class="sub">${att.length} itens · ${isCEO() ? 'o que depende de você aparece primeiro' : 'ordenado por prazo'}</span></div>
        <div class="list">
          ${att.slice(0, 7).map((a) => `
            <div class="row" data-act="${a.act}" data-id="${a.id}">
              ${avatar(a.who, 'lg')}
              <div class="grow"><div class="t">${esc(a.title)}</div><div class="s">${a.tag}<span>${esc(a.step)}</span>${a.who === 'ceo' || a.ceo ? '<span class="badge ceo">Depende da CEO</span>' : ''}</div></div>
              <div class="when">${dueTag(a.date)}</div>
            </div>`).join('') || '<div class="empty" style="margin:0 18px 18px">Nada pendente. 🎉</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Próximos prazos</h2><span class="sub">próximos 7 dias</span><a class="right" href="#/calendario" style="font-size:12.5px;font-weight:600">Calendário →</a></div>
        <div class="list">
          ${upcoming.map((u) => `
            <div class="row" data-act="${u.act}" data-id="${u.id}">
              <div style="width:52px;text-align:center"><div class="mono" style="font-size:18px;font-weight:600;line-height:1">${pad(parse(u.date).getDate())}</div><div class="mono muted" style="font-size:10.5px;text-transform:uppercase">${WD[parse(u.date).getDay()]}</div></div>
              <div class="grow"><div class="t">${esc(u.title)}</div><div class="s"><span>${esc(u.kind)}</span>·<span>${esc(person(u.who).name)}</span></div></div>
              <div class="when muted">${rel(u.date)}</div>
            </div>`).join('') || '<div class="empty" style="margin:0 18px 18px">Sem prazos nos próximos dias.</div>'}
        </div>
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h2>Funil de produção</h2><span class="sub">${total} conteúdos por etapa</span><a class="right" href="#/producao" style="font-size:12.5px;font-weight:600">Abrir Kanban →</a></div>
        <div class="card-b">
          <div class="pipeline">${stageCounts.filter((s) => s.n).map((s) => `<i class="st st-${s.id}" style="width:${(s.n / total) * 100}%" title="${esc(s.label)}: ${s.n}"></i>`).join('')}</div>
          <div class="legend">${stageCounts.map((s) => `<div class="st st-${s.id}" data-act="go" data-id="producao"><span class="sw"></span>${esc(s.label)}<b>${s.n}</b></div>`).join('')}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Carga da equipe</h2><span class="sub">conteúdos e tarefas abertas</span></div>
        <div class="card-b load">
          ${team.map((t) => `<div class="l">${who(t.p.id, t.p.role)}
            <div class="track" title="${t.cs} conteúdos · ${t.ts} tarefas no prazo · ${t.late} atrasadas">
              <i style="width:${(t.cs / maxLoad) * 100}%;background:var(--blue)"></i>
              <i style="width:${(t.ts / maxLoad) * 100}%;background:#9DB4FF"></i>
              <i style="width:${(t.late / maxLoad) * 100}%;background:var(--danger)"></i>
            </div><span class="num">${t.total}</span></div>`).join('')}
          <div class="cal-legend" style="margin-top:2px">
            <span><i style="--c:var(--blue)"></i>Conteúdos</span><span><i style="--c:#9DB4FF"></i>Tarefas no prazo</span><span><i style="--c:var(--danger)"></i>Atrasadas</span>
          </div>
        </div>
      </div>
    </section>`;
  }

  /* ---------------- 2. Produção (Kanban) ---------------- */
  function kanbanFiltered() {
    const f = ui.kanban; const q = f.q.trim().toLowerCase();
    return state.contents.filter((c) =>
      (!q || (c.title + ' ' + c.id + ' ' + c.pillar).toLowerCase().includes(q)) &&
      (!f.owner || nextOwner(c) === f.owner || c.owner === f.owner) &&
      (!f.format || c.format === f.format) &&
      (!f.channel || c.channel === f.channel) &&
      (!f.late || contentLate(c)));
  }

  function kcard(c) {
    const n = diff(c.due);
    const done = ['publicado', 'agendado'].includes(c.stage);
    const dueCls = done ? '' : n < 0 ? 'late' : n === 0 ? 'today' : '';
    const dueTxt = c.stage === 'agendado' || c.stage === 'publicado' ? `pub. ${fmt(c.publish)}` : n < 0 ? `atrasado ${-n}d` : n === 0 ? 'prazo hoje' : `prazo ${fmt(c.due)}`;
    return `<article class="kcard" draggable="true" data-card="${c.id}" data-act="content" data-id="${c.id}">
      <div class="id">${c.id}<span>·</span>${esc(c.channel)}${c.comments.length ? `<span style="margin-left:auto">💬 ${c.comments.length}</span>` : ''}</div>
      <div class="ttl">${esc(c.title)}</div>
      <div class="meta"><span class="badge fmt">${esc(c.format)}</span>${c.video ? `<span class="vid">${I.play.replace('<svg', '<svg width="10" height="10"')} vídeo</span>` : ''}${c.stage === 'aguardando_aprovacao' ? '<span class="badge ceo">CEO</span>' : ''}</div>
      <div class="foot"><span class="due ${dueCls}">${I.clock.replace('<svg', '<svg width="12" height="12"')}${dueTxt}</span>${avatar(nextOwner(c))}</div>
    </article>`;
  }

  function pageKanban() {
    const f = ui.kanban;
    const list = kanbanFiltered();
    return head('Produção de conteúdo', 'Kanban de produção', 'Arraste os cards entre as etapas ou clique para ver detalhes. O avatar mostra quem tem o próximo passo.',
      `<button class="btn primary" data-act="new-content">${I.plus}Novo conteúdo</button>`) + `
    <div class="filters">
      <input class="input search" id="k-q" placeholder="Buscar título, código ou tema" value="${esc(f.q)}" data-filter="kanban.q">
      <select class="input" data-filter="kanban.owner">${peopleOpts(f.owner, 'Todos os responsáveis')}</select>
      <select class="input" data-filter="kanban.format">${options(SEED.FORMATS, f.format, 'Todos os formatos')}</select>
      <select class="input" data-filter="kanban.channel">${options(SEED.CHANNELS, f.channel, 'Todos os canais')}</select>
      <label class="chip-toggle ${f.late ? 'on' : ''}"><input type="checkbox" data-filter="kanban.late" ${f.late ? 'checked' : ''}>Só atrasados</label>
      ${f.q || f.owner || f.format || f.channel || f.late ? '<button class="btn ghost sm" data-act="clear-kanban">Limpar filtros</button>' : ''}
      <span class="result">${list.length} de ${state.contents.length}</span>
    </div>
    <div class="kanban" id="kanban">
      ${SEED.STAGES.map((s) => { const cards = list.filter((c) => c.stage === s.id); return `
        <section class="col st st-${s.id}">
          <div class="col-h"><span class="dot"></span><b>${esc(s.label)}</b><span class="n">${cards.length}</span></div>
          <div class="col-b" data-drop="${s.id}">${cards.map(kcard).join('')}</div>
        </section>`; }).join('')}
    </div>`;
  }

  /* ---------------- 3. Central de aprovação ---------------- */
  function approvalLists() {
    const recent = state.contents.filter((c) => c.comments.some((m) => m.decision === 'aprovado') && ['aprovado', 'agendado', 'publicado'].includes(c.stage));
    return {
      aguardando: state.contents.filter((c) => c.stage === 'aguardando_aprovacao').sort((a, b) => a.due.localeCompare(b.due)),
      ajustes: state.contents.filter((c) => c.stage === 'ajustes'),
      aprovados: recent
    };
  }

  function playerHTML(c) {
    const src = c.video || ui.localVideo[c.id];
    if (src) {
      return `<div class="player"><video id="review-video" src="${esc(src)}" controls preload="metadata" playsinline></video></div>
        ${!c.video ? '<div class="local-note">Pré-visualização de um arquivo do seu computador. Nada foi enviado: ao recarregar a página, o vídeo some.</div>' : ''}`;
    }
    return `<div class="player"><div class="none">${I.film}<b>Sem arquivo de vídeo nesta versão</b>
      <p>Neste protótipo não há upload real. Você pode pré-visualizar um vídeo do seu computador. Ele não é enviado a lugar nenhum.</p>
      <label class="btn sm" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2)">Escolher vídeo do computador<input type="file" accept="video/*" hidden data-local-video="${c.id}"></label></div></div>`;
  }

  function thread(c) {
    return `<div class="thread" id="thread">${c.comments.map((m) => `
      <div class="msg ${m.decision || ''}">${avatar(m.by)}<div class="bubble"><div class="h"><b>${esc(person(m.by).name)}</b><span>${rel(m.date)}</span>${m.decision === 'aprovado' ? '<span class="badge st st-aprovado">Aprovou</span>' : m.decision === 'ajustes' ? '<span class="badge st st-ajustes">Pediu ajustes</span>' : ''}</div>${esc(m.text)}</div></div>`).join('') || '<div class="muted" style="font-size:12.5px">Nenhum comentário ainda.</div>'}</div>`;
  }

  function pageApproval() {
    const lists = approvalLists();
    const tab = ui.approval.tab;
    const list = lists[tab];
    if (!list.find((c) => c.id === ui.approval.selected)) ui.approval.selected = list[0] ? list[0].id : null;
    const c = content(ui.approval.selected);
    const tabs = [['aguardando', 'Aguardando'], ['ajustes', 'Em ajustes'], ['aprovados', 'Aprovados']];
    const canDecide = c && c.stage === 'aguardando_aprovacao';

    return head('Central de aprovação', 'Aprovar conteúdos', 'Veja o roteiro e o vídeo, comente e decida. Cada decisão fica registrada no histórico do conteúdo.') + `
    <div class="approval">
      <aside class="card queue">
        <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="ap-tab" data-id="${k}">${l}<span class="n">${lists[k].length}</span></button>`).join('')}</div>
        <div style="margin-top:10px">
          ${list.map((x) => `<div class="qitem ${x.id === ui.approval.selected ? 'on' : ''}" data-act="ap-select" data-id="${x.id}">
            <div class="mono muted" style="font-size:11px">${x.id} · v${x.version}</div>
            <div class="t">${esc(x.title)}</div>
            <div class="m"><span class="badge fmt">${esc(x.format)}</span>${x.video ? '<span class="badge">▶ vídeo</span>' : '<span class="badge">sem vídeo</span>'}${dueTag(x.due, tab === 'aprovados')}</div>
          </div>`).join('') || '<div class="empty" style="margin:0 12px 12px">Nenhum conteúdo nesta lista.</div>'}
        </div>
      </aside>
      ${c ? `<section class="card">
        <div class="review-h">
          <div class="id">${c.id} · versão ${c.version} · ${esc(c.channel)}</div>
          <h2>${esc(c.title)}</h2>
          <div class="m">${stageBadge(c.stage)}<span class="badge fmt">${esc(c.format)}</span><span class="badge">Pilar: ${esc(c.pillar)}</span>${who(c.owner, 'responsável')}<span class="muted" style="font-size:12.5px">Publicação prevista: <b class="mono">${fmt(c.publish)}</b></span></div>
        </div>
        <div class="review-body">
          <div class="review-main">
            <p class="section-t">Vídeo</p>
            ${playerHTML(c)}
            <p class="section-t" style="margin-top:20px">Roteiro · versão ${c.version}</p>
            <div class="script">${esc(c.script) || '<span class="muted">Roteiro ainda não escrito.</span>'}</div>
          </div>
          <div class="review-side">
            <div class="decision">
              <h4>Decisão</h4>
              ${canDecide ? `<p>Para pedir ajustes, escreva o que mudar no campo de comentário abaixo.</p>
                <div class="btns">
                  <button class="btn approve" data-act="approve" data-id="${c.id}" ${isCEO() ? '' : 'disabled'}>${I.check}Aprovar</button>
                  <button class="btn adjust" data-act="adjust" data-id="${c.id}" ${isCEO() ? '' : 'disabled'}>Pedir ajustes</button>
                </div>
                ${isCEO() ? '' : `<div class="lock">${I.lock.replace('<svg', '<svg width="13" height="13" style="vertical-align:-2px"')} Só a CEO aprova. Para testar, mude <b>Visualizar como</b> para <b>CEO</b> no topo.</div>`}`
              : c.stage === 'ajustes' ? `<p>A CEO pediu ajustes. Quando a nova versão estiver pronta, reenvie.</p><button class="btn primary" style="width:100%" data-act="resubmit" data-id="${c.id}">Reenviar para aprovação (v${c.version + 1})</button>`
              : `<p>Este conteúdo já foi aprovado.</p>${c.stage === 'aprovado' ? `<button class="btn dark" style="width:100%" data-act="schedule" data-id="${c.id}">Marcar como agendado</button>` : stageBadge(c.stage)}`}
            </div>
            <div>
              <p class="section-t">Comentários (${c.comments.length})</p>
              ${thread(c)}
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                <textarea class="input" id="ap-comment" placeholder="${canDecide && isCEO() ? 'Ex.: aos 0:12, trocar a legenda…' : 'Escreva um comentário…'}"></textarea>
                ${c.video || ui.localVideo[c.id] ? '<label class="chip-toggle" style="font-weight:500;font-size:12px"><input type="checkbox" id="ap-time">Marcar o minuto atual do vídeo</label>' : ''}
                <button class="btn" data-act="comment" data-id="${c.id}">Comentar como ${esc(person(me()).name)}</button>
              </div>
            </div>
          </div>
        </div>
      </section>` : `<section class="empty" style="padding:60px">Selecione um conteúdo na lista ao lado.</section>`}
    </div>`;
  }

  /* ---------------- 4. Calendário editorial ---------------- */
  function calFiltered() {
    const f = ui.cal;
    return state.contents.filter((c) => (!f.owner || c.owner === f.owner) && (!f.format || c.format === f.format) && (!f.stage || c.stage === f.stage));
  }
  const evHTML = (c) => `<div class="ev st st-${c.stage}" data-act="content" data-id="${c.id}" title="${esc(c.title)} · ${esc(c.format)} · ${esc(stageLabel(c.stage))} · ${esc(person(c.owner).name)}">${avatar(c.owner, 'av')}<span>${esc(c.format)} · ${esc(c.title)}</span></div>`;

  function pageCalendar() {
    const f = ui.cal;
    const list = calFiltered();
    const first = new Date(f.year, f.month, 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 42; i++) days.push(addDays(start, i));
    while (days.length > 35 && days[days.length - 7].getMonth() !== f.month) days.splice(days.length - 7, 7);

    const grid = `<div class="cal">
      ${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => `<div class="dow">${d}</div>`).join('')}
      ${days.map((d) => { const s = iso(d); const evs = list.filter((c) => c.publish === s); const wk = d.getDay() === 0 || d.getDay() === 6; return `
        <div class="day ${d.getMonth() !== f.month ? 'out' : ''} ${s === iso(TODAY) ? 'today' : ''} ${wk ? 'weekend' : ''}">
          <span class="num">${d.getDate()}</span>${evs.map(evHTML).join('')}
        </div>`; }).join('')}
    </div>`;

    const monthList = list.filter((c) => { const d = parse(c.publish); return d.getMonth() === f.month && d.getFullYear() === f.year; }).sort((a, b) => a.publish.localeCompare(b.publish));
    const listView = `<div class="card table-wrap"><table class="table"><thead><tr><th>Data</th><th>Conteúdo</th><th>Formato</th><th>Status</th><th>Responsável</th></tr></thead><tbody>
      ${monthList.map((c) => `<tr data-act="content" data-id="${c.id}" style="cursor:pointer"><td class="mono" style="white-space:nowrap">${fmt(c.publish)}</td><td><div class="tt">${esc(c.title)}</div><div class="tsub">${c.id} · ${esc(c.channel)}</div></td><td><span class="badge fmt">${esc(c.format)}</span></td><td>${stageBadge(c.stage)}</td><td>${who(c.owner)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nada publicado neste mês com os filtros atuais.</div></td></tr>'}
    </tbody></table></div>`;

    return head('Calendário editorial', 'Calendário de publicações', 'Cada conteúdo aparece na data prevista de publicação, com formato, status (cor) e responsável (avatar).',
      `<button class="btn primary" data-act="new-content">${I.plus}Novo conteúdo</button>`) + `
    <div class="cal-head">
      <button class="btn sm" data-act="cal-prev" aria-label="Mês anterior">${I.chevL}</button>
      <button class="btn sm" data-act="cal-next" aria-label="Próximo mês">${I.chevR}</button>
      <h2>${MONTHS[f.month]} ${f.year}</h2>
      <button class="btn sm" data-act="cal-today">Hoje</button>
      <span style="flex:1"></span>
      <div class="seg"><button class="${f.view === 'mes' ? 'on' : ''}" data-act="cal-view" data-id="mes">Mês</button><button class="${f.view === 'lista' ? 'on' : ''}" data-act="cal-view" data-id="lista">Lista</button></div>
    </div>
    <div class="filters">
      <select class="input" data-filter="cal.owner">${peopleOpts(f.owner, 'Todos os responsáveis')}</select>
      <select class="input" data-filter="cal.format">${options(SEED.FORMATS, f.format, 'Todos os formatos')}</select>
      <select class="input" data-filter="cal.stage">${options(SEED.STAGES.map((s) => ({ value: s.id, label: s.label })), f.stage, 'Todos os status')}</select>
      <span class="result">${monthList.length} no mês</span>
    </div>
    ${f.view === 'mes' ? grid : listView}
    <div class="cal-legend">${SEED.STAGES.map((s) => `<span class="st st-${s.id}"><i></i>${esc(s.label)}</span>`).join('')}</div>`;
  }

  /* ---------------- 5. Tarefas ---------------- */
  const STATUSES = ['A fazer', 'Em andamento', 'Bloqueada', 'Concluída'];
  const PRIORITIES = ['Alta', 'Média', 'Baixa'];

  function tasksFiltered() {
    const f = ui.tasks; const q = f.q.trim().toLowerCase();
    return state.tasks.filter((t) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (!f.owner || t.owner === f.owner) &&
      (!f.status || t.status === f.status) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.ceo || t.ceo) &&
      (!f.late || taskLate(t)) &&
      (!f.hideDone || t.status !== 'Concluída' || f.status === 'Concluída'))
      .sort((a, b) => (a.status === 'Concluída') - (b.status === 'Concluída') || a.due.localeCompare(b.due) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  }

  function pageTasks() {
    const f = ui.tasks;
    const list = tasksFiltered();
    const chip = (key, label) => `<label class="chip-toggle ${f[key] ? 'on' : ''}"><input type="checkbox" data-filter="tasks.${key}" ${f[key] ? 'checked' : ''}>${label}</label>`;
    return head('Gestão de tarefas', 'Tarefas da operação', 'Quem faz, até quando e com qual prioridade. O marcador <span class="badge ceo">Depende da CEO</span> mostra o que está parado esperando a diretoria.',
      `<button class="btn primary" data-act="new-task">${I.plus}Nova tarefa</button>`) + `
    <div class="filters">
      <input class="input search" id="t-q" placeholder="Buscar tarefa" value="${esc(f.q)}" data-filter="tasks.q">
      <select class="input" data-filter="tasks.owner">${peopleOpts(f.owner, 'Todos os responsáveis')}</select>
      <select class="input" data-filter="tasks.status">${options(STATUSES, f.status, 'Todos os status')}</select>
      <select class="input" data-filter="tasks.priority">${options(PRIORITIES, f.priority, 'Todas as prioridades')}</select>
      ${chip('ceo', 'Depende da CEO')}${chip('late', 'Atrasadas')}${chip('hideDone', 'Ocultar concluídas')}
      <span class="result">${list.length} tarefas</span>
    </div>
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th style="width:40px"></th><th>Tarefa</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Status</th><th>CEO</th></tr></thead>
        <tbody>
        ${list.map((t) => { const c = t.content ? content(t.content) : null; const done = t.status === 'Concluída'; return `
          <tr class="${done ? 'done' : ''}">
            <td><input type="checkbox" class="check" data-act="task-done" data-id="${t.id}" ${done ? 'checked' : ''} aria-label="Concluir tarefa"></td>
            <td><div class="tt">${esc(t.title)}</div><div class="tsub">${t.id}${c ? ` · <a data-act="content" data-id="${c.id}">${c.id} ${esc(c.title.slice(0, 42))}${c.title.length > 42 ? '…' : ''}</a>` : ''}${t.note ? ` · <span style="color:var(--danger)">${esc(t.note)}</span>` : ''}</div></td>
            <td>${who(t.owner)}</td>
            <td style="white-space:nowrap">${dueTag(t.due, done)}${!done && diff(t.due) > 0 ? `<div class="muted" style="font-size:11px">${rel(t.due)}</div>` : ''}</td>
            <td><span class="badge ${prioClass(t.priority)}">${t.priority}</span></td>
            <td><select class="mini" data-task-status="${t.id}">${options(STATUSES, t.status)}</select></td>
            <td><button class="btn ghost sm" data-act="task-ceo" data-id="${t.id}" title="Marcar/desmarcar: depende da CEO">${t.ceo ? '<span class="badge ceo">Depende</span>' : `<span class="muted">${I.flag.replace('<svg', '<svg width="14" height="14"')}</span>`}</button></td>
          </tr>`; }).join('') || '<tr><td colspan="7"><div class="empty">Nenhuma tarefa com esses filtros.</div></td></tr>'}
        </tbody>
      </table>
    </div>`;
  }

  /* ---------------- 6. Área de clientes ---------------- */
  function libraryHTML(inShell) {
    const p = ui.portal;
    const cats = [...new Set(SEED.LIBRARY.map((l) => l.cat))];
    const vids = SEED.LIBRARY.filter((l) => l.type === 'video' && (!p.cat || l.cat === p.cat));
    const mats = SEED.LIBRARY.filter((l) => l.type === 'material' && (!p.cat || l.cat === p.cat));
    const catBar = `<div class="filters"><button class="chip-toggle ${!p.cat ? 'on' : ''}" data-act="portal-cat" data-id="">Todos</button>${cats.map((c) => `<button class="chip-toggle ${p.cat === c ? 'on' : ''}" data-act="portal-cat" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    const videos = `<h2>Vídeos educativos</h2><div class="lib">${vids.map((v) => `
      <article class="vcard" data-act="watch" data-id="${v.id}">
        <div class="thumb"><div class="sl"><i></i><i></i><i></i></div><span class="play">${I.play}</span><div class="cap">${esc(v.title)}</div><span class="dur">${v.dur}</span></div>
        <div class="info"><div class="t">${esc(v.title)}</div><div class="m"><span class="badge fmt">${esc(v.cat)}</span><span class="badge">${esc(v.level)}</span>${state.watched.includes(v.id) ? '<span class="badge st st-aprovado">Assistido</span>' : ''}</div></div>
      </article>`).join('') || '<div class="empty">Nenhum vídeo nesta categoria.</div>'}</div>`;
    const materials = `<h2>Materiais exclusivos</h2><div class="mats">${mats.map((m) => `
      <div class="mat"><span class="ic">${m.file}</span><div><div class="t">${esc(m.title)}</div><div class="c">${esc(m.cat)}</div></div>
      <button class="btn sm" data-act="download" title="Disponível quando o armazenamento de arquivos estiver conectado">${I.down}Baixar</button></div>`).join('') || '<div class="empty">Nenhum material nesta categoria.</div>'}</div>`;
    const body = p.tab === 'videos' ? videos : p.tab === 'materiais' ? materials : videos + materials;
    return catBar + body + `<div class="portal-note"><b>Demonstração.</b> No sistema real, cada cliente entra com login próprio e só vê o que foi liberado para a empresa dele. ${inShell ? 'A equipe Vindex escolhe aqui quais vídeos e materiais cada cliente recebe.' : 'Os downloads e vídeos vêm de armazenamento privado com links temporários.'}</div>`;
  }

  function pageClientsPreview() {
    return head('Área de clientes', 'Portal do cliente', 'Uma área separada da operação interna, com vídeos educativos e materiais exclusivos. Abaixo, a biblioteca como o cliente vê.',
      `<button class="btn dark" data-act="profile" data-id="cliente">Abrir como cliente ${I.arrow}</button>`) +
      `<div class="seg" style="margin-bottom:14px">${[['videos', 'Vídeos'], ['materiais', 'Materiais'], ['tudo', 'Tudo']].map(([k, l]) => `<button class="${ui.portal.tab === k ? 'on' : ''}" data-act="portal-tab" data-id="${k}">${l}</button>`).join('')}</div>` +
      libraryHTML(true);
  }

  function portal() {
    const vids = SEED.LIBRARY.filter((l) => l.type === 'video');
    const seen = vids.filter((v) => state.watched.includes(v.id)).length;
    return `<div class="portal">
      <header class="portal-top">
        <img src="assets/img/logo_on_light.png" alt="Vindex">
        <span class="sep"></span><span class="area">Área do cliente</span>
        <nav>${[['videos', 'Vídeos'], ['materiais', 'Materiais'], ['tudo', 'Tudo']].map(([k, l]) => `<button class="${ui.portal.tab === k ? 'on' : ''}" data-act="portal-tab" data-id="${k}">${l}</button>`).join('')}</nav>
        <span style="flex:1"></span>
        <button class="demo-pill" data-act="about"><i></i>Protótipo · dados fictícios</button>
        ${viewAs()}
      </header>
      <section class="portal-hero"><div class="slash"><span></span><span></span><span></span></div><div>
        <div class="k">${esc(CLIENT_NAME)} · cliente exemplo</div>
        <h1>Entre vender e lucrar, existe a Vindex.</h1>
        <p>Vídeos curtos e materiais práticos para você entender os números do seu e-commerce e tomar decisões com segurança.</p>
        <div class="prog"><div><b>${seen}/${vids.length}</b><span>vídeos assistidos</span></div><div><b>${SEED.LIBRARY.length - vids.length}</b><span>materiais disponíveis</span></div></div>
      </div></section>
      <main class="portal-body">${libraryHTML(false)}</main>
    </div>`;
  }

  /* ---------------- Camadas: drawer e modal ---------------- */
  function openLayer(html) {
    closeLayer();
    const ov = document.getElementById('overlay');
    ov.hidden = false;
    const layer = document.createElement('div');
    layer.id = 'layer';
    layer.innerHTML = html;
    document.body.appendChild(layer);
    const f = layer.querySelector('[autofocus]');
    if (f) f.focus();
  }
  function closeLayer() {
    const l = document.getElementById('layer');
    if (l) l.remove();
    document.getElementById('overlay').hidden = true;
  }

  function openContent(id) {
    const c = content(id);
    if (!c) return;
    const task = state.tasks.filter((t) => t.content === id);
    openLayer(`<aside class="drawer" role="dialog" aria-label="${esc(c.title)}">
      <div class="drawer-h"><div><div class="mono muted" style="font-size:11.5px">${c.id} · versão ${c.version}</div><h2>${esc(c.title)}</h2>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${stageBadge(c.stage)}<span class="badge fmt">${esc(c.format)}</span>${contentLate(c) ? `<span class="badge late">Atrasado ${-diff(c.due)}d</span>` : ''}</div></div>
        <button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <div class="drawer-b">
        <div style="background:var(--blue-50);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px">
          <div style="flex:1"><div class="section-t" style="margin:0 0 3px;color:var(--blue-600)">Próximo passo</div><b>${esc(NEXT_STEP[c.stage])}</b></div>${who(nextOwner(c))}
        </div>
        <dl class="props">
          <dt>Etapa</dt><dd><select class="input" data-content-field="stage" data-id="${c.id}">${options(SEED.STAGES.map((s) => ({ value: s.id, label: s.label })), c.stage)}</select></dd>
          <dt>Responsável</dt><dd><select class="input" data-content-field="owner" data-id="${c.id}">${peopleOpts(c.owner)}</select></dd>
          <dt>Prazo da etapa</dt><dd><input type="date" class="input" data-content-field="due" data-id="${c.id}" value="${c.due}"></dd>
          <dt>Publicação</dt><dd><input type="date" class="input" data-content-field="publish" data-id="${c.id}" value="${c.publish}"></dd>
          <dt>Canal · Pilar</dt><dd>${esc(c.channel)} · ${esc(c.pillar)}</dd>
          <dt>Vídeo</dt><dd>${c.video ? '<span class="badge st st-aprovado">Arquivo anexado</span>' : '<span class="muted">Nenhum arquivo</span>'}</dd>
        </dl>
        <div><p class="section-t">Roteiro</p><div class="script" style="max-height:220px">${esc(c.script) || '<span class="muted">Ainda não escrito.</span>'}</div></div>
        ${task.length ? `<div><p class="section-t">Tarefas ligadas</p>${task.map((t) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px;padding:4px 0">${avatar(t.owner)}<span style="flex:1">${esc(t.title)}</span><span class="badge">${t.status}</span></div>`).join('')}</div>` : ''}
        <div><p class="section-t">Comentários</p>${thread(c)}</div>
        <div><p class="section-t">Histórico</p><div class="hist">${c.history.slice().reverse().map((h) => `<div><span class="when">${fmt(h.date)}</span><span>${esc(h.text)}</span></div>`).join('')}</div></div>
      </div>
      <div class="drawer-f">
        <button class="btn" data-act="close">Fechar</button>
        ${['aguardando_aprovacao', 'ajustes', 'aprovado'].includes(c.stage) ? `<button class="btn primary" data-act="review" data-id="${c.id}">Abrir na Central de aprovação ${I.arrow}</button>` : ''}
      </div>
    </aside>`);
  }

  function openTask(id) {
    location.hash = '#/tarefas';
    const t = state.tasks.find((x) => x.id === id);
    if (t) { ui.tasks.q = t.title; ui.tasks.hideDone = false; }
    render();
  }

  function newContentModal() {
    openLayer(`<div class="modal" role="dialog" aria-label="Novo conteúdo">
      <div class="drawer-h"><div><div class="eyebrow mono" style="font-size:11px;color:var(--blue);letter-spacing:.14em;text-transform:uppercase">Nova pauta</div><h2>Novo conteúdo</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <form class="form" id="f-content">
        <div class="field full"><label>Título</label><input class="input" name="title" required autofocus placeholder="Ex.: Como calcular o lucro real de um pedido"></div>
        <div class="field"><label>Formato</label><select class="input" name="format">${options(SEED.FORMATS, 'Reels')}</select></div>
        <div class="field"><label>Canal</label><select class="input" name="channel">${options(SEED.CHANNELS, 'Instagram')}</select></div>
        <div class="field"><label>Responsável</label><select class="input" name="owner">${peopleOpts('marina')}</select></div>
        <div class="field"><label>Publicação prevista</label><input class="input" type="date" name="publish" value="${offset(14)}"></div>
        <div class="field full"><label>Pilar</label><select class="input" name="pillar">${options(['Lucro', 'Fluxo de caixa', 'Marketplaces', 'Impostos', 'Gestão', 'Institucional'], 'Lucro')}</select></div>
      </form>
      <div class="drawer-f"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save-content">Criar na etapa Pauta</button></div>
    </div>`);
  }

  function newTaskModal() {
    openLayer(`<div class="modal" role="dialog" aria-label="Nova tarefa">
      <div class="drawer-h"><div><h2>Nova tarefa</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <form class="form" id="f-task">
        <div class="field full"><label>Tarefa</label><input class="input" name="title" required autofocus placeholder="O que precisa ser feito?"></div>
        <div class="field"><label>Responsável</label><select class="input" name="owner">${peopleOpts(me() || 'marina')}</select></div>
        <div class="field"><label>Prazo</label><input class="input" type="date" name="due" value="${offset(2)}"></div>
        <div class="field"><label>Prioridade</label><select class="input" name="priority">${options(PRIORITIES, 'Média')}</select></div>
        <div class="field"><label>Conteúdo ligado (opcional)</label><select class="input" name="content">${options(state.contents.filter((c) => c.stage !== 'publicado').map((c) => ({ value: c.id, label: `${c.id} · ${c.title.slice(0, 34)}` })), '', 'Nenhum')}</select></div>
        <label class="chip-toggle full"><input type="checkbox" name="ceo">Esta tarefa depende da CEO</label>
      </form>
      <div class="drawer-f"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save-task">Criar tarefa</button></div>
    </div>`);
  }

  function watchModal(id) {
    const v = SEED.LIBRARY.find((l) => l.id === id);
    if (!state.watched.includes(id) && v.video) { state.watched.push(id); save(); }
    openLayer(`<div class="modal" style="width:min(820px,calc(100vw - 32px))" role="dialog" aria-label="${esc(v.title)}">
      <div class="drawer-h"><div><div class="mono muted" style="font-size:11px">${esc(v.cat)} · ${v.dur}</div><h2>${esc(v.title)}</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <div style="padding:6px 22px 22px">${v.video
        ? `<div class="player"><video src="${esc(v.video)}" controls autoplay playsinline></video></div><p class="muted" style="font-size:12px;margin:10px 0 0">Neste protótipo, o vídeo institucional da Vindex é usado como exemplo de aula.</p>`
        : `<div class="player"><div class="none">${I.film}<b>Aula de demonstração</b><p>Este vídeo ainda não existe. No sistema real, ele viria de um serviço de vídeo com link temporário, visível só para clientes com acesso.</p></div></div>`}</div>
    </div>`);
  }

  function aboutModal() {
    openLayer(`<div class="modal" style="width:min(600px,calc(100vw - 32px))" role="dialog" aria-label="Sobre o protótipo">
      <div class="drawer-h"><div><h2>O que é real neste protótipo</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <div style="padding:4px 22px 18px;font-size:13.5px;line-height:1.6">
        <p style="margin-top:0"><b>Funciona de verdade:</b> navegação, filtros, mover cards, criar conteúdos e tarefas, comentar, aprovar e pedir ajustes.</p>
        <p><b>Mas é só demonstração:</b> todas as alterações ficam salvas <b>apenas neste navegador</b>. Outra pessoa não vê o que você mudou. Não há login: o seletor “Visualizar como” só troca a visão, não protege nada.</p>
        <p><b>Não existe ainda:</b> upload de arquivos, banco de dados, contas de usuário, e-mails e downloads da área de clientes. Todos os nomes, empresas e números são fictícios.</p>
        <p style="margin-bottom:0">O plano para transformar isto num sistema real está no arquivo <span class="mono">ARQUITETURA.md</span>, dentro da pasta do projeto.</p>
      </div>
      <div class="drawer-f"><button class="btn adjust" data-act="reset">Restaurar dados de exemplo</button><button class="btn primary" data-act="close">Entendi</button></div>
    </div>`);
  }

  /* ---------------- Render ---------------- */
  function render() {
    const active = document.activeElement;
    const focusId = active && active.id;
    const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    const vid = document.getElementById('review-video');
    const vstate = vid ? { src: vid.getAttribute('src'), t: vid.currentTime } : null;
    const draft = document.getElementById('ap-comment');
    const draftText = draft ? draft.value : '';

    const app = document.getElementById('app');
    if (state.profile === 'cliente') {
      app.innerHTML = portal();
    } else {
      if (location.hash.startsWith('#/portal')) location.hash = '#/dashboard';
      const route = currentRoute();
      app.innerHTML = shell(route);
      document.title = `${route.label} · Vindex Hub`;
    }

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); if (caret !== null && el.setSelectionRange) el.setSelectionRange(caret, caret); }
    }
    const nv = document.getElementById('review-video');
    if (nv && vstate && nv.getAttribute('src') === vstate.src) nv.currentTime = vstate.t;
    const nd = document.getElementById('ap-comment');
    if (nd && draftText) nd.value = draftText;
  }

  function setFilter(path, value) {
    const [group, key] = path.split('.');
    ui[group][key] = value;
    render();
  }

  /* ---------------- Eventos ---------------- */
  document.addEventListener('click', (e) => {
    if (e.target.id === 'overlay') { closeLayer(); return; }
    const el = e.target.closest('[data-act]');
    if (!el) {
      if (ui.navOpen && !e.target.closest('.sidebar')) { ui.navOpen = false; render(); }
      return;
    }
    const act = el.dataset.act;
    const id = el.dataset.id;
    if (el.tagName === 'INPUT' && el.type === 'checkbox' && act !== 'task-done') return;

    switch (act) {
      case 'nav': ui.navOpen = !ui.navOpen; render(); break;
      case 'go': {
        const [route, flag] = id.split('?');
        if (route === 'tarefas' && flag === 'late') { ui.tasks.late = true; ui.tasks.ceo = false; ui.tasks.q = ''; }
        location.hash = '#/' + route; break;
      }
      case 'about': aboutModal(); break;
      case 'close': closeLayer(); break;
      case 'reset':
        try { localStorage.removeItem(STORE_KEY); } catch (err) { /* sem armazenamento */ }
        state = freshState(); ui.localVideo = {}; closeLayer(); render(); toast('Dados de exemplo restaurados', ''); break;
      case 'profile':
        state.profile = id; save(); closeLayer();
        if (id === 'cliente') { ui.portal.tab = 'videos'; location.hash = '#/portal'; }
        else if (location.hash.startsWith('#/portal') || !location.hash) location.hash = '#/dashboard';
        render(); window.scrollTo(0, 0);
        toast(`Visualizando como ${PROFILES[id].label}`, 'demonstração · não é login'); break;
      case 'content': e.stopPropagation(); openContent(id); break;
      case 'task': openTask(id); break;
      case 'review':
        closeLayer();
        { const c = content(id); ui.approval.tab = c.stage === 'ajustes' ? 'ajustes' : c.stage === 'aguardando_aprovacao' ? 'aguardando' : 'aprovados'; ui.approval.selected = id; }
        if (location.hash !== '#/aprovacoes') location.hash = '#/aprovacoes'; else render();
        break;
      case 'new-content': newContentModal(); break;
      case 'new-task': newTaskModal(); break;
      case 'save-content': {
        const f = document.getElementById('f-content');
        if (!f.reportValidity()) return;
        const d = Object.fromEntries(new FormData(f));
        const pub = d.publish || offset(14);
        const c = { id: `C-${state.seq.c++}`, title: d.title.trim(), format: d.format, channel: d.channel, stage: 'pauta', owner: d.owner, due: iso(addDays(parse(pub), -7)), publish: pub, pillar: d.pillar, video: null, version: 1, script: '', comments: [], history: [{ date: iso(TODAY), text: `Pauta criada por ${person(me()).name}` }] };
        state.contents.push(c); save(); closeLayer(); render(); toast(`${c.id} criado em Pauta`); break;
      }
      case 'save-task': {
        const f = document.getElementById('f-task');
        if (!f.reportValidity()) return;
        const d = Object.fromEntries(new FormData(f));
        const t = { id: `T-${pad(state.seq.t++)}`, title: d.title.trim(), owner: d.owner, due: d.due || offset(2), priority: d.priority, status: 'A fazer', ceo: !!d.ceo, content: d.content || null, note: '' };
        state.tasks.push(t); save(); closeLayer(); render(); toast(`Tarefa ${t.id} criada`); break;
      }
      case 'clear-kanban': ui.kanban = { q: '', owner: '', format: '', channel: '', late: false }; render(); break;
      case 'ap-tab': ui.approval.tab = id; ui.approval.selected = null; render(); break;
      case 'ap-select': ui.approval.selected = id; render(); break;
      case 'approve':
        if (!isCEO()) return;
        decide(id, 'aprovado', (document.getElementById('ap-comment').value || '').trim() || 'Aprovado.');
        document.getElementById('ap-comment').value = '';
        render(); toast('Conteúdo aprovado e registrado no histórico'); break;
      case 'adjust': {
        if (!isCEO()) return;
        const box = document.getElementById('ap-comment');
        const txt = box.value.trim();
        if (!txt) { box.focus(); box.style.borderColor = 'var(--danger)'; toast('Escreva no comentário o que precisa mudar', ''); return; }
        box.value = '';
        decide(id, 'ajustes', withTime(txt)); render(); toast('Ajustes solicitados à equipe'); break;
      }
      case 'resubmit': moveStage(id, 'aguardando_aprovacao'); ui.approval.tab = 'aguardando'; ui.approval.selected = id; render(); toast('Reenviado para aprovação'); break;
      case 'schedule': moveStage(id, 'agendado'); render(); toast('Marcado como agendado'); break;
      case 'comment': {
        const box = document.getElementById('ap-comment');
        const txt = box.value.trim();
        if (!txt) { box.focus(); return; }
        box.value = '';
        addComment(id, withTime(txt)); render(); toast('Comentário adicionado');
        const th = document.getElementById('thread'); if (th) th.scrollTop = th.scrollHeight;
        break;
      }
      case 'cal-prev': case 'cal-next': {
        const d = new Date(ui.cal.year, ui.cal.month + (act === 'cal-next' ? 1 : -1), 1);
        ui.cal.month = d.getMonth(); ui.cal.year = d.getFullYear(); render(); break;
      }
      case 'cal-today': ui.cal.month = TODAY.getMonth(); ui.cal.year = TODAY.getFullYear(); render(); break;
      case 'cal-view': ui.cal.view = id; render(); break;
      case 'task-done': {
        const t = state.tasks.find((x) => x.id === id);
        t.status = el.checked ? 'Concluída' : 'A fazer'; save(); render();
        toast(el.checked ? 'Tarefa concluída' : 'Tarefa reaberta'); break;
      }
      case 'task-ceo': {
        const t = state.tasks.find((x) => x.id === id);
        t.ceo = !t.ceo; save(); render(); toast(t.ceo ? 'Marcada: depende da CEO' : 'Marcador da CEO removido'); break;
      }
      case 'portal-tab': ui.portal.tab = id; render(); break;
      case 'portal-cat': ui.portal.cat = id; render(); break;
      case 'watch': watchModal(id); break;
      case 'download': toast('Download indisponível no protótipo', 'precisa do armazenamento de arquivos'); break;
      default: break;
    }
  });

  function withTime(txt) {
    const cb = document.getElementById('ap-time');
    const v = document.getElementById('review-video');
    if (cb && cb.checked && v) { const s = Math.floor(v.currentTime); return `[${Math.floor(s / 60)}:${pad(s % 60)}] ${txt}`; }
    return txt;
  }

  document.addEventListener('input', (e) => {
    const f = e.target.dataset.filter;
    if (f && e.target.type !== 'checkbox' && e.target.tagName === 'INPUT') setFilter(f, e.target.value);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.filter) {
      if (t.type === 'checkbox') setFilter(t.dataset.filter, t.checked);
      else if (t.tagName === 'SELECT') setFilter(t.dataset.filter, t.value);
      return;
    }
    if (t.dataset.taskStatus) {
      const task = state.tasks.find((x) => x.id === t.dataset.taskStatus);
      task.status = t.value; save(); render(); toast(`Status: ${t.value}`); return;
    }
    if (t.dataset.contentField) {
      const c = content(t.dataset.id); const field = t.dataset.contentField;
      if (field === 'stage') {
        if (!moveStage(c.id, t.value)) { t.value = c.stage; return; }
        toast(`Movido para ${stageLabel(t.value)}`);
      } else if (t.value) {
        c[field] = t.value;
        c.history.push({ date: iso(TODAY), text: field === 'owner' ? `Responsável alterado para ${person(t.value).name}` : field === 'due' ? `Prazo alterado para ${fmt(t.value)}` : `Publicação alterada para ${fmt(t.value)}` });
        save(); toast('Alteração salva');
      }
      render(); openContent(c.id); return;
    }
    if (t.dataset.localVideo && t.files && t.files[0]) {
      const old = ui.localVideo[t.dataset.localVideo];
      if (old) URL.revokeObjectURL(old);
      ui.localVideo[t.dataset.localVideo] = URL.createObjectURL(t.files[0]);
      render(); toast('Pré-visualização local carregada', 'o arquivo não foi enviado');
    }
  });

  // Arrastar e soltar no Kanban
  let dragId = null;
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('[data-card]');
    if (!card) return;
    dragId = card.dataset.card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  document.addEventListener('dragend', () => {
    dragId = null;
    document.querySelectorAll('.dragging').forEach((n) => n.classList.remove('dragging'));
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
  });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('[data-drop]');
    if (!col || !dragId) return;
    e.preventDefault();
    document.querySelectorAll('.drop').forEach((n) => { if (n !== col) n.classList.remove('drop'); });
    col.classList.add('drop');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('[data-drop]');
    if (!col || !dragId) return;
    e.preventDefault();
    const id = dragId;
    if (moveStage(id, col.dataset.drop)) toast(`${id} → ${stageLabel(col.dataset.drop)}`);
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLayer();
    if (e.key === 'Enter' && e.target.matches('.kpi, .row')) e.target.click();
  });

  window.addEventListener('hashchange', () => { ui.navOpen = false; closeLayer(); render(); window.scrollTo(0, 0); });

  if (state.profile === 'cliente') location.hash = '#/portal';
  render();
})();
