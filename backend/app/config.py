"""Central configuration for StudySphere (core + premium/credits)."""
import os
import secrets
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

# Data dir is configurable so production can point it at a persistent volume.
DATA_DIR = Path(os.getenv("STUDYSPHERE_DATA_DIR") or (BACKEND_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "studysphere.db"

# Built React frontend (created by `npm run build`). When present, the API also
# serves the SPA so the whole app runs as a single service.
DIST_DIR = ROOT_DIR / "frontend" / "dist"

# --- AI --------------------------------------------------------------------- #
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
MODEL = os.getenv("STUDYSPHERE_MODEL", "claude-opus-4-8").strip()
TOP_K = int(os.getenv("STUDYSPHERE_TOP_K", "5"))
AI_ENABLED = bool(ANTHROPIC_API_KEY)

# --- Auth ------------------------------------------------------------------- #
_secret_file = DATA_DIR / ".jwt_secret"
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not JWT_SECRET:
    if _secret_file.exists():
        JWT_SECRET = _secret_file.read_text(encoding="utf-8").strip()
    else:
        JWT_SECRET = secrets.token_hex(32)
        _secret_file.write_text(JWT_SECRET, encoding="utf-8")
JWT_ALGO = "HS256"
JWT_EXPIRES_DAYS = 7

# --- Payments (Razorpay) ---------------------------------------------------- #
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
RAZORPAY_ENABLED = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)

# --- Plans & credits -------------------------------------------------------- #
SIGNUP_BONUS_CREDITS = 10

# key -> {name, price (INR), credits}
PLANS = {
    "starter": {"name": "Starter", "price": 99, "credits": 50},
    "pro": {"name": "Pro", "price": 199, "credits": 150},
    "premium": {"name": "Premium", "price": 399, "credits": 500},
}

# Credit cost per online (AI) action — tiered by token cost.
CREDIT_COSTS = {
    "chat": 1,
    "analyze": 1,
    "summarize": 2,
    "quiz": 2,
    "revision_plan": 2,
    "question_paper": 3,
}

MCA_CURRICULUM = {
    "Semester 1": ["Database Management Systems", "Programming in Java", "Computer Networks"],
    "Semester 2": ["Python Programming", "Data Structures & Algorithms", "Operating Systems"],
    "Semester 3": ["Machine Learning", "Cloud Computing", "Web Technologies"],
    "Semester 4": ["Data Science", "Project Work", "Information Security"],
}
