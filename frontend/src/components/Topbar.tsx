import { useApp } from "../context";
import { TITLES, type ViewKey } from "../App";
import ScopeSelect from "./ScopeSelect";

export default function Topbar({
  view,
  setView,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
}) {
  const { user, mode, setMode, config, toast } = useApp();
  const aiEnabled = config?.ai_enabled ?? false;

  function pickOnline() {
    if (!aiEnabled) {
      toast("Online mode isn't configured on the server (no API key).", true);
      return;
    }
    setMode("online");
  }

  return (
    <header className="topbar">
      <h1>{TITLES[view]}</h1>
      <div className="topbar-right">
        <ScopeSelect />

        <div className="mode-toggle" title="Offline is free. Online uses AI credits.">
          <button
            className={"mode-opt" + (mode === "offline" ? " active" : "")}
            onClick={() => setMode("offline")}
          >
            Offline
          </button>
          <button
            className={"mode-opt" + (mode === "online" ? " active" : "")}
            onClick={pickOnline}
            disabled={!aiEnabled}
          >
            Online ✦
          </button>
        </div>

        <button className="credits-pill" onClick={() => setView("pricing")} title="Buy more credits">
          <span className="cr-num">{user?.credits ?? 0}</span> credits
          <span className="cr-plan">{user?.plan}</span>
        </button>
      </div>
    </header>
  );
}
