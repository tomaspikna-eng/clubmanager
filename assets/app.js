(() => {
'use strict';
const cfg=window.CSP_CM_CONFIG;
if(!cfg||!window.supabase) throw new Error('Supabase configuration is missing.');
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const parts=location.pathname.split('/').filter(Boolean);
const routeNames=new Set(['login','dashboard','venues','reservations']);
if(parts.length&&routeNames.has(parts.at(-1)))parts.pop();
const rootPath='/'+(parts.length?parts.join('/')+'/':'');
const route=(name='')=>rootPath+String(name).replace(/^\/+/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const api={
 db,route,esc,
 async session(){const {data,error}=await db.auth.getSession();if(error)throw error;return data.session;},
 async requireAccess(){
   const session=await api.session();
   if(!session){location.replace(route('login/?returnTo=')+encodeURIComponent(location.pathname+location.search));throw new Error('LOGIN_REQUIRED');}
   const {data,error}=await db.rpc('club_manager_bootstrap');if(error)throw error;
   if(!data?.allowed){
     document.body.innerHTML=`<main class="access-denied"><section><div class="brand-mark">C</div><h1>Club Manager nemáte aktivovaný</h1><p>Prístup určuje oprávnenie účtu. Technické označenia Ultra, Elite a Admin nie sú súčasťou používateľského obsahu.</p><a href="https://connectsportspro.com/">Späť na CONNECT SPORTS PRO</a><button id="logoutDenied">Odhlásiť sa</button></section></main>`;
     document.getElementById('logoutDenied').onclick=async()=>{await db.auth.signOut();location.replace(route('login/'));};
     throw new Error('PLAN_REQUIRED');
   }
   return data;
 },
 money:v=>`${Number(v||0).toFixed(2)} €`,
 time(seconds){seconds=Math.max(0,Math.floor(Number(seconds||0)));const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;},
 currentSeconds(s){const base=Number(s.accumulated_seconds||0);return s.status==='running'&&s.started_at?base+Math.max(0,Math.floor((Date.now()-new Date(s.started_at).getTime())/1000)):base;},
 scoreboardSport(st){const v=String(st?.sport||'').toLowerCase();return v.includes('dart')||v.includes('šíp')?'darts':v.includes('billiard')||v.includes('biliard')||v.includes('pool')?'billiard':'other';},
 scoreboardUrl(st){const u=new URL('https://connectsportspro.com/scoreboard/');u.searchParams.set('station',st.name);u.searchParams.set('station_id',st.id);u.searchParams.set('sport',api.scoreboardSport(st));u.searchParams.set('lock',st.lock_mode?'1':'0');if(st.token)u.searchParams.set('station_token',st.token);u.searchParams.set('from',location.origin+route('dashboard/'));return u.toString();},
 subscribe(clubId,handler){return db.channel(`cm-${clubId}`).on('postgres_changes',{event:'*',schema:'public',table:'club_manager_live_sessions',filter:`club_id=eq.${clubId}`},handler).on('postgres_changes',{event:'*',schema:'public',table:'stations',filter:`club_id=eq.${clubId}`},handler).on('postgres_changes',{event:'*',schema:'public',table:'reservations',filter:`club_id=eq.${clubId}`},handler).subscribe();},
 async logout(){await db.auth.signOut();location.replace(route('login/'));}
};
const setNetwork=()=>document.documentElement.classList.toggle('offline',!navigator.onLine);
addEventListener('online',setNetwork);addEventListener('offline',setNetwork);setNetwork();
if('serviceWorker'in navigator)navigator.serviceWorker.register(route('service-worker.js')).catch(()=>{});
window.CSPClubManager=api;
})();