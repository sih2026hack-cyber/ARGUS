# ARGUS browser extension

One Chrome extension for all of ARGUS. **It works in any text box on any site** (WhatsApp Web, Gmail, X, Facebook, Messenger, LinkedIn, Discord, Telegram, blogs and forums, as well as YouTube, Reddit and Instagram): a live badge as you type, and a check when you send. Password, email and search fields are never read; messages are never stored. To try it without signing in anywhere, run `node extension/test/serve.mjs` and open http://localhost:8792/anywhere (Gmail-, Discord-, X- and blog-style boxes, plus a login form and a search box it must leave alone).

 The toolbar popup opens every part (comment check, Lens, register your work, review and credentials) and verifies an account in place. Right-click an image to check it or **register it as your work**, or right-click selected text to **check it with the moderator**. All checks send their work to your ARGUS server; the extension holds no AI keys.

- **Your comments** (`moderator.js`, from the team's AI Moderator): on YouTube, Reddit and Instagram (and WhatsApp Web if you switch it on), pressing Post first checks the comment.
  - Clean comments post.
  - Rude ones are held, with the reason and a better way to say it (**Use this** / **Edit**).
  - Harmful ones are explained and not posted.
  - Comments the AI can't read confidently wait for a moderator (on the server's `/admin` page).
  - Each comment is judged in the context of the post it replies to (its topic, summary and sensitivity, summarised once per post and reused). The card says which context was used.
  - If ARGUS can't be reached, nothing posts (it fails closed).
- **Images in your feed** (`lens.js`, from Argus Lens): hover over an image on Instagram, Reddit or YouTube and click **Check**, or right-click any image and choose **Check with Argus Lens**.
  - The verdict sits on the image: labelled as AI-made, likely AI, no signs found, or can't tell.
  - The evidence is outlined on the image, and private details are blurred on your screen.
  - Videos: **Check frame** checks the paused frame.
  - The toolbar panel's **Check a photo or video file** opens the ARGUS Lens page (`/lens`).
  - Registered work (`phash.js`): if the image matches work a creator registered on `/register`, the card shows the creator, Content ID and reuse terms. Only the image's fingerprint is sent, not the image.
- **Who posted it** (`identity.js`): on a YouTube video or channel, a Reddit post, or an Instagram post or profile, a badge by the author's name shows an ARGUS credential (verified person, official organisation account, or authorised AI agent and what it may do). A warning appears when an account uses a verified name without being that account. Accounts without a credential get no badge.

## Install (Chrome, Edge, Brave)

1. Start ARGUS: `npm start` (http://localhost:8787).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose this `extension` folder.
3. Click the ARGUS icon. The panel should say **Connected to http://localhost:8787**.

For a deployed ARGUS, open the extension's **Settings** and set:
- the server address;
- the **extension key**: the server's `ARGUS_EXTENSION_KEY`. On a password-protected deployment it is how the extension gets in.

## Try it without signing in anywhere

```bash
node extension/test/serve.mjs
```

This opens a test bench at http://localhost:8792 that forwards to ARGUS on port 8787:
- `/`: fake YouTube, Reddit and Instagram comment boxes.
- `/social`: a fake social feed with comment boxes.
- `/test`: a fake image feed for Lens. Add `?auto=1` for automatic checks.

## Cost

Every check is a paid AI call on the server:
- Comments use Nemotron while Nebius credits last, then MiniMax.
- Images use Meta's Muse Wonder and SAM 3.1, and stop with "Couldn't check" when the Meta credits are used up.

Automatic image checks are off by default and capped per minute (10 by default) in Settings. The server also rate-limits each client.

## Privacy

- Comment text is checked on the server. Emails and phone numbers are masked before it reaches the model.
- Private messages are never stored or shown to a moderator.
- Images are fetched without your cookies.
- Video checks use only a screenshot of the video's box on your screen.
- The "harsh messages" history stays in this browser and can be cleared in Settings.
