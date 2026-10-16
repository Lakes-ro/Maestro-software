import { supabase, isConfigured } from './supabase.js';
import { toast, setBusy, loading } from './ui.js';

let user = null;
export const getUser = () => user;
export const logout = () => supabase.auth.signOut();

async function isAdmin(uid) {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
  return !error && !!data;
}

export function initAuth({ onSignedIn, onSignedOut }) {
  const $ = (id) => document.getElementById(id);
  const form = $('login-form'), errorBox = $('login-error');
  const show = (signedIn) => { $('login-view').hidden = signedIn; $('app').hidden = !signedIn; };
  const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = !msg; };

  async function handle(session) {
    if (!session) {
      user = null;
      show(false);
      await onSignedOut?.();
      return;
    }
    if (user?.id === session.user.id) return; // ignora refresh de token
    if (!(await isAdmin(session.user.id))) {
      await supabase.auth.signOut();
      showError('Esta conta não tem acesso de administrador.');
      return;
    }
    user = session.user;
    show(true);
    await onSignedIn?.(user);
  }

  if (!isConfigured) {
    loading(false);
    show(false);
    showError('Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/supabase.js.');
    return;
  }

  // setTimeout evita deadlock ao chamar o Supabase dentro do callback.
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(async () => { await handle(session); loading(false); }, 0);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const email = $('login-email').value.trim(), password = $('login-pass').value;
    if (!email || !password) return showError('Informe e-mail e senha.');
    showError('');
    setBusy(btn, true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(btn, false);
    if (error) { showError('E-mail ou senha inválidos.'); toast('Falha no login.', 'error'); }
    else form.reset();
  });
}
