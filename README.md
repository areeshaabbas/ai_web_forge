# Roshan Rozgar · روشن روزگار

**Bolo, Kaam Ho Gaya.** A voice-first, hyperlocal skilled-worker marketplace for Islamabad and Rawalpindi. Built for COMSATS AI Web Forge.

## Run on Windows with MongoDB Atlas

1. Install Node.js 24. In Atlas, create or select a cluster, create a database user with read/write access to `roshan_rozgar`, and add the IP address of the computer or host that will run the app to your project IP access list. In **Connect → Drivers**, copy the connection string and insert your database user password. URL-encode reserved characters in the password.
2. Extract the project and open Command Prompt in `roshan-rozgar`.

```cmd
copy backend\.env.example backend\.env
notepad backend\.env
```

3. Replace the `MONGODB_URI` line with your Atlas connection string, keep `MONGODB_DB=roshan_rozgar`, and save. `GEMINI_API_KEY` is optional. Keep the connection string and API key in `backend/.env`.
4. Run these commands from the project root.

```cmd
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open [http://localhost:3001](http://localhost:3001). [The health endpoint](http://localhost:3001/api/health) returns `"database":"mongodb"` when the database responds. The first startup creates indexes and seeds fictional accounts, workers, bookings, messages, ratings, a sample evidence image, and a pending extra-work request.

[MongoDB Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/)

### Run with a local replica set

Use a local MongoDB replica set if you want a demo without relying on venue internet. The app requires a replica set or Atlas because booking confirmation uses transactions. If Docker Desktop is available, run the following in Command Prompt:

```cmd
docker run -d --name roshan-mongo -p 127.0.0.1:27017:27017 -v roshan-mongo-data:/data/db mongo:7.0 --replSet rs0 --bind_ip_all
docker exec roshan-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

Wait for the replica to elect a primary, then use the default URI in `backend/.env.example`. Keep this Docker configuration on your own machine. The port is bound to loopback and the container is for local demo data. To restart an existing container, run `docker start roshan-mongo`.

For frontend development, use `npm run dev`. Vite runs on port 5173 and proxies API requests to port 3001. For a hosted demo, build the project and run `npm start` on a Node 24 host with `MONGODB_URI`, `MONGODB_DB`, and optionally `GEMINI_API_KEY` set as server secrets. The app serves the frontend and API on one origin. Use HTTPS for browser dictation.

### Reset a demo database

Stop the app. Double-check the configured database is dedicated to the demo, then run `npm run db:reset -- --confirm-demo-reset`. This replaces data in the app's MongoDB collections. Existing SQLite data is separate and is not imported automatically.

## Judge demo

**Pehle Poochho (ask first):** Use the default **Customer · Ayesha Khan**. Go to **Bookings & chat → Confirmed bookings → Ceiling fan repair**. A fictional Rs. 450 capacitor replacement is awaiting approval on a Rs. 1,500 job. Decline it and show that the agreed total remains Rs. 1,500. Switch to the worker view, request a different extra, switch back, and approve it. Both roles see the same decision and revised total. The original agreement stays visible.

**Full journey:**

1. Choose **New demo worker** and start Bolo Profile. Use the example, review the extracted fields, enter Rs. 1,200 if desired, and save the profile with availability on.
2. Switch to the customer and enter “Mera fan kharab hai, electrician chahiye jo aaj aa sakay.” Choose **Rawalpindi → Satellite Town** and request the new worker, Usman Ali.
3. Open the booking. Use a Roman Urdu quick reply and a price counteroffer from the worker view. Accept it from the customer view.
4. In the confirmed booking, the worker can preview and upload a JPEG, PNG, or WebP up to 1 MB. The customer can approve or decline any pending extra, confirm completion, and submit a review.
5. Show the rating update on the worker profile. To show cancellation or decline, create another request and use its confirmation dialog. To show no matches, set the minimum experience above the local workers' experience.

## Backend and database

| Collection | Data |
| --- | --- |
| `users` | Fictional customer and worker accounts, profile, skills, service area, prices, availability and calendar revision |
| `requests` | Customer repair descriptions, urgency, trade and locality |
| `bookings` | Versioned terms, participants, status, reviews, evidence and extra-work decisions |
| `messages` | Booking conversations, sender and timestamp |
| `counters`, `meta` | API ID sequences and seed state |

The server validates requests with Zod. A unique partial index prevents two active bookings for one request. Booking confirmations for a worker write the same calendar revision inside a MongoDB transaction before checking for overlapping slots, so concurrent confirmations cannot both reserve the same time. Proposal versions reject stale acceptance. Ratings are calculated from completed bookings. Extra-work decisions are atomically applied to the booking, and only approved extras contribute to the current total.

`npm test` runs the REST integration test against a temporary MongoDB replica set. The first run may download a MongoDB binary. Set `MONGODB_TEST_URI` if you already have a test replica set. The test creates and drops its own temporary database. Run it against a test cluster only.

## Gemini, voice and demo scope

Copy `backend/.env.example` to `backend/.env` if needed. Set `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey) and restart to enable Gemini. The UI labels Gemini output and local fallback separately. Dictation uses browser Web Speech APIs and depends on browser permissions and language support. Text entry remains available. All seeded profiles, bookings and reviews are fictional. The sample evidence is a labeled illustration.

The role selector is for a controlled hackathon demo. Real accounts and production authentication are out of scope. The demo allows completion without waiting for the scheduled visit, and availability and chat can be refreshed when switching devices. Protect any hosted demo at the hosting layer. The generated implementation was built with ChatGPT/Codex assistance.
