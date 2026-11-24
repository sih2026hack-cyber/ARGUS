// ARGUS server for the browser extension: the comment moderator and Argus Lens.
// Model keys stay here; the extension only knows this server's address (and an optional extension key).
//   /api/ext/*     comment moderator, as the extension calls it (lib/extension-api.mjs)
//   /api/lens/*    Argus Lens: is an image or video AI-made, harmful or private?
//   /api/plugin/*  the moderator plugin's own routes (ai-moderator-plugin/)
//   /lens          the Lens page; /plugin/moderator-widget.* the drop-in comment box widget
//   /api/provenance/*, /api/identity/*, /api/admin/*  Provenance & Ownership, Identity (lib/trust-api.mjs)
//   /register      creators register their work; /admin the reviewer queue, credentials and registry
//   /api/health    which models are in use and how much credit is left
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {ROOT,settings,server,env} from './lib/config.mjs';
import {readLocal,saveLocal,upsert,restoreState} from './lib/storage.mjs';
const restored=await restoreState(); // must run before any module reads runtime state
if(restored)console.log(`Restored ${restored} state files from Supabase`);
const {moderator,moderatorModel,postContext}=await import('./lib/moderation.mjs');
const {lens,lensStatus}=await import('./lib/lens.mjs');
const {createExtensionApi}=await import('./lib/extension-api.mjs');
const {createModeratorService,moderatorHandler}=await import('./ai-moderator-plugin/src/index.mjs');
const {createSigner}=await import('./lib/signing.mjs');
const {createIdentity}=await import('./lib/identity.mjs');
const {createRegistry}=await import('./lib/provenance-registry.mjs');
const {createTrustApi}=await import('./lib/trust-api.mjs');

// One signing key for content registrations and identity credentials (lib/signing.mjs).
// ARGUS_SIGNING_KEY may be written on one line with \n for the line breaks (as .env files need).
const signer=createSigner({pem:env.ARGUS_SIGNING_KEY?env.ARGUS_SIGNING_KEY.replace(/\\n/g,'\n'):null,load:()=>readLocal('signing-key',null),save:v=>saveLocal('signing-key',v)});
const identity=createIdentity({signer,store:{load:()=>readLocal('identity',null),save:v=>saveLocal('identity',v)}});
const registry=createRegistry({signer,identity,store:{load:()=>readLocal('content-registry',[]),save:v=>saveLocal('content-registry',v)}});
// The admin key opens /admin (reviewer queue, credentials). Locally a fresh one is printed at start
// when none is set; a public deployment must set ARGUS_ADMIN_SECRET.
const adminKey=env.ARGUS_ADMIN_SECRET||env.ARGUS_MODERATOR_SECRET||(server.isPublic?null:crypto.randomBytes(9).toString('base64url'));
const trustApi=createTrustApi({registry,identity,signer,adminKey});

// Decisions are kept locally and mirrored to Supabase (table moderation_logs) when it is configured.
const plugin=createModeratorService({moderator,decisions:readLocal('moderation',[]),persist:async(item,decisions)=>{let storage;try{await upsert('moderation_logs',[{id:item.id,created_at:item.created_at,payload:item}],'id');storage='Supabase + local';}catch{storage='Local only - cloud sync needed';}saveLocal('moderation',decisions.slice(0,300));return storage;}});
// Plugin routes under /api/plugin: preview, check, accept, ask, status, decisions (+ queue and resolve when ARGUS_MODERATOR_SECRET is set).
const pluginRoutes=moderatorHandler(plugin,{base:'/api/plugin',moderatorSecret:adminKey});
const extensionApi=createExtensionApi({plugin,moderator,lens,postContext});

// Local: only localhost. Public (Render): its hostname, behind HTTP Basic Auth.
const localHosts=[`localhost:${settings.port}`,`127.0.0.1:${settings.port}`];
const allowedHost=h=>localHosts.includes(h)||server.hosts.includes(String(h||'').toLowerCase().replace(/:\d+$/,''));
const allowedOrigin=(o,h)=>{try{const u=new URL(o);return u.host===h&&(u.protocol==='https:'||localHosts.includes(u.host));}catch{return false;}};
const same=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
function authorized(req){
  if(!server.isPublic)return true;
  if(!server.password)return false; // never serve a public instance without a password
  const [scheme,token]=String(req.headers.authorization||'').split(' ');
  if(scheme!=='Basic'||!token)return false;
  const [user,...rest]=Buffer.from(token,'base64').toString().split(':');
  return same(user,server.user)&&same(rest.join(':'),server.password);
}
function json(res,value,code=200){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}

const assets=new Map([
  ['/',['lens/page/index.html','text/html']],
  ['/lens',['lens/page/index.html','text/html']],
  ['/lens/lens.js',['lens/page/lens.js','text/javascript']],
  ['/plugin/moderator-widget.js',['ai-moderator-plugin/widget/moderator-widget.js','text/javascript']],
  ['/plugin/moderator-widget.css',['ai-moderator-plugin/widget/moderator-widget.css','text/css']],
  ['/phash.js',['extension/phash.js','text/javascript']],
  ['/register',['pages/register.html','text/html']],['/register.js',['pages/register.js','text/javascript']],
  ['/admin',['pages/admin.html','text/html']],['/admin.js',['pages/admin.js','text/javascript']],
  ['/pages.css',['pages/pages.css','text/css']],
]);
// The Lens page shows the user's own files (blob: URLs) and uses the Inter web font.
const CSP="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self' blob: data:; img-src 'self' data: blob:; media-src 'self' blob: data:; frame-ancestors 'none'";

http.createServer(async(req,res)=>{
  try{
    if(req.url==='/healthz')return json(res,{ok:true}); // Render health check, no data
    if(!allowedHost(req.headers.host))return json(res,{error:'Invalid host'},403);
    // The browser extension may call only its own routes. With ARGUS_EXTENSION_KEY set it must
    // send that key, which also lets it past the password on a public deployment.
    const extRoute=/^\/api\/(?:ext\/|lens\/|provenance\/(?:match|item)|identity\/(?:lookup|issuer))/.test(req.url),fromExtension=String(req.headers.origin||'').startsWith('chrome-extension://');
    const extKeyOk=!!env.ARGUS_EXTENSION_KEY&&same(req.headers['x-extension-key']||'',env.ARGUS_EXTENSION_KEY);
    if(extRoute&&fromExtension&&env.ARGUS_EXTENSION_KEY&&!extKeyOk)return json(res,{error:"This extension isn't set up for this server. Add the extension key in its settings."},401);
    if(req.headers.origin&&!(extRoute&&fromExtension)&&!allowedOrigin(req.headers.origin,req.headers.host))return json(res,{error:'Cross-origin requests are not allowed'},403);
    if(!authorized(req)&&!(extRoute&&extKeyOk)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="ARGUS", charset="UTF-8"','Content-Type':'text/plain; charset=utf-8'});res.end(server.password?'Sign in to ARGUS.':'Set ARGUS_PASSWORD in the Render environment to use this deployment.');return;}
    const url=new URL(req.url,`http://127.0.0.1:${settings.port}`);
    if(url.pathname==='/api/health'&&req.method==='GET')return json(res,{ok:true,minimax_configured:!!settings.miniKey,moderator_model:moderatorModel(),post_context:postContext.stats(),registry:{items:registry.size()},issuer:signer.id,lens:lensStatus()});
    if(url.pathname.startsWith('/api/plugin/'))return await pluginRoutes(req,res);
    if(await extensionApi(req,res,url))return;
    if(await trustApi(req,res,url))return;
    const sample=url.pathname.match(/^\/lens\/samples\/([a-z-]+\.(webp|mp4))$/);
    if(sample&&req.method==='GET'&&fs.existsSync(path.join(ROOT,'lens/page/samples',sample[1]))){res.writeHead(200,{'Content-Type':sample[2]==='mp4'?'video/mp4':'image/webp','Cache-Control':'max-age=3600','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(ROOT,'lens/page/samples',sample[1])));return;}
    const asset=assets.get(url.pathname);if(!asset||req.method!=='GET')return json(res,{error:'Not found'},404);
    res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':CSP});res.end(fs.readFileSync(path.join(ROOT,asset[0])));
  }catch(error){json(res,{error:error.status?error.message:'Operation failed. Check service availability and retry.'},error.status||500);}
}).listen(settings.port,server.host,()=>{console.log(`ARGUS listening on ${server.host}:${settings.port}${server.isPublic?' (public, password '+(server.password?'set':'MISSING')+')':''}`);if(adminKey&&!env.ARGUS_ADMIN_SECRET&&!env.ARGUS_MODERATOR_SECRET)console.log(`Admin key for http://localhost:${settings.port}/admin this run: ${adminKey}`);else if(!adminKey)console.log('Set ARGUS_ADMIN_SECRET to use /admin.');});
