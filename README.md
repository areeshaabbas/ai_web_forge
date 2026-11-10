# Roshan Rozgar — final submission

An Urdu / Roman Urdu / English skilled-worker marketplace for Islamabad and Rawalpindi. This revision keeps the supplied UI and stack: React + Vite, Express, MongoDB, optional Gemini.

## Start on Windows (Command Prompt)

Extract this ZIP into a **new folder**, not inside your old project. Open Command Prompt in the extracted `roshan-rozgar` folder (the one containing `package.json`). Stop old dev servers with Ctrl+C first.

```bat
npm ci
copy backend\.env.example backend\.env
notepad backend\.env
```

Set `MONGODB_URI` to your Atlas connection string, with a database user allowed to read/write the database and your machine allowed by Atlas Network Access. Use URL-encoded credentials in the URI. Keep `MONGODB_DB=roshan_rozgar` to use your existing data, or choose a different database name for a fresh demo. Transactions require Atlas or a replica set; a standalone MongoDB instance will not work.

Set `GEMINI_API_KEY` to your own key to enable Gemini. `GEMINI_MODEL` is configurable; the example uses `gemini-2.5-flash`. If your account does not have access to that model, set an available model supporting structured JSON output. Keep `DEMO_MODE=false`.

```bat
npm run dev
```

Open the **frontend URL printed by Vite**, normally http://localhost:5173. Do not open an old tab pointing at another project's port. Node 24 or newer is required.

For a single-server production preview:

```bat
npm run build
npm start
```

Open http://localhost:3001. The backend serves the built frontend and `/api` from the same origin. For hosting, set environment variables on the server, run `npm ci` and `npm run build`, then `npm start`. Use HTTPS for microphone support beyond localhost. No frontend API key is needed.

## What changed

- Public demo impersonation is OFF by default. `x-demo-user` cannot authenticate a visitor unless the server explicitly enables demo mode. Real signed-in users can update only their own worker profile/availability; role and email cannot be changed through profile edits.
- Fixed a route-remount race that redirected newly signed-up workers to the dashboard instead of their profile input form. Added explicit accessible names to password inputs.
- Guest visitors can browse and reach sign-up/sign-in without needing a demo persona. Booking/dashboard routes require sign-in. Invalid tokens never fall back to a demo identity.
- Worker descriptions and manual fields are available. Existing workers can choose **Describe my work / use AI**, review the suggestions and save. Missing AI fields do not erase existing information. Name updates refresh the account header.
- Locality fields accept typed neighbourhoods, with suggestions. Existing city/trade/rate/rating/experience filters and the visual layout are retained.
- AI job scoping returns suggested skills, targeted clarification questions and a work-agreement checklist. Suggested skills rank actual database results when using best-match sorting, with visible matching reasons. Customers can explicitly add the checklist to their booking brief, which is then saved with the request and agreement. Trade, area and calendar filtering remain database-driven.
- Gemini failures are visibly labelled as local extraction. Local rules still supply a basic checklist; they are not presented as generative AI. AI calls have an account-level limit of 10/minute per server instance.
- Token expiry uses the application's clock consistently; malformed tokens with extra segments are rejected.
- Cash selected for later payment is not shown as paid. Digital payments are clearly simulations. Cancellation clears pending cash records; already simulated-paid jobs cannot be cancelled because this MVP has no refund flow.
- Work-photo public access requires completed, reviewed work; booking participants can see their own evidence beforehand.
- Refreshed search results update the selected worker, preventing stale displayed rates. Invalid or over-24-hour slots are caught in the frontend as well as the backend.
- Expanded `.gitignore`; removed the uploaded `.env`, unrelated Python wheels, dependencies and generated build output from the source package.

## Five-minute judge demo

1. Keep `DEMO_MODE=false`. Create a **worker** account. The worker description box appears immediately after sign-up.
2. Describe: `Mera naam Usman Ali hai. Main 12 saal se electrician ka kaam kar raha hoon. Main Satellite Town, Rawalpindi mein wiring, fan repair aur switch board ka kaam karta hoon.` Review the fields, enter an indicative price, and save.
3. Open a separate browser/incognito session and create a **customer** account. Describe: `Fan repair and wiring in Satellite Town Rawalpindi today.` Show the extraction source, clarification questions, checklist, and skill-match reasons. Answer questions by adding detail to the original description and running it again.
4. Review the brief, select your newly registered worker, choose a future slot and offer a price. Send the request.
5. In the worker session, open Bookings & chat, then accept or counteroffer. The other party accepts the latest terms. Show chat, occupied slots and customer-approved extra work.
6. Customer confirms completion and adds a review. Show the updated profile rating. If demonstrating payment, use cash or **test details only**; no real payment provider is connected.
7. Try editing another worker using your session: the backend rejects it. The public interface has no account-switcher with demo mode off.

Seeded profiles and sample reviews are fictional. They remain visible for presentation, but are not claimable by real accounts; use two newly created accounts for the complete booking demonstration. For a deliberately public sandbox on an isolated database only, `DEMO_MODE=true` restores the old fictional-persona switcher. Anyone can operate those fictional accounts in that mode. Never enable it for a real deployment.

## AI: honest submission explanation

AI reduces typing and turns an unstructured description into a reviewable profile or service request, asks for missing details, drafts the job scope, and suggests skill signals used to rank eligible workers. It does not invent workers, availability, prices or credentials, and never automatically accepts an agreement. Browser speech recognition handles transcription separately from Gemini. Urdu speech playback depends on the device's installed voices. Manual input remains usable without microphone support.

Without a valid Gemini key, this is a rules-based fallback demo, **not a live Gemini demonstration**. The UI explicitly says so. To verify live AI before judging, configure the key, restart the backend, submit a description and confirm the UI says **Understood with Gemini** or **Extracted with Gemini**. A local fallback message means the provider request did not succeed; check key, model access, quota and connectivity. Descriptions are sent to Google when configured; do not enter private addresses or sensitive details into the AI prompt.

SDK structured-output reference: https://ai.google.dev/gemini-api/docs/structured-output

## Validation

```bat
npm test
npm run build
```

Tests use disposable MongoDB replica sets and can download a MongoDB binary on their first run. They do not use your backend `.env` or reset your application database. Coverage includes booking lifecycle, overlapping slots, negotiations, reviews, payments, profile ownership, forged demo headers, token expiry, AI throttling and missing-detail extraction. A DOM-based UI interaction check passed: guest navigation, worker signup, profile description/extraction/save/edit, sign-out, customer signup, job analysis and checklist adoption, with no runtime JavaScript errors. Full browser visual checks could not run in the preparation environment because Chromium startup was blocked. Check desktop/mobile layouts and microphone permissions on your presentation machine.

Live Gemini, Atlas credentials, real payment processing and device microphone/Urdu voice output must be checked in your own environment. No live API credentials were used in validation.

## Repository / data care

`.gitignore` is in the ZIP root alongside `package.json`. Dotfiles may appear hidden in some viewers. Never commit `backend/.env`. If an earlier `.env` is already tracked, remove it from Git tracking using `git rm --cached backend/.env`; ignore rules do not remove existing tracked files. Rotate credentials if you previously published them. The original ZIP included an `.env`; this package deliberately does not include its values.

`npm run db:reset -- --confirm-demo-reset` is destructive: it resets that configured database. It is not required for this update. Back up your data first if intentionally using it.

This is a hackathon MVP, not a production payment or identity-verification service. Authentication tokens are stored in browser local storage; distributed rate limiting, account recovery, phone verification, moderation and refund settlement remain future work. No redesign or unrelated features were added.
