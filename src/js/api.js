import { SUPA_URL, SUPA_KEY } from './config.js';
import { state } from './state.js';
import { logout, showLoginError } from './auth.js';

export const api = async (path, opts = {}) => {
  const { headers: extraHeaders, prefer, ...restOpts } = opts;
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${state.sessionToken || SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': prefer || 'return=representation',
      ...extraHeaders,
    },
    ...restOpts,
  });
  if (!r.ok) {
    const t = await r.text();
    try {
      const err = JSON.parse(t);
      if (err.code === 'PGRST303' || err.message === 'JWT expired' || (err.message || '').includes('JWT')) {
        logout();
        showLoginError('Sua sessão expirou. Faça login novamente.');
        throw new Error('Sessão expirada');
      }
    } catch (parseErr) {
      if (parseErr.message === 'Sessão expirada') throw parseErr;
    }
    throw new Error(t);
  }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
