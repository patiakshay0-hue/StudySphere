import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { makeAiErrorHandler } from "../useAiError";
import type { ViewKey } from "../App";

interface Message {
  role: "user" | "bot";
  text: string;
  sources?: string[];
  thinking?: boolean;
}

export default function Chat({ goto }: { goto: (v: ViewKey) => void }) {
  const { scopeId, mode, config, refreshUser, toast } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const onErr = makeAiErrorHandler(toast, goto);
  const cost = config?.credit_costs.chat ?? 1;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast("Voice input failed.", true);
    };
    recRef.current = rec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(qText?: string) {
    const q = (qText ?? input).trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", text: q },
      { role: "bot", text: mode === "online" ? "Thinking…" : "Searching your notes…", thinking: true },
    ]);
    try {
      const r = await api.chat(q, scopeId, mode);
      setMessages((m) => [...m.slice(0, -1), { role: "bot", text: r.answer, sources: r.sources }]);
      if (r.used_ai) refreshUser();
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      onErr(e);
    }
  }

  function startVoice() {
    if (!recRef.current) return toast("Voice input not supported in this browser.", true);
    try {
      recRef.current.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }

  return (
    <div className="chat-wrap">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <h3>Ask anything about your notes</h3>
            <p className="muted">e.g. "Explain Logistic Regression in simple terms"</p>
            <div className={"mode-hint " + mode}>
              {mode === "online"
                ? `Online mode · ${cost} credit per question`
                : "Offline mode · free, answers from your notes"}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"msg " + m.role + (m.thinking ? " thinking" : "")}>
            {m.text}
            {m.sources && m.sources.length > 0 && (
              <div className="sources">
                <strong>Sources:</strong>
                <br />
                {m.sources.map((s, j) => (
                  <span className="src-tag" key={j}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="chat-input">
        {recRef.current && (
          <button
            className={"icon-btn" + (listening ? " listening" : "")}
            onClick={startVoice}
            title="Voice input"
          >
            🎤
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type your question…"
        />
        <button className="btn btn-primary" onClick={() => send()}>
          Ask
        </button>
      </div>
    </div>
  );
}
