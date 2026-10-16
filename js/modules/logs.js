import { supabase } from '../supabase.js';
import { h, toast, setTopbar, withLoading, formatDateTime } from '../ui.js';

const LABEL = {
  projeto_criado: 'Projeto criado', projeto_editado: 'Projeto editado', projeto_removido: 'Projeto removido',
  token_gerado: 'Token de integração gerado', grupo_renomeado: 'Grupo renomeado', pagamento_manual: 'Pagamento registrado', pagamento_status: 'Pagamento atualizado',
};
let alive = false;

export async function render(root, ctx) {
  alive = true;
  setTopbar('Logs');
  const { data, error } = await withLoading(() =>
    supabase.from('logs_auditoria').select('*').order('criado_em', { ascending: false }).limit(200));
  if (!alive) return;
  if (error) return toast(`Erro ao carregar logs: ${error.message}`, 'error');
  if (!data.length) {
    root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, 'Sem registros'), h('p', { class: 'muted' }, 'As ações feitas no Maestro aparecem aqui.')));
    return;
  }
  root.replaceChildren(
    h('p', { class: 'muted', style: { marginBottom: '12px' } }, 'Últimas 200 ações. Os registros não podem ser alterados nem apagados.'),
    h('div', { class: 'plist' }, ...data.map((l) => h('div', { class: 'prow prow--wrap' },
      h('div', { class: 'prow__main' },
        h('span', { class: 'prow__name' }, LABEL[l.acao] ?? l.acao),
        h('span', { class: 'prow__meta' }, [l.detalhes?.nome ?? ctx.projetos.find((p) => p.id === l.projeto_id)?.nome, l.detalhes?.pedido].filter(Boolean).join(' · ') || '—')),
      h('span', { class: 'tag' }, formatDateTime(l.criado_em))))));
}

export const destroy = () => { alive = false; };
