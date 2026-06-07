import { useEffect } from "react";
import { api } from "../api";
import { useApp } from "../context";

export default function Knowledge() {
  const { files, curriculum, refreshFiles, toast } = useApp();

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  async function remove(id: number) {
    if (!confirm("Delete this file from the index?")) return;
    try {
      await api.deleteFile(id);
      toast("File deleted.");
      refreshFiles();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Knowledge Base</h2>
        <p className="muted">
          Your uploaded material, organized. Delete anything to remove it from the
          index.
        </p>
        <div className="file-list">
          {files.length === 0 && (
            <p className="empty-note">
              No files yet. Upload material to build your knowledge base.
            </p>
          )}
          {files.map((f) => (
            <div className="file-row" key={f.id}>
              <div className="file-meta">
                <span className="fn">{f.name}</span>
                <span className="fd">
                  {f.semester && <span className="pill">{f.semester}</span>}
                  {f.subject && <span className="pill">{f.subject}</span>}
                  <span className="pill">{(f.doc_kind || "notes").replace("_", " ")}</span>
                  {f.chunk_count} chunks · {f.char_count.toLocaleString()} chars
                </span>
              </div>
              <button className="del-btn" onClick={() => remove(f.id)} title="Delete">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>MCA Curriculum</h2>
        <p className="muted">Suggested subjects per semester.</p>
        <div className="curriculum">
          {Object.entries(curriculum).map(([sem, subs]) => (
            <div className="sem-card" key={sem}>
              <h4>{sem}</h4>
              {subs.map((s) => (
                <span key={s}>• {s}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
