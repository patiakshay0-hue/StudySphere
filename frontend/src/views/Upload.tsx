import { useRef, useState } from "react";
import { api } from "../api";
import { useApp } from "../context";

export default function Upload() {
  const { toast, refreshFiles } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [semester, setSemester] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("notes");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doUpload() {
    if (!file) return toast("Please choose a file first.", true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("semester", semester);
    fd.append("subject", subject);
    fd.append("doc_kind", kind);
    setBusy(true);
    try {
      const r = await api.upload(fd);
      setResult(
        `✓ ${r.filename} indexed — ${r.chunks} chunks, ` +
          `${r.char_count.toLocaleString()} characters.`
      );
      toast("File indexed successfully!");
      setFile(null);
      refreshFiles();
    } catch (e) {
      const raw = (e as Error).message || "Upload failed.";
      // Network/proxy failure → the request never reached the server.
      const friendly = /failed to fetch|networkerror|load failed|fetch/i.test(raw)
        ? "Couldn't reach the server. Refresh the page and try again (make sure the app is running)."
        : raw;
      setError(friendly);
      toast(friendly, true);
    } finally {
      setBusy(false);
    }
  }

  const sizeMB = file ? file.size / (1024 * 1024) : 0;

  return (
    <div className="card">
      <h2>Upload Study Material</h2>
      <p className="muted">
        Supported: PDF, DOCX, PPTX, TXT, MD. Files are chunked, indexed, and made
        searchable instantly.
      </p>

      <div
        className={"dropzone" + (drag ? " drag" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,.pptx,.txt,.md"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="dz-inner">
          <div className="dz-icon">↑</div>
          <p>
            <strong>Click to browse</strong> or drag &amp; drop a file
          </p>
          <span className="muted">
            {file ? `${file.name} · ${sizeMB.toFixed(1)} MB` : "No file selected"}
          </span>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Semester</label>
          <select value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="">—</option>
            <option>Semester 1</option>
            <option>Semester 2</option>
            <option>Semester 3</option>
            <option>Semester 4</option>
          </select>
        </div>
        <div className="field">
          <label>Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Machine Learning"
          />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="notes">Notes</option>
            <option value="ebook">E-book</option>
            <option value="ppt">PPT</option>
            <option value="previous_paper">Previous Paper</option>
            <option value="lab_manual">Lab Manual</option>
            <option value="assignment">Assignment</option>
          </select>
        </div>
      </div>

      <button className="btn btn-primary" onClick={doUpload} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" />
            Indexing…
          </>
        ) : (
          "Upload & Index"
        )}
      </button>

      {result && <div className="result-box">{result}</div>}
      {error && (
        <div className="result-box" style={{ background: "var(--red-soft)", color: "var(--red-dark)" }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
