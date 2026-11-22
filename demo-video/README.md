# Owner onboarding video

`VV_Apartelle_Onboarding_Demo.mp4`: a narrated, captioned walkthrough of the app (about 5 min 50 s, 1080p).

Chapters: welcome → guest website → the three account types → a guest books → pays by QR → front desk verifies → automatic receipt → check-in → owner dashboard → rooms, rates, payment QR, customers, staff, settings → safeguards → demo vs. going live.

## Regenerating it
`tools/` holds the scripts that made it (Playwright drives the real app; edge-tts reads the narration).
1. `npm run build && npm start`
2. `node tools/record.js dump` writes the narration, then `python3 tools/tts.py` makes the voice clips
3. `node tools/record.js record` records the screen, then mux the audio with ffmpeg
