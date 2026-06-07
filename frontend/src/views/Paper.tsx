import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { makeAiErrorHandler } from "../useAiError";
import Markdown from "../components/Markdown";
import CostHint from "../components/CostHint";
import type { ViewKey } from "../App";

export default function Paper({ goto }: { goto: (v: ViewKey) => void }) {
  const { scopeId, mode, refreshUser, toast } = useApp();
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("university");
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState<string | null>(null);
  const onErr = makeAiErrorHandler(toast, goto);

  async function run() {
    setBusy(true);
    try {
      const r = await api.paper(subject, level, scopeId, mode);
      setPaper(r.paper);
      if (r.used_ai) refreshUser();
    } catch (e) {
      onErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Question Paper Generator</h2>
      <div className="form-row">
        <div className="field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. DBMS" />
        </div>
        <div className="field">
          <label>Difficulty</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="university">University Pattern</option>
          </select>
        </div>
      </div>
      <div className="action-row">
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Generating…
            </>
          ) : (
            "Generate Paper"
          )}
        </button>
        <CostHint action="question_paper" />
      </div>
      {paper && <Markdown text={paper} />}
    </div>
  );
}
