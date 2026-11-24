import fs from 'node:fs';
import path from 'node:path';
import { DATA, settings, env } from './config.mjs';
import { requestJson } from './providers.mjs';
export const readLocal = (name, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, name + '.json'), 'utf8')); } catch { return fallback; } };
export function saveLocal(name, value) {
  const file = path.join(DATA, name + '.json'); fs.writeFileSync(file + '.tmp', JSON.stringify(value)); fs.renameSync(file + '.tmp', file);
  if (stateSync()) queueState(name);
}
// Render's free plan has no persistent disk: mirror runtime state to Supabase table argus_state
// (supabase/argus-state.sql) and restore it on boot. On by default when deployed; ARGUS_STATE_SYNC=true/false overrides.
const stateSync = () => dbConfigured() && (env.ARGUS_STATE_SYNC ? env.ARGUS_STATE_SYNC === 'true' : Boolean(env.RENDER));
const queued = new Map();
function queueState(name) {
  clearTimeout(queued.get(name));
  queued.set(name, setTimeout(async () => {
    queued.delete(name);
    try { const value = JSON.parse(fs.readFileSync(path.join(DATA, name + '.json'), 'utf8')); await upsert('argus_state', [{ key: name, value, updated_at: new Date().toISOString() }], 'key'); }
    catch (error) { console.error(`State sync failed for ${name}: ${error.message}`); }
  }, 1500));
}
export async function restoreState() {
  if (!stateSync()) return 0;
  try {
    let restored = 0;
    for (let offset = 0; ; offset += 20) {
      const rows = await readRows('argus_state', `select=key,value&order=key&limit=20&offset=${offset}`);
      for (const row of rows) if (/^[\w.-]+$/.test(row.key)) { fs.writeFileSync(path.join(DATA, row.key + '.json'), JSON.stringify(row.value)); restored++; }
      if (rows.length < 20) return restored;
    }
  } catch (error) { console.error(`State restore skipped: ${error.message}. Run supabase/argus-state.sql once.`); return 0; }
}
export function removeLocal(name){try{fs.unlinkSync(path.join(DATA,name+'.json'));}catch{}if(stateSync())requestJson(`${settings.supabaseUrl}/rest/v1/argus_state?key=eq.${encodeURIComponent(name)}`,{method:'DELETE',headers:headers()},'Supabase argus_state').catch(()=>{});}
export async function flushState() { for (const name of [...queued.keys()]) { clearTimeout(queued.get(name)); queued.delete(name); } }
export function dbConfigured() { return Boolean(settings.supabaseUrl && settings.supabaseKey); }
function headers() { return { apikey: settings.supabaseKey, Authorization: `Bearer ${settings.supabaseKey}`, 'Content-Type': 'application/json' }; }
export async function readRows(table, query = '') {
  if (!dbConfigured()) throw new Error('Supabase credentials are missing.');
  return requestJson(`${settings.supabaseUrl}/rest/v1/${table}?${query}`, { headers: headers() }, `Supabase ${table}`);
}
export async function upsert(table, rows, conflict) {
  if (!rows.length) return 0;
  if (!dbConfigured()) throw new Error('Supabase credentials are missing. Data is stored locally only.');
  for (let i = 0; i < rows.length; i += 50) {
    await requestJson(`${settings.supabaseUrl}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: 'POST', headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows.slice(i, i + 50)),
    }, `Supabase ${table}`);
  }
  return rows.length;
}
