"""StudySphere REST API — auth, per-user RAG, metered AI, and payments."""
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import config, db, security
from app.schemas import (
    AnalyzeRequest,
    AuthResponse,
    ChatRequest,
    ChatResponse,
    CreateOrderRequest,
    LoginRequest,
    PaperRequest,
    PlanRequest,
    QuizRequest,
    SignupRequest,
    SummarizeRequest,
    UploadResponse,
    UserOut,
    VerifyPaymentRequest,
)
from app.services import ai_service, payments, study_tools
from app.services.loader import chunk_pages, extract_pages, full_text
from app.services.vector_store import store

api_router = APIRouter()
_bearer = HTTPBearer(auto_error=True)


# --------------------------------------------------------------------------- #
# Auth dependency
# --------------------------------------------------------------------------- #
def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    try:
        user_id = security.decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return user


def _user_out(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "plan": user["plan"],
        "credits": user["credits"],
    }


# --------------------------------------------------------------------------- #
# Credit metering helpers
# --------------------------------------------------------------------------- #
def _guard_online(user: dict, action: str, online: bool) -> int:
    """Validate an online request before doing work. Returns the credit cost."""
    if not online:
        return 0
    if not config.AI_ENABLED:
        raise HTTPException(status_code=503, detail="Online mode is not configured on this server.")
    cost = config.CREDIT_COSTS[action]
    if user["credits"] < cost:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough credits. This action needs {cost} credit(s). Upgrade to continue.",
        )
    return cost


def _settle(user: dict, action: str, used_ai: bool) -> int:
    """Deduct credits if AI was used; return the remaining balance."""
    if not used_ai:
        return db.get_user(user["id"])["credits"]  # type: ignore[index]
    cost = config.CREDIT_COSTS[action]
    db.deduct_credits(user["id"], cost)
    return db.get_user(user["id"])["credits"]  # type: ignore[index]


# --------------------------------------------------------------------------- #
# Public: status & config
# --------------------------------------------------------------------------- #
@api_router.get("/status")
async def status():
    return {"ai_enabled": config.AI_ENABLED, "model": config.MODEL if config.AI_ENABLED else None}


@api_router.get("/config")
async def app_config():
    return {
        "ai_enabled": config.AI_ENABLED,
        "razorpay_enabled": config.RAZORPAY_ENABLED,
        "signup_bonus": config.SIGNUP_BONUS_CREDITS,
        "credit_costs": config.CREDIT_COSTS,
        "plans": config.PLANS,
        "curriculum": config.MCA_CURRICULUM,
    }


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    if db.get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = db.create_user(req.name.strip(), req.email, security.hash_password(req.password))
    token = security.create_token(user["id"])
    return {"token": token, "user": _user_out(user)}


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user = db.get_user_by_email(req.email)
    if not user or not security.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = security.create_token(user["id"])
    return {"token": token, "user": _user_out(user)}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)


# --------------------------------------------------------------------------- #
# Dashboard stats (per user)
# --------------------------------------------------------------------------- #
@api_router.get("/me/stats")
async def my_stats(user: dict = Depends(get_current_user)):
    s = db.stats(user["id"])
    s["indexed_chunks"] = s["chunks"]
    s["credits"] = user["credits"]
    s["plan"] = user["plan"]
    return s


# --------------------------------------------------------------------------- #
# Upload & files (per user)
# --------------------------------------------------------------------------- #
@api_router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    semester: str = Form(""),
    subject: str = Form(""),
    doc_kind: str = Form("notes"),
    user: dict = Depends(get_current_user),
):
    try:
        pages, suffix = await extract_pages(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to read file: {exc}")

    source_name = file.filename or f"document.{suffix}"
    chunks = chunk_pages(pages, source_name)
    text = full_text(pages)

    file_id = db.insert_file(
        user_id=user["id"],
        name=source_name,
        file_type=suffix,
        semester=semester or None,
        subject=subject or None,
        doc_kind=doc_kind or "notes",
        char_count=len(text),
        chunk_count=len(chunks),
    )
    db.insert_chunks(file_id, user["id"], chunks)
    store.add_chunks(file_id, user["id"], chunks)

    return UploadResponse(
        file_id=file_id,
        filename=source_name,
        status="indexed",
        chunks=len(chunks),
        char_count=len(text),
        text_preview=text[:400],
    )


@api_router.get("/files")
async def get_files(user: dict = Depends(get_current_user)):
    return {"files": db.list_files(user["id"]), "curriculum": config.MCA_CURRICULUM}


@api_router.delete("/files/{file_id}")
async def remove_file(file_id: int, user: dict = Depends(get_current_user)):
    if not db.get_file(file_id, user["id"]):
        raise HTTPException(status_code=404, detail="File not found")
    db.delete_file(file_id, user["id"])
    store.reload()
    return {"status": "deleted", "file_id": file_id}


# --------------------------------------------------------------------------- #
# RAG chat (metered)
# --------------------------------------------------------------------------- #
@api_router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")
    online = req.mode == "online"
    _guard_online(user, "chat", online)
    try:
        answer, sources, chunks, used_ai = ai_service.answer_query(
            question, user["id"], req.file_id, online
        )
    except ai_service.AIUnavailable as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}")
    credits = _settle(user, "chat", used_ai)
    return ChatResponse(answer=answer, sources=sources, chunks=chunks, used_ai=used_ai, credits=credits)


# --------------------------------------------------------------------------- #
# Study tools (metered)
# --------------------------------------------------------------------------- #
def _run_tool(user: dict, action: str, online: bool, fn):
    _guard_online(user, action, online)
    try:
        result = fn()
    except ai_service.AIUnavailable as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}")
    result["credits"] = _settle(user, action, result.get("used_ai", False))
    return result


@api_router.post("/summarize")
async def summarize(req: SummarizeRequest, user: dict = Depends(get_current_user)):
    online = req.mode == "online"
    return _run_tool(user, "summarize", online, lambda: study_tools.summarize(user["id"], req.file_id, online))


@api_router.post("/quiz")
async def quiz(req: QuizRequest, user: dict = Depends(get_current_user)):
    online = req.mode == "online"
    count = max(1, min(req.count, 20))
    return _run_tool(user, "quiz", online, lambda: study_tools.generate_quiz(user["id"], req.topic, count, req.file_id, online))


@api_router.post("/question-paper")
async def question_paper(req: PaperRequest, user: dict = Depends(get_current_user)):
    online = req.mode == "online"
    return _run_tool(user, "question_paper", online, lambda: study_tools.generate_paper(user["id"], req.subject, req.level, req.file_id, online))


@api_router.post("/revision-plan")
async def revision_plan(req: PlanRequest, user: dict = Depends(get_current_user)):
    online = req.mode == "online"
    return _run_tool(user, "revision_plan", online, lambda: study_tools.revision_plan(user["id"], req.days, req.subject, req.file_id, online))


@api_router.post("/analyze-papers")
async def analyze_papers(req: AnalyzeRequest, user: dict = Depends(get_current_user)):
    online = req.mode == "online"
    return _run_tool(user, "analyze", online, lambda: study_tools.analyze_papers(user["id"], req.file_id, online))


@api_router.get("/history")
async def history(limit: int = 50, user: dict = Depends(get_current_user)):
    return {"history": db.list_chat(user["id"], limit)}


# --------------------------------------------------------------------------- #
# Payments
# --------------------------------------------------------------------------- #
@api_router.get("/payments/plans")
async def payment_plans():
    return {"plans": config.PLANS, "razorpay_enabled": config.RAZORPAY_ENABLED}


@api_router.post("/payments/create-order")
async def create_order(req: CreateOrderRequest, user: dict = Depends(get_current_user)):
    if req.plan not in config.PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan.")
    try:
        order = payments.create_order(req.plan)
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return order


@api_router.post("/payments/verify")
async def verify_payment(req: VerifyPaymentRequest, user: dict = Depends(get_current_user)):
    plan = config.PLANS.get(req.plan)
    if not plan:
        raise HTTPException(status_code=400, detail="Unknown plan.")

    mock = payments.is_mock_order(req.order_id) or not config.RAZORPAY_ENABLED
    if not mock:
        if not payments.verify_signature(req.order_id, req.payment_id, req.signature):
            db.record_transaction(
                user["id"], req.plan, plan["price"], plan["credits"],
                req.order_id, req.payment_id, "failed",
            )
            raise HTTPException(status_code=400, detail="Payment verification failed.")

    db.add_credits(user["id"], plan["credits"], req.plan)
    db.record_transaction(
        user["id"], req.plan, plan["price"], plan["credits"],
        req.order_id, req.payment_id or "mock", "success",
    )
    updated = db.get_user(user["id"])
    return {
        "status": "success",
        "plan": updated["plan"],
        "credits": updated["credits"],
        "added": plan["credits"],
        "mock": mock,
    }
