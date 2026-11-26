/* OFFPACK settings. Edit values here, nowhere else.
   The Supabase URL and the publishable key are public by design.
   NEVER put a secret or service_role key in this file. */
window.OFFPACK_HASH = location.hash;
window.OFFPACK_SEARCH = location.search;
/* Demo inside the app: when a logged-in user starts the demo, this tab behaves like app.html?demo=1 (see demo-switch.js). */
try { if (sessionStorage.getItem('offpack_demo') === '1' && !/[?&]demo=1/.test(location.search)) window.OFFPACK_SEARCH = (location.search ? location.search + '&' : '?') + 'demo=1'; } catch (e) {}
window.OFFPACK = {
  name: 'Offpack',
  siteUrl: 'https://offpackapp.github.io',
  supabaseUrl: 'https://bpimfnxkisqzjcoyzktc.supabase.co',
  supabaseKey: 'sb_publishable_ZYtkyIiR3nxUQwbJFaWTQw_dSeBv65_',
  supportEmail: 'Offpackjournal@gmail.com',
  demoEnabled: true,
  emotions: ['Calm', 'Confident', 'Hesitant', 'Anxious', 'FOMO', 'Frustrated'],
  mistakes: ['Early entry', 'Moved stop', 'FOMO', 'No confirmation', 'Revenge trade', 'Oversized'],
  sessions: ['Asia', 'London', 'New York'],
  leverages: [1, 5, 10, 20, 50, 100],
  maxScreenshots: 5,
  maxRiskPctWarn: 5
};
