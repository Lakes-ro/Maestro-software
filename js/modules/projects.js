import { supabase, SUPABASE_URL } from '../supabase.js';
import { h, icon, toast, modal, confirmDialog, withLoading, setTopbar, emailColor, copyText } from '../ui.js';

const COLORS = ['#a78bfa', '#2dd4bf', '#f472b6', '#22d3ee', '#a3e635', '#e0a38a', '#94a3b8'];
const STATUS = [['ativo', 'Ativo'], ['planejado', 'Planejado (em breve)'], ['arquivado', 'Arquivado']];
const NIVEL = [['atalho', 'Atalho (só abre o link)'], ['monitoramento', 'Monitoramento (status e alertas)'], ['completo', 'Completo (painel no Maestro)']];
const NIVEL_LABEL = { atalho: 'Atalho', monitoramento: 'Monitoramento', completo: 'Completo' };
const STATUS_BADGE = { ativo: ['badge badge--ok', 'Ativo'], planejado: ['badge badge--warn', 'Em breve'], arquivado: ['badge badge--muted', 'Arquivado'] };

let root = null, ctx = null, items = [], dragId = null;

export async function render(container, context) {
  root = container;
  ctx = context;
  setTopbar('Projetos',
    h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => openForm() }, icon('plus', 16), 'Novo projeto'));
  await load();
}

export function destroy() { root = null; items = []; dragId = null; }

/* ---------- Dados ---------- */
async function load() {
  const { data, error } = await withLoading(() => supabase.from('projetos').select('*').order('ordem'));
  if (error) return toast(`Erro ao carregar projetos: ${error.message}`, 'error');
  items = data;
  paint();
}

const log = async (acao, p) => {
  await supabase.from('logs_auditoria').insert({ acao, projeto_id: p.id ?? null, detalhes: { nome: p.nome } });
};

function groups() {
  const m = new Map();
  for (const p of items) {
    const k = p.grupo || '';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  }
  return m;
}

/* ---------- Lista ---------- */
const bolt = (email) => h('span', { class: 'bolt', style: { color: emailColor(email) } }, icon('zap', 14));
const iconBtn = (name, label, onclick, disabled = false) =>
  h('button', { class: 'btn-icon', type: 'button', 'aria-label': label, title: label, onclick, disabled }, icon(name, 16));
const sameGroup = (id, key) => (items.find((x) => x.id === id)?.grupo || '') === key;

function row(p, i, arr, key) {
  const [badgeClass, badgeText] = STATUS_BADGE[p.status] ?? STATUS_BADGE.ativo;
  const el = h('div', {
    class: 'prow', draggable: 'true',
    ondragstart: (e) => {
      dragId = p.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', p.id);
      el.classList.add('dragging');
    },
    ondragend: () => {
      dragId = null;
      root?.querySelectorAll('.dragging, .over').forEach((x) => x.classList.remove('dragging', 'over'));
    },
    ondragover: (e) => {
      if (dragId && dragId !== p.id && sameGroup(dragId, key)) { e.preventDefault(); el.classList.add('over'); }
    },
    ondragleave: () => el.classList.remove('over'),
    ondrop: (e) => {
      e.preventDefault();
      if (dragId && dragId !== p.id) reorder(dragId, p.id, key);
    },
  },
    h('span', { class: 'prow__grip', title: 'Arraste para reordenar' }, icon('grip', 16)),
    h('span', { class: 'proj__dot', style: { '--c': p.cor || 'var(--text-3)' } }),
    h('div', { class: 'prow__main' },
      h('span', { class: 'prow__name' }, p.nome),
      h('span', { class: 'prow__meta' }, p.email_supabase ? [bolt(p.email_supabase), p.email_supabase] : 'Sem e-mail Supabase')),
    h('span', { class: badgeClass }, badgeText),
    h('span', { class: 'badge badge--muted' }, NIVEL_LABEL[p.nivel] ?? p.nivel),
    h('div', { class: 'prow__actions' },
      iconBtn('up', 'Subir', () => move(p.id, -1, key), i === 0),
      iconBtn('down', 'Descer', () => move(p.id, 1, key), i === arr.length - 1),
      iconBtn('key', 'Token de integração', () => gerarToken(p)),
      iconBtn('edit', 'Editar', () => openForm(p)),
      iconBtn('trash', 'Remover', () => remove(p))));
  return el;
}

function paint() {
  if (!root) return;
  if (!items.length) {
    root.replaceChildren(h('div', { class: 'empty' },
      h('h2', {}, 'Nenhum projeto ainda'),
      h('p', { class: 'muted' }, 'Cadastre o primeiro para ele aparecer na sidebar.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openForm() }, icon('plus', 16), 'Novo projeto')));
    return;
  }
  const all = [...groups()];
  root.replaceChildren(...all.map(([key, arr], gi) =>
    h('section', { class: 'nav-group' },
      h('div', { class: 'group-head' },
        h('h2', { class: 'nav-group__title' }, key || 'Sem grupo'),
        h('div', { class: 'prow__actions' },
          iconBtn('up', 'Subir grupo', () => moveGroup(key, -1), gi === 0),
          iconBtn('down', 'Descer grupo', () => moveGroup(key, 1), gi === all.length - 1),
          iconBtn('edit', 'Renomear grupo', () => renameGroup(key)))),
      h('div', { class: 'plist' }, ...arr.map((p, i) => row(p, i, arr, key))))));
}

/* ---------- Reordenar ---------- */
function move(id, dir, key) {
  const list = groups().get(key);
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  list.splice(j, 0, list.splice(i, 1)[0]);
  return saveOrder(list, key);
}

function reorder(fromId, toId, key) {
  const list = groups().get(key);
  const from = list.findIndex((x) => x.id === fromId), to = list.findIndex((x) => x.id === toId);
  list.splice(to, 0, list.splice(from, 1)[0]);
  return saveOrder(list, key);
}

function saveOrder(list, key) {
  return persistFlat([...groups()].flatMap(([k, arr]) => (k === key ? list : arr)));
}

function moveGroup(key, dir) {
  const all = [...groups()];
  const i = all.findIndex(([k]) => k === key), j = i + dir;
  if (j < 0 || j >= all.length) return;
  all.splice(j, 0, all.splice(i, 1)[0]);
  return persistFlat(all.flatMap(([, arr]) => arr));
}

function renameGroup(key) {
  const input = h('input', { type: 'text', value: key, placeholder: 'Nome do grupo', autocomplete: 'off' });
  modal({
    title: key ? 'Renomear grupo' : 'Dar nome ao grupo',
    body: h('label', { class: 'field' }, h('span', {}, key ? `Novo nome para "${key}"` : 'Projetos sem grupo'), input),
    dismissible: false,
    actions: [{ label: 'Cancelar' }, {
      label: 'Salvar', variant: 'primary',
      onClick: async () => {
        const nome = input.value.trim();
        if (nome === key) return;
        const q = supabase.from('projetos').update({ grupo: nome || null });
        const { error } = await withLoading(() => (key ? q.eq('grupo', key) : q.is('grupo', null)));
        if (error) { toast(`Erro: ${error.message}`, 'error'); return false; }
        await log('grupo_renomeado', { nome: `${key || 'Sem grupo'} → ${nome || 'Sem grupo'}` });
        toast('Grupo atualizado.', 'success');
        await load();
        await ctx.reload();
      },
    }],
  });
  input.focus();
  input.select();
}

async function persistFlat(flat) {
  const updates = flat.map((p, i) => ({ id: p.id, ordem: i, mudou: p.ordem !== i })).filter((u) => u.mudou);
  items = flat.map((p, i) => ({ ...p, ordem: i }));
  paint();
  const res = await Promise.all(updates.map((u) => supabase.from('projetos').update({ ordem: u.ordem }).eq('id', u.id)));
  const fail = res.find((r) => r.error);
  if (fail) { toast(`Erro ao reordenar: ${fail.error.message}`, 'error'); return load(); }
  await ctx.reload();
}

/* ---------- Validação e salvamento ---------- */
function validate(d) {
  const isUrl = (s) => { try { return ['http:', 'https:'].includes(new URL(s).protocol); } catch { return false; } };
  if (!d.nome) return 'Informe o nome do projeto.';
  if (d.url_app && !isUrl(d.url_app)) return 'URL do sistema inválida.';
  if (d.url_supabase && !/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(d.url_supabase)) return 'A URL do Supabase deve ser https://<ref>.supabase.co';
  if (d.url_dashboard && !isUrl(d.url_dashboard)) return 'Link do dashboard inválido.';
  if (d.email_supabase && !/^\S+@\S+\.\S+$/.test(d.email_supabase)) return 'E-mail inválido.';
  if (d.chave_publica) {
    if (d.chave_publica.startsWith('sb_secret_')) return 'Essa é uma chave secreta. Use apenas a anon/publishable.';
    try {
      if (JSON.parse(atob(d.chave_publica.split('.')[1])).role === 'service_role') return 'Essa é a chave service_role. Use apenas a anon.';
    } catch { /* chave publishable não é JWT: ok */ }
  }
  return null;
}

async function save(p, d) {
  const err = validate(d);
  if (err) { toast(err, 'error'); return false; }
  const nextOrder = items.length ? Math.max(...items.map((x) => x.ordem)) + 1 : 0;
  const q = p
    ? supabase.from('projetos').update(d).eq('id', p.id)
    : supabase.from('projetos').insert({ ...d, ordem: nextOrder });
  const { data, error } = await withLoading(() => q.select('id').single());
  if (error) { toast(`Erro ao salvar: ${error.message}`, 'error'); return false; }
  await log(p ? 'projeto_editado' : 'projeto_criado', { id: data.id, nome: d.nome });
  toast('Projeto salvo.', 'success');
  await load();
  await ctx.reload();
}

async function remove(p) {
  const ok = await confirmDialog(
    `Remover "${p.nome}" do Maestro? Só o cadastro é apagado, o sistema em si não é afetado. Para apenas esconder, use o status Arquivado.`,
    { title: 'Remover projeto', confirmLabel: 'Remover', danger: true });
  if (!ok) return;
  await log('projeto_removido', p);
  const { error } = await withLoading(() => supabase.from('projetos').delete().eq('id', p.id));
  if (error) return toast(`Erro ao remover: ${error.message}`, 'error');
  toast('Projeto removido.', 'success');
  await load();
  await ctx.reload();
}

/* ---------- Formulário ---------- */
function openForm(p = null, defaults = {}) {
  const v = p ?? defaults;
  let cor = v.cor || COLORS[0];
  let dirty = false;
  const f = {};

  const text = (key, label, { span, ph, type = 'text', list } = {}) => {
    f[key] = h('input', { type, value: v[key] ?? '', placeholder: ph, list, autocomplete: 'off', spellcheck: 'false' });
    return h('label', { class: span ? 'field span-2' : 'field' }, h('span', {}, label), f[key]);
  };
  const select = (key, label, opts) => {
    f[key] = h('select', {}, ...opts.map(([val, txt]) => h('option', { value: val, selected: (v[key] ?? opts[0][0]) === val }, txt)));
    return h('label', { class: 'field' }, h('span', {}, label), f[key]);
  };

  const hex = h('input', { type: 'text', class: 'hex-input', value: cor, maxlength: '7', spellcheck: 'false', 'aria-label': 'Cor em hexadecimal' });
  const custom = h('input', { type: 'color', class: 'color-input', value: cor, title: 'Escolher qualquer cor (RGB)', 'aria-label': 'Escolher cor personalizada' });
  const swatches = COLORS.map((c) => {
    const b = h('button', { type: 'button', class: 'swatch', style: { '--c': c }, 'aria-label': `Cor ${c}`, onclick: () => setCor(c) });
    b.dataset.c = c;
    return b;
  });
  function setCor(c) {
    cor = c.toLowerCase();
    custom.value = cor;
    hex.value = cor;
    swatches.forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.c === cor)));
    dirty = true;
  }
  custom.addEventListener('input', () => setCor(custom.value));
  hex.addEventListener('change', () => {
    const c = hex.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) setCor(c);
    else { hex.value = cor; toast('Use o formato #RRGGBB.', 'warn'); }
  });
  setCor(cor);
  dirty = false;
  const chk = h('input', { type: 'checkbox', checked: !!v.modulo_pagamentos });
  const grupos = [...new Set(items.map((x) => x.grupo).filter(Boolean))];

  const body = h('div', { class: 'form-grid' },
    text('nome', 'Nome do projeto', { ph: 'Ex.: Marketplace' }),
    text('grupo', 'Grupo', { ph: 'Ex.: Negócios', list: 'grupos-list' }),
    h('datalist', { id: 'grupos-list' }, ...grupos.map((g) => h('option', { value: g }))),
    h('div', { class: 'field span-2' }, h('span', {}, 'Cor'), h('div', { class: 'swatches' }, ...swatches, custom, hex)),
    select('status', 'Status', STATUS),
    select('nivel', 'Nível de integração', NIVEL),
    text('url_app', 'URL do sistema (abre dentro do Maestro)', { span: true, ph: 'https://...' }),
    text('email_supabase', 'E-mail da conta Supabase', { span: true, ph: 'conta@exemplo.com' }),
    text('url_supabase', 'URL do projeto Supabase', { span: true, ph: 'https://xxxx.supabase.co' }),
    text('chave_publica', 'Chave pública (anon / publishable)', { span: true, type: 'password' }),
    text('url_dashboard', 'Link do dashboard (opcional; se vazio, é gerado pela URL do Supabase)', { span: true }),
    h('label', { class: 'check span-2' }, chk, h('span', {}, 'Ativar módulo de pagamentos (InfinitePay)')));

  body.addEventListener('input', () => { dirty = true; });

  const collect = () => {
    const val = (k) => f[k].value.trim() || null;
    return {
      nome: f.nome.value.trim(), grupo: val('grupo'), cor,
      status: f.status.value, nivel: f.nivel.value,
      url_app: val('url_app'), url_supabase: val('url_supabase')?.replace(/\/+$/, '') ?? null,
      chave_publica: val('chave_publica'), url_dashboard: val('url_dashboard'),
      email_supabase: val('email_supabase')?.toLowerCase() ?? null,
      modulo_pagamentos: chk.checked,
    };
  };

  const actions = [{
    label: 'Cancelar',
    onClick: async () => !dirty || await confirmDialog('Descartar o que você preencheu?', { title: 'Descartar alterações', confirmLabel: 'Descartar', danger: true }),
  }];
  if (!p) {
    actions.push({
      label: 'Salvar e criar outro',
      onClick: async () => {
        const d = collect();
        if ((await save(null, d)) === false) return false;
        // mantém grupo, cor, status, nível, e-mail e pagamentos para agilizar o próximo cadastro
        setTimeout(() => openForm(null, { grupo: d.grupo, cor: d.cor, status: d.status, nivel: d.nivel, email_supabase: d.email_supabase, modulo_pagamentos: d.modulo_pagamentos }), 0);
      },
    });
  }
  actions.push({ label: 'Salvar', variant: 'primary', onClick: () => save(p, collect()) });

  // dismissible:false → clicar fora do formulário não descarta o que foi digitado
  modal({ title: p ? 'Editar projeto' : 'Novo projeto', body, actions, dismissible: false });
  f.nome.focus();
}

/* ---------- Token de integração (ingest) ---------- */
const sha256 = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

async function gerarToken(p) {
  const ok = await confirmDialog(
    p.ingest_token_hash ? 'Este projeto já tem um token. Gerar outro invalida o anterior. Continuar?' : 'Gerar o token de integração deste projeto?',
    { title: 'Token de integração', confirmLabel: 'Gerar' });
  if (!ok) return;
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const { error } = await withLoading(async () =>
    supabase.from('projetos').update({ ingest_token_hash: await sha256(token) }).eq('id', p.id));
  if (error) return toast(`Erro ao gerar token: ${error.message}`, 'error');
  await log('token_gerado', p);
  await load();
  const exemplo = `// No SERVIDOR do projeto (Edge Function / backend). Nunca no front-end.
await fetch('${SUPABASE_URL}/functions/v1/ingest', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-maestro-token': MAESTRO_TOKEN },
  body: JSON.stringify({
    projeto_id: '${p.id}',
    notificacoes: [{ tipo: 'sem_lancamento', titulo: 'Usuários sem lançamentos', contagem: 12, gravidade: 'atencao' }],
    pagamentos: [{ pedido_ref: 'MKT-0231', valor_centavos: 18000, status: 'pago', forma: 'pix' }],
  }),
});`;
  const sql = scriptSql(p, token);
  modal({
    title: 'Token de integração',
    body: h('div', { class: 'token-box' },
      h('p', { class: 'muted' }, 'Copie agora: o token não será mostrado de novo.'),
      h('strong', {}, 'Opção 1: script SQL (mais rápido)'),
      h('p', { class: 'muted' }, 'Cole no SQL Editor do Supabase deste projeto e clique em Run. Ele guarda o token no Vault, cria o envio ao Maestro e agenda a sincronização diária.'),
      h('pre', { class: 'code' }, sql),
      h('details', {}, h('summary', {}, 'Opção 2: chamar pelo código do servidor'), h('pre', { class: 'code' }, exemplo)),
      h('code', { class: 'code' }, token)),
    actions: [
      { label: 'Copiar script SQL', variant: 'primary', onClick: () => { copyText(sql, 'Script copiado!'); return false; } },
      { label: 'Copiar token', onClick: () => { copyText(token); return false; } },
      { label: 'Fechar' },
    ],
    dismissible: false,
  });
}

// Script SQL pronto para colar no SQL Editor do projeto conectado.
// A única parte que muda de projeto para projeto é maestro.sync() (as consultas dos alertas).
function scriptSql(p, token) {
  const nome = p.nome.replace(/[\r\n]+/g, ' ');
  const url = `${SUPABASE_URL}/functions/v1/ingest`;
  const segredo = (chave, valor) => `  if exists (select 1 from vault.secrets where name = '${chave}') then
    perform vault.update_secret((select id from vault.secrets where name = '${chave}'), '${valor}', '${chave}');
  else
    perform vault.create_secret('${valor}', '${chave}');
  end if;`;

  return `-- Maestro: conexão do projeto "${nome}"
-- Cole no SQL Editor do Supabase DESTE projeto e clique em Run.
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;
create schema if not exists maestro;

-- 1) Guarda o token e o ID no Vault
do $$
begin
${segredo('maestro_token', token)}
${segredo('maestro_projeto_id', p.id)}
end $$;

-- 2) Envio ao Maestro
create or replace function maestro.enviar(p_payload jsonb)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_token text; v_id text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'maestro_token';
  select decrypted_secret into v_id from vault.decrypted_secrets where name = 'maestro_projeto_id';
  return net.http_post(
    url := '${url}',
    headers := jsonb_build_object('content-type', 'application/json', 'x-maestro-token', v_token),
    body := jsonb_build_object('projeto_id', v_id) || p_payload
  );
end $$;
revoke all on function maestro.enviar(jsonb) from public;

-- 3) Alertas: a ÚNICA parte que muda de projeto para projeto
create or replace function maestro.sync()
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  -- resolve o aviso de teste da conexão
  perform maestro.enviar(jsonb_build_object('notificacoes', jsonb_build_array(
    jsonb_build_object('tipo', 'conexao', 'titulo', 'Conexão com o Maestro ativa', 'contagem', 0))));

  -- EXEMPLO (tire os "--" e ajuste a tabela e a condição):
  -- select count(*) into v_n from public.produtos where denunciado;
  -- perform maestro.enviar(jsonb_build_object('notificacoes', jsonb_build_array(
  --   jsonb_build_object('tipo', 'produto_denunciado', 'titulo', 'Produtos denunciados', 'contagem', v_n, 'gravidade', 'atencao'))));
end $$;
revoke all on function maestro.sync() from public;

-- 4) Agenda todos os dias às 8h (Brasília)
select cron.schedule('maestro-sync', '0 11 * * *', 'select maestro.sync()');

-- 5) Teste agora: deve aparecer "Conexão com o Maestro ativa" nas Notificações
select maestro.enviar(jsonb_build_object('notificacoes', jsonb_build_array(
  jsonb_build_object('tipo', 'conexao', 'titulo', 'Conexão com o Maestro ativa', 'contagem', 1, 'gravidade', 'info'))));

-- Para conferir a resposta: select status_code, left(content::text, 200) from net._http_response order by created desc limit 1;
`;
}
