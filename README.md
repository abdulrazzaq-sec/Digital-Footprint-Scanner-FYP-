# Digital Footprint Scanner

A web app that helps people see how much of their personal information is exposed online. You sign in, run any of 18 checks (email breaches, password leaks, username reuse, image matches, IP and browser exposure, and more), and get a plain-language risk summary with steps to reduce it.

Built as a final year project for BSCS at Muhammad Ali Jinnah University, Karachi.

> **Use it on yourself.** Several scanners handle sensitive data (CNIC, phone numbers, photos). Only run them on information you own or have explicit permission to check.

---

## What it does

Each scan takes one kind of input and reports what is publicly visible or leaked, then rates the risk. Results are collected in a dashboard and can be exported as a PDF report.

| Area | Scans |
|---|---|
| **Accounts and credentials** | Email Breach, Password Analyzer, Username Mapper, Ghost Account Finder |
| **Identity and public exposure** | Doxxing Vulnerability, Phishing Profiler, Phone Risk, CNIC Lookup |
| **Images and files** | Profile Image Search (with face matching), Image Metadata, Document Analyzer |
| **Network and browser** | IP Privacy, Network Exposure, Device Fingerprint, Session and Cookie Analyzer |
| **Infrastructure and awareness** | Subdomain Scanner, IP Tracker Links, Phishing Quiz |

### How the main scans work

- **Email breach:** queries the LeakCheck API and turns the response into a risk level and recommendations.
- **Password:** strength and pattern checks run in the browser. The leak check uses the Have I Been Pwned range API, so only the first 5 characters of the SHA-1 hash leave your device.
- **Username:** checks GitHub, Reddit, GitLab, Hacker News, DEV.to and npm directly, and gives manual links for other platforms.
- **Profile image:** uploads the photo, reads EXIF data, runs reverse image search, then compares faces with InsightFace in a separate Python service.
- **Document:** checks file signature and metadata, looks for suspicious PDF/Office indicators, and looks up the file hash on VirusTotal when a key is set.
- **IP and network:** geolocation, VPN/proxy hints, DNS blacklist checks, and WebRTC leak detection in the browser.
- **Subdomains:** collects public records from HackerTarget and crt.sh.
- **Tracker links:** generates a link that logs the IP and user agent of whoever opens it (see the consent note below).

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, React Router, React Query |
| Backend | Node.js, Express |
| Face matching | Python, Flask, InsightFace (CPU) |
| Auth and data | Supabase |
| Hosting config | Netlify (frontend) |

## Architecture

```
Browser (React)  --->  Express API (:5000)  --->  third-party APIs
                              |
                              +---> Face service, Flask (:5001)
                              |
                              +---> Supabase (auth, contact queries, trackers)
```

Scan results are stored in the browser's `localStorage`, not on the server. The dashboard and report are built from that local data.

## Getting started

### Requirements

- Node.js 18 or newer
- Python 3.9 or newer
- A Supabase project

### 1. Frontend

```bash
npm install
npm run dev
```

Runs on http://localhost:8080.

### 2. Backend

```bash
cd backend
npm install
node server.js
```

Runs on http://localhost:5000. Create a `.env` file in `backend/` (see below).

### 3. Face service

```bash
cd face-service
pip install -r requirements.txt
python app.py
```

Runs on http://localhost:5001. The first start downloads the InsightFace model, so it takes a while.

### Environment variables

Create `backend/.env` and fill in what you need. Only the Supabase values are required to sign in; each optional key switches on one feature, and that scan returns limited or no results without it.

```env
# Required
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SUPABASE_ANON_KEY=
FRONTEND_URL=http://localhost:8080
ADMIN_SECRET=choose-a-long-random-value

# Optional (one per feature: image search, face lookup, document hash check, etc.)
# See the top of backend/server.js for the exact variable names.
```

Never commit your `.env` file. Set `ADMIN_SECRET` to your own value before deploying anywhere.

### Supabase tables

The backend expects these tables: `contact_queries`, `trackers`, `tracker_hits`. Create them in your Supabase project before using the contact form or tracker links.

## Project structure

```
.
├── src/                 React app (pages, components, contexts, hooks)
│   └── pages/scans/     One file per scanner
├── backend/             Express API (server.js)
├── face-service/        Flask + InsightFace
├── netlify.toml         Frontend build and SPA redirects
└── vite.config.ts
```

## Limitations

This is a learning and awareness tool, not an authoritative security product.

- A clean result does not prove you were never breached. Each source has its own coverage.
- Risk scores are rule-based estimates, and the overall score is a simple average across scans with different methods. Face matching is the only machine-learning component.
- Phone prefix and carrier detection is inferred from number format, not verified with a telecom.
- Some scans (Phishing Profiler without a search key, for example) fall back to simulated output.
- `PIIScan` and `SocialMediaScan` exist in the code but are not routed in the app.
- No automated tests yet.

## Privacy and responsible use

- Images, hashes and queries may be sent to the third-party services listed above, each with its own retention policy.
- The Tracker Links feature records the IP address and user agent of anyone who opens the link, and can ask for browser location. Use it only for legitimate testing, and tell the people involved.
- CNIC and phone lookups deal with sensitive personal data. Check the legal position and the source's reliability before using them on anyone's data but your own.

## Roadmap

- Move scan history from `localStorage` to the database
- Auth and rate limiting on all scan endpoints
- Move secrets and database config fully to environment variables
- Unify scan counts across dashboard, profile and report
- Tests for the backend and scan logic
- Docker setup for all three services

## Author

**Abdul Razzak Ghouri**
BSCS, Muhammad Ali Jinnah University, Karachi

## License

Add a license file before publishing (MIT is a common choice for student projects).
