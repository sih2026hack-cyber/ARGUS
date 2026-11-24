// HTTP helper and MiniMax, the moderator's fallback model once Nemotron's credits are used up.
import { settings } from './config.mjs';
export class ServiceError extends Error { constructor(message, status = 503) { super(message); this.status = status; } }
export async function requestJson(url, options = {}, label = 'Service', retries = 2) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeout || 90000) }); }
    catch { if(attempt<retries){await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));continue;}throw new ServiceError(`${label} could not be reached. Check the connection.`); }
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await response.body?.cancel();
      const delay = Number(response.headers.get('retry-after')) || 2 ** attempt;
      if (delay > 10) throw new ServiceError(`${label} is rate limited. Retry later.`);
      await new Promise(resolve => setTimeout(resolve, delay * 1000)); continue;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason || data.code || '';
      throw new ServiceError(`${label} returned HTTP ${response.status}${reason ? ` (${reason})` : ''}.`, response.status === 429 ? 429 : 503);
    }
    return data;
  }
}
export async function minimax(messages, maxTokens = 1800) {
  if (!settings.miniKey) throw new ServiceError('MiniMax is not configured. Add MINIMAX_API_KEY to the server environment.');
  const data = await requestJson(settings.miniUrl, {
    method: 'POST', headers: { Authorization: `Bearer ${settings.miniKey}`, 'Content-Type': 'application/json' },
    // MiniMax-M3 reasons before it answers (~250 tokens on a short task), so the budget gets room
    // for that; reasoning_split keeps the reasoning out of the answer text.
    body: JSON.stringify({ model: settings.miniModel, messages, temperature: 0.2, max_tokens: maxTokens + 1500, reasoning_split: true }),
  }, 'MiniMax', 0);
  if (data.base_resp?.status_code) throw new ServiceError(`MiniMax rejected the request (code ${data.base_resp.status_code}). Check the API key, account region and balance.`);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new ServiceError('MiniMax returned no answer.');
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
