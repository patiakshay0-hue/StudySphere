# StudySphere — Premium / Credits Architecture

This document describes the accounts, authentication, dual-mode (offline/online),
credits, and payments system added on top of the core RAG application.

## 1. Modes

| Mode | Engine | Auth | Credits | Availability |
| --- | --- | --- | --- | --- |
| **Offline** | Local TF-IDF retrieval (extractive answers) | Required (any account) | **0** | Always |
| **Online** | Claude API (RAG generation) | Required | **Costs credits** | When server has `ANTHROPIC_API_KEY` and user has credits |

A mode toggle lives in the UI. Every AI action sends `mode: "online" | "offline"`.
The backend enforces credit availability and only ever charges for **successful**
online generations.

## 2. Plans & Credits

| Plan | Price | Credits | Notes |
| --- | --- | --- | --- |
| Free | ₹0 | Offline mode + **10 trial credits** on signup | Default on signup |
| Starter | ₹99 | +50 | |
| Pro | ₹199 | +150 | Best value |
| Premium | ₹399 | +500 | |

- **Signup bonus:** every new account gets 10 trial credits to try online mode.
- **Rollover:** purchased credits **stack and never expire**.

### Credit cost per online action (tiered by token cost)

| Action | Credits |
| --- | --- |
| Ask Your Notes (chat) | 1 |
| Paper Analysis | 1 |
| Summarizer | 2 |
| Quiz Generator | 2 |
| Revision Planner | 2 |
| Question Paper | 3 |

## 3. Authentication

- **Passwords:** PBKDF2-HMAC-SHA256 with a per-user random salt (stdlib `hashlib`).
  Stored as `pbkdf2_sha256$<iterations>$<salt>$<hash>`.
- **Tokens:** JWT (HS256) via PyJWT. Payload `{sub: user_id, exp}`. 7-day expiry.
  Signing secret from `JWT_SECRET` env, else auto-generated and persisted to
  `backend/data/.jwt_secret`.
- **Transport:** `Authorization: Bearer <token>` header. A `get_current_user`
  FastAPI dependency decodes it and loads the user.

## 4. Multi-tenant data isolation

Every `file`, `chunk`, `chat_history`, and `transaction` row carries a `user_id`.
Retrieval (`vector_store.search`) always filters by the requesting user, so one
student never sees another's material.

## 5. Payments (Razorpay)

```
Client                         Backend                       Razorpay
  | create-order(plan) ───────► |                               |
  |                             | POST /v1/orders ────────────► |
  |                             | ◄──────────── order_id        |
  | ◄── {order_id, key_id, amt} |                               |
  | Razorpay Checkout ───────────────────────────────────────► |
  | ◄──────────── payment_id, signature ───────────────────────|
  | verify(order,payment,sig) ► |                               |
  |                             | HMAC verify (key_secret)      |
  |                             | credits += plan.credits       |
  | ◄── {credits, plan}         |                               |
```

- **Signature check:** `HMAC_SHA256(order_id|payment_id, key_secret)` compared in
  constant time against the `razorpay_signature` from Checkout.
- **Mock fallback:** when `RAZORPAY_KEY_ID/SECRET` are not configured, the server
  issues a mock order and verifies without a real charge — so the full upgrade
  flow is demoable in development. Switch to live by setting the env keys.
- Every successful purchase is recorded in the `transactions` table.

## 6. Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | — | Create account (+10 credits) |
| POST | `/api/auth/login` | — | Get JWT |
| GET | `/api/auth/me` | ✓ | Current user (plan, credits) |
| GET | `/api/status` | — | Server/AI status |
| GET | `/api/config` | — | Plans + credit costs + flags |
| POST | `/api/upload` | ✓ | Upload & index (per-user) |
| GET/DELETE | `/api/files` | ✓ | Manage own files |
| POST | `/api/chat` | ✓ | RAG chat (mode-aware, metered) |
| POST | `/api/summarize`,`/quiz`,`/question-paper`,`/revision-plan`,`/analyze-papers` | ✓ | Study tools (metered) |
| GET | `/api/history` | ✓ | Own conversation history |
| GET | `/api/payments/plans` | — | Plan catalogue |
| POST | `/api/payments/create-order` | ✓ | Start a purchase |
| POST | `/api/payments/verify` | ✓ | Confirm purchase, add credits |

## 7. Optimization & safety

- **Credits charged only on success.** If the Claude call errors, no deduction.
- **Atomic deduction:** `UPDATE ... WHERE credits >= cost` prevents going negative
  under concurrency.
- **No AI on offline mode:** offline never calls Claude, so it's free and fast.
- **Retrieval keeps prompts small:** only top-k chunks go to Claude, controlling
  token spend per credit.
- **Insufficient credits → HTTP 402** so the UI can prompt an upgrade cleanly.
