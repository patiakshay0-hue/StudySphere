import { mdToHtml } from "../md";

export default function Markdown({ text }: { text: string }) {
  return (
    <div
      className="result-box markdown"
      dangerouslySetInnerHTML={{ __html: mdToHtml(text) }}
    />
  );
}
