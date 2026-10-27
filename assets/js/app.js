/*
  Vindex Hub — aplicação.
  Login com Google e dados compartilhados no Firebase (ver backend.js).
  O que cada perfil pode ver e alterar é garantido pelas regras do banco (firestore.rules);
  esconder botões aqui é só conforto visual.
*/
(function () {
  'use strict';

  const K = window.VINDEX_CONST;
  const DAY = 864e5;
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
  const READY_STAGES = ['aprovado', 'agendado', 'publicado'];
  const STATUSES = ['A fazer', 'Em andamento', 'Bloqueada', 'Concluída'];
  const PRIORITIES = ['Alta', 'Média', 'Baixa'];
  const COLORS = ['#1F56FF', '#6B4CE6', '#0E9F8A', '#C9721C', '#D43F8D', '#2F3C8F', '#0A0F1F', '#4D7C0F'];

  /* ---------------- Datas ---------------- */
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let TODAY = startOfDay(new Date());
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const offset = (n) => iso(addDays(TODAY, n));
  const diff = (s) => Math.round((parse(s) - TODAY) / DAY);
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const fmt = (s) => { if (!s) return '—'; const d = parse(s); return `${WD[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
  const rel = (s) => {
    const n = diff(s);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
  };
  const nowIso = () => new Date().toISOString();

  /* ---------------- Estado ---------------- */
  const S = {
    status: 'loading', // loading | config | offline | login | denied | app
    authUser: null, me: null,
    users: [], contents: [], tasks: [], library: [],
    loaded: {}, unsubs: [], error: ''
  };
  const ui = {
    kanban: { q: '', owner: '', format: '', channel: '', late: false },
    tasks: { q: '', owner: '', status: '', priority: '', ceo: false, late: false, hideDone: true },
    cal: { month: TODAY.getMonth(), year: TODAY.getFullYear(), owner: '', format: '', stage: '', view: 'mes' },
    approval: { tab: 'aguardando', selected: null },
    portal: { tab: 'videos', cat: '' },
    navOpen: false, confirmDelete: null
  };

  /* ---------------- Utilidades ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const role = () => (S.me ? S.me.papel : null);
  const myEmail = () => (S.authUser ? S.authUser.email.toLowerCase() : '');
  const isCEO = () => role() === 'ceo';
  const canManageAccess = () => ['admin', 'ceo'].includes(role());
  const canEditContent = () => ['admin', 'equipe'].includes(role());
  const roleLabel = (r) => (K.ROLES.find((x) => x.id === r) || {}).label || r;
  const stageLabel = (id) => (K.STAGES.find((s) => s.id === id) || {}).label || id;
  const content = (id) => S.contents.find((c) => c.id === id);
  const code = (c) => 'C-' + c.id.slice(0, 4).toUpperCase();
  const team = () => S.users.filter((u) => u.ativo && u.papel !== 'cliente').sort((a, b) => a.nome.localeCompare(b.nome));
  const ceoEmail = () => (S.users.find((u) => u.papel === 'ceo' && u.ativo) || {}).id || '';
  function colorFor(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; }
  function person(email) {
    const u = S.users.find((x) => x.id === email);
    const nome = u ? u.nome : (email ? email.split('@')[0] : 'Sem responsável');
    const parts = nome.trim().split(/\s+/);
    const initials = (u && u.papel === 'ceo') ? 'CEO' : ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    return { id: email, name: nome, initials, color: email ? colorFor(email) : '#9AA0AE', role: u ? roleLabel(u.papel) : '' };
  }
  const avatar = (id, cls = '') => { const p = person(id); return `<span class="avatar ${cls}" style="background:${p.color}" title="${esc(p.name)}">${esc(p.initials)}</span>`; };
  const who = (id, sub) => { const p = person(id); return `<span class="who">${avatar(id)}<span style="min-width:0"><div class="n">${esc(p.name)}</div>${sub ? `<div class="r">${esc(sub)}</div>` : ''}</span></span>`; };
  const stageBadge = (id) => `<span class="badge st st-${id}"><span class="dot"></span>${esc(stageLabel(id))}</span>`;
  const nextOwner = (c) => (c.stage === 'aguardando_aprovacao' ? (ceoEmail() || c.owner) : c.owner);
  const contentLate = (c) => c.due && !['publicado', 'agendado', 'aprovado'].includes(c.stage) && diff(c.due) < 0;
  const taskLate = (t) => t.due && t.status !== 'Concluída' && diff(t.due) < 0;
  const dueTag = (s, done) => {
    if (!s) return '<span class="muted">sem prazo</span>';
    if (done) return `<span class="mono muted">${fmt(s)}</span>`;
    const n = diff(s);
    if (n < 0) return `<span class="badge late">Atrasado ${-n}d</span>`;
    if (n === 0) return `<span class="badge today">Hoje</span>`;
    return `<span class="mono" style="font-size:12px">${fmt(s)}</span>`;
  };
  const prioClass = (p) => ({ Alta: 'p-alta', 'Média': 'p-media', Baixa: 'p-baixa' }[p]);
  const options = (list, sel, all) => (all ? `<option value="">${all}</option>` : '') +
    list.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
  const peopleOpts = (sel, all) => options(team().map((p) => ({ value: p.id, label: p.nome + (p.papel === 'ceo' ? ' (CEO)' : '') })), sel, all);
  const safeUrl = (u) => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } };

  // Converte links do YouTube / Google Drive em players que tocam dentro do Hub.
  function media(u) {
    const url = safeUrl(u);
    if (!url) return null;
    const x = new URL(url);
    const host = x.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be' || host === 'youtube.com') {
      const id = host === 'youtu.be' ? x.pathname.slice(1) : (x.searchParams.get('v') || x.pathname.split('/').filter(Boolean).pop());
      if (id) return { type: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` };
    }
    if (host === 'drive.google.com') {
      const m = x.pathname.match(/\/d\/([^/]+)/);
      const id = m ? m[1] : x.searchParams.get('id');
      if (id) return { type: 'iframe', src: `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` };
    }
    if (/\.(mp4|webm|mov|m4v)$/i.test(x.pathname)) return { type: 'video', src: url };
    return { type: 'link', src: url };
  }

  const I = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 6 2 2 4-4M3 14l2 2 4-4M13 6h8M13 14h8M13 20h8"/></svg>',
    clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="m10 8.5 4.5 2.5L10 13.5z"/><path d="M8 21h8"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    google: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>'
  };

  let toastTimer;
  function toast(msg, sub = '') {
    const el = document.getElementById('toast');
    el.innerHTML = `<span>${esc(msg)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }
  function fail(err) {
    console.error(err);
    const denied = err && /permission/i.test(String(err.code || err.message));
    toast(denied ? 'Sem permissão para essa ação' : 'Não foi possível salvar', denied ? 'regra de acesso' : 'verifique a internet');
  }

  /* ---------------- Escrita no banco ---------------- */
  const H = (text) => ({ at: nowIso(), by: myEmail(), text });

  async function moveStage(id, stage) {
    const c = content(id);
    if (!c || c.stage === stage) return false;
    if (stage === 'aprovado' && !isCEO()) { toast('Só a CEO pode aprovar. Use a Central de aprovação.', 'regra de permissão'); return false; }
    const patch = { stage };
    if (stage === 'aguardando_aprovacao' && c.stage === 'ajustes') patch.version = (c.version || 1) + 1;
    try { await VH.push('conteudos', id, 'history', H(`Movido para ${stageLabel(stage)}`), patch); return true; } catch (e) { fail(e); return false; }
  }

  async function decide(id, decision, text) {
    const c = content(id);
    const comment = { at: nowIso(), by: myEmail(), text: text || 'Aprovado.', decision };
    const hist = H(decision === 'aprovado' ? `Versão ${c.version || 1} aprovada pela CEO` : `CEO pediu ajustes na versão ${c.version || 1}`);
    try {
      await VH.update('conteudos', id, {
        stage: decision === 'aprovado' ? 'aprovado' : 'ajustes',
        comments: (c.comments || []).concat([comment]),
        history: (c.history || []).concat([hist])
      });
      await Promise.all(S.tasks.filter((t) => t.content === id && t.ceo && t.status !== 'Concluída')
        .map((t) => VH.update('tarefas', t.id, { status: 'Concluída' })));
      return true;
    } catch (e) { fail(e); return false; }
  }

  const addComment = (id, text) => VH.push('conteudos', id, 'comments', { at: nowIso(), by: myEmail(), text, decision: null }).catch(fail);

  /* ---------------- Contadores ---------------- */
  function counts() {
    const approvals = S.contents.filter((c) => c.stage === 'aguardando_aprovacao').length;
    const lateTasks = S.tasks.filter(taskLate).length;
    const ceoTasks = S.tasks.filter((t) => t.ceo && t.status !== 'Concluída').length;
    return { approvals, lateTasks, ceoTasks };
  }

  /* ---------------- Estrutura ---------------- */
  const ROUTES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dash', render: pageDashboard },
    { id: 'producao', label: 'Produção', icon: 'board', render: pageKanban },
    { id: 'aprovacoes', label: 'Central de aprovação', icon: 'check', render: pageApproval },
    { id: 'calendario', label: 'Calendário editorial', icon: 'cal', render: pageCalendar },
    { id: 'tarefas', label: 'Tarefas', icon: 'tasks', render: pageTasks },
    { id: 'clientes', label: 'Área de clientes', icon: 'clients', render: pageClients },
    { id: 'acessos', label: 'Acessos', icon: 'users', render: pageAccess, only: canManageAccess }
  ];
  function currentRoute() {
    const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    const r = ROUTES.find((x) => x.id === h && (!x.only || x.only()));
    return r || ROUTES[0];
  }

  function shell(route) {
    const n = counts();
    const badge = { aprovacoes: n.approvals ? `<span class="count">${n.approvals}</span>` : '', tarefas: n.lateTasks ? `<span class="count alert" title="tarefas atrasadas">${n.lateTasks}</span>` : '' };
    const link = (r) => `<a href="#/${r.id}" class="${r.id === route.id ? 'active' : ''}">${I[r.icon]}<span>${r.label}</span>${badge[r.id] || ''}</a>`;
    const meP = person(myEmail());
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
          ${canManageAccess() ? `<div class="nav-label">Administração</div>${link(ROUTES[6])}` : ''}
        </nav>
        <div class="bars"><span></span><span></span><span></span></div>
        <div class="side-foot">@vindex.ecomm</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost menu-btn" data-act="nav" aria-label="Abrir menu">${I.menu}</button>
          <span class="live-pill"><i></i>Dados sincronizados</span>
          <span class="spacer"></span>
          ${userChip(meP)}
        </header>
        <main class="page" id="page">${route.render()}</main>
      </div>
    </div>`;
  }

  function userChip(meP) {
    return `<div class="userchip">${avatar(myEmail())}<div class="uc-txt"><b>${esc(meP.name)}</b><span>${esc(roleLabel(role()))}</span></div>
      <button class="btn sm" data-act="logout">Sair</button></div>`;
  }

  function head(eyebrow, title, desc, actions = '') {
    return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  }
  const newContentBtn = () => (canEditContent() ? `<button class="btn primary" data-act="new-content">${I.plus}Novo conteúdo</button>` : '');

  /* ---------------- 1. Dashboard ---------------- */
  function attentionItems() {
    const items = [];
    S.contents.forEach((c) => {
      if (c.stage === 'aguardando_aprovacao') items.push({ who: nextOwner(c), ceo: true, title: c.title, step: 'Aprovar ou pedir ajustes', date: c.due, tag: stageBadge(c.stage), act: 'review', id: c.id });
      else if (c.stage === 'ajustes') items.push({ who: c.owner, title: c.title, step: 'Aplicar ajustes pedidos pela CEO', date: c.due, tag: stageBadge(c.stage), act: 'content', id: c.id });
      else if (contentLate(c)) items.push({ who: c.owner, title: c.title, step: NEXT_STEP[c.stage], date: c.due, tag: stageBadge(c.stage), act: 'content', id: c.id });
    });
    S.tasks.filter(taskLate).forEach((t) => items.push({ who: t.owner, title: t.title, step: t.status === 'Bloqueada' ? `Bloqueada${t.note ? ': ' + t.note : ''}` : 'Tarefa atrasada', date: t.due, tag: '<span class="badge">Tarefa</span>', act: 'task', id: t.id, ceo: t.ceo }));
    items.sort((a, b) => {
      if (isCEO()) { const ca = a.ceo ? 0 : 1; const cb = b.ceo ? 0 : 1; if (ca !== cb) return ca - cb; }
      return String(a.date || '9').localeCompare(String(b.date || '9'));
    });
    return items;
  }

  function pageDashboard() {
    const n = counts();
    const mon = addDays(TODAY, -((TODAY.getDay() + 6) % 7));
    const sun = addDays(mon, 6);
    const inWeek = (s) => s && parse(s) >= mon && parse(s) <= sun;
    const week = S.contents.filter((c) => inWeek(c.publish));
    const weekReady = week.filter((c) => READY_STAGES.includes(c.stage)).length;
    const pending = S.contents.filter((c) => !['publicado', 'agendado'].includes(c.stage)).length;
    const att = attentionItems();
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const meP = person(myEmail());
    const mine = att.filter((a) => a.who === myEmail());
    const first = mine[0] || att[0];
    const todayTasks = S.tasks.filter((t) => t.status !== 'Concluída' && t.due && diff(t.due) === 0).length;
    const empty = !S.contents.length && !S.tasks.length;
    const summary = empty
      ? 'O Hub está pronto e vazio. Comece cadastrando os conteúdos da semana em <b>Produção</b>.'
      : isCEO()
        ? `Você tem <b>${n.approvals} ${n.approvals === 1 ? 'aprovação' : 'aprovações'}</b> e <b>${n.ceoTasks} ${n.ceoTasks === 1 ? 'tarefa' : 'tarefas'}</b> esperando sua decisão.`
        : `A equipe tem <b>${todayTasks} ${todayTasks === 1 ? 'tarefa' : 'tarefas'} para hoje</b>, <b>${n.lateTasks} ${n.lateTasks === 1 ? 'atrasada' : 'atrasadas'}</b> e <b>${n.approvals} ${n.approvals === 1 ? 'conteúdo' : 'conteúdos'}</b> esperando a CEO.`;

    const upcoming = []
      .concat(S.contents.filter((c) => c.stage !== 'publicado').map((c) => ({ date: c.stage === 'agendado' ? c.publish : c.due, title: c.title, kind: c.stage === 'agendado' ? 'Publicação' : NEXT_STEP[c.stage], who: nextOwner(c), act: 'content', id: c.id })))
      .concat(S.tasks.filter((t) => t.status !== 'Concluída').map((t) => ({ date: t.due, title: t.title, kind: 'Tarefa', who: t.owner, act: 'task', id: t.id })))
      .filter((u) => u.date && diff(u.date) >= 0 && diff(u.date) <= 7)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);

    const total = S.contents.length;
    const stageCounts = K.STAGES.map((s) => ({ ...s, n: S.contents.filter((c) => c.stage === s.id).length }));
    const load = team().map((p) => {
      const cs = S.contents.filter((c) => nextOwner(c) === p.id && c.stage !== 'publicado').length;
      const ts = S.tasks.filter((t) => t.owner === p.id && t.status !== 'Concluída');
      const late = ts.filter(taskLate).length;
      return { p, cs, ts: ts.length - late, late, total: cs + ts.length };
    });
    const maxLoad = Math.max(...load.map((t) => t.total), 1);
    const kpi = (icon, k, v, h, go, extra = '', cls = '') => `<div class="card kpi ${cls}" data-act="go" data-id="${go}" role="link" tabindex="0"><div class="k">${I[icon]}${k}</div><div class="v">${v}</div><div class="h">${h}</div>${extra}</div>`;

    return `
    <section class="greet">
      <div class="slash"><span></span><span></span><span></span></div>
      <div>
        <div class="date">${WD[TODAY.getDay()]} · ${TODAY.getDate()} de ${MONTHS[TODAY.getMonth()]}</div>
        <h1>${hello}, ${esc(meP.name.split(' ')[0])}.</h1>
        <p>${summary}</p>
      </div>
      ${first ? `<div class="next"><div class="k">Próximo passo</div><div class="v">${esc(first.title)}</div><div style="font-size:12px;color:#B9C1DA;margin:-6px 0 10px">${esc(first.step)}</div>
        <div style="display:flex;align-items:center;gap:10px;justify-content:space-between">${who(first.who)}<button class="btn primary sm" data-act="${first.act}" data-id="${first.id}">Abrir ${I.arrow}</button></div></div>`
        : (canEditContent() ? `<div class="next"><div class="k">Para começar</div><div class="v">Cadastre o primeiro conteúdo</div><button class="btn primary sm" data-act="new-content">${I.plus}Novo conteúdo</button></div>` : '')}
    </section>

    <section class="kpis">
      ${kpi('cal', 'Produção da semana', `${weekReady}<small>/${week.length}</small>`, 'prontos (aprovados, agendados ou publicados)', 'calendario', `<div class="bar"><i style="width:${week.length ? (weekReady / week.length) * 100 : 0}%"></i></div>`)}
      ${kpi('board', 'Conteúdos pendentes', pending, 'em produção, ainda não agendados', 'producao')}
      ${kpi('alert', 'Tarefas atrasadas', n.lateTasks, n.lateTasks ? 'precisam de atenção' : 'nada atrasado', 'tarefas?late', '', n.lateTasks ? 'alert' : '')}
      ${kpi('check', 'Aprovações necessárias', n.approvals, 'esperando a CEO', 'aprovacoes')}
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h2>Precisa de atenção</h2><span class="sub">${att.length} ${att.length === 1 ? 'item' : 'itens'}</span></div>
        <div class="list">
          ${att.slice(0, 7).map((a) => `
            <div class="row" data-act="${a.act}" data-id="${a.id}" tabindex="0">
              ${avatar(a.who, 'lg')}
              <div class="grow"><div class="t">${esc(a.title)}</div><div class="s">${a.tag}<span>${esc(a.step)}</span>${a.ceo ? '<span class="badge ceo">Depende da CEO</span>' : ''}</div></div>
              <div class="when">${dueTag(a.date)}</div>
            </div>`).join('') || '<div class="empty" style="margin:0 18px 18px">Nada pendente.</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Próximos prazos</h2><span class="sub">próximos 7 dias</span><a class="right" href="#/calendario" style="font-size:12.5px;font-weight:600">Calendário →</a></div>
        <div class="list">
          ${upcoming.map((u) => `
            <div class="row" data-act="${u.act}" data-id="${u.id}" tabindex="0">
              <div style="width:52px;text-align:center"><div class="mono" style="font-size:18px;font-weight:600;line-height:1">${pad(parse(u.date).getDate())}</div><div class="mono muted" style="font-size:10.5px;text-transform:uppercase">${WD[parse(u.date).getDay()]}</div></div>
              <div class="grow"><div class="t">${esc(u.title)}</div><div class="s"><span>${esc(u.kind)}</span>·<span>${esc(person(u.who).name)}</span></div></div>
              <div class="when muted">${rel(u.date)}</div>
            </div>`).join('') || '<div class="empty" style="margin:0 18px 18px">Sem prazos nos próximos dias.</div>'}
        </div>
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h2>Funil de produção</h2><span class="sub">${total} ${total === 1 ? 'conteúdo' : 'conteúdos'} por etapa</span><a class="right" href="#/producao" style="font-size:12.5px;font-weight:600">Abrir Kanban →</a></div>
        <div class="card-b">
          <div class="pipeline">${stageCounts.filter((s) => s.n).map((s) => `<i class="st st-${s.id}" style="width:${(s.n / total) * 100}%" title="${esc(s.label)}: ${s.n}"></i>`).join('')}</div>
          <div class="legend">${stageCounts.map((s) => `<div class="st st-${s.id}" data-act="go" data-id="producao"><span class="sw"></span>${esc(s.label)}<b>${s.n}</b></div>`).join('')}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Carga da equipe</h2><span class="sub">conteúdos e tarefas abertas</span></div>
        <div class="card-b load">
          ${load.map((t) => `<div class="l">${who(t.p.id, roleLabel(t.p.papel))}
            <div class="track" title="${t.cs} conteúdos · ${t.ts} tarefas no prazo · ${t.late} atrasadas">
              <i style="width:${(t.cs / maxLoad) * 100}%;background:var(--blue)"></i>
              <i style="width:${(t.ts / maxLoad) * 100}%;background:#9DB4FF"></i>
              <i style="width:${(t.late / maxLoad) * 100}%;background:var(--danger)"></i>
            </div><span class="num">${t.total}</span></div>`).join('') || '<div class="empty">Ninguém da equipe cadastrado ainda.</div>'}
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
    return S.contents.filter((c) =>
      (!q || (c.title + ' ' + code(c) + ' ' + (c.pillar || '')).toLowerCase().includes(q)) &&
      (!f.owner || nextOwner(c) === f.owner || c.owner === f.owner) &&
      (!f.format || c.format === f.format) &&
      (!f.channel || c.channel === f.channel) &&
      (!f.late || contentLate(c)));
  }

  function kcard(c) {
    const done = ['publicado', 'agendado'].includes(c.stage);
    const n = c.due ? diff(c.due) : null;
    const dueCls = done || n === null ? '' : n < 0 ? 'late' : n === 0 ? 'today' : '';
    const dueTxt = done ? `pub. ${fmt(c.publish)}` : n === null ? 'sem prazo' : n < 0 ? `atrasado ${-n}d` : n === 0 ? 'prazo hoje' : `prazo ${fmt(c.due)}`;
    const nc = (c.comments || []).length;
    return `<article class="kcard" draggable="${canEditContent() || isCEO()}" data-card="${c.id}" data-act="content" data-id="${c.id}" tabindex="0">
      <div class="id">${code(c)}<span>·</span>${esc(c.channel)}${nc ? `<span style="margin-left:auto">💬 ${nc}</span>` : ''}</div>
      <div class="ttl">${esc(c.title)}</div>
      <div class="meta"><span class="badge fmt">${esc(c.format)}</span>${c.video ? `<span class="vid">${I.play.replace('<svg', '<svg width="10" height="10"')} vídeo</span>` : ''}${c.stage === 'aguardando_aprovacao' ? '<span class="badge ceo">CEO</span>' : ''}</div>
      <div class="foot"><span class="due ${dueCls}">${I.clock.replace('<svg', '<svg width="12" height="12"')}${dueTxt}</span>${avatar(nextOwner(c))}</div>
    </article>`;
  }

  function pageKanban() {
    const f = ui.kanban;
    const list = kanbanFiltered();
    return head('Produção de conteúdo', 'Kanban de produção', 'Arraste os cards entre as etapas ou clique para editar. O avatar mostra quem tem o próximo passo.', newContentBtn()) + `
    <div class="filters">
      <input class="input search" id="k-q" placeholder="Buscar título, código ou tema" value="${esc(f.q)}" data-filter="kanban.q">
      <select class="input" data-filter="kanban.owner">${peopleOpts(f.owner, 'Todos os responsáveis')}</select>
      <select class="input" data-filter="kanban.format">${options(K.FORMATS, f.format, 'Todos os formatos')}</select>
      <select class="input" data-filter="kanban.channel">${options(K.CHANNELS, f.channel, 'Todos os canais')}</select>
      <label class="chip-toggle ${f.late ? 'on' : ''}"><input type="checkbox" data-filter="kanban.late" ${f.late ? 'checked' : ''}>Só atrasados</label>
      ${f.q || f.owner || f.format || f.channel || f.late ? '<button class="btn ghost sm" data-act="clear-kanban">Limpar filtros</button>' : ''}
      <span class="result">${list.length} de ${S.contents.length}</span>
    </div>
    ${!S.contents.length ? `<div class="empty" style="margin-bottom:14px">Nenhum conteúdo ainda. ${canEditContent() ? 'Clique em <b>Novo conteúdo</b> para cadastrar o primeiro post.' : ''}</div>` : ''}
    <div class="kanban" id="kanban">
      ${K.STAGES.map((s) => { const cards = list.filter((c) => c.stage === s.id); return `
        <section class="col st st-${s.id}">
          <div class="col-h"><span class="dot"></span><b>${esc(s.label)}</b><span class="n">${cards.length}</span></div>
          <div class="col-b" data-drop="${s.id}">${cards.map(kcard).join('')}</div>
        </section>`; }).join('')}
    </div>`;
  }

  /* ---------------- 3. Central de aprovação ---------------- */
  function approvalLists() {
    const approved = (c) => (c.comments || []).some((m) => m.decision === 'aprovado');
    return {
      aguardando: S.contents.filter((c) => c.stage === 'aguardando_aprovacao').sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9'))),
      ajustes: S.contents.filter((c) => c.stage === 'ajustes'),
      aprovados: S.contents.filter((c) => approved(c) && READY_STAGES.includes(c.stage))
    };
  }

  function playerHTML(c) {
    const m = media(c.video);
    if (!m) {
      return `<div class="player"><div class="none">${I.film}<b>Sem vídeo nesta versão</b>
        <p>Cole o link do vídeo (Google Drive ou YouTube "não listado") no card do conteúdo, campo <b>Link do vídeo</b>.</p>
        ${canEditContent() ? `<button class="btn sm" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2)" data-act="content" data-id="${c.id}">Abrir o card</button>` : ''}</div></div>`;
    }
    if (m.type === 'iframe') return `<div class="player"><iframe src="${esc(m.src)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="Vídeo"></iframe></div>
      <div class="local-note neutral">Se o vídeo não abrir, confira se o arquivo no Drive está compartilhado com "Qualquer pessoa com o link". <a href="${esc(c.video)}" target="_blank" rel="noopener">Abrir em nova aba</a></div>`;
    if (m.type === 'video') return `<div class="player"><video id="review-video" src="${esc(m.src)}" controls preload="metadata" playsinline></video></div>`;
    return `<div class="player"><div class="none">${I.link}<b>Link do vídeo</b><p>Este endereço não toca dentro do Hub.</p><a class="btn sm" href="${esc(m.src)}" target="_blank" rel="noopener">Abrir em nova aba</a></div></div>`;
  }

  function thread(c, id = 'thread') {
    const list = (c.comments || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return `<div class="thread" id="${id}">${list.map((m) => `
      <div class="msg ${m.decision || ''}">${avatar(m.by)}<div class="bubble"><div class="h"><b>${esc(person(m.by).name)}</b><span>${rel(m.at)}</span>${m.decision === 'aprovado' ? '<span class="badge st st-aprovado">Aprovou</span>' : m.decision === 'ajustes' ? '<span class="badge st st-ajustes">Pediu ajustes</span>' : ''}</div>${esc(m.text)}</div></div>`).join('') || '<div class="muted" style="font-size:12.5px">Nenhum comentário ainda.</div>'}</div>`;
  }

  /* ---------------- Imagens (slides do carrossel, posts) ----------------
     Cada imagem fica comprimida num documento da coleção "midias" (plano gratuito do Firebase,
     sem Storage). Só carregam quando alguém abre o conteúdo. */
  const MEDIA = {};
  function loadMedia(id, force) {
    if (!force && MEDIA[id]) return;
    MEDIA[id] = MEDIA[id] && MEDIA[id] !== 'loading' ? MEDIA[id] : 'loading';
    VH.list('midias', ['conteudo', id])
      .then((rows) => { MEDIA[id] = rows.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); paintGallery(id); })
      .catch((e) => { console.error(e); MEDIA[id] = []; paintGallery(id); });
  }
  function galleryInner(id) {
    const list = MEDIA[id];
    if (!list || list === 'loading') return '<div class="muted" style="font-size:12.5px">Carregando imagens…</div>';
    const ed = canEditContent();
    if (!list.length) return `<div class="muted" style="font-size:12.5px">Nenhuma imagem.${ed ? ' Use o botão Adicionar imagens.' : ''}</div>`;
    return `<div class="slides">${list.map((m, i) => `<figure>
      <img src="${esc(m.data)}" alt="${esc(m.nome || 'Imagem ' + (i + 1))}" loading="lazy" data-act="img-full" data-id="${m.id}" data-content="${id}">
      <figcaption><span class="mono">${i + 1}/${list.length}${i === 0 ? ' · clique para ampliar' : ''}</span>${ed ? `<button class="btn ghost sm danger-txt" data-act="del-img" data-id="${m.id}" data-content="${id}">${ui.confirmDelete === m.id ? 'Confirmar' : 'Remover'}</button>` : ''}</figcaption>
    </figure>`).join('')}</div>`;
  }
  function galleryHTML(c) {
    loadMedia(c.id);
    return `<div class="gallery" data-gallery="${c.id}">${galleryInner(c.id)}</div>
      ${canEditContent() ? `<label class="btn sm" style="margin-top:10px">${I.plus}Adicionar imagens<input type="file" accept="image/*" multiple hidden data-upload="${c.id}"></label>
      <span class="muted" style="font-size:12px;margin-left:8px">Na ordem do nome do arquivo (ex.: slide_1, slide_2…)</span>` : ''}`;
  }
  function paintGallery(id) {
    document.querySelectorAll(`[data-gallery="${id}"]`).forEach((g) => { g.innerHTML = galleryInner(id); });
  }
  // Reduz a imagem para caber num documento do banco (limite de 1 MB).
  function compress(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(1, 1440 / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        for (const [q, f] of [[0.88, 1], [0.8, 1], [0.72, 0.85], [0.65, 0.7]]) {
          const cv = document.createElement('canvas');
          cv.width = Math.round(w * f); cv.height = Math.round(h * f);
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          const data = cv.toDataURL('image/jpeg', q);
          if (data.length < 900000) return resolve({ data, w: cv.width, h: cv.height });
        }
        reject(new Error('Imagem grande demais'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Arquivo não é uma imagem')); };
      img.src = url;
    });
  }
  async function uploadImages(id, files) {
    const c = content(id);
    if (!c || !files.length) return;
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const current = Array.isArray(MEDIA[id]) ? MEDIA[id] : [];
    let ordem = current.reduce((m, x) => Math.max(m, x.ordem || 0), 0);
    let ok = 0;
    for (const f of sorted) {
      toast(`Enviando ${f.name}…`);
      try {
        const r = await compress(f);
        await VH.add('midias', { conteudo: id, ordem: ++ordem, nome: f.name, data: r.data, w: r.w, h: r.h, criadoEm: nowIso(), criadoPor: myEmail() });
        ok++;
      } catch (err) { toast(`Não foi possível enviar ${f.name}`, err.message); }
    }
    if (ok) {
      try { await VH.push('conteudos', id, 'history', H(`${ok} imagem(ns) adicionada(s)`), { imagens: current.length + ok }); } catch (err) { fail(err); }
      toast(`${ok} imagem(ns) enviada(s)`);
    }
    loadMedia(id, true);
  }
  function fullImage(contentId, mediaId) {
    const list = Array.isArray(MEDIA[contentId]) ? MEDIA[contentId] : [];
    const i = list.findIndex((m) => m.id === mediaId);
    if (i < 0) return;
    const prevLayer = document.getElementById('lightbox');
    if (prevLayer) prevLayer.remove();
    const box = document.createElement('div');
    box.id = 'lightbox'; box.className = 'lightbox';
    box.innerHTML = `<img src="${esc(list[i].data)}" alt="">
      <div class="lb-bar"><span class="mono">${i + 1}/${list.length}</span>
      ${i > 0 ? `<button class="btn sm" data-lb="${list[i - 1].id}">← Anterior</button>` : ''}
      ${i < list.length - 1 ? `<button class="btn sm" data-lb="${list[i + 1].id}">Próxima →</button>` : ''}
      <button class="btn sm" data-lb="close">Fechar</button></div>`;
    box.addEventListener('click', (e) => {
      const t = e.target.closest('[data-lb]');
      if (t) { e.stopPropagation(); if (t.dataset.lb === 'close') box.remove(); else fullImage(contentId, t.dataset.lb); return; }
      if (e.target === box) box.remove();
    });
    document.body.appendChild(box);
  }

  function pageApproval() {
    const lists = approvalLists();
    const tab = ui.approval.tab;
    const list = lists[tab];
    if (!list.find((c) => c.id === ui.approval.selected)) ui.approval.selected = list[0] ? list[0].id : null;
    const c = content(ui.approval.selected);
    const tabs = [['aguardando', 'Aguardando'], ['ajustes', 'Em ajustes'], ['aprovados', 'Aprovados']];
    const canDecide = c && c.stage === 'aguardando_aprovacao';

    return head('Central de aprovação', 'Aprovar conteúdos', 'Veja o roteiro e o vídeo, comente e decida. Cada decisão fica registrada no histórico, com nome e data.') + `
    <div class="approval">
      <aside class="card queue">
        <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="ap-tab" data-id="${k}">${l}<span class="n">${lists[k].length}</span></button>`).join('')}</div>
        <div style="margin-top:10px">
          ${list.map((x) => `<div class="qitem ${x.id === ui.approval.selected ? 'on' : ''}" data-act="ap-select" data-id="${x.id}" tabindex="0">
            <div class="mono muted" style="font-size:11px">${code(x)} · v${x.version || 1}</div>
            <div class="t">${esc(x.title)}</div>
            <div class="m"><span class="badge fmt">${esc(x.format)}</span>${x.video ? '<span class="badge">▶ vídeo</span>' : ''}${x.imagens ? `<span class="badge">${x.imagens} imagem(ns)</span>` : ''}${!x.video && !x.imagens ? '<span class="badge">sem mídia</span>' : ''}${dueTag(x.due, tab === 'aprovados')}</div>
          </div>`).join('') || '<div class="empty" style="margin:0 12px 12px">Nenhum conteúdo nesta lista.</div>'}
        </div>
      </aside>
      ${c ? `<section class="card">
        <div class="review-h">
          <div class="id">${code(c)} · versão ${c.version || 1} · ${esc(c.channel)}</div>
          <h2>${esc(c.title)}</h2>
          <div class="m">${stageBadge(c.stage)}<span class="badge fmt">${esc(c.format)}</span>${c.pillar ? `<span class="badge">Pilar: ${esc(c.pillar)}</span>` : ''}${who(c.owner, 'responsável')}<span class="muted" style="font-size:12.5px">Publicação prevista: <b class="mono">${fmt(c.publish)}</b></span></div>
        </div>
        <div class="review-body">
          <div class="review-main">
            ${c.imagens || !c.video ? `<p class="section-t">Imagens</p>${galleryHTML(c)}` : ''}
            ${c.video || !c.imagens ? `<p class="section-t"${c.imagens || !c.video ? ' style="margin-top:20px"' : ''}>Vídeo</p>${playerHTML(c)}` : ''}
            <p class="section-t" style="margin-top:20px">Roteiro · versão ${c.version || 1}</p>
            <div class="script">${esc(c.script) || '<span class="muted">Roteiro ainda não escrito.</span>'}</div>
            ${c.caption ? `<p class="section-t" style="margin-top:20px">Legenda</p><div class="script">${esc(c.caption)}</div>` : ''}
          </div>
          <div class="review-side">
            <div class="decision">
              <h4>Decisão</h4>
              ${canDecide ? `<p>Para pedir ajustes, escreva o que mudar no campo de comentário abaixo.</p>
                <div class="btns">
                  <button class="btn approve" data-act="approve" data-id="${c.id}" ${isCEO() ? '' : 'disabled'}>${I.check}Aprovar</button>
                  <button class="btn adjust" data-act="adjust" data-id="${c.id}" ${isCEO() ? '' : 'disabled'}>Pedir ajustes</button>
                </div>
                ${isCEO() ? '' : `<div class="lock">${I.lock.replace('<svg', '<svg width="13" height="13" style="vertical-align:-2px"')} Só a CEO aprova ou pede ajustes.</div>`}`
              : c.stage === 'ajustes' ? `<p>A CEO pediu ajustes. Quando a nova versão estiver pronta, reenvie.</p>${canEditContent() ? `<button class="btn primary" style="width:100%" data-act="resubmit" data-id="${c.id}">Reenviar para aprovação (v${(c.version || 1) + 1})</button>` : ''}`
              : `<p>Este conteúdo já foi aprovado.</p>${c.stage === 'aprovado' && canEditContent() ? `<button class="btn dark" style="width:100%" data-act="schedule" data-id="${c.id}">Marcar como agendado</button>` : stageBadge(c.stage)}`}
            </div>
            <div>
              <p class="section-t">Comentários (${(c.comments || []).length})</p>
              ${thread(c)}
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                <textarea class="input" id="ap-comment" placeholder="${canDecide && isCEO() ? 'Ex.: aos 0:12, trocar a legenda…' : 'Escreva um comentário…'}"></textarea>
                <button class="btn" data-act="comment" data-id="${c.id}">Comentar</button>
              </div>
            </div>
          </div>
        </div>
      </section>` : `<section class="empty" style="padding:60px">Nada para revisar nesta lista. Quando a equipe mover um conteúdo para <b>Aguardando aprovação</b>, ele aparece aqui.</section>`}
    </div>`;
  }

  /* ---------------- 4. Calendário editorial ---------------- */
  function calFiltered() {
    const f = ui.cal;
    return S.contents.filter((c) => c.publish && (!f.owner || c.owner === f.owner) && (!f.format || c.format === f.format) && (!f.stage || c.stage === f.stage));
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
      ${monthList.map((c) => `<tr data-act="content" data-id="${c.id}" style="cursor:pointer"><td class="mono" style="white-space:nowrap">${fmt(c.publish)}</td><td><div class="tt">${esc(c.title)}</div><div class="tsub">${code(c)} · ${esc(c.channel)}</div></td><td><span class="badge fmt">${esc(c.format)}</span></td><td>${stageBadge(c.stage)}</td><td>${who(c.owner)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nada previsto para este mês com os filtros atuais.</div></td></tr>'}
    </tbody></table></div>`;

    return head('Calendário editorial', 'Calendário de publicações', 'Cada conteúdo aparece na data prevista de publicação, com formato, status (cor) e responsável (avatar).', newContentBtn()) + `
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
      <select class="input" data-filter="cal.format">${options(K.FORMATS, f.format, 'Todos os formatos')}</select>
      <select class="input" data-filter="cal.stage">${options(K.STAGES.map((s) => ({ value: s.id, label: s.label })), f.stage, 'Todos os status')}</select>
      <span class="result">${monthList.length} no mês</span>
    </div>
    ${f.view === 'mes' ? grid : listView}
    <div class="cal-legend">${K.STAGES.map((s) => `<span class="st st-${s.id}"><i></i>${esc(s.label)}</span>`).join('')}</div>`;
  }

  /* ---------------- 5. Tarefas ---------------- */
  function tasksFiltered() {
    const f = ui.tasks; const q = f.q.trim().toLowerCase();
    return S.tasks.filter((t) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (!f.owner || t.owner === f.owner) &&
      (!f.status || t.status === f.status) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.ceo || t.ceo) &&
      (!f.late || taskLate(t)) &&
      (!f.hideDone || t.status !== 'Concluída' || f.status === 'Concluída'))
      .sort((a, b) => (a.status === 'Concluída') - (b.status === 'Concluída') || String(a.due || '9').localeCompare(String(b.due || '9')) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
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
      <span class="result">${list.length} ${list.length === 1 ? 'tarefa' : 'tarefas'}</span>
    </div>
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th style="width:40px"></th><th>Tarefa</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Status</th><th>CEO</th><th></th></tr></thead>
        <tbody>
        ${list.map((t) => { const c = t.content ? content(t.content) : null; const done = t.status === 'Concluída'; return `
          <tr class="${done ? 'done' : ''}">
            <td><input type="checkbox" class="check" data-act="task-done" data-id="${t.id}" ${done ? 'checked' : ''} aria-label="Concluir tarefa"></td>
            <td><div class="tt">${esc(t.title)}</div><div class="tsub">${c ? `<a data-act="content" data-id="${c.id}">${code(c)} ${esc(c.title.slice(0, 42))}${c.title.length > 42 ? '…' : ''}</a>` : ''}${t.note ? `${c ? ' · ' : ''}<span style="color:var(--danger)">${esc(t.note)}</span>` : ''}</div></td>
            <td>${who(t.owner)}</td>
            <td style="white-space:nowrap">${dueTag(t.due, done)}${!done && t.due && diff(t.due) > 0 ? `<div class="muted" style="font-size:11px">${rel(t.due)}</div>` : ''}</td>
            <td><span class="badge ${prioClass(t.priority)}">${t.priority}</span></td>
            <td><select class="mini" data-task-status="${t.id}">${options(STATUSES, t.status)}</select></td>
            <td><button class="btn ghost sm" data-act="task-ceo" data-id="${t.id}" title="Marcar/desmarcar: depende da CEO">${t.ceo ? '<span class="badge ceo">Depende</span>' : `<span class="muted">${I.flag.replace('<svg', '<svg width="14" height="14"')}</span>`}</button></td>
            <td><button class="btn ghost sm" data-act="edit-task" data-id="${t.id}">Editar</button></td>
          </tr>`; }).join('') || `<tr><td colspan="8"><div class="empty">${S.tasks.length ? 'Nenhuma tarefa com esses filtros.' : 'Nenhuma tarefa ainda. Clique em <b>Nova tarefa</b>.'}</div></td></tr>`}
        </tbody>
      </table>
    </div>`;
  }

  /* ---------------- 6. Área de clientes ---------------- */
  function libraryGrid(items, manage) {
    const p = ui.portal;
    const vids = items.filter((l) => l.tipo === 'video' && (!p.cat || l.categoria === p.cat));
    const mats = items.filter((l) => l.tipo === 'material' && (!p.cat || l.categoria === p.cat));
    const cats = [...new Set(items.map((l) => l.categoria).filter(Boolean))];
    const catBar = cats.length ? `<div class="filters"><button class="chip-toggle ${!p.cat ? 'on' : ''}" data-act="portal-cat" data-id="">Todos</button>${cats.map((c) => `<button class="chip-toggle ${p.cat === c ? 'on' : ''}" data-act="portal-cat" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : '';
    const edit = (l) => (manage ? `<button class="btn ghost sm" data-act="edit-lib" data-id="${l.id}">Editar</button>${l.publicado ? '' : '<span class="badge today">Rascunho</span>'}` : '');
    const videos = `<h2>Vídeos educativos</h2><div class="lib">${vids.map((v) => `
      <article class="vcard"><div class="thumb" data-act="watch" data-id="${v.id}"><div class="sl"><i></i><i></i><i></i></div><span class="play">${I.play}</span><div class="cap">${esc(v.titulo)}</div>${v.duracao ? `<span class="dur">${esc(v.duracao)}</span>` : ''}</div>
        <div class="info"><div class="t">${esc(v.titulo)}</div><div class="m">${v.categoria ? `<span class="badge fmt">${esc(v.categoria)}</span>` : ''}${v.nivel ? `<span class="badge">${esc(v.nivel)}</span>` : ''}${edit(v)}</div></div>
      </article>`).join('') || '<div class="empty">Nenhum vídeo ainda.</div>'}</div>`;
    const materials = `<h2>Materiais exclusivos</h2><div class="mats">${mats.map((m) => `
      <div class="mat"><span class="ic">${esc((m.arquivo || 'LINK').slice(0, 4).toUpperCase())}</span><div style="min-width:0"><div class="t">${esc(m.titulo)}</div><div class="c">${esc(m.categoria || '')} ${edit(m)}</div></div>
      ${safeUrl(m.link) ? `<a class="btn sm" href="${esc(safeUrl(m.link))}" target="_blank" rel="noopener">Abrir</a>` : ''}</div>`).join('') || '<div class="empty">Nenhum material ainda.</div>'}</div>`;
    return catBar + (p.tab === 'videos' ? videos : p.tab === 'materiais' ? materials : videos + materials);
  }

  function pageClients() {
    return head('Área de clientes', 'Biblioteca dos clientes', 'Vídeos educativos e materiais que os clientes veem quando entram no Hub. Só aparecem para eles os itens marcados como publicados.',
      canEditContent() ? `<button class="btn primary" data-act="new-lib">${I.plus}Novo item</button>` : '') +
      `<div class="seg" style="margin-bottom:14px">${[['videos', 'Vídeos'], ['materiais', 'Materiais'], ['tudo', 'Tudo']].map(([k, l]) => `<button class="${ui.portal.tab === k ? 'on' : ''}" data-act="portal-tab" data-id="${k}">${l}</button>`).join('')}</div>` +
      libraryGrid(S.library, canEditContent()) +
      `<div class="portal-note">Para dar acesso a um cliente, vá em <b>Acessos</b> e cadastre o e-mail dele com o perfil <b>Cliente</b>. Ele entra com o Google e vê só esta biblioteca, nunca a operação interna.</div>`;
  }

  function portal() {
    const items = S.library.filter((l) => l.publicado);
    const meP = person(myEmail());
    return `<div class="portal">
      <header class="portal-top">
        <img src="assets/img/logo_on_light.png" alt="Vindex">
        <span class="sep"></span><span class="area">Área do cliente</span>
        <nav>${[['videos', 'Vídeos'], ['materiais', 'Materiais'], ['tudo', 'Tudo']].map(([k, l]) => `<button class="${ui.portal.tab === k ? 'on' : ''}" data-act="portal-tab" data-id="${k}">${l}</button>`).join('')}</nav>
        <span style="flex:1"></span>
        ${userChip(meP)}
      </header>
      <section class="portal-hero"><div class="slash"><span></span><span></span><span></span></div><div>
        <div class="k">Olá, ${esc(meP.name.split(' ')[0])}</div>
        <h1>Entre vender e lucrar, existe a Vindex.</h1>
        <p>Vídeos curtos e materiais práticos para você entender os números do seu e-commerce e tomar decisões com segurança.</p>
      </div></section>
      <main class="portal-body">${libraryGrid(items, false)}</main>
    </div>`;
  }

  /* ---------------- 7. Acessos ---------------- */
  function pageAccess() {
    const rows = S.users.slice().sort((a, b) => (a.papel === 'cliente') - (b.papel === 'cliente') || a.nome.localeCompare(b.nome));
    return head('Administração', 'Acessos', 'Quem pode entrar no Hub e com qual perfil. A pessoa entra com o botão "Entrar com Google", usando exatamente o e-mail cadastrado aqui.',
      `<button class="btn primary" data-act="new-user">${I.plus}Adicionar pessoa</button>`) + `
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th>Pessoa</th><th>E-mail</th><th>Perfil</th><th>Acesso</th><th></th></tr></thead>
        <tbody>
        ${rows.map((u) => { const self = u.id === myEmail(); return `
          <tr class="${u.ativo ? '' : 'done'}">
            <td>${who(u.id)}</td>
            <td class="mono" style="font-size:12.5px">${esc(u.id)}</td>
            <td><select class="mini" data-user-role="${esc(u.id)}" ${self ? 'disabled title="Você não pode mudar o próprio perfil"' : ''}>${options(K.ROLES.map((r) => ({ value: r.id, label: r.label })), u.papel)}</select></td>
            <td>${self ? '<span class="badge st st-aprovado">Você</span>' : `<button class="btn sm ${u.ativo ? '' : 'primary'}" data-act="user-toggle" data-id="${esc(u.id)}">${u.ativo ? 'Bloquear' : 'Liberar'}</button>`}</td>
            <td>${self ? '' : `<button class="btn ghost sm" data-act="user-rename" data-id="${esc(u.id)}">Renomear</button>`}</td>
          </tr>`; }).join('')}
        </tbody>
      </table>
    </div>
    <div class="portal-note"><b>Perfis:</b> <b>CEO</b> aprova conteúdos e gerencia acessos. <b>Administrador</b> é da equipe e também gerencia acessos. <b>Equipe</b> cria e move conteúdos e tarefas. <b>Cliente</b> só vê a biblioteca publicada da Área de clientes.</div>`;
  }

  /* ---------------- Telas de entrada ---------------- */
  function gate(title, body, actions = '') {
    return `<div class="gate"><div class="gate-card">
      <img src="assets/img/logo_on_dark.png" alt="Vindex" class="gate-logo">
      <div class="gate-tag">HUB · operação de conteúdo</div>
      <h1>${title}</h1><p>${body}</p>${actions}
    </div><div class="gate-bars"><span></span><span></span><span></span></div></div>`;
  }

  function renderGate() {
    switch (S.status) {
      case 'loading': return gate('Carregando…', 'Conectando ao Vindex Hub.');
      case 'config': return gate('Configuração pendente', 'O banco de dados ainda não foi ligado a este site. Falta preencher o arquivo <span class="mono">firebase-config.js</span>.');
      case 'offline': return gate('Sem conexão', 'Não foi possível carregar o sistema de login. Verifique a internet e recarregue a página.', '<button class="btn primary" data-act="reload">Tentar de novo</button>');
      case 'login': return gate('Entre para continuar', 'Use a sua conta Google cadastrada pela Vindex.',
        `<button class="btn google" data-act="login">${I.google}Entrar com Google</button>${S.error ? `<div class="gate-err">${esc(S.error)}</div>` : ''}`);
      case 'denied': return gate('Acesso não liberado', `A conta <b>${esc(myEmail())}</b> não tem acesso ao Vindex Hub. Peça para a Vindex liberar este e-mail, ou entre com outra conta.`,
        '<button class="btn primary" data-act="logout">Entrar com outra conta</button>');
      default: return '';
    }
  }

  /* ---------------- Camadas: drawer e modal ---------------- */
  function openLayer(html, kind = '', id = '') {
    closeLayer();
    document.getElementById('overlay').hidden = false;
    const layer = document.createElement('div');
    layer.id = 'layer';
    layer.dataset.kind = kind; layer.dataset.id = id;
    layer.innerHTML = html;
    document.body.appendChild(layer);
    const f = layer.querySelector('[autofocus]');
    if (f) f.focus();
  }
  function closeLayer() {
    const l = document.getElementById('layer');
    if (l) l.remove();
    document.getElementById('overlay').hidden = true;
    ui.confirmDelete = null;
  }

  function openContent(id) {
    const c = content(id);
    if (!c) { closeLayer(); return; }
    const ed = canEditContent();
    const dis = ed ? '' : 'disabled';
    const linked = S.tasks.filter((t) => t.content === id);
    openLayer(`<aside class="drawer" role="dialog" aria-label="${esc(c.title)}">
      <div class="drawer-h"><div style="min-width:0;flex:1"><div class="mono muted" style="font-size:11.5px">${code(c)} · versão ${c.version || 1}</div>
        ${ed ? `<input class="input title-input" data-content-field="title" data-id="${c.id}" value="${esc(c.title)}" aria-label="Título">` : `<h2>${esc(c.title)}</h2>`}
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${stageBadge(c.stage)}<span class="badge fmt">${esc(c.format)}</span>${contentLate(c) ? `<span class="badge late">Atrasado ${-diff(c.due)}d</span>` : ''}</div></div>
        <button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <div class="drawer-b">
        <div style="background:var(--blue-50);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px">
          <div style="flex:1"><div class="section-t" style="margin:0 0 3px;color:var(--blue-600)">Próximo passo</div><b>${esc(NEXT_STEP[c.stage])}</b></div>${who(nextOwner(c))}
        </div>
        <dl class="props">
          <dt>Etapa</dt><dd><select class="input" data-content-field="stage" data-id="${c.id}" ${ed || isCEO() ? '' : 'disabled'}>${options(K.STAGES.map((s) => ({ value: s.id, label: s.label })), c.stage)}</select></dd>
          <dt>Responsável</dt><dd><select class="input" data-content-field="owner" data-id="${c.id}" ${dis}>${peopleOpts(c.owner, 'Sem responsável')}</select></dd>
          <dt>Prazo da etapa</dt><dd><input type="date" class="input" data-content-field="due" data-id="${c.id}" value="${esc(c.due || '')}" ${dis}></dd>
          <dt>Publicação</dt><dd><input type="date" class="input" data-content-field="publish" data-id="${c.id}" value="${esc(c.publish || '')}" ${dis}></dd>
          <dt>Formato</dt><dd><select class="input" data-content-field="format" data-id="${c.id}" ${dis}>${options(K.FORMATS, c.format)}</select></dd>
          <dt>Canal</dt><dd><select class="input" data-content-field="channel" data-id="${c.id}" ${dis}>${options(K.CHANNELS, c.channel)}</select></dd>
          <dt>Pilar</dt><dd><select class="input" data-content-field="pillar" data-id="${c.id}" ${dis}>${options(K.PILLARS, c.pillar, '—')}</select></dd>
          <dt>Link do vídeo</dt><dd><input type="url" class="input" data-content-field="video" data-id="${c.id}" value="${esc(c.video || '')}" placeholder="Link do Google Drive ou YouTube" ${dis}></dd>
        </dl>
        <div><p class="section-t">Imagens</p>${galleryHTML(c)}</div>
        <div><p class="section-t">Roteiro</p>
          ${ed ? `<textarea class="input" id="ed-script" rows="8">${esc(c.script || '')}</textarea>` : `<div class="script">${esc(c.script) || '<span class="muted">Ainda não escrito.</span>'}</div>`}</div>
        <div><p class="section-t">Legenda do post</p>
          ${ed ? `<textarea class="input" id="ed-caption" rows="4">${esc(c.caption || '')}</textarea>` : `<div class="script">${esc(c.caption) || '<span class="muted">Sem legenda.</span>'}</div>`}</div>
        ${ed ? `<div style="display:flex;justify-content:flex-end"><button class="btn primary sm" data-act="save-texts" data-id="${c.id}">Salvar roteiro e legenda</button></div>` : ''}
        ${linked.length ? `<div><p class="section-t">Tarefas ligadas</p>${linked.map((t) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px;padding:4px 0">${avatar(t.owner)}<span style="flex:1">${esc(t.title)}</span><span class="badge">${esc(t.status)}</span></div>`).join('')}</div>` : ''}
        <div><p class="section-t">Comentários</p>${thread(c, 'd-thread')}
          <div style="margin-top:8px;display:flex;gap:8px"><input class="input" id="d-comment" placeholder="Escreva um comentário…"><button class="btn" data-act="d-comment" data-id="${c.id}">Enviar</button></div></div>
        <div><p class="section-t">Histórico</p><div class="hist">${(c.history || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).map((h) => `<div><span class="when">${fmt(h.at)}</span><span>${esc(h.text)}${h.by ? ` · <span class="muted">${esc(person(h.by).name)}</span>` : ''}</span></div>`).join('')}</div></div>
      </div>
      <div class="drawer-f">
        ${ed ? `<button class="btn ghost sm danger-txt" data-act="del-content" data-id="${c.id}">${ui.confirmDelete === c.id ? 'Clique de novo para excluir' : 'Excluir'}</button><span style="flex:1"></span>` : ''}
        <button class="btn" data-act="close">Fechar</button>
        ${['aguardando_aprovacao', 'ajustes', 'aprovado'].includes(c.stage) ? `<button class="btn primary" data-act="review" data-id="${c.id}">Central de aprovação ${I.arrow}</button>` : ''}
      </div>
    </aside>`, 'content', id);
  }

  function openTask(id) {
    const t = S.tasks.find((x) => x.id === id);
    location.hash = '#/tarefas';
    if (t) { ui.tasks.q = t.title; ui.tasks.hideDone = false; ui.tasks.late = false; ui.tasks.ceo = false; }
    render();
  }

  function contentModal() {
    openLayer(`<div class="modal" role="dialog" aria-label="Novo conteúdo">
      <div class="drawer-h"><div><div class="mono" style="font-size:11px;color:var(--blue);letter-spacing:.14em;text-transform:uppercase">Nova pauta</div><h2>Novo conteúdo</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <form class="form" id="f-content" onsubmit="return false">
        <div class="field full"><label>Título</label><input class="input" name="title" required autofocus maxlength="160" placeholder="Ex.: Como calcular o lucro real de um pedido"></div>
        <div class="field"><label>Formato</label><select class="input" name="format">${options(K.FORMATS, 'Reels')}</select></div>
        <div class="field"><label>Canal</label><select class="input" name="channel">${options(K.CHANNELS, 'Instagram')}</select></div>
        <div class="field"><label>Responsável</label><select class="input" name="owner">${peopleOpts(myEmail())}</select></div>
        <div class="field"><label>Etapa</label><select class="input" name="stage">${options(K.STAGES.filter((s) => s.id !== 'aprovado').map((s) => ({ value: s.id, label: s.label })), 'pauta')}</select></div>
        <div class="field"><label>Prazo da etapa</label><input class="input" type="date" name="due" value="${offset(3)}"></div>
        <div class="field"><label>Publicação prevista</label><input class="input" type="date" name="publish" value="${offset(7)}"></div>
        <div class="field full"><label>Pilar</label><select class="input" name="pillar">${options(K.PILLARS, 'Lucro', '—')}</select></div>
      </form>
      <div class="drawer-f"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save-content">Criar conteúdo</button></div>
    </div>`, 'modal');
  }

  function taskModal(id) {
    const t = id ? S.tasks.find((x) => x.id === id) : null;
    const v = t || { title: '', owner: myEmail(), due: offset(2), priority: 'Média', ceo: false, content: '', note: '' };
    openLayer(`<div class="modal" role="dialog" aria-label="${t ? 'Editar tarefa' : 'Nova tarefa'}">
      <div class="drawer-h"><div><h2>${t ? 'Editar tarefa' : 'Nova tarefa'}</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <form class="form" id="f-task" onsubmit="return false">
        <div class="field full"><label>Tarefa</label><input class="input" name="title" required autofocus maxlength="200" value="${esc(v.title)}" placeholder="O que precisa ser feito?"></div>
        <div class="field"><label>Responsável</label><select class="input" name="owner">${peopleOpts(v.owner)}</select></div>
        <div class="field"><label>Prazo</label><input class="input" type="date" name="due" value="${esc(v.due || '')}"></div>
        <div class="field"><label>Prioridade</label><select class="input" name="priority">${options(PRIORITIES, v.priority)}</select></div>
        <div class="field"><label>Conteúdo ligado (opcional)</label><select class="input" name="content">${options(S.contents.filter((c) => c.stage !== 'publicado' || c.id === v.content).map((c) => ({ value: c.id, label: `${code(c)} · ${c.title.slice(0, 34)}` })), v.content || '', 'Nenhum')}</select></div>
        <div class="field full"><label>Observação (opcional)</label><input class="input" name="note" maxlength="200" value="${esc(v.note || '')}" placeholder="Ex.: aguardando cenário"></div>
        <label class="chip-toggle full"><input type="checkbox" name="ceo" ${v.ceo ? 'checked' : ''}>Esta tarefa depende da CEO</label>
      </form>
      <div class="drawer-f">${t ? `<button class="btn ghost sm danger-txt" data-act="del-task" data-id="${t.id}">${ui.confirmDelete === t.id ? 'Clique de novo para excluir' : 'Excluir'}</button><span style="flex:1"></span>` : ''}
        <button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save-task" data-id="${t ? t.id : ''}">${t ? 'Salvar' : 'Criar tarefa'}</button></div>
    </div>`, 'modal');
  }

  function libModal(id) {
    const l = id ? S.library.find((x) => x.id === id) : null;
    const v = l || { tipo: 'video', titulo: '', categoria: K.LIB_CATS[0], link: '', duracao: '', nivel: 'Essencial', arquivo: 'PDF', publicado: false };
    openLayer(`<div class="modal" role="dialog" aria-label="Item da biblioteca">
      <div class="drawer-h"><div><h2>${l ? 'Editar item' : 'Novo item da biblioteca'}</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <form class="form" id="f-lib" onsubmit="return false">
        <div class="field"><label>Tipo</label><select class="input" name="tipo">${options([{ value: 'video', label: 'Vídeo' }, { value: 'material', label: 'Material' }], v.tipo)}</select></div>
        <div class="field"><label>Categoria</label><select class="input" name="categoria">${options(K.LIB_CATS, v.categoria)}</select></div>
        <div class="field full"><label>Título</label><input class="input" name="titulo" required autofocus maxlength="160" value="${esc(v.titulo)}"></div>
        <div class="field full"><label>Link (Google Drive, YouTube não listado, PDF…)</label><input class="input" type="url" name="link" required value="${esc(v.link)}" placeholder="https://"></div>
        <div class="field"><label>Duração (vídeo)</label><input class="input" name="duracao" maxlength="10" value="${esc(v.duracao || '')}" placeholder="12:40"></div>
        <div class="field"><label>Nível (vídeo)</label><select class="input" name="nivel">${options(K.LEVELS, v.nivel)}</select></div>
        <div class="field"><label>Tipo de arquivo (material)</label><input class="input" name="arquivo" maxlength="5" value="${esc(v.arquivo || '')}" placeholder="PDF"></div>
        <label class="chip-toggle" style="align-self:end"><input type="checkbox" name="publicado" ${v.publicado ? 'checked' : ''}>Publicado para clientes</label>
      </form>
      <div class="drawer-f">${l ? `<button class="btn ghost sm danger-txt" data-act="del-lib" data-id="${l.id}">${ui.confirmDelete === l.id ? 'Clique de novo para excluir' : 'Excluir'}</button><span style="flex:1"></span>` : ''}
        <button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save-lib" data-id="${l ? l.id : ''}">Salvar</button></div>
    </div>`, 'modal');
  }

  function userModal() {
    openLayer(`<div class="modal" role="dialog" aria-label="Adicionar pessoa">
      <div class="drawer-h"><div><h2>Adicionar pessoa</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <form class="form" id="f-user" onsubmit="return false">
        <div class="field full"><label>Nome</label><input class="input" name="nome" required autofocus maxlength="80" placeholder="Ex.: Juliana Souza"></div>
        <div class="field full"><label>E-mail da conta Google</label><input class="input" type="email" name="email" required placeholder="nome@gmail.com"></div>
        <div class="field full"><label>Perfil</label><select class="input" name="papel">${options(K.ROLES.map((r) => ({ value: r.id, label: r.label })), 'equipe')}</select></div>
      </form>
      <div class="drawer-f"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save-user">Liberar acesso</button></div>
    </div>`, 'modal');
  }

  function watchModal(id) {
    const v = S.library.find((l) => l.id === id);
    if (!v) return;
    const m = media(v.link);
    const body = !m ? '<div class="none"><b>Link inválido</b></div>'
      : m.type === 'iframe' ? `<iframe src="${esc(m.src)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="${esc(v.titulo)}"></iframe>`
      : m.type === 'video' ? `<video src="${esc(m.src)}" controls autoplay playsinline></video>`
      : `<div class="none">${I.link}<b>Abrir vídeo</b><p></p><a class="btn sm" href="${esc(m.src)}" target="_blank" rel="noopener">Abrir em nova aba</a></div>`;
    openLayer(`<div class="modal" style="width:min(860px,calc(100vw - 32px))" role="dialog" aria-label="${esc(v.titulo)}">
      <div class="drawer-h"><div><div class="mono muted" style="font-size:11px">${esc(v.categoria || '')}${v.duracao ? ' · ' + esc(v.duracao) : ''}</div><h2>${esc(v.titulo)}</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
      <div style="padding:6px 22px 22px"><div class="player">${body}</div></div>
    </div>`, 'modal');
  }

  /* ---------------- Render ---------------- */
  function render() {
    const active = document.activeElement;
    const focusId = active && active.id;
    const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    const draft = document.getElementById('ap-comment');
    const draftText = draft ? draft.value : '';

    const app = document.getElementById('app');
    if (S.status !== 'app') {
      app.innerHTML = renderGate();
      document.title = 'Vindex Hub';
      return;
    }
    if (role() === 'cliente') {
      app.innerHTML = portal();
      document.title = 'Área do cliente · Vindex Hub';
    } else {
      const route = currentRoute();
      app.innerHTML = shell(route);
      document.title = `${route.label} · Vindex Hub`;
    }
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); if (caret !== null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch (e) { /* campo sem cursor */ } }
    }
    const nd = document.getElementById('ap-comment');
    if (nd && draftText) nd.value = draftText;
  }

  // Atualizações que chegam do banco. Na Central de aprovação, se só chegaram comentários
  // do conteúdo aberto, atualiza apenas a conversa para não reiniciar o vídeo que está tocando.
  let pending = false;
  let lastApprovalSig = '';
  function approvalSig() {
    const c = content(ui.approval.selected);
    const l = approvalLists();
    return [ui.approval.tab, ui.approval.selected, c && c.stage, c && c.version, c && c.video, c && c.script, c && c.caption, c && c.imagens,
      l.aguardando.length, l.ajustes.length, l.aprovados.length].join('|');
  }
  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const onApproval = S.status === 'app' && role() !== 'cliente' && currentRoute().id === 'aprovacoes' && !document.getElementById('layer');
      const sig = onApproval ? approvalSig() : '';
      if (onApproval && sig === lastApprovalSig && document.querySelector('.review-main .player, .review-main .gallery')) { refreshSideOnly(); return; }
      lastApprovalSig = sig;
      render();
      refreshLayer();
    });
  }
  function refreshSideOnly() {
    const c = content(ui.approval.selected);
    const th = document.getElementById('thread');
    if (c && th) th.outerHTML = thread(c);
  }
  // Mantém o card aberto atualizado (comentários, histórico) sem perder o que está sendo digitado.
  function refreshLayer() {
    const l = document.getElementById('layer');
    if (!l || l.dataset.kind !== 'content') return;
    const c = content(l.dataset.id);
    if (!c) { closeLayer(); return; }
    const th = document.getElementById('d-thread');
    if (th) th.outerHTML = thread(c, 'd-thread');
  }

  function setFilter(path, value) {
    const [group, key] = path.split('.');
    ui[group][key] = value;
    render();
  }

  /* ---------------- Sessão e dados ---------------- */
  function stopWatching() { S.unsubs.forEach((u) => u()); S.unsubs = []; }

  function watchAll() {
    stopWatching();
    const onErr = (e) => { console.error(e); toast('Sem permissão para ler alguns dados', 'regra de acesso'); };
    const sub = (col, key, filter) => S.unsubs.push(VH.watch(col, (rows) => { S[key] = rows; scheduleRender(); }, onErr, filter));
    if (role() === 'cliente') {
      sub('biblioteca', 'library', ['publicado', true]);
      return;
    }
    sub('usuarios', 'users');
    sub('conteudos', 'contents');
    sub('tarefas', 'tasks');
    sub('biblioteca', 'library');
  }

  function start() {
    if (start.done) return;
    start.done = true;
    if (!window.VH) { S.status = window.VINDEX_FIREBASE_CONFIG ? 'offline' : 'config'; render(); return; }
    VH.onAuth(async (u) => {
      stopWatching();
      S.authUser = u; S.me = null; S.users = []; S.contents = []; S.tasks = []; S.library = [];
      if (!u) { S.status = 'login'; render(); return; }
      S.status = 'loading'; render();
      try {
        const me = await VH.getUser(u.email.toLowerCase());
        if (!me || !me.ativo) { S.status = 'denied'; render(); return; }
        S.me = me;
        S.users = [{ id: u.email.toLowerCase(), ...me }];
        S.status = 'app';
        watchAll();
        render();
      } catch (e) {
        console.error(e);
        S.status = 'denied'; render();
      }
    });
  }

  /* ---------------- Eventos ---------------- */
  const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

  document.addEventListener('click', async (e) => {
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
      case 'login':
        S.error = '';
        try { await VH.signIn(); } catch (err) {
          if (!/popup-closed|cancelled-popup/.test(String(err.code))) { S.error = 'Não foi possível entrar. Tente de novo.'; render(); }
        }
        break;
      case 'logout': closeLayer(); await VH.signOut(); location.hash = ''; break;
      case 'reload': location.reload(); break;
      case 'nav': ui.navOpen = !ui.navOpen; render(); break;
      case 'go': {
        const [route, flag] = id.split('?');
        if (route === 'tarefas' && flag === 'late') { ui.tasks.late = true; ui.tasks.ceo = false; ui.tasks.q = ''; }
        location.hash = '#/' + route; break;
      }
      case 'close': closeLayer(); break;
      case 'content': e.stopPropagation(); openContent(id); break;
      case 'task': openTask(id); break;
      case 'review': {
        closeLayer();
        const c = content(id);
        ui.approval.tab = c.stage === 'ajustes' ? 'ajustes' : c.stage === 'aguardando_aprovacao' ? 'aguardando' : 'aprovados';
        ui.approval.selected = id;
        if (location.hash !== '#/aprovacoes') location.hash = '#/aprovacoes'; else render();
        break;
      }
      case 'new-content': contentModal(); break;
      case 'new-task': taskModal(); break;
      case 'edit-task': taskModal(id); break;
      case 'new-lib': libModal(); break;
      case 'edit-lib': libModal(id); break;
      case 'new-user': userModal(); break;
      case 'save-content': {
        const f = document.getElementById('f-content');
        if (!f.reportValidity()) return;
        const d = Object.fromEntries(new FormData(f));
        el.disabled = true;
        try {
          await VH.add('conteudos', {
            title: d.title.trim(), format: d.format, channel: d.channel, stage: d.stage, owner: d.owner || '',
            due: d.due || '', publish: d.publish || '', pillar: d.pillar || '', video: '', version: 1, script: '', caption: '',
            comments: [], history: [H(`Conteúdo criado em ${stageLabel(d.stage)}`)], createdAt: nowIso(), createdBy: myEmail()
          });
          closeLayer(); toast('Conteúdo criado');
        } catch (err) { fail(err); el.disabled = false; }
        break;
      }
      case 'save-task': {
        const f = document.getElementById('f-task');
        if (!f.reportValidity()) return;
        const d = Object.fromEntries(new FormData(f));
        const data = { title: d.title.trim(), owner: d.owner || '', due: d.due || '', priority: d.priority, ceo: !!d.ceo, content: d.content || null, note: (d.note || '').trim() };
        el.disabled = true;
        try {
          if (id) await VH.update('tarefas', id, data);
          else await VH.add('tarefas', { ...data, status: 'A fazer', createdAt: nowIso(), createdBy: myEmail() });
          closeLayer(); toast(id ? 'Tarefa salva' : 'Tarefa criada');
        } catch (err) { fail(err); el.disabled = false; }
        break;
      }
      case 'save-lib': {
        const f = document.getElementById('f-lib');
        if (!f.reportValidity()) return;
        const d = Object.fromEntries(new FormData(f));
        const link = safeUrl(d.link);
        if (!link) { toast('Link inválido', 'use um endereço que começa com https://'); return; }
        const data = { tipo: d.tipo, categoria: d.categoria, titulo: d.titulo.trim(), link, duracao: d.duracao.trim(), nivel: d.nivel, arquivo: d.arquivo.trim(), publicado: !!d.publicado };
        try {
          if (id) await VH.update('biblioteca', id, data); else await VH.add('biblioteca', { ...data, createdAt: nowIso() });
          closeLayer(); toast('Biblioteca atualizada');
        } catch (err) { fail(err); }
        break;
      }
      case 'save-user': {
        const f = document.getElementById('f-user');
        if (!f.reportValidity()) return;
        const d = Object.fromEntries(new FormData(f));
        const email = d.email.trim().toLowerCase();
        if (S.users.find((u) => u.id === email)) { toast('Este e-mail já está cadastrado'); return; }
        try { await VH.set('usuarios', email, { nome: d.nome.trim(), papel: d.papel, ativo: true, criadoEm: nowIso(), criadoPor: myEmail() }); closeLayer(); toast(`Acesso liberado para ${d.nome.trim()}`); } catch (err) { fail(err); }
        break;
      }
      case 'user-toggle': {
        const u = S.users.find((x) => x.id === id);
        try { await VH.update('usuarios', id, { ativo: !u.ativo }); toast(u.ativo ? 'Acesso bloqueado' : 'Acesso liberado'); } catch (err) { fail(err); }
        break;
      }
      case 'user-rename': {
        const u = S.users.find((x) => x.id === id);
        openLayer(`<div class="modal" role="dialog" aria-label="Renomear"><div class="drawer-h"><div><h2>Renomear</h2></div><button class="x" data-act="close" aria-label="Fechar">${I.x}</button></div>
          <form class="form" onsubmit="return false"><div class="field full"><label>Nome</label><input class="input" id="rn-nome" autofocus maxlength="80" value="${esc(u.nome)}"></div></form>
          <div class="drawer-f"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save-rename" data-id="${esc(id)}">Salvar</button></div></div>`, 'modal');
        break;
      }
      case 'save-rename': {
        const nome = val('rn-nome').trim();
        if (!nome) return;
        try { await VH.update('usuarios', id, { nome }); closeLayer(); toast('Nome atualizado'); } catch (err) { fail(err); }
        break;
      }
      case 'save-texts': {
        try { await VH.push('conteudos', id, 'history', H('Roteiro/legenda atualizados'), { script: val('ed-script'), caption: val('ed-caption') }); toast('Roteiro e legenda salvos'); } catch (err) { fail(err); }
        break;
      }
      case 'd-comment': {
        const txt = val('d-comment').trim();
        if (!txt) return;
        document.getElementById('d-comment').value = '';
        await addComment(id, txt);
        break;
      }
      case 'del-content': case 'del-task': case 'del-lib': {
        if (ui.confirmDelete !== id) { ui.confirmDelete = id; el.textContent = 'Clique de novo para excluir'; return; }
        const col = { 'del-content': 'conteudos', 'del-task': 'tarefas', 'del-lib': 'biblioteca' }[act];
        try {
          if (col === 'conteudos') { const imgs = await VH.list('midias', ['conteudo', id]); await Promise.all(imgs.map((m) => VH.remove('midias', m.id))); delete MEDIA[id]; }
          await VH.remove(col, id); closeLayer(); toast('Excluído');
        } catch (err) { fail(err); }
        break;
      }
      case 'clear-kanban': ui.kanban = { q: '', owner: '', format: '', channel: '', late: false }; render(); break;
      case 'ap-tab': ui.approval.tab = id; ui.approval.selected = null; render(); break;
      case 'ap-select': ui.approval.selected = id; render(); break;
      case 'approve': {
        if (!isCEO()) return;
        const box = document.getElementById('ap-comment');
        const txt = box.value.trim();
        box.value = '';
        if (await decide(id, 'aprovado', txt || 'Aprovado.')) toast('Conteúdo aprovado e registrado');
        break;
      }
      case 'adjust': {
        if (!isCEO()) return;
        const box = document.getElementById('ap-comment');
        const txt = box.value.trim();
        if (!txt) { box.focus(); box.style.borderColor = 'var(--danger)'; toast('Escreva no comentário o que precisa mudar'); return; }
        box.value = '';
        if (await decide(id, 'ajustes', txt)) toast('Ajustes solicitados à equipe');
        break;
      }
      case 'resubmit': if (await moveStage(id, 'aguardando_aprovacao')) { ui.approval.tab = 'aguardando'; ui.approval.selected = id; toast('Reenviado para aprovação'); } break;
      case 'schedule': if (await moveStage(id, 'agendado')) toast('Marcado como agendado'); break;
      case 'comment': {
        const box = document.getElementById('ap-comment');
        const txt = box.value.trim();
        if (!txt) { box.focus(); return; }
        box.value = '';
        await addComment(id, txt);
        break;
      }
      case 'cal-prev': case 'cal-next': {
        const d = new Date(ui.cal.year, ui.cal.month + (act === 'cal-next' ? 1 : -1), 1);
        ui.cal.month = d.getMonth(); ui.cal.year = d.getFullYear(); render(); break;
      }
      case 'cal-today': ui.cal.month = TODAY.getMonth(); ui.cal.year = TODAY.getFullYear(); render(); break;
      case 'cal-view': ui.cal.view = id; render(); break;
      case 'task-done': {
        const t = S.tasks.find((x) => x.id === id);
        try { await VH.update('tarefas', id, { status: el.checked ? 'Concluída' : 'A fazer' }); toast(el.checked ? 'Tarefa concluída' : 'Tarefa reaberta'); } catch (err) { fail(err); el.checked = t.status === 'Concluída'; }
        break;
      }
      case 'task-ceo': {
        const t = S.tasks.find((x) => x.id === id);
        try { await VH.update('tarefas', id, { ceo: !t.ceo }); } catch (err) { fail(err); }
        break;
      }
      case 'portal-tab': ui.portal.tab = id; render(); break;
      case 'portal-cat': ui.portal.cat = id; render(); break;
      case 'watch': watchModal(id); break;
      case 'img-full': fullImage(el.dataset.content, id); break;
      case 'del-img': {
        const cid = el.dataset.content;
        if (ui.confirmDelete !== id) { ui.confirmDelete = id; el.textContent = 'Confirmar'; return; }
        ui.confirmDelete = null;
        try {
          await VH.remove('midias', id);
          const left = (Array.isArray(MEDIA[cid]) ? MEDIA[cid] : []).filter((m) => m.id !== id);
          MEDIA[cid] = left; paintGallery(cid);
          await VH.push('conteudos', cid, 'history', H('Imagem removida'), { imagens: left.length });
          toast('Imagem removida');
        } catch (err) { fail(err); }
        break;
      }
      default: break;
    }
  });

  document.addEventListener('input', (e) => {
    const f = e.target.dataset.filter;
    if (f && e.target.type !== 'checkbox' && e.target.tagName === 'INPUT') setFilter(f, e.target.value);
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.filter) {
      if (t.type === 'checkbox') setFilter(t.dataset.filter, t.checked);
      else if (t.tagName === 'SELECT') setFilter(t.dataset.filter, t.value);
      return;
    }
    if (t.dataset.upload) {
      const files = [...t.files]; t.value = '';
      await uploadImages(t.dataset.upload, files);
      return;
    }
    if (t.dataset.taskStatus) {
      try { await VH.update('tarefas', t.dataset.taskStatus, { status: t.value }); toast(`Status: ${t.value}`); } catch (err) { fail(err); }
      return;
    }
    if (t.dataset.userRole) {
      try { await VH.update('usuarios', t.dataset.userRole, { papel: t.value }); toast('Perfil atualizado'); } catch (err) { fail(err); }
      return;
    }
    if (t.dataset.contentField) {
      const c = content(t.dataset.id); const field = t.dataset.contentField;
      if (!c) return;
      if (field === 'stage') {
        if (await moveStage(c.id, t.value)) { toast(`Movido para ${stageLabel(t.value)}`); openContent(c.id); } else t.value = c.stage;
        return;
      }
      let value = t.value;
      if (field === 'title') { value = value.trim(); if (!value) { t.value = c.title; return; } }
      if (field === 'video' && value && !safeUrl(value)) { toast('Link inválido', 'use um endereço que começa com https://'); t.value = c.video || ''; return; }
      const labels = { title: 'Título alterado', owner: `Responsável: ${person(value).name}`, due: `Prazo: ${fmt(value)}`, publish: `Publicação: ${fmt(value)}`, format: `Formato: ${value}`, channel: `Canal: ${value}`, pillar: `Pilar: ${value || '—'}`, video: value ? 'Link do vídeo atualizado' : 'Link do vídeo removido' };
      try { await VH.push('conteudos', c.id, 'history', H(labels[field] || 'Alterado'), { [field]: value }); toast('Alteração salva'); } catch (err) { fail(err); }
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
  document.addEventListener('drop', async (e) => {
    const col = e.target.closest && e.target.closest('[data-drop]');
    if (!col || !dragId) return;
    e.preventDefault();
    const id = dragId;
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
    if (await moveStage(id, col.dataset.drop)) toast(`${code(content(id))} → ${stageLabel(col.dataset.drop)}`);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const lb = document.getElementById('lightbox'); if (lb) lb.remove(); else closeLayer(); }
    if (e.key === 'Enter' && e.target.matches('.kpi, .row, .qitem, .kcard')) e.target.click();
    if (e.key === 'Enter' && e.target.id === 'd-comment') { const b = document.querySelector('[data-act="d-comment"]'); if (b) b.click(); }
  });

  window.addEventListener('hashchange', () => { ui.navOpen = false; closeLayer(); render(); window.scrollTo(0, 0); });

  // Vira o dia sem recarregar (prazos "hoje"/"atrasado" continuam certos).
  setInterval(() => { const t = startOfDay(new Date()); if (t - TODAY) { TODAY = t; if (S.status === 'app') render(); } }, 60000);

  render();
  if (window.VH !== undefined) start();
  else {
    window.addEventListener('vh:ready', start);
    // Se o módulo do Firebase não carregar (sem internet / bloqueado), avisa em vez de ficar carregando.
    setTimeout(() => { if (!start.done) { S.status = window.VINDEX_FIREBASE_CONFIG ? 'offline' : 'config'; start.done = true; render(); } }, 10000);
  }
})();
