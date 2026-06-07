import { useEffect, useState } from "react";
import { api, type HistoryItem } from "../api";
import { useApp } from "../context";

export default function History() {
  const { toast } = useApp();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .history()
      .then((d) => setItems(d.history))
      .catch((e) => toast((e as Error).message, true))
      .finally(() => setLoaded(true));
  }, [toast]);

  return (
    <div className="card">
      <h2>Conversation History</h2>
      <div className="history-list">
        {loaded && items.length === 0 && (
          <p className="empty-note">
            No conversations yet. Ask a question in "Ask Your Notes".
          </p>
        )}
        {items.map((h) => (
          <div className="hist-item" key={h.id}>
            <div className="hist-q">{h.question}</div>
            <div className="hist-a">
              {h.answer.slice(0, 400)}
              {h.answer.length > 400 ? "…" : ""}
            </div>
            <div className="hist-time">
              {new Date(h.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
