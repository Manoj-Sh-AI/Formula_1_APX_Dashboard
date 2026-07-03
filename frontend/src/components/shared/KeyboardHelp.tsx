import { useEffect, useState } from "react";

const SHORTCUTS = [
  { keys: "Space", action: "Play / Pause" },
  { keys: "← / →", action: "Step frame" },
  { keys: "L", action: "Toggle map labels" },
  { keys: "?", action: "Toggle this help" },
  { keys: "D", action: "Cycle layout mode" },
  { keys: "Esc", action: "Reset to Operational layout" },
] as const;

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (e.key === "?" || (e.shiftKey && e.code === "Slash")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <div className="keyboard-help" role="dialog" aria-label="Keyboard shortcuts">
      <h4>Keyboard Shortcuts</h4>
      <ul>
        {SHORTCUTS.map((s) => (
          <li key={s.keys}>
            <span>{s.action}</span>
            <kbd>{s.keys}</kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
