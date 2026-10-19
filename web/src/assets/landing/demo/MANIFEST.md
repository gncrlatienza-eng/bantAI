# Landing demo video

| File                      | What                                      | Size   |
| ------------------------- | ----------------------------------------- | ------ |
| `bantai-tour.mp4`         | H.264, 590×1280, 30 fps, no audio, 20.0 s | 525 KB |
| `bantai-tour.webm`        | VP9, same cut                             | 388 KB |
| `bantai-tour-poster.webp` | Frame at 0.6 s (the "All" tour card)      | 19 KB  |

**Source:** screen recording `SVID_20261017_211741_1.mp4` (BantAI 1.7, light
theme, first-run tour), shared on Google Drive on 2026-10-17.

**Edits (2026-10-18):**

- Trimmed to 0.9–24.2 s of the source. That drops the first Settings segment,
  which showed a real profile name.
- Blurred message rows in the inbox (sender, number, preview), keeping the
  tour cards sharp with a brightness/violet mask.
- Blurred the phone number on the Alerts row while it's visible.
- Removed the audio track.

**Re-cut (2026-10-19), because the 2026-10-18 cut leaked:** the check that day
sampled one frame per second, and the brightness mask treated any bright area
as a tour card. Frames between the samples showed real phone numbers and a
verification code: 0.35–0.9 s (before the tour dims the screen) and
10.6–12.4 s (the tour spotlight sliding over the inbox to the Alerts tab).
The current file keeps 1.0–11.55 s and 13.4–22.8 s of that cut, which also
drops the closing Settings segment (profile initials).

**PII check (2026-10-19):** every distinct frame was reviewed (near-duplicate
frames removed with `mpdecimate`, nothing else skipped), and no frame shows an
undimmed inbox. No phone numbers, names, initials, verification codes or
personal message bodies are legible. The Scam Waves screen shows the wording
of received scam texts (e.g. a prize-claim lure); those are scam content, not
personal data.

Re-record with demo data and Android demo mode to replace this cut.
