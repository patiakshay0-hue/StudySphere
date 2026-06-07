import { useState } from "react";
import { useApp } from "./context";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Auth from "./views/Auth";
import Dashboard from "./views/Dashboard";
import Upload from "./views/Upload";
import Chat from "./views/Chat";
import Knowledge from "./views/Knowledge";
import Summarizer from "./views/Summarizer";
import Quiz from "./views/Quiz";
import Paper from "./views/Paper";
import Planner from "./views/Planner";
import Analysis from "./views/Analysis";
import History from "./views/History";
import Pricing from "./views/Pricing";
import Welcome from "./views/Welcome";

export type ViewKey =
  | "dashboard"
  | "upload"
  | "chat"
  | "knowledge"
  | "summary"
  | "quiz"
  | "paper"
  | "planner"
  | "analysis"
  | "history"
  | "pricing";

export const TITLES: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  upload: "Upload Material",
  chat: "Ask Your Notes",
  knowledge: "Knowledge Base",
  summary: "Notes Summarizer",
  quiz: "Quiz Generator",
  paper: "Question Paper Generator",
  planner: "Revision Planner",
  analysis: "Previous Paper Analysis",
  history: "History",
  pricing: "Upgrade & Credits",
};

export default function App() {
  const { user, authReady, justAuthed, clearWelcome } = useApp();
  const [view, setView] = useState<ViewKey>("dashboard");

  if (!authReady) {
    return (
      <div className="boot">
        <div className="spinner dark" /> Loading StudySphere…
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="app">
      {justAuthed && <Welcome onDone={clearWelcome} />}
      <Sidebar view={view} setView={setView} />
      <main className="main">
        <Topbar view={view} setView={setView} />
        <div className="content" key={view}>
          {view === "dashboard" && <Dashboard goto={setView} />}
          {view === "upload" && <Upload />}
          {view === "chat" && <Chat goto={setView} />}
          {view === "knowledge" && <Knowledge />}
          {view === "summary" && <Summarizer goto={setView} />}
          {view === "quiz" && <Quiz goto={setView} />}
          {view === "paper" && <Paper goto={setView} />}
          {view === "planner" && <Planner goto={setView} />}
          {view === "analysis" && <Analysis goto={setView} />}
          {view === "history" && <History />}
          {view === "pricing" && <Pricing />}
        </div>
      </main>
    </div>
  );
}
