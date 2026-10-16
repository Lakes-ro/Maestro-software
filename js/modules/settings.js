import { supabase } from '../supabase.js';
import { h, toast, setTopbar, setBusy, confirmDialog } from '../ui.js';

export function render(root, ctx) {
  setTopbar('Configurações');

  const nova = h('input', { type: 'password', autocomplete: 'new-password', minlength: '8' });
  const conf = h('input', { type: 'password', autocomplete: 'new-password', minlength: '8' });
  const btn = h('button', { class: 'btn btn--primary', type: 'submit' }, 'Alterar senha');

  const form = h('form', { class: 'card settings__card', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (nova.value.length < 8) return toast('A senha precisa ter ao menos 8 caracteres.', 'error');
      if (nova.value !== conf.value) return toast('As senhas não conferem.', 'error');
      setBusy(btn, true);
      const { error } = await supabase.auth.updateUser({ password: nova.value });
      setBusy(btn, false);
      if (error) return toast(`Erro: ${error.message}`, 'error');
      form.reset();
      toast('Senha alterada.', 'success');
    } },
    h('h2', { class: 'modal__title' }, 'Senha'),
    h('label', { class: 'field' }, h('span', {}, 'Nova senha'), nova),
    h('label', { class: 'field' }, h('span', {}, 'Confirmar nova senha'), conf),
    btn);

  const sessoes = h('div', { class: 'card settings__card' },
    h('h2', { class: 'modal__title' }, 'Sessões'),
    h('p', { class: 'muted' }, 'Encerra o acesso do Maestro em todos os aparelhos, inclusive este.'),
    h('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
      if (await confirmDialog('Sair do Maestro em todos os dispositivos?', { title: 'Encerrar sessões', confirmLabel: 'Sair de tudo', danger: true })) {
        await supabase.auth.signOut({ scope: 'global' });
      }
    } }, 'Sair de todos os dispositivos'));

  root.replaceChildren(h('div', { class: 'settings' },
    h('div', { class: 'card settings__card' },
      h('h2', { class: 'modal__title' }, 'Conta'),
      h('p', { class: 'muted' }, ctx.user?.email ?? '')),
    form, sessoes));
}
