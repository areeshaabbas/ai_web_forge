# Roshan Rozgar · روشن روزگار

**Bolo, Kaam Ho Gaya.** A voice-first, hyperlocal skilled-worker marketplace for Islamabad and Rawalpindi. Built for COMSATS AI Web Forge, 10 November 2026.

## Run the demo

Install **Node.js 24 LTS** and open a terminal in the extracted project folder.

```sh
npm ci
npm run build
npm start
```

Open [http://localhost:3001](http://localhost:3001). Express serves both the built React app and the REST API on that port. SQLite initializes automatically. For development, run `npm run dev` and open [http://127.0.0.1:5173](http://127.0.0.1:5173). The Vite dev proxy expects the API on port 3001. Restart the development command after changing backend files.

To reseed the database for another demo, stop the server and run `npm run db:reset`, then start it again. Reset deletes demo changes including new profiles, requests, messages, photos, and reviews. The application never resets on startup or on role change.

## Enable Gemini

1. Copy `backend/.env.example` to `backend/.env`.
2. Create a key in [Google AI Studio](https://aistudio.google.com/apikey), then set `GEMINI_API_KEY` in that file.
3. Restart the server. Run an extraction and look for **Extracted with Gemini** or **Understood with Gemini** on the result.

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. Change it to a supported structured-output model available to your Google account if needed. The SDK runs only in Express, with schema-constrained JSON and runtime Zod validation. Extracted fields remain editable. Requests fall back to clearly labeled local pattern matching if the key is missing, the service times out, the quota is exceeded, or the model response fails validation. Gemini receives the natural-language description when configured. Use fictional details during the demo.

Browser speech recognition needs a compatible browser, a secure context (HTTPS or localhost), and microphone permission. Support for Urdu recognition and speech synthesis varies by browser, device and installed voices. The browser speech provider may process audio remotely. Roshan Rozgar itself stores no microphone recordings. Urdu, Roman Urdu and English text work even if dictation is unavailable. The language switch changes selected navigation, home, and onboarding labels.

## Judge demo

1. Start as **New demo worker**. Open **Bolo Profile**, use the sample or dictate it, and build the profile. The example describes Usman Ali, an electrician with 12 years of experience in Satellite Town, Rawalpindi. Confirm the suggested fields, optionally enter Rs. 1,200 as the indicative rate, and save with availability on.
2. Open **Find workers** as the customer. Enter “Mera fan kharab hai, electrician chahiye jo aaj aa sakay.” Run **Understand my job**. Show the location follow-up, then choose **Rawalpindi → Satellite Town**. Choose Usman and send the request.
3. On the agreement, **Switch to worker view**. Tap **Main available hoon.** Then select **Propose new terms**, tap the Rs. 1,500 preset, and send the counteroffer. Switch back to the customer and confirm the updated agreement.
4. Show the booking confirmation and the reserved slot on the worker dashboard. The same time range will no longer return Usman in discovery with **Free for this slot** enabled.
5. In the customer view, confirm completion and submit a rating. Open the worker profile to show the review and updated job count. The worker can also attach a JPEG, PNG, or WebP up to 1 MB. Use a fictional work photo.

The customer can mark completion immediately so the full flow fits the live pitch. The demo does not wait for wall-clock job completion.

## Implementation

| Outcome | Implementation |
| --- | --- |
| Onboarding | Speech or text → Gemini or local parser → editable profile → persistent worker and skill rows |
| Discovery | Trade, city, locality, selected time interval, accepting status, experience, and rating filters |
| Communication | Persisted messages, tap-to-send replies, optional browser dictation, and structured counteroffers |
| Booking | Either party can propose, only the other can accept. SQLite `BEGIN IMMEDIATE` serializes overlap checks and writes. An agreement version prevents acceptance of stale terms. |
| Trust | Customer-confirmed completion, one review per booking, profile rating derived from reviews, optional work-photo evidence |

Time intervals are half-open. Back-to-back bookings are allowed, while confirmed intervals that overlap for a worker are rejected. Display and entry use Pakistan time. Availability is derived from the worker’s accepting flag and confirmed slots, so cancelling or completing a booking releases its reservation. Matching reasons come from actual search criteria. Search uses city/locality rather than estimated distance because the demo has no coordinates.

### Source layout

- `frontend/` — React, Vite, Tailwind CSS, Lucide icons, React Router, voice input and both demo dashboards
- `backend/app.js` — Express REST endpoints and demo access checks
- `backend/domain.js` — validation, shared server-side domain constraints and errors
- `backend/market.js` — profile persistence, matching, negotiation and booking transitions
- `backend/ai.js` — Gemini SDK and deterministic extraction fallback
- `backend/schema.sql`, `db.js`, `reset.js` — SQLite schema, fictional data and reset

`npm test` exercises onboarding, local extraction, slot discovery, proposal versions, messages, overlap prevention, review gates, evidence upload, rating updates and availability using the actual REST API. The test uses an isolated in-memory SQLite database.

## Hosting and submission

The official brief accepts a working local demo. For hosted demo use a Node 24 server/container with a persistent volume and one Express instance. Set `DB_PATH` to an absolute path on the volume, set `PORT` as required by the host, and add `GEMINI_API_KEY` as a server secret. Build with `npm ci && npm run build`, start with `npm start`, and serve via HTTPS if you want microphone access. Static-only hosting cannot run the Express and SQLite backend.

The role switcher intentionally lets visitors act as fictional demo users. If hosting, restrict access at the host or reverse proxy and share the demo only with intended testers. This is not an authentication system for real users. A production launch would require real sign-in, access control, moderation and data protection. Payment processing and formal identity verification are outside the demo. Availability across separate devices can be reloaded with **Refresh**. The app has no payment, SMS, or push notification integration.

For the required public source submission, put this folder in the team’s Git repository after the team has reviewed, understood, and meaningfully integrated the generated implementation. Commit the source and lockfile. The provided ignore rules exclude the API key, local database, and build files. Use the working local demo or your own deployment during judging.

## Simulation and AI disclosure

All workers, customers, reviews, and historical jobs in the seed are fictional. No private dataset or external marketplace was imported. New profiles, requests, messages, agreements, photos, and ratings created during the demo are real SQLite writes against this fictional dataset. “Customer feedback” is a record of a completed demo job, not a formal verification claim.

**AI services used by the product:** Google Gemini via `@google/genai` for structured worker/profile and job extraction when configured. Browser Web Speech APIs for optional speech recognition and instructions. Search and booking logic are deterministic.

**AI development assistance:** OpenAI ChatGPT/Codex generated the initial implementation, interface, and tests during the hackathon session. The team should add its own contributions and tool disclosures after reviewing and integrating the project. No project-specific starter or prior marketplace repository was used.

**References:** [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output) · [Gemini model lifecycle](https://ai.google.dev/gemini-api/docs/deprecations) · [Node SQLite](https://nodejs.org/api/sqlite.html)
