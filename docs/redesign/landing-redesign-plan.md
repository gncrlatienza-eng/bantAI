# Landing Page Redesign Plan — v2

Status: plan v2 (2026-10-18), revised after review. Builds in the
`landing-polish` worktree (`feature/web-landing-polish`), which already holds
the landing capture pipeline and media components.

Kept from v1 (≈85%): the research, asset strategy, typography, video
specification, accessibility rules and implementation approach.
Changed in v2:
1. Distribution reality (Play Protect) and the default-SMS consent.
2. The Android app is the centre of the page; researchers and organizations
   get one concise band and their own page.
3. Page rhythm: one hero demonstration, compact highlights, one campaign
   visual, deliberate whitespace. No run of alternating screenshot rows.

Light mode only, on the existing `mineral` web tokens. The app itself is
shown in **its own light theme** (indigo `#5B4FE8` on `#F2F2F7`, from
`mobile/.../ui/theme/Color.kt`), never recoloured to the web's mulberry.

---

## 1. Why the current page fails (unchanged)

- It never shows the real product. The hero is a wireframe phone, and the "Android interface preview" is a mulberry replica that looks nothing like the violet app.
- Abstract diagrams, decorative circles and triangles, and thesis vocabulary carry the story.
- There's no path to the app, and no trust information.

---

## 2. Distribution reality — read before choosing the main button

**Play Protect will block a browser download in the Philippines.**
- Since February 2025, Google's *enhanced fraud protection* is on by default for every Android phone in the Philippines.
- It blocks apps installed from "internet-sideloading sources" (browsers, messaging apps, file managers) when they request `RECEIVE_SMS` or `READ_SMS`, among other sensitive permissions.
- BantAI needs both. A signed APK linked from the landing page is therefore **not** a reliable install path for Filipino users. The team has already seen devices block it.

**Rule for the page:** the primary Android button is driven by one config
value, never hard-coded.

| Mode | Primary button | Shows | When |
|---|---|---|---|
| `beta` (default now) | **Join the Android beta** | Beta page: requirements, the default-SMS step, how testers get the build | Until a public path is verified |
| `tester` | **Download tester build** | APK v-pinned link, size, SHA-256, install steps | Only for invited testers (e.g. a link shared directly), not the public landing |
| `public` | **Get BantAI for Android** | Store listing or verified installer | After the release checklist below passes |

**Release checklist before any public download button:**
- [ ] Install tested on supported devices: Android 8+, ARM64 and 32-bit ARM, at least two brands, with a PH SIM.
- [ ] Install tested **from a browser with Play Protect on**; results recorded per device (blocked / warned / installed).
- [ ] Every warning text captured and explained in the beta page FAQ.
- [ ] The exact release documented: tag, file name, size, SHA-256, signer certificate.
- [ ] A tested path that doesn't depend on the user turning protections off. **An anti-scam app must never tell people to disable Play Protect.**

**Facts for the current tester build** (from GitHub release
`student-android-v1.7`, 2026-10-16):
- File: `bantAI-student-offline-1.7.apk`, **354 MB** (includes the offline model).
- Requires Android 8 or later on an ARM64 or 32-bit ARM phone.
- SHA-256 `b840669d5973525d22602313eab71450baafdbc3cadf2e09c4d7f09167f9948d`.
- Install over an existing copy; don't uninstall first.

---

## 3. The default-SMS consent — explain it up front

To give its intended experience (scanning each incoming text, sorting the
inbox, blocking senders), BantAI asks to become the phone's **default SMS
app**.
- Android treats this as a sensitive role: the app must request it with `RoleManager.ROLE_SMS`, and the **user explicitly approves** it in a system dialog.
- The user can switch back to their old messaging app at any time.

The page says this plainly in three places:
- **Hero microcopy** under the button: *"BantAI becomes your SMS app. Android asks you first, and you can switch back anytime."*
- **How it works, step 1** ("Make BantAI your SMS app"), showing the real "Set as your SMS app" screen.
- **FAQ:** "Why does BantAI need to be my default SMS app?" and "What does it read?"

---

## 4. Page structure and rhythm

Goal: understand the product within the first two screens, then a few calm,
varied beats. Every section has a different visual form. No two adjacent
sections look alike.

```
1  HERO            Short headline · beta button · ▶ Watch the demo
                   ONE impressive demo: real-theme phone playing the scam-text moment
2  PROOF STRIP     Free · Offline on your phone · English, Filipino, Taglish · Thesis project
3  HOW IT WORKS    3 compact steps in one row (set as SMS app → it checks each text → you decide)
4  HIGHLIGHTS      One tight 2×2 grid of small cards, each with a small real-UI crop
5  SCAM WAVES      The ONE engaging intelligence visual: texts converging into one wave
6  PRIVACY         Short, quiet: 3 facts, no visual noise
7  RESEARCHERS &   One concise band → dedicated /platform page
   ORGANIZATIONS
8  FAQ             Accordion (install, default SMS, data, accuracy, cost)
9  FINAL CTA       Beta button again + QR (desktop) · requirements line
```

### Section details

1. **Hero.**
   - Headline: *"Know a scam text before you tap."* Sub: one sentence.
   - Buttons: **Join the Android beta** (mode-driven, §2) and **Watch the demo**, which opens the real recording.
   - The default-SMS microcopy (§3) sits under the buttons.
   - The visual is the page's one big moment, a phone in the app's real light theme. It plays a 7 s muted loop:
     1. A text from "GCash-Rewards" arrives in the inbox.
     2. It's marked **Likely scam**.
     3. The AI summary sheet slides up ("Prize claim — asks for your MPIN").
     4. It holds, then repeats.
   - A pause button sits on the phone. With reduced motion, the end state shows as a still.
2. **Proof strip.** One quiet row, small icons, no logos we haven't earned.
3. **How it works.** One row, three steps, each with a number, a sentence and a small real-UI crop. Not three sections.
4. **Highlights.** A compact 2×2 grid replaces the long alternating rows: *Inbox sorted* (All · Spam · Unknown) · *Explained, not just blocked* (AI summary) · *What to do next* (scam guide) · *One-tap block & report*. Small cards, short copy.
5. **Scam waves (the one intelligence visual).**
   - Several differently-worded scam texts drift in and settle into one "Rewards / prize claim · 8 messages · Active" wave card.
   - That card is the real Scam Waves UI.
   - Shows why grouping matters in one glance. Motion is scroll-triggered once, with a static end state.
6. **Privacy.** Three plain facts; generous whitespace.
7. **For researchers & organizations.**
   - One concise band: *"Studying smishing in the Philippines? The BantAI platform groups reports into campaigns and indicators."*
   - Links: **Learn about the platform** goes to the new `/platform` page; **Request access** goes to the existing flow.
   - The portal visuals, the Shield explanation and the capture loop move to `/platform`.
8. **FAQ.** About six questions, install and default-SMS first.
9. **Final CTA.**
   - The mode-driven button again, plus a QR code that opens the beta page on a phone.
   - Requirements line: Android 8+, ARM, Philippines SIM.

**Whitespace:** sections separated by 128–160 px on desktop (96 px tablet,
72 px phone); content max 1120 px; a maximum of one visual per section.

---

## 5. Assets — locked decisions

| Need | Source | Treatment |
|---|---|---|
| **Watch the demo** | The real light-mode screen recording (Drive, 39 s) | Blur phone numbers, names, message bodies and the profile; H.264 + WebM; captions; plays only in the dialog |
| Hero demo, step crops, highlights, scam wave | **Recreated** from the real app's light theme tokens and layouts (`Color.kt`, the Drive screens as reference) with **demo data** | HTML/CSS inside a phone/crop frame: crisp at any size, no personal data, animatable. Labelled "Demo data" in small print. |
| Dark screenshots (Drive) | Reference only | Not shipped: wrong theme and personal data |
| Platform visuals | Existing `landing-polish` portal capture pipeline | Moves to `/platform` |

Re-recording with demo data, demo-mode status bar and native resolution is
still the best long-term source. The recreated components can be swapped for
real captures later without changing the layout.

---

## 6. Copy rules (unchanged, plus)

- Visitor language; thesis terms go to `/about` and `/platform`.
- Every number has a source; no invented user counts.
- Never imply "100% protection". Never suggest turning off Play Protect.
- Don't claim "on Google Play" until it is.

---

## 7. Media specification (unchanged)

- **Hero:** HTML/CSS animation (no video weight) with a pause control.
- **Demo video:** MP4 (H.264) + WebM, ≤ 4 MB at 720 px wide, captions in WebVTT; loaded only when the dialog opens.
- **Stills:** AVIF/WebP, `srcset`, explicit sizes, lazy-loaded below the fold.

## 8. Accessibility and performance (unchanged)

- Muted inline autoplay only, a pause control on every loop over 5 s (WCAG 2.2.2), and reduced motion shows the static end state.
- Captions on the demo; meaningful alt text; a keyboard-operable dialog and FAQ.
- LCP < 2.5 s, CLS < 0.1, initial weight < 1.5 MB (the hero has no video), Lighthouse ≥ 90.

---

## 9. Implementation

1. **Config:** `web/src/config/android.ts` with `ANDROID_DISTRIBUTION`, the release facts, and the beta page path.
2. **Recreated app UI kit:** `pages/Landing/app/` holds `AppPhone`, `InboxScreen`, `MessageScreen`, `SummarySheet`, `ScamWaveCard` and the crop components, in the app's light tokens.
3. **Media:** a redacted demo video and `DemoVideoDialog` (native `<dialog>`, focus management, captions).
4. **Sections:** rebuild the landing per §4. Move the portal content to a new `/platform` page, and add a `/android` beta page.
5. **QA:**
   - Tests (render, reduced motion, CTA modes) and lint/typecheck/build.
   - Visual QA at 1440/1024/768/390, Lighthouse, a PII sweep of every frame.

## 10. Still open

- How beta testers receive builds, e.g. Google Play closed testing (needs the default-SMS-handler declaration) or direct invites. The beta page states requirements and how to ask to join.
- School and team credit wording.

---

## Sources

- Google Play Protect enhanced fraud protection, Philippines rollout — BusinessWorld: https://bworldonline.com/?p=652821
- How the protection decides (sideloading sources, SMS permissions) — 9to5Google: https://9to5google.com/2024/02/06/play-protect-financial-fraud-pilot/ ; https://heyupnow.com/blogs/news/google-play-protect-now-offers-enhanced-protection-against-financial-fraud-for-android-users
- Google, enhanced protection announcement (MY) — https://blog.google/intl/en-my/company-news/technology/google-launches-enhanced-protection-in-google/
- Android `RoleManager` (`ROLE_SMS`, `createRequestRoleIntent`) — https://developer.android.com/reference/android/app/role/RoleManager
- Reference sites: Whoscall https://web.whoscall.com/en · Truecaller https://www.truecaller.com/ · 1Password https://1password.com/ · Monzo https://monzo.com/ · Revolut https://www.revolut.com/ · Linear https://linear.app/ · Arc https://arc.net/ · Things https://culturedcode.com/things/
- web.dev, Lazy loading video — https://web.dev/articles/lazy-loading-video
- A11Y Project, auto-play — https://www.a11yproject.com/posts/never-use-auto-play/ ; WCAG 2.2.2 with reduced motion — https://hidde.blog/meeting-2-22-pause-stop-hide-with-prefers-reduced-motion/
