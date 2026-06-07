import { useState } from "react";
import { api, type QuizQuestion } from "../api";
import { useApp } from "../context";
import { makeAiErrorHandler } from "../useAiError";
import CostHint from "../components/CostHint";
import type { ViewKey } from "../App";

function QuizCard({ q, index }: { q: QuizQuestion; index: number }) {
  const [chosen, setChosen] = useState<number | null>(null);
  return (
    <div className="q-card">
      <div className="q-text">
        {index + 1}. {q.question}
      </div>
      {q.options.map((opt, idx) => {
        let cls = "q-opt";
        if (chosen !== null) {
          if (idx === q.answer) cls += " correct";
          else if (idx === chosen) cls += " wrong";
        }
        return (
          <button key={idx} className={cls} onClick={() => chosen === null && setChosen(idx)}>
            {String.fromCharCode(65 + idx)}. {opt}
          </button>
        );
      })}
      {chosen !== null && (
        <div className="q-exp">
          ✓ Correct: {String.fromCharCode(65 + q.answer)}. {q.explanation}
        </div>
      )}
    </div>
  );
}

export default function Quiz({ goto }: { goto: (v: ViewKey) => void }) {
  const { scopeId, mode, refreshUser, toast } = useApp();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const onErr = makeAiErrorHandler(toast, goto);

  async function run() {
    setBusy(true);
    setQuestions(null);
    setMessage(null);
    try {
      const r = await api.quiz(topic, count, scopeId, mode);
      if (!r.questions || r.questions.length === 0) {
        setMessage(r.message || "No questions generated. Upload notes first.");
      } else {
        setQuestions(r.questions);
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
      <h2>Quiz Generator</h2>
      <div className="form-row">
        <div className="field">
          <label>Topic (optional)</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Normalization" />
        </div>
        <div className="field">
          <label>Questions</label>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 5)}
          />
        </div>
      </div>
      <div className="action-row">
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Generating…
            </>
          ) : (
            "Generate Quiz"
          )}
        </button>
        <CostHint action="quiz" />
      </div>

      {message && <p className="empty-note">{message}</p>}
      {questions && (
        <div className="quiz-result">
          {questions.map((q, i) => (
            <QuizCard key={i} q={q} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
