import { useApp } from "../context";

export default function ScopeSelect() {
  const { files, scopeId, setScopeId } = useApp();
  return (
    <div className="file-scope">
      <label>Scope:</label>
      <select
        value={scopeId ?? ""}
        onChange={(e) => setScopeId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">All uploaded material</option>
        {files.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
            {f.subject ? ` — ${f.subject}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
