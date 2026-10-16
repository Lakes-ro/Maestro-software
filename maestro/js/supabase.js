import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// Preencha com a URL e a chave PÚBLICA (anon) do projeto Supabase do próprio Maestro.
export const SUPABASE_URL = 'https://vnptwivdzqwdacjvjjwo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucHR3aXZkenF3ZGFjanZqandvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTM0MDIsImV4cCI6MjEwNzY4OTQwMn0.wy9ERZjhxgxi4w0csOv6LYbliI8aUZnfDtxVq8Gs6Og';

export const isConfigured = !SUPABASE_URL.includes('SEU-PROJETO') && SUPABASE_ANON_KEY !== 'SUA_ANON_KEY';

// Trava de segurança: a service_role ignora a RLS e nunca pode estar no navegador.
try {
  const role = JSON.parse(atob(SUPABASE_ANON_KEY.split('.')[1])).role;
  if (role === 'service_role') throw new Error('service_role no front-end é proibido. Use a anon key.');
} catch (e) {
  if (String(e.message).includes('service_role')) throw e;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'maestro-auth' },
});

// Link do dashboard do Supabase de um projeto (campo url_dashboard ou derivado da url_supabase).
export function dashboardUrl(p) {
  if (p.url_dashboard) return p.url_dashboard;
  const ref = p.url_supabase?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}` : null;
}
