import { supabase } from '../supabase.js';
import { h, icon, toast, modal, setTopbar, withLoading, formatBRL, formatDateTime } from '../ui.js';

const ST = {
  pago: ['badge badge--ok', 'Pago'], pendente: ['badge badge--warn', 'Pendente'],
  expirado: ['badge badge--danger', 'Expirado'], cancelado: ['badge badge--muted', 'Cancelado'],
};
const FILTROS = [['todos', 'Todos'], ['pago', 'Pagos'], ['pendente', 'Pendentes'], ['expirado', 'Expirados']];
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

let alive = false, root = null, ctx = null, items = [], mes = startOfMonth(new Date()), projeto = '', status = 'todos';

export async function render(container, context) {
  alive = true; root = container; ctx = context;
  mes = startOfMonth(new Date()); projeto = ''; status = 'todos';
  setTopbar('Pagamentos',
    h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: openForm }, icon('plus', 16), 'Novo pagamento'));
  await load();
}

export function destroy() { alive = false; root = null; items = []; }

async function load() {
  const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
  let q = supabase.from('pagamentos').select('*')
    .gte('criado_em', mes.toISOString()).lt('criado_em', fim.toISOString())
    .order('criado_em', { ascending: false }).limit(500);
  if (projeto) q = q.eq('projeto_id', projeto);
  const { data, error } = await withLoading(() => q);
  if (error) return toast(`Erro ao carregar pagamentos: ${error.message}`, 'error');
  items = data;
  paint();
}

const sum = (st) => items.filter((p) => p.status === st).reduce((s, p) => s + Number(p.valor_centavos), 0);
const nomeDe = (id) => ctx.projetos.find((p) => p.id === id);

async function marcarPago(p) {
  const { error } = await withLoading(() =>
    supabase.from('pagamentos').update({ status: 'pago', pago_em: new Date().toISOString() }).eq('id', p.id));
  if (error) return toast(`Erro: ${error.message}`, 'error');
  await supabase.from('logs_auditoria').insert({ acao: 'pagamento_status', projeto_id: p.projeto_id, detalhes: { nome: nomeDe(p.projeto_id)?.nome, pedido: p.pedido_ref, para: 'pago' } });
  toast('Marcado como pago.', 'success');
  await load();
}

function row(p) {
  const proj = nomeDe(p.projeto_id);
  const [cls, txt] = ST[p.status] ?? ST.pendente;
  const parcelas = p.parcelas > 1 ? ` ${p.parcelas}x` : '';
  return h('div', { class: 'prow prow--wrap' },
    h('span', { class: 'proj__dot', style: { '--c': proj?.cor || 'var(--text-3)' } }),
    h('div', { class: 'prow__main' },
      h('span', { class: 'prow__name' }, p.descricao ? `${p.pedido_ref} · ${p.descricao}` : p.pedido_ref),
      h('span', { class: 'prow__meta' }, `${proj?.nome ?? 'Projeto removido'} · ${p.forma ?? '—'}${parcelas} · ${formatDateTime(p.pago_em ?? p.criado_em)}`)),
    h('span', { class: cls }, txt),
    h('span', { class: 'prow__valor' }, formatBRL(Number(p.valor_centavos))),
    p.status === 'pendente'
      ? h('button', { class: 'btn btn--sm', type: 'button', onclick: () => marcarPago(p) }, 'Marcar pago')
      : null);
}

function paint() {
  if (!alive) return;
  const lista = items.filter((p) => status === 'todos' || p.status === status);

  const porProj = new Map();
  for (const p of items) if (p.status === 'pago') porProj.set(p.projeto_id, (porProj.get(p.projeto_id) ?? 0) + Number(p.valor_centavos));
  const max = Math.max(1, ...porProj.values());

  const mudaMes = (d) => { mes = new Date(mes.getFullYear(), mes.getMonth() + d, 1); load(); };
  const stat = (label, value, cls) => h('div', { class: 'stat' }, h('span', { class: 'stat__label' }, label), h('span', { class: `stat__value ${cls}` }, value));

  root.replaceChildren(
    h('div', { class: 'toolbar' },
      h('div', { class: 'monthnav' },
        h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Mês anterior', onclick: () => mudaMes(-1) }, icon('left')),
        h('span', { class: 'monthnav__label' }, mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })),
        h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Próximo mês', onclick: () => mudaMes(1) }, icon('right'))),
      h('select', { class: 'select', 'aria-label': 'Projeto', onchange: (e) => { projeto = e.target.value; load(); } },
        h('option', { value: '' }, 'Todos os projetos'),
        ...ctx.projetos.map((p) => h('option', { value: p.id, selected: p.id === projeto }, p.nome)))),
    h('div', { class: 'stats' },
      stat('Recebido', formatBRL(sum('pago')), 'is-ok'),
      stat('Pendente', formatBRL(sum('pendente')), 'is-warn'),
      stat('Expirados', items.filter((p) => p.status === 'expirado').length, 'is-danger')),
    porProj.size ? h('section', { class: 'nav-group' },
      h('h2', { class: 'nav-group__title' }, 'Recebido por projeto'),
      ...[...porProj].map(([id, v]) => h('div', { class: 'bar' },
        h('div', { class: 'bar__top' }, h('span', {}, nomeDe(id)?.nome ?? 'Projeto removido'), h('strong', {}, formatBRL(v))),
        h('div', { class: 'bar__track' }, h('div', { class: 'bar__fill', style: { width: `${(v / max) * 100}%`, '--c': nomeDe(id)?.cor || 'var(--accent)' } }))))) : null,
    h('div', { class: 'chips' }, ...FILTROS.map(([k, label]) =>
      h('button', { class: `chip${status === k ? ' chip--on' : ''}`, type: 'button', onclick: () => { status = k; paint(); } }, label))),
    lista.length
      ? h('div', { class: 'plist' }, ...lista.map(row))
      : h('div', { class: 'empty' }, h('h2', {}, 'Nenhum pagamento'), h('p', { class: 'muted' }, 'Nada neste período e filtro. Os sistemas enviam pagamentos pelo token de integração, ou use "Novo pagamento".')));
}

/* ---------- Registro manual ---------- */
function openForm() {
  if (!ctx.projetos.length) return toast('Cadastre um projeto antes.', 'warn');
  const f = {};
  const input = (key, label, ph, span) => {
    f[key] = h('input', { type: 'text', placeholder: ph, autocomplete: 'off' });
    return h('label', { class: span ? 'field span-2' : 'field' }, h('span', {}, label), f[key]);
  };
  const select = (key, label, opts) => {
    f[key] = h('select', {}, ...opts.map(([v, t]) => h('option', { value: v }, t)));
    return h('label', { class: 'field' }, h('span', {}, label), f[key]);
  };
  const body = h('div', { class: 'form-grid' },
    select('projeto_id', 'Projeto', ctx.projetos.map((p) => [p.id, p.nome])),
    input('pedido_ref', 'Referência do pedido', 'MKT-0231'),
    input('valor', 'Valor (R$)', '180,00'),
    select('status', 'Status', [['pago', 'Pago'], ['pendente', 'Pendente'], ['expirado', 'Expirado'], ['cancelado', 'Cancelado']]),
    select('forma', 'Forma', [['pix', 'Pix'], ['credito', 'Crédito'], ['outro', 'Outro']]),
    input('descricao', 'Descrição (opcional)', '', true));

  modal({
    title: 'Novo pagamento', body,
    actions: [{ label: 'Cancelar' }, {
      label: 'Salvar', variant: 'primary',
      onClick: async () => {
        const ref = f.pedido_ref.value.trim();
        const reais = parseFloat(f.valor.value.replace(/\./g, '').replace(',', '.'));
        if (!ref || !Number.isFinite(reais) || reais < 0) { toast('Informe a referência e um valor válido.', 'error'); return false; }
        const st = f.status.value;
        const { error } = await withLoading(() => supabase.from('pagamentos').insert({
          projeto_id: f.projeto_id.value, pedido_ref: ref, valor_centavos: Math.round(reais * 100), status: st,
          forma: f.forma.value, descricao: f.descricao.value.trim() || null, pago_em: st === 'pago' ? new Date().toISOString() : null,
        }));
        if (error) { toast(error.code === '23505' ? 'Já existe um pagamento com essa referência neste projeto.' : `Erro: ${error.message}`, 'error'); return false; }
        await supabase.from('logs_auditoria').insert({ acao: 'pagamento_manual', projeto_id: f.projeto_id.value, detalhes: { nome: nomeDe(f.projeto_id.value)?.nome, pedido: ref } });
        toast('Pagamento registrado.', 'success');
        await load();
      },
    }],
  });
  f.pedido_ref.focus();
}
