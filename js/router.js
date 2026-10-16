import { supabase, dashboardUrl } from './supabase.js';
import { getUser, logout } from './auth.js';
import { h, icon, emailColor, copyText, setTopbar, toast, withLoading } from './ui.js';

const $ = (id) => document.getElementById(id);

// Cada módulo exporta: render(container, ctx) e, opcionalmente, destroy().
const routes = [
  { re: /^\/$/, title: 'Início', module: './modules/dashboard.js' },
  { re: /^\/projetos$/, title: 'Projetos', module: './modules/projects.js' },
  { re: /^\/notificacoes$/, title: 'Notificações', module: './modules/notifications.js' },
  { re: /^\/pagamentos$/, title: 'Pagamentos', module: './modules/payments.js' },
  { re: /^\/logs$/, title: 'Logs', module: './modules/logs.js' },
  { re: /^\/configuracoes$/, title: 'Configurações', module: './modules/settings.js' },
  { re: /^\/p\/([\w-]+)$/, viewer: true },
];

const NAV = [
  { path: '/', label: 'Início', icon: 'home' },
  { path: '/notificacoes', label: 'Notificações', icon: 'bell' },
  { path: '/pagamentos', label: 'Pagamentos', icon: 'wallet' },
  { path: '/projetos', label: 'Projetos', icon: 'grid' },
  { path: '/logs', label: 'Logs', icon: 'log' },
  { path: '/configuracoes', label: 'Configurações', icon: 'sliders' },
];

const state = { projetos: [], alertas: new Map(), alertTotal: 0, channel: null, current: null, navId: 0 };
const currentPath = () => location.hash.slice(1) || '/';
const closeNav = () => $('app').classList.remove('nav-open');

const ctx = () => ({
  get projetos() { return state.projetos; },
  user: getUser(),
  get alertas() { return state.alertas; },
  reload: loadProjects,
  refreshAlerts: loadAlerts,
  setTopbar,
});

/* ---------- Dados ---------- */
async function fetchAlerts() {
  const { data } = await supabase.from('notificacoes').select('projeto_id, contagem').eq('status', 'aberta');
  state.alertas = new Map();
  state.alertTotal = 0;
  for (const n of data ?? []) {
    state.alertas.set(n.projeto_id, (state.alertas.get(n.projeto_id) ?? 0) + n.contagem);
    state.alertTotal += n.contagem;
  }
}

export async function loadAlerts() { await fetchAlerts(); renderSidebar(); }

export async function loadProjects() {
  const [{ data, error }] = await Promise.all([
    supabase.from('projetos').select('*').neq('status', 'arquivado').order('ordem'),
    fetchAlerts(),
  ]);
  if (error) toast(`Erro ao carregar projetos: ${error.message}`, 'error');
  else state.projetos = data;
  renderSidebar();
}

/* ---------- Sidebar ---------- */
const boltFor = (email) =>
  h('span', { class: 'bolt', title: `Conta Supabase: ${email}`, style: { color: emailColor(email) } }, icon('zap', 14));

function link(path, ...children) {
  const href = `#${path}`;
  return h('a', {
    href, 'data-path': path,
    onclick: () => { if (location.hash === href) navigate(); }, // reclicar no item atual também reinicia a tela
  }, ...children);
}

function projectItem(p) {
  const soon = p.status === 'planejado' || !p.url_app;
  const dot = h('span', { class: 'proj__dot', style: { '--c': p.cor || 'var(--text-3)' } });
  const name = h('span', { class: 'proj__name' }, p.nome);
  const bolt = p.email_supabase ? boltFor(p.email_supabase) : null;
  const n = state.alertas.get(p.id);
  const badge = n ? h('span', { class: 'nb', title: `${n} alerta(s) aberto(s)` }, n) : null;
  if (soon) return h('span', { class: 'proj proj--soon', 'aria-disabled': 'true' }, dot, name, bolt, h('span', { class: 'tag' }, 'Em breve'));
  const a = link(`/p/${p.id}`, dot, name, bolt, badge);
  a.classList.add('proj');
  return a;
}

function renderSidebar() {
  const groups = new Map();
  for (const p of state.projetos) {
    const g = p.grupo || 'Sem grupo';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const emails = [...new Set(state.projetos.map((p) => p.email_supabase).filter(Boolean))];
  const user = getUser();

  $('sidebar').replaceChildren(
    h('div', { class: 'brand' }, h('span', { class: 'brand__logo' }, 'M'), h('span', { class: 'brand__name' }, 'Maestro')),
    h('nav', { class: 'nav', 'aria-label': 'Principal' }, ...NAV.map((n) => {
      const cnt = n.path === '/notificacoes' ? state.alertTotal : 0;
      const a = link(n.path, icon(n.icon), h('span', {}, n.label), cnt ? h('span', { class: 'nb' }, cnt) : null);
      a.classList.add('nav__item');
      return a;
    })),
    h('div', { class: 'side__scroll' },
      ...[...groups].map(([g, items]) => h('section', { class: 'nav-group' },
        h('h2', { class: 'nav-group__title' }, g), ...items.map(projectItem))),
      emails.length ? h('section', { class: 'nav-group' },
        h('h2', { class: 'nav-group__title' }, 'Contas Supabase'),
        ...emails.map((e) => h('button', { class: 'acct', type: 'button', title: 'Copiar e-mail', onclick: () => copyText(e) },
          boltFor(e), h('span', {}, e)))) : null),
    h('div', { class: 'side__foot' },
      h('span', { class: 'side__user', title: user?.email }, user?.email),
      h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Sair', title: 'Sair', onclick: () => logout() }, icon('logout'))),
  );
  markActive();
}

function markActive(path = currentPath()) {
  $('sidebar').querySelectorAll('[data-path]').forEach((a) =>
    a.dataset.path === path ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
}

/* ---------- Telas ---------- */
function renderEmpty(title, text) {
  setTopbar(title);
  $('view').replaceChildren(h('div', { class: 'empty' }, h('h2', {}, title), h('p', { class: 'muted' }, text)));
}

function renderViewer(id) {
  const p = state.projetos.find((x) => x.id === id);
  if (!p?.url_app) return renderEmpty('Projeto indisponível', 'Este projeto não tem URL de aplicação cadastrada.');
  const dash = dashboardUrl(p);

  setTopbar(p.nome,
    h('a', { class: 'btn btn--sm', href: p.url_app, target: '_blank', rel: 'noopener' }, icon('external', 16), 'Nova aba'),
    h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Fechar', title: 'Fechar', onclick: () => { location.hash = '#/'; } }, icon('x')));

  const meta = h('div', { class: 'viewer__meta' },
    p.email_supabase
      ? h('button', { class: 'chip', type: 'button', title: 'Copiar e-mail', onclick: () => copyText(p.email_supabase) },
          boltFor(p.email_supabase), p.email_supabase, icon('copy', 14))
      : h('span', { class: 'chip chip--warn' }, 'Sem e-mail Supabase'),
    dash ? h('button', { class: 'chip', type: 'button', onclick: () => copyText(dash, 'Link do dashboard copiado!') }, icon('copy', 14), 'Copiar link do dashboard') : null,
    dash ? h('a', { class: 'chip', href: dash, target: '_blank', rel: 'noopener' }, icon('external', 14), 'Abrir dashboard') : null);

  const frame = h('iframe', {
    class: 'viewer__frame', src: p.url_app, title: p.nome, allow: 'clipboard-write',
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads',
  });
  $('view').append(meta, frame);
}

/* ---------- Navegação ---------- */
async function teardown() {
  const mod = state.current;
  state.current = null;
  try { await mod?.destroy?.(); } catch (e) { console.error(e); }
  const view = $('view');
  const frame = view.querySelector('iframe');
  if (frame) { frame.src = 'about:blank'; frame.remove(); } // destrói o estado do sistema embutido
  view.replaceChildren();
  view.classList.remove('is-viewer');
  setTopbar('');
}

async function navigate() {
  const id = ++state.navId;
  const path = currentPath();
  await teardown();
  closeNav();
  markActive(path);

  const route = routes.find((r) => r.re.test(path));
  if (!route) return renderEmpty('Página não encontrada', 'Esse endereço não existe no Maestro.');

  if (route.viewer) {
    $('view').classList.add('is-viewer');
    return renderViewer(path.match(route.re)[1]);
  }

  setTopbar(route.title);
  try {
    const mod = await import(route.module);
    if (id !== state.navId) return;
    state.current = mod;
    await mod.render($('view'), ctx());
  } catch (err) {
    console.error(err);
    if (id === state.navId) renderEmpty(route.title, 'Este módulo ainda não foi implementado.');
  }
}

export async function initRouter() {
  const menu = $('btn-menu');
  menu.replaceChildren(icon('menu'));
  menu.onclick = () => $('app').classList.toggle('nav-open');
  $('scrim').onclick = closeNav;
  window.removeEventListener('hashchange', navigate);
  window.addEventListener('hashchange', navigate);
  await withLoading(loadProjects);
  if (state.channel) supabase.removeChannel(state.channel);
  state.channel = supabase.channel('maestro-alertas')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new?.gravidade === 'urgente') toast(`Novo alerta: ${payload.new.titulo}`, 'warn');
      loadAlerts();
    })
    .subscribe();
  navigate();
}

export async function destroyRouter() {
  window.removeEventListener('hashchange', navigate);
  if (state.channel) { supabase.removeChannel(state.channel); state.channel = null; }
  await teardown();
  state.projetos = [];
  $('sidebar').replaceChildren();
  history.replaceState(null, '', location.pathname + location.search);
}
