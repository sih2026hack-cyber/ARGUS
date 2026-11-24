# ARGUS demo video: script and recording guide

**Length:** about 9½ minutes. Intro film 3½ min · live demo 5½ min · close 30 s.
**Files:** `demo/intro.html` (the intro film) · `demo/assets/` (images for the Provenance and Lens parts).

---

## Before you record (15 minutes)

**Set up the computer**
- [ ] Turn on Do Not Disturb (Windows: notification bell → Do not disturb). Close WhatsApp and Teams notifications.
- [ ] Screen resolution 1920×1080 if possible. Chrome zoom 100%. Hide the bookmarks bar (Ctrl+Shift+B).
- [ ] Use a headset or external mic; record in a quiet room.

**Start ARGUS**
- [ ] In `E:\argus`, run `npm start`. Leave the window open.
- [ ] At `chrome://extensions`, click **reload** on ARGUS (version **0.6.3** or later).
- [ ] Click the ARGUS icon: it should say **Connected · localhost:8787**. Make sure **ARGUS on this site** and **Check my messages too** are ticked.

**Demo data (already on your server)**
- Priya's café photo is registered: **ARGUS-CBYST3M5I6QH** (free to share with credit).
- Arun's remix of it is registered and linked to Priya's.
- Mei's parcel photo is registered with **no edits allowed**.

**Open these tabs in this order** (so you just click from left to right):
1. `demo/intro.html`. Double-click the file to open it in Chrome, then press **F11** for full screen.
2. A YouTube video you're happy to comment under (signed in). A sports or trick-shot clip is ideal.
3. WhatsApp Web, open on **"Message yourself"** (your own number), so nothing reaches anyone.
4. http://localhost:8787/moderator
5. http://localhost:8787/lens
6. http://localhost:8787/register
7. http://localhost:8787/admin (log in with the key from `ARGUS_MODERATOR_SECRET` in your `.env`)
8. The YouTube channel you'll verify in the Identity part: your team's own channel is best.

**Record with:** OBS Studio (free), or the Xbox Game Bar (**Win+Alt+R** starts and stops recording the active window). Edit in **Clipchamp** (built into Windows 11): trim the waiting while Lens thinks, and add the voiceover.

> Tip: record the intro film silently, then record the voiceover on top in Clipchamp. Timing is easier, and you can redo lines.

---

## Part 1 · Intro film (3:36)

Press **Space** to start. It plays by itself. (**→ / ←** step through scenes, **R** restarts, **H** hides the thin progress line.)

| Scene | Time | Voiceover |
|---|---|---|
| **Billions of posts.** | 0:00–0:12 | "Billions of posts go online every single day. Is it safe? Is it real? Whose is it? Who's really speaking? Right now, nobody checks all four." |
| **This is a normal day online.** | 0:12–0:48 | "Look at an ordinary feed. An account that looks like a university is collecting fees. That sunset photo was taken by someone else; the watermark was cropped out. That shocking video was made by AI, with no label. A reply that says 'That's sick!' sounds harmless, until you see it's under a news report about a crash. And a chatbot claims to be a bank's official assistant, though nobody authorised it. Every one of these looks normal. None of them gets flagged." |
| **Good tools already exist.** | 0:48–1:11 | "We're not starting from zero. Safe Browsing warns about dangerous sites. TinEye finds matching images. Hive scores media for AI. C2PA records how a file was made. W3C Verifiable Credentials prove identity. Perspective scores toxic comments. But each answers one question, on its own website. People still have to connect the pieces themselves." |
| **If nothing changes** | 1:11–1:40 | "And if nothing changes? Seeing stops being believing: when any video can be faked, real evidence gets dismissed too. Creators stop sharing, because their work is copied with no credit and no way to prove it's theirs. Anyone can speak for an institution, including AI agents nobody authorised. Moderation fails both ways, punishing jokes while missing real threats. And slowly, trust in everything online wears away." |
| **ARGUS** | 1:40–1:57 | "This is ARGUS: one trust layer for everything you see and post online. It's named after the hundred-eyed watchman of Greek myth, and it's a Chrome extension, so it works on any site without waiting for platforms to adopt it." |
| **Five engines** | 1:57–2:34 | "ARGUS has five engines. Content Safety checks what you write, in the context of the post, and suggests a kinder way to say it before it's sent. Provenance gives creators a Content ID and a signed record, and recognises copies, crops and screenshots. Authenticity reads Content Credentials and checks images and video for AI, harm and private details. Identity gives people, organisations and AI agents verifiable credentials, and warns about look-alikes. And Responsible AI explains every decision, sends uncertain ones to a person, and avoids repeating work." |
| **The engines share what they know** | 2:34–3:02 | "What makes ARGUS different is that its engines share what they know. Each post is summarised once, and that context is reused for every comment. Images are fingerprinted right in your browser, so the image itself never leaves your computer. Accounts are checked against signed credentials. That's how ARGUS knows 'That's sick!' is praise under a trick shot, and cruel under a crash report." |
| **How ARGUS changes that future** | 3:02–3:24 | "So the future changes. Every image can be checked, with the evidence shown. Creators keep their name on their work. Real accounts and AI agents carry credentials. Comments are judged in context, by AI that explains itself. Trust becomes something you can check, wherever you browse." |
| **Let's see it live.** | 3:24–3:36 | "ARGUS doesn't decide what you're allowed to say. It shows you the evidence and leaves the judgement to people. Let's see it live." |

---

## Part 2 · Live demo (about 5½ minutes)

Speak naturally while you do each step. Lines in quotes are suggestions.

### 2.1 Content Safety on YouTube (60 s), tab 2

| Do | Say |
|---|---|
| Click the YouTube comment box. Point to the small **A** badge in its corner. | "ARGUS lives in every text box, like a spell-checker, but for harm." |
| Type **`you're an idiot, this is so fake`** and pause for 2 seconds. The badge turns to **!** and a card opens by itself. | "As I pause, it checks. It explains what's wrong and offers a better way to say it." |
| Click **Comment** anyway. | "Even if I try to post, ARGUS holds it. Nothing goes out unchecked." |
| On the card, point to **"Judged with this post's context: …"**. | "It knows what this video is about. It summarised the video once and reuses that for every comment." |
| Click **Edit** and clear the box. Don't post. | |

### 2.2 Context matters (40 s), tab 4: `/moderator`

| Do | Say |
|---|---|
| Pick the 🏀 **trick shot** post, click **That's sick!**, then **Check and post**. | "Here's the same idea step by step. Under a trick shot, 'That's sick!' is praise." |
| Pick the 📰 **bus accident** post, keep the same comment, **Check and post**. | "Under news about a fatal crash, the same words read as cheering it, so it's held, with a kinder version." |
| Point to **Context Memory** on the left: *summaries made* and *times reused*. | "Each post is summarised once and reused, so ARGUS doesn't pay the AI to re-read it for every comment." |
| Click **semma song 🔥** with the trick shot post. | "It understands Tamil and Hindi typed in English, and it notices this one is off-topic, without blocking it." |

### 2.3 Any site: WhatsApp Web (40 s), tab 3

| Do | Say |
|---|---|
| In "Message yourself", type **`shut up you useless idiot`** and press **Enter**. | "It's not just YouTube. ARGUS works anywhere you type: WhatsApp, Gmail, X, LinkedIn, Discord." |
| The card says **Not sent yet**. Click **Use this**. | "The kinder version is sent instead. Private messages are checked but never stored, and never shown to a moderator." |
| Click the ARGUS icon in the toolbar. | "Everything's in one place: check a comment, check a photo, register my work, verify an account, and switch ARGUS off for any site." |

### 2.4 Human review (40 s), tabs 4 and 7

| Do | Say |
|---|---|
| On `/moderator` (🎤 singing post), type **`enna da idhu, romba cringe ah irukku`** → **Check and post**. | "When the AI isn't sure, it doesn't guess." |
| It shows **Waiting for a person**. Switch to **/admin → Review queue**. | "A person sees what was written, what the AI thinks it means, and the post's context." |
| Click **Approve: post it**, switch back to `/moderator`. It now says **approved, posted**. | "A human makes the final call." |

> If it comes back "Posted" or "Not posted" instead of "Waiting", try `nee romba over ah pannura` or `ivan oru mental case`. The AI decides when it's unsure.

### 2.5 Authenticity: Argus Lens (45 s), tab 5

| Do | Say |
|---|---|
| On `/lens`, drop in **`demo/assets/4-ai-image-with-address.webp`**. (Cut the ~30 s wait in editing.) | "Lens checks images for signs of AI, harm and private details." |
| Point to **Labelled as AI-made**, and the **blurred address**. | "This file carries an AI label, and the delivery label shows a stranger's home address and phone number, so ARGUS blurs it before you share it." |
| Point to the note *"That doesn't prove it's real"* (if shown) or the evidence list. | "ARGUS shows evidence and confidence. It never claims more than it can see." |

### 2.6 Provenance & Ownership (60 s), tab 6

| Do | Say |
|---|---|
| On `/register`, scroll to **Look up a Content ID**, enter **ARGUS-CBYST3M5I6QH**. | "Priya registered her photo. She has a Content ID, a signed record, and her terms: free to share, with credit. Arun's remix is linked to it." |
| Scroll up and drop in **`demo/assets/2-stolen-copy-mirrored-cropped.jpg`**. | "Now someone has stolen it: flipped, cropped to a square, with their own watermark." |
| ARGUS shows **"Looks like a cropped, mirrored copy of it. 89%"** and Priya's record. | "ARGUS still recognises Priya's work, and only fingerprints leave the browser, never the image." |
| Point to the note: *"…not proof of who owns the image…"*. | "And it's honest: similarity is evidence, not proof." |
| (Optional) On any website, right-click an image → **Register this image as my work (ARGUS)**. | "Creators can register their work straight from the page." |

### 2.7 Identity & Accountability (50 s), tabs 7 and 8

| Do | Say |
|---|---|
| On **/admin → Identity credentials**: *This account is* "The official account of an organisation", platform **youtube**, handle **@yourteamchannel**, name **your team or college name**, *How you checked*: "Confirmed by the team". Click **Issue and sign**. | "Organisations can prove which accounts are really theirs. ARGUS issues a signed credential following the W3C standard." |
| Open a video on that channel (tab 8). Point to **✓ ARGUS verified** next to the channel name. Hover it. | "Now anyone with ARGUS sees it's the official account, and what that does and doesn't prove." |
| Click the ARGUS icon → **Verify an account** → type another handle → **Check**. | "Look-alike accounts using a verified name get a warning instead." |
| (Optional) Issue an **AI agent** credential, "may reply to comments". | "AI agents can carry credentials too, saying who runs them and what they may do." |

---

## Part 3 · Close (30 s)

Show the ARGUS popup or the intro's last frame. Say:

> "ARGUS brings safety, authenticity, ownership and identity together in one extension that works on any site. It explains every decision, asks a person when it isn't sure, and never claims more than the evidence shows. It doesn't control what people say. It gives them the evidence to trust what they see, and to protect what they create. That's ARGUS."

---

## If something goes wrong while recording

| Problem | Fix |
|---|---|
| Popup says "Can't reach server" | The `npm start` window was closed. Start it again. |
| No **A** badge in a box | Refresh the tab (F5). Check **ARGUS on this site** in the popup. |
| "Couldn't check right now" | Internet or AI credit. Click **Try again**; `/api/health` shows the credit left. |
| Lens is slow | Normal: 20–40 s for an image. Cut the wait in editing. Avoid videos (3+ minutes). |
| You posted something by mistake | Delete it on the site straight away. |
