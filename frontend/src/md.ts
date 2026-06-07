// Tiny, safe markdown → HTML converter (escapes first, then formats).
// Enough for the headings/lists/bold/code the backend emits, without pulling
// in a markdown dependency.
export function mdToHtml(md: string): string {
  let h = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  h = h
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.*)$/gm, "<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => "<ul>" + m + "</ul>");
  h = h.replace(/<\/ul>\s*<ul>/g, "");
  return h.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
}
