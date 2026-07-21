(() => {
  'use strict';

  const cfg = window.CSP_CM_CONFIG;
  if (!cfg || !window.supabase) {
    throw new Error('Supabase configuration is missing.');
  }

  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const routeNames = new Set(['login', 'dashboard', 'venues']);
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length && routeNames.has(parts[parts.length - 1])) parts.pop();
  const rootPath = '/' + (parts.length ? parts.join('/') + '/' : '');
  const route = (name = '') => rootPath + String(name).replace(/^\/+/, '');

  const api = {
    db,
    route,

    async session() {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async requireAccess() {
      const session = await api.session();

      if (!session) {
        location.replace(
          route('login/?returnTo=') +
          encodeURIComponent(location.pathname + location.search)
        );
        throw new Error('LOGIN_REQUIRED');
      }

      const { data, error } = await db.rpc('club_manager_bootstrap');
      if (error) throw error;

      if (!data?.allowed) {
        document.body.innerHTML = `
          <main class="access-denied">
            <section>
              <div class="brand-mark">C</div>
              <h1>Club Manager vyžaduje Ultra</h1>
              <p>Tento modul je dostupný pre program Ultra, Elite a administrátora.</p>
              <a href="https://connectsportspro.com/premium">Zobraziť programy</a>
              <button id="logoutDenied">Odhlásiť sa</button>
            </section>
          </main>`;

        document.getElementById('logoutDenied').addEventListener('click', async () => {
          await db.auth.signOut();
          location.replace(route('login/'));
        });

        throw new Error('PLAN_REQUIRED');
      }

      return data;
    },

    money(value) {
      return `${Number(value || 0).toFixed(2)} €`;
    },

    time(seconds) {
      seconds = Math.max(0, Math.floor(Number(seconds || 0)));
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;

      return h > 0
        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    currentSeconds(session) {
      const base = Number(session.accumulated_seconds || 0);
      if (session.status !== 'running' || !session.started_at) return base;

      return base + Math.max(
        0,
        Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      );
    },

    async logout() {
      await db.auth.signOut();
      location.replace(route('login/'));
    }
  };

  window.CSPClubManager = api;
})();
