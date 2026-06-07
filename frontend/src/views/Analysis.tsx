import { useState } from "react";
import { api, type TopicStat } from "../api";
import { useApp } from "../context";
import { makeAiErrorHandler } from "../useAiError";
import CostHint from "../components/CostHint";
import type { ViewKey } from "../App";

export default function Analysis({ goto }: { goto: (v: ViewKey) => void }) {
  const { scopeId, mode, refreshUser, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [topics, setTopics] = useState<TopicStat[] | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const onErr = makeAiErrorHandler(toast, goto);

  async function run() {
    setBusy(true);
    setTopics(null);
    setInsight(null);
    setMessage(null);
    try {
      const r = await api.analyze(scopeId, mode);
      if (!r.topics || r.topics.length === 0) {
        setMessage(r.message || "No data to analyze.");
      } else {
        setTopics(r.topics);
        setInsight(r.insight || null);
        if (r.used_ai) refreshUser();
      }
    } catch (e) {
      onErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Previous Paper Analysis</h2>
      <p className="muted">
        Upload previous question papers, then find the most repeated topics. Tip: set
        the scope above to a previous-paper file. (Topic frequency works offline; online
        mode adds an AI study recommendation.)
      </p>
      <div className="action-row">
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Analyzing…
            </>
          ) : (
            "Analyze Topics"
          )}
        </button>
        <CostHint action="analyze" />
      </div>

      {message && <p className="empty-note">{message}</p>}
      {insight && <div className="insight">💡 {insight}</div>}
      {topics && (
        <div className="bars">
          {topics.map((t) => (
            <div className="bar-row" key={t.topic}>
              <div className="bar-label">{t.topic}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: Math.max(t.weight * 100, 12) + "%" }}>
                  {t.frequency}×
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
