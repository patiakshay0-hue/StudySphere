import { useState } from "react";
import { useApp } from "../context";
import Logo from "../components/Logo";

export default function Auth() {
  const { login, signup, config, toast } = useApp();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "login") await login(email, password);
      else await signup(name, email, password);
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  const bonus = config?.signup_bonus ?? 10;

  return (
    <div className="auth-screen">
      <div className="auth-art">
        <div className="brand auth-brand">
          <Logo className="brand-logo auth-logo" />
          <div className="brand-text">
            <span className="brand-name">StudySphere</span>
            <span className="brand-tag">Smart MCA Assistant</span>
          </div>
        </div>
        <h2>Turn your notes into answers.</h2>
        <p>
          RAG-powered study assistant for MCA students. Upload notes, ask questions,
          generate quizzes and papers — with source citations.
        </p>
        <ul className="auth-points">
          <li>✦ Free offline mode — answers straight from your notes</li>
          <li>✦ Online (AI) mode powered by Claude</li>
          <li>✦ {bonus} free trial credits when you sign up</li>
        </ul>
        <div className="auth-orb" />
        <div className="auth-orb auth-orb2" />
      </div>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={tab === "login" ? "active" : ""}
              onClick={() => setTab("login")}
            >
              Log In
            </button>
            <button
              className={tab === "signup" ? "active" : ""}
              onClick={() => setTab("signup")}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={submit}>
            {tab === "signup" && (
              <div className="field">
                <label>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "signup" ? "At least 6 characters" : "••••••••"}
                required
                minLength={6}
              />
            </div>
            <button className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" /> Please wait…
                </>
              ) : tab === "login" ? (
                "Log In"
              ) : (
                `Create Account (+${bonus} credits)`
              )}
            </button>
          </form>

          <p className="auth-switch">
            {tab === "login" ? "New to StudySphere? " : "Already have an account? "}
            <button onClick={() => setTab(tab === "login" ? "signup" : "login")}>
              {tab === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
