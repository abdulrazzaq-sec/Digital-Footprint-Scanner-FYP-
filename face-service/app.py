import os
import io
import logging
import numpy as np
import requests
import cv2
import insightface
from insightface.app import FaceAnalysis
from flask import Flask, request, jsonify
from PIL import Image, UnidentifiedImageError

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = Flask(__name__)

SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.35"))
DOWNLOAD_TIMEOUT     = int(os.environ.get("DOWNLOAD_TIMEOUT", "6"))

# Load InsightFace model on startup (buffalo_sc = small/compact, ~100MB)
log.info("Loading InsightFace model...")
face_app = FaceAnalysis(
    name="buffalo_sc",
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"],
)
face_app.prepare(ctx_id=-1, det_size=(640, 640))
log.info("InsightFace model loaded ✓")


# ── helpers ───────────────────────────────────────────────────────────────────

def bytes_to_bgr(data: bytes):
    """Convert raw image bytes → BGR numpy array for OpenCV/InsightFace."""
    try:
        pil = Image.open(io.BytesIO(data)).convert("RGB")
        # Resize very large images
        w, h = pil.size
        if w * h > 4096 * 4096:
            factor = (4096 * 4096 / (w * h)) ** 0.5
            pil = pil.resize((int(w * factor), int(h * factor)), Image.LANCZOS)
        arr = np.array(pil)
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def get_face_embedding(image_bytes: bytes):
    """Return the embedding of the largest face, or None."""
    img = bytes_to_bgr(image_bytes)
    if img is None:
        return None
    try:
        faces = face_app.get(img)
    except Exception as e:
        log.warning(f"face_app.get error: {e}")
        return None
    if not faces:
        return None
    # Pick largest face by bounding box area
    largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return largest.embedding.tolist()


def fetch_image(url: str) -> bytes | None:
    try:
        r = requests.get(url, timeout=DOWNLOAD_TIMEOUT, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept":     "image/*,*/*;q=0.8",
        }, allow_redirects=True)
        if r.status_code == 200 and "image" in r.headers.get("Content-Type", ""):
            return r.content
    except Exception:
        pass
    return None


def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom else 0.0


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return "ok"


@app.post("/embed")
def embed():
    """Body: raw image bytes. Returns: { embedding: [...] }"""
    data = request.data
    if not data:
        return jsonify({"error": "no image data"}), 400
    emb = get_face_embedding(data)
    if emb is None:
        return jsonify({"error": "no face detected"}), 422
    return jsonify({"embedding": emb, "dimensions": len(emb)})


@app.post("/verify-url")
def verify_url():
    """Body: { embedding: [...], url: '...' }"""
    body = request.get_json(silent=True) or {}
    emb1 = body.get("embedding")
    url  = body.get("url")
    if not emb1 or not url:
        return jsonify({"error": "embedding and url required"}), 400
    img_bytes = fetch_image(url)
    if img_bytes is None:
        return jsonify({"match": False, "similarity": 0, "reason": "download failed"})
    emb2 = get_face_embedding(img_bytes)
    if emb2 is None:
        return jsonify({"match": False, "similarity": 0, "reason": "no face in candidate"})
    sim = cosine_similarity(emb1, emb2)
    return jsonify({"match": sim >= SIMILARITY_THRESHOLD, "similarity": round(sim, 4), "confidence": round(sim * 100, 1)})


@app.post("/verify-batch")
def verify_batch():
    """Body: { embedding: [...], urls: ['url1', ...] }"""
    body = request.get_json(silent=True) or {}
    emb1 = body.get("embedding")
    urls = body.get("urls", [])
    if not emb1 or not urls:
        return jsonify({"error": "embedding and urls required"}), 400

    results = []
    for url in urls[:60]:
        img_bytes = fetch_image(url)
        if img_bytes is None:
            continue
        emb2 = get_face_embedding(img_bytes)
        if emb2 is None:
            continue
        sim = cosine_similarity(emb1, emb2)
        results.append({
            "url":        url,
            "match":      sim >= SIMILARITY_THRESHOLD,
            "similarity": round(sim, 4),
            "confidence": round(sim * 100, 1),
        })
    return jsonify(results)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    log.info(f"Starting on port {port}")
    app.run(host="0.0.0.0", port=port)
