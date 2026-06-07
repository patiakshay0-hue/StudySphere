import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import type { ViewKey } from "../App";

const FEATURES: { key: ViewKey; title: string; desc: string }[] = [
  { key: "chat", title: "✦ Ask Your Notes", desc: "RAG-powered answers with source citations." },
  { key: "summary", title: "≡ Summarize", desc: "Condense long PDFs into revision sheets." },
  { key: "quiz", title: "? Quiz Me", desc: "Auto-generate MCQs from any topic." },
  { key: "paper", title: "✎ Paper Generator", desc: "Create university-pattern question papers." },
  { key: "planner", title: "◷ Revision Planner", desc: "Day-by-day plan before your exam." },
  { key: "analysis", title: "▮ Paper Analysis", desc: "Find the most repeated exam topics." },
];

export default function Dashboard({ goto }: { goto: (v: ViewKey) => void }) {
  const { user, files } = useApp();
  const [s, setS] = useState({ files: 0, indexed_chunks: 0, subjects: 0, conversations: 0 });

  useEffect(() => {
    api.stats().then((d) => setS(d)).catch(() => {});
  }, [files]);

  const stats = [
    { num: s.files, lbl: "Files indexed" },
    { num: s.indexed_chunks, lbl: "Knowledge chunks" },
    { num: user?.credits ?? 0, lbl: "AI credits" },
    { num: s.conversations, lbl: "Questions asked" },
  ];

  return (
    <>
      <div className="hero">
        <div className="hero-text">
          <h2>Welcome back, {user?.name?.split(" ")[0]} 👋</h2>
          <p>
            Upload your MCA material, then ask questions in plain English. Use{" "}
            <em>Offline</em> mode free, or switch to <em>Online</em> mode for
            AI-written answers powered by Claude.
          </p>
          <div className="hero-actions">
            <button className="btn btn-light" onClick={() => goto("upload")}>
              Upload material →
            </button>
            <button className="btn btn-outline-light" onClick={() => goto("pricing")}>
              Get more credits
            </button>
          </div>
        </div>
        <div className="hero-art">
          <div className="orb" />
          <div className="orb orb2" />
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((st) => (
          <div className="stat-card" key={st.lbl}>
            <span className="stat-num">{st.num}</span>
            <span className="stat-lbl">{st.lbl}</span>
          </div>
        ))}
      </div>

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <button className="feature" key={f.key} onClick={() => goto(f.key)}>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </button>
        ))}
      </div>
    </>
  );
}
