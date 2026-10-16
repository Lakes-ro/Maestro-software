import { supabase } from '../supabase.js';
import { h, toast, setTopbar, setBusy, confirmDialog, applyAccent, ACCENT_KEY } from '../ui.js';

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

  const PADRAO = '#6c8cff';
  const salvo = (() => { try { return localStorage.getItem(ACCENT_KEY); } catch { return null; } })();
  const picker = h('input', { type: 'color', class: 'color-input', value: salvo || PADRAO, 'aria-label': 'Cor de destaque' });
  const hex = h('input', { type: 'text', class: 'hex-input', value: salvo || PADRAO, maxlength: '7', spellcheck: 'false', 'aria-label': 'Cor em hexadecimal' });
  const aplicar = (c) => {
    if (!/^#[0-9a-f]{6}$/i.test(c)) { hex.value = picker.value; return toast('Use o formato #RRGGBB.', 'warn'); }
    picker.value = c; hex.value = c; applyAccent(c);
    try { localStorage.setItem(ACCENT_KEY, c); } catch { /* ignora */ }
  };
  picker.addEventListener('input', () => aplicar(picker.value));
  hex.addEventListener('change', () => aplicar(hex.value.trim()));
  const aparencia = h('div', { class: 'card settings__card' },
    h('h2', { class: 'modal__title' }, 'Aparência'),
    h('p', { class: 'muted' }, 'Cor de destaque do Maestro (botões, item ativo e logo). Fica salva neste aparelho.'),
    h('div', { class: 'colorrow' }, picker, hex),
    h('button', { class: 'btn btn--sm', type: 'button', onclick: () => {
      picker.value = PADRAO; hex.value = PADRAO; applyAccent(null);
      try { localStorage.removeItem(ACCENT_KEY); } catch { /* ignora */ }
    } }, 'Restaurar padrão'));

  root.replaceChildren(h('div', { class: 'settings' },
    h('div', { class: 'card settings__card' },
      h('h2', { class: 'modal__title' }, 'Conta'),
      h('p', { class: 'muted' }, ctx.user?.email ?? '')),
    aparencia, form, sessoes));
}
