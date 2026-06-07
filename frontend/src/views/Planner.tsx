import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { makeAiErrorHandler } from "../useAiError";
import Markdown from "../components/Markdown";
import CostHint from "../components/CostHint";
import type { ViewKey } from "../App";

export default function Planner({ goto }: { goto: (v: ViewKey) => void }) {
  const { scopeId, mode, refreshUser, toast } = useApp();
  const [days, setDays] = useState(7);
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const onErr = makeAiErrorHandler(toast, goto);

  async function run() {
    setBusy(true);
    try {
      const r = await api.plan(days, subject, scopeId, mode);
      setPlan(r.plan);
      if (r.used_ai) refreshUser();
    } catch (e) {
      onErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Revision Planner</h2>
      <div className="form-row">
        <div className="field">
          <label>Days until exam</label>
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 7)}
          />
        </div>
        <div className="field">
          <label>Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Machine Learning"
          />
        </div>
      </div>
      <div className="action-row">
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Building…
            </>
          ) : (
            "Build Plan"
          )}
        </button>
        <CostHint action="revision_plan" />
      </div>
      {plan && <Markdown text={plan} />}
    </div>
  );
}
