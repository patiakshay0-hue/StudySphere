import { useEffect, useState } from "react";
import { useApp } from "../context";
import Logo from "../components/Logo";

/**
 * Full-screen 3D welcome splash shown right after login/signup. The logo flips
 * in on a 3D axis, the wordmark scales up, then the whole overlay fades away.
 */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const { user } = useApp();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const hold = reduce ? 1000 : 3000;
    const t1 = setTimeout(() => setClosing(true), hold);
    const t2 = setTimeout(onDone, hold + 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div className={"welcome" + (closing ? " closing" : "")}>
      <div className="welcome-bg" />
      <span className="wp wp1" />
      <span className="wp wp2" />
      <span className="wp wp3" />
      <span className="wp wp4" />
      <span className="wp wp5" />

      <div className="welcome-stage">
        <div className="welcome-logo-wrap">
          <div className="welcome-ring" />
          <Logo className="welcome-logo" />
        </div>
        <div className="welcome-kicker">WELCOME TO</div>
        <h1 className="welcome-title">StudySphere</h1>
        <p className="welcome-sub">
          {user?.name ? `Hi ${user.name.split(" ")[0]} — ` : ""}Learn Smarter. Achieve More.
        </p>
      </div>
    </div>
  );
}
