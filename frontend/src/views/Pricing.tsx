import { useState } from "react";
import { api, ApiError, type OrderInfo } from "../api";
import { useApp } from "../context";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const PLAN_ORDER = ["free", "starter", "pro", "premium"];

export default function Pricing() {
  const { user, config, refreshUser, toast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  if (!config) return <p className="empty-note">Loading plans…</p>;
  const plans = config.plans;

  async function finalize(order: OrderInfo, planKey: string, payment_id = "", signature = "") {
    const r = await api.verifyPayment({
      plan: planKey,
      order_id: order.order_id,
      payment_id,
      signature,
    });
    refreshUser();
    toast(
      `Success! +${r.added} credits added${r.mock ? " (test/mock payment)" : ""}. Balance: ${r.credits}.`
    );
  }

  async function buy(planKey: string) {
    setBusy(planKey);
    try {
      const order = await api.createOrder(planKey);

      // Mock flow (no Razorpay keys configured): credit immediately.
      if (order.mock || !order.key_id) {
        await finalize(order, planKey);
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) {
        toast("Could not load Razorpay Checkout.", true);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "StudySphere",
        description: `${order.plan_name} — ${order.credits} credits`,
        order_id: order.order_id,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#d62828" },
        handler: async (resp: any) => {
          try {
            await finalize(
              order,
              planKey,
              resp.razorpay_payment_id,
              resp.razorpay_signature
            );
          } catch (e) {
            toast((e as Error).message, true);
          }
        },
      });
      rzp.on("payment.failed", () => toast("Payment failed or cancelled.", true));
      rzp.open();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      toast(msg, true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="card balance-card">
        <div>
          <span className="muted" style={{ margin: 0 }}>
            Current balance
          </span>
          <div className="balance-num">{user?.credits ?? 0} credits</div>
        </div>
        <span className={"plan-badge plan-" + (user?.plan || "free")}>
          {user?.plan?.toUpperCase()} PLAN
        </span>
      </div>

      <div className="pricing-grid">
        {/* Free tier card */}
        <div className="price-card">
          <h3>Free</h3>
          <div className="price">
            ₹0<span>/forever</span>
          </div>
          <ul>
            <li>✓ Offline mode (unlimited)</li>
            <li>✓ {config.signup_bonus} trial credits on signup</li>
            <li>✓ Upload &amp; search your notes</li>
            <li>✓ All study tools (offline)</li>
          </ul>
          <button className="btn btn-ghost" disabled>
            {user?.plan === "free" ? "Current plan" : "Included"}
          </button>
        </div>

        {PLAN_ORDER.filter((k) => k !== "free").map((key) => {
          const p = plans[key];
          if (!p) return null;
          const featured = key === "pro";
          return (
            <div className={"price-card" + (featured ? " featured" : "")} key={key}>
              {featured && <div className="ribbon">Best value</div>}
              <h3>{p.name}</h3>
              <div className="price">
                ₹{p.price}
                <span>/{p.credits} credits</span>
              </div>
              <ul>
                <li>✓ {p.credits} AI (online) credits</li>
                <li>✓ Claude-powered answers</li>
                <li>✓ Credits never expire</li>
                <li>✓ Everything in Free</li>
              </ul>
              <button
                className="btn btn-primary"
                onClick={() => buy(key)}
                disabled={busy !== null}
              >
                {busy === key ? (
                  <>
                    <span className="spinner" /> Processing…
                  </>
                ) : (
                  `Buy ${p.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      {!config.razorpay_enabled && (
        <p className="empty-note">
          ⓘ Razorpay keys are not configured, so purchases use a test/mock flow and
          credit your account instantly. Add <code>RAZORPAY_KEY_ID</code> and{" "}
          <code>RAZORPAY_KEY_SECRET</code> in <code>backend/.env</code> to enable real
          payments.
        </p>
      )}

      <div className="card" style={{ marginTop: 22 }}>
        <h2>How credits work</h2>
        <p className="muted">Online actions spend credits (offline mode is always free):</p>
        <div className="cost-grid">
          {Object.entries(config.credit_costs).map(([action, cost]) => (
            <div className="cost-item" key={action}>
              <span>{action.replace("_", " ")}</span>
              <span className="cost-val">{cost} cr</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
