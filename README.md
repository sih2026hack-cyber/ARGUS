# ARGUS

ARGUS is a browser extension that helps people think before they post and check before they share. It runs on YouTube, Reddit and Instagram (and WhatsApp Web for messages), and talks to a small ARGUS server that holds the model keys.

- **Comment moderator** (`ai-moderator-plugin/`): checks a comment before it posts. It suggests a better way to say a rude one, explains why a harmful one can't be posted, and sends unclear ones to a moderator. It uses NVIDIA Nemotron while Nebius credits last, then MiniMax. Private messages are checked but never stored.
- **Argus Lens** (`lens/`, page at `/lens`): checks a photo or video for signs of AI generation and for harmful or private details, with the evidence outlined. It uses Meta's Muse Wonder and SAM 3.1, and answers "Couldn't check" when the Meta credits are used up.
- **Browser extension** (`extension/`): both checks inside the sites above. See [extension/README.md](extension/README.md).
- **Abusive-word masking** (`lib/profanity.mjs`): masks abusive words in English, Hindi (romanised) and Tamil (romanised and Tamil script), for example `k****`. To add words, edit `STEMS` (also matches inflected forms) or `EXACT` (whole words only), then run `npm test`.

## Run it

Requires Node.js 22+.

```powershell
npm install
copy .env.example .env   # then fill in the keys
npm start
```

The server listens on http://localhost:8787. Then load the extension:

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `extension/` folder.
2. Click the ARGUS icon. The panel should say **Connected to http://localhost:8787**.

```powershell
npm test
```

The tests run against fake model APIs on localhost, so no credits are spent.

## Layout

| Path | What it is |
|---|---|
| `server.mjs` | The server: extension routes, Lens page, moderator plugin routes, `/api/health` |
| `lib/extension-api.mjs` | Extension routes: `/api/ext/check`, `/peek`, `/suggest`, `/status`; `/api/lens/assess`, `/assess-video`. Rate limited per client |
| `lib/moderation.mjs` | Picks Nemotron or MiniMax for the moderator and tracks Nebius spend |
| `lib/lens.mjs` | Connects Lens to the Meta API and tracks Meta spend |
| `lib/profanity.mjs` | Abusive-word masking |
| `lib/config.mjs`, `lib/providers.mjs`, `lib/storage.mjs` | Settings, the MiniMax client, local state (optionally mirrored to Supabase) |
| `ai-moderator-plugin/` | The moderator as a reusable package, with a drop-in comment box widget and demo |
| `lens/` | Lens engine (`src/`) and page (`page/`) |
| `extension/` | The Chrome (Manifest V3) extension, with test pages in `extension/test/` |

## Deploy on Render (free plan)

`Dockerfile` and `render.yaml` are included: New > Blueprint > pick this repo. Set `ARGUS_PASSWORD` and `ARGUS_EXTENSION_KEY`, and put the same extension key and the Render address in the extension's settings. The free plan has no disk, so to keep credit spend and moderator decisions across restarts, set the Supabase variables and run `supabase/argus-state.sql` once.

## Privacy

Keys stay on the server. Never commit `.env` or `data/runtime/`; both are in `.gitignore`.
