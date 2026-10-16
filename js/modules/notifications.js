import { supabase } from '../supabase.js';
import { h, toast, setTopbar, withLoading, formatDateTime } from '../ui.js';

const GRAV = { urgente: ['badge badge--danger', 'Urgente'], atencao: ['badge badge--warn', 'Atenção'], info: ['badge badge--muted', 'Info'] };
const FILTROS = [['aberta', 'Abertas'], ['lida', 'Lidas'], ['silenciada', 'Silenciadas'], ['resolvida', 'Resolvidas'], ['todas', 'Todas']];
let alive = false, root = null, ctx = null, items = [], filtro = 'aberta';

export async function render(container, context) {
  alive = true; root = container; ctx = context; filtro = 'aberta';
  setTopbar('Notificações');
  await load();
}

export function destroy() { alive = false; root = null; items = []; }

async function load() {
  const { data, error } = await withLoading(() =>
    supabase.from('notificacoes').select('*').order('criado_em', { ascending: false }).limit(300));
  if (error) return toast(`Erro ao carregar: ${error.message}`, 'error');
  items = data;
  paint();
}

async function setStatus(n, status) {
  const { error } = await withLoading(() => supabase.from('notificacoes').update({ status }).eq('id', n.id));
  if (error) return toast(`Erro: ${error.message}`, 'error');
  await load();
  await ctx.refreshAlerts();
}

function card(n) {
  const p = ctx.projetos.find((x) => x.id === n.projeto_id);
  const [cls, txt] = GRAV[n.gravidade] ?? GRAV.info;
  const btn = (label, status, primary = false) =>
    h('button', { class: `btn btn--sm${primary ? ' btn--primary' : ''}`, type: 'button', onclick: () => setStatus(n, status) }, label);
  return h('div', { class: 'prow prow--wrap' },
    h('span', { class: cls }, txt),
    h('div', { class: 'prow__main' },
      h('span', { class: 'prow__name' }, `${n.contagem} · ${n.titulo}`),
      h('span', { class: 'prow__meta' }, `${p?.nome ?? 'Projeto removido'} · ${formatDateTime(n.atualizado_em)}`)),
    h('div', { class: 'prow__actions prow__actions--text' },
      p?.url_app && p.status !== 'planejado' ? h('a', { class: 'btn btn--sm', href: `#/p/${p.id}` }, 'Abrir sistema') : null,
      n.status === 'aberta' ? [btn('Lida', 'lida'), btn('Silenciar', 'silenciada'), btn('Resolver', 'resolvida', true)] : btn('Reabrir', 'aberta')));
}

function paint() {
  if (!alive) return;
  const lista = items.filter((n) => filtro === 'todas' || n.status === filtro);
  root.replaceChildren(
    h('div', { class: 'chips' }, ...FILTROS.map(([k, label]) => {
      const total = k === 'todas' ? items.length : items.filter((n) => n.status === k).length;
      return h('button', { class: `chip${filtro === k ? ' chip--on' : ''}`, type: 'button', onclick: () => { filtro = k; paint(); } }, `${label} (${total})`);
    })),
    lista.length
      ? h('div', { class: 'plist' }, ...lista.map(card))
      : h('div', { class: 'empty' }, h('h2', {}, 'Nada por aqui'), h('p', { class: 'muted' }, 'Nenhuma notificação neste filtro.')));
}
