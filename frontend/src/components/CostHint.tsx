import { useApp } from "../context";

export default function CostHint({ action }: { action: string }) {
  const { mode, config } = useApp();
  const cost = config?.credit_costs[action] ?? 1;
  return (
    <span className={"cost-hint " + mode}>
      {mode === "online" ? `Online · ${cost} credit${cost > 1 ? "s" : ""}` : "Offline · free"}
    </span>
  );
}
