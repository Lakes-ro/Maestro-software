import { supabase } from '../supabase.js';
import { h, icon, toast, setTopbar, formatBRL, emailColor } from '../ui.js';

const GRAV = { urgente: ['badge badge--danger', 'Urgente'], atencao: ['badge badge--warn', 'Atenção'], info: ['badge badge--muted', 'Info'] };
let alive = false;

export async function render(root, ctx) {
  alive = true;
  setTopbar('Início');

  if (!ctx.projetos.length) {
    root.replaceChildren(h('div', { class: 'empty' },
      h('h2', {}, 'Bem-vindo ao Maestro'),
      h('p', { class: 'muted' }, 'Cadastre seu primeiro projeto para ele aparecer aqui e na sidebar.'),
      h('a', { class: 'btn btn--primary', href: '#/projetos' }, icon('plus', 16), 'Cadastrar projeto')));
    return;
  }

  const ini = new Date();
  ini.setDate(1); ini.setHours(0, 0, 0, 0);
  const [al, pg] = await Promise.all([
    supabase.from('notificacoes').select('*').eq('status', 'aberta').order('criado_em', { ascending: false }),
    supabase.from('pagamentos').select('valor_centavos, status').gte('criado_em', ini.toISOString()),
  ]);
  if (!alive) return;
  if (al.error || pg.error) return toast('Erro ao carregar o painel.', 'error');

  const sum = (st) => pg.data.filter((p) => p.status === st).reduce((s, p) => s + Number(p.valor_centavos), 0);
  const totalAlertas = al.data.reduce((s, n) => s + n.contagem, 0);
  const nomeDe = (id) => ctx.projetos.find((p) => p.id === id)?.nome ?? 'Projeto removido';
  const stat = (label, value, cls = '') =>
    h('div', { class: 'stat' }, h('span', { class: 'stat__label' }, label), h('span', { class: `stat__value ${cls}` }, value));

  const groups = new Map();
  for (const p of ctx.projetos) {
    const k = p.grupo || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }

  const card = (p) => {
    const soon = p.status === 'planejado' || !p.url_app;
    const n = ctx.alertas.get(p.id);
    const first = al.data.find((x) => x.projeto_id === p.id);
    const kids = [
      h('div', { class: 'pcard__top' },
        h('span', { class: 'proj__dot', style: { '--c': p.cor || 'var(--text-3)' } }),
        h('span', { class: 'pcard__name' }, p.nome),
        n ? h('span', { class: 'nb' }, n) : null),
      h('span', { class: 'prow__meta' },
        p.email_supabase ? [h('span', { class: 'bolt', style: { color: emailColor(p.email_supabase) } }, icon('zap', 14)), p.email_supabase] : 'Sem e-mail Supabase'),
      h('span', { class: 'pcard__sub' }, first ? `${first.contagem} · ${first.titulo}` : soon ? 'Em breve' : 'Tudo em dia'),
    ];
    return soon ? h('div', { class: 'pcard pcard--soon' }, ...kids) : h('a', { class: 'pcard', href: `#/p/${p.id}` }, ...kids);
  };

  root.replaceChildren(
    h('div', { class: 'stats' },
      stat('Projetos ativos', ctx.projetos.filter((p) => p.status === 'ativo').length),
      stat('Alertas abertos', totalAlertas, totalAlertas ? 'is-danger' : ''),
      stat('Recebido no mês', formatBRL(sum('pago')), 'is-ok'),
      stat('Pendente no mês', formatBRL(sum('pendente')), 'is-warn')),
    ...[...groups].map(([g, arr]) => h('section', { class: 'nav-group' },
      h('h2', { class: 'nav-group__title' }, g || 'Sem grupo'),
      h('div', { class: 'pgrid' }, ...arr.map(card)))),
    h('section', { class: 'nav-group' },
      h('h2', { class: 'nav-group__title' }, 'Alertas recentes'),
      al.data.length
        ? h('div', { class: 'plist' }, ...al.data.slice(0, 6).map((n) => {
            const [cls, txt] = GRAV[n.gravidade] ?? GRAV.info;
            return h('a', { class: 'prow prow--link', href: '#/notificacoes' },
              h('span', { class: cls }, txt),
              h('div', { class: 'prow__main' }, h('span', { class: 'prow__name' }, n.titulo), h('span', { class: 'prow__meta' }, nomeDe(n.projeto_id))),
              h('span', { class: 'nb' }, n.contagem));
          }))
        : h('p', { class: 'muted' }, 'Nenhum alerta aberto.')));
}

export const destroy = () => { alive = false; };
