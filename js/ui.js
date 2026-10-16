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
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  log: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
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
  let downOnOverlay = false; // só fecha se o clique COMEÇOU e TERMINOU fora do modal
  const overlay = h('div', {
    class: 'modal-overlay',
    onmousedown: (e) => { downOnOverlay = e.target === overlay; },
    onclick: (e) => { if (e.target === overlay && downOnOverlay && dismissible) close(); },
  },
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

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/* ---------- Cor de destaque personalizável ---------- */
export const ACCENT_KEY = 'maestro-accent';
export function applyAccent(hex) {
  const st = document.documentElement.style;
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) {
    ['--accent', '--accent-soft', '--accent-bg', '--on-accent'].forEach((k) => st.removeProperty(k));
    return;
  }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (c) => Math.round(c + (255 - c) * 0.3);
  st.setProperty('--accent', hex);
  st.setProperty('--accent-soft', `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`);
  st.setProperty('--accent-bg', `rgba(${r}, ${g}, ${b}, .16)`);
  st.setProperty('--on-accent', (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0c0f15' : '#ffffff');
}
