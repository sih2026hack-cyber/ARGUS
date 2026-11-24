import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function readEnv(file) {
  if (!file || !fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}
const local = readEnv(path.join(ROOT, '.env'));
export const env = { ...readEnv(process.env.ARGUS_ENV_FILE || local.ARGUS_ENV_FILE), ...local, ...process.env };
export const DATA = path.resolve(ROOT, env.ARGUS_DATA_DIR || 'data/runtime');
const isPublic = Boolean(env.RENDER || env.ARGUS_PUBLIC === 'true');
export const server = {
  host: env.HOST || (isPublic ? '0.0.0.0' : '127.0.0.1'), isPublic,
  // Hostnames the app may be addressed by; Render provides RENDER_EXTERNAL_HOSTNAME automatically.
  hosts: [env.RENDER_EXTERNAL_HOSTNAME, ...(env.ARGUS_ALLOWED_HOSTS || '').split(',')].map(h => (h || '').trim().toLowerCase()).filter(Boolean),
  user: env.ARGUS_USER || 'argus', password: env.ARGUS_PASSWORD || '',
};
fs.mkdirSync(DATA, { recursive: true });
export const settings = {
  port: Number(env.PORT || 8787),
  supabaseUrl: (env.SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  miniKey: env.MINIMAX_API_KEY, miniModel: env.MINIMAX_MODEL || 'MiniMax-M3', // MiniMax-Text-01 was retired (Nov 2026)
  miniUrl: env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1/chat/completions',
};
if (settings.miniUrl.endsWith('/v1')) settings.miniUrl += '/chat/completions';
if (/^https:\/\/[^/]+\/?$/.test(settings.miniUrl)) settings.miniUrl = settings.miniUrl.replace(/\/$/, '') + '/v1/chat/completions';
