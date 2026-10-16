/* ---------- DOM builder (sem innerHTML com dados: evita XSS) ---------- */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    } else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

/* ---------- Ícones (paths estáticos e confiáveis) ---------- */
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
};

export function icon(name, size = 18) {
  const el = h('span', { class: 'icon' });
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
  return el;
}

/* ---------- Toasts ---------- */
export function toast(message, type = 'info', ms = 4000) {
  const el = h('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status', onclick: () => el.remove() }, message);
  document.getElementById('toasts').append(el);
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}

/* ---------- Modais ---------- */
export function modal({ title, body, actions = [], dismissible = true, onClose }) {
  const prev = document.activeElement;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    prev?.focus?.();
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(); };
  const buttons = actions.map((a) => h('button', {
    class: `btn btn--${a.variant || 'ghost'}`, type: 'button',
    onclick: async () => { if ((await a.onClick?.()) !== false) close(); },
  }, a.label));
  const overlay = h('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay && dismissible) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('h2', { class: 'modal__title' }, title),
      h('div', { class: 'modal__body' }, body),
      h('div', { class: 'modal__actions' }, ...buttons)));
  document.getElementById('modal-root').append(overlay);
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.btn--primary, .btn--danger, .btn')?.focus();
  return { close, el: overlay };
}

export const confirmDialog = (message, { title = 'Confirmar', confirmLabel = 'Confirmar', danger = false } = {}) =>
  new Promise((resolve) => modal({
    title, body: message, onClose: () => resolve(false),
    actions: [
      { label: 'Cancelar' },
      { label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => resolve(true) },
    ],
  }));

/* ---------- Loading ---------- */
let pending = 0;
export function loading(on) {
  pending = Math.max(0, pending + (on ? 1 : -1));
  document.getElementById('loading').hidden = pending === 0;
}
export async function withLoading(fn) {
  loading(true);
  try { return await fn(); } finally { loading(false); }
}
export function setBusy(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('is-busy', on);
}

/* ---------- Topbar ---------- */
export function setTopbar(title, ...actions) {
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-actions').replaceChildren(...actions);
}

/* ---------- Helpers ---------- */
// Cor estável por e-mail (paleta sem verde/amarelo/vermelho/azul de destaque, reservados para status e UI).
const PALETTE = ['#a78bfa', '#2dd4bf', '#f472b6', '#22d3ee', '#a3e635', '#e0a38a'];
export function emailColor(email = '') {
  let hash = 0;
  for (const c of email.toLowerCase()) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export async function copyText(text, okMsg = 'Copiado!') {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg, 'success', 2000);
  } catch {
    toast('Não foi possível copiar.', 'error');
  }
}

// Valores monetários sempre em centavos (inteiros).
export const formatBRL = (centavos) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
