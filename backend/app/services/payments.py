"""Razorpay payments — order creation and signature verification.

Implemented with the standard library (urllib + hmac) so there's no extra SDK to
install. When Razorpay keys aren't configured, a mock flow is used so the full
upgrade experience can be demoed in development.
"""
import base64
import hashlib
import hmac
import json
import secrets
import urllib.error
import urllib.request
from typing import Optional

from app import config

_RZP_BASE = "https://api.razorpay.com/v1"


class PaymentError(Exception):
    pass


def _rzp_post(path: str, payload: dict) -> dict:
    auth = base64.b64encode(
        f"{config.RAZORPAY_KEY_ID}:{config.RAZORPAY_KEY_SECRET}".encode()
    ).decode()
    req = urllib.request.Request(
        _RZP_BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Basic " + auth, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise PaymentError(f"Razorpay error: {exc.read().decode(errors='ignore')}") from exc
    except Exception as exc:  # network
        raise PaymentError(str(exc)) from exc


def create_order(plan_key: str) -> dict:
    """Create a payment order for a plan. Returns details for Razorpay Checkout."""
    plan = config.PLANS.get(plan_key)
    if not plan:
        raise PaymentError("Unknown plan.")
    amount_paise = plan["price"] * 100

    if not config.RAZORPAY_ENABLED:
        # Mock order — no real charge; verify() will accept it.
        return {
            "mock": True,
            "order_id": "order_mock_" + secrets.token_hex(8),
            "amount": amount_paise,
            "currency": "INR",
            "key_id": None,
            "plan": plan_key,
            "plan_name": plan["name"],
            "credits": plan["credits"],
        }

    order = _rzp_post(
        "/orders",
        {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": "rcpt_" + secrets.token_hex(6),
            "payment_capture": 1,
        },
    )
    return {
        "mock": False,
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": config.RAZORPAY_KEY_ID,
        "plan": plan_key,
        "plan_name": plan["name"],
        "credits": plan["credits"],
    }


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    expected = hmac.new(
        config.RAZORPAY_KEY_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def is_mock_order(order_id: Optional[str]) -> bool:
    return bool(order_id and order_id.startswith("order_mock_"))
