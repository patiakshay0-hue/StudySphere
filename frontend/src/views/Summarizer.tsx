import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { makeAiErrorHandler } from "../useAiError";
import Markdown from "../components/Markdown";
import CostHint from "../components/CostHint";
import type { ViewKey } from "../App";

export default function Summarizer({ goto }: { goto: (v: ViewKey) => void }) {
  const { scopeId, mode, refreshUser, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const onErr = makeAiErrorHandler(toast, goto);

  async function run() {
    setBusy(true);
    try {
      const r = await api.summarize(scopeId, mode);
      setSummary(r.summary);
      if (r.used_ai) refreshUser();
    } catch (e) {
      onErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Notes Summarizer</h2>
      <p className="muted">Generate a key-concepts revision sheet from the selected scope.</p>
      <div className="action-row">
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Generating…
            </>
          ) : (
            "Generate Summary"
          )}
        </button>
        <CostHint action="summarize" />
      </div>
      {summary && <Markdown text={summary} />}
    </div>
  );
}
