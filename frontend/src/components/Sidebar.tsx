import { useApp } from "../context";
import Logo from "./Logo";
import type { ViewKey } from "../App";

interface NavDef {
  key: ViewKey;
  label: string;
  icon: string;
  group?: string;
}

const NAV: NavDef[] = [
  { key: "dashboard", label: "Dashboard", icon: "◆" },
  { key: "upload", label: "Upload Material", icon: "↑" },
  { key: "chat", label: "Ask Your Notes", icon: "✦" },
  { key: "knowledge", label: "Knowledge Base", icon: "▤" },
  { key: "summary", label: "Summarizer", icon: "≡", group: "Study Tools" },
  { key: "quiz", label: "Quiz Generator", icon: "?" },
  { key: "paper", label: "Paper Generator", icon: "✎" },
  { key: "planner", label: "Revision Planner", icon: "◷" },
  { key: "analysis", label: "Paper Analysis", icon: "▮" },
  { key: "history", label: "History", icon: "⟲" },
  { key: "pricing", label: "Upgrade & Credits", icon: "✦", group: "Account" },
];

export default function Sidebar({
  view,
  setView,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
}) {
  const { user, logout } = useApp();

  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">StudySphere</span>
          <span className="brand-tag">Smart MCA Assistant</span>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((n) => (
          <div key={n.key}>
            {n.group && <p className="nav-label">{n.group}</p>}
            <button
              className={"nav-item" + (view === n.key ? " active" : "")}
              onClick={() => setView(n.key)}
            >
              <span className="ic">{n.icon}</span>
              <span className="lbl">{n.label}</span>
            </button>
          </div>
        ))}
      </nav>

      <div className="user-box">
        <div className="user-info">
          <span className="user-name">{user?.name}</span>
          <span className={"plan-badge plan-" + (user?.plan || "free")}>
            {user?.plan?.toUpperCase()}
          </span>
        </div>
        <button className="logout-btn" onClick={logout} title="Log out">
          ⎋
        </button>
      </div>
    </aside>
  );
}
