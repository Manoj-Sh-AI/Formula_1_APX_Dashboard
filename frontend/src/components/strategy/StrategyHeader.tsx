interface StrategyHeaderProps {
  currentLap: number;
  totalLaps: number;
  displayLap?: string;
}

export function StrategyHeader({
  currentLap,
  totalLaps,
  displayLap,
}: StrategyHeaderProps) {
  const lapLabel = displayLap ?? String(currentLap);

  return (
    <div className="strategy-header">
      <span className="strategy-flag">🏁</span>
      <span className="strategy-title">TYRE STRATEGY</span>
      <span className="strategy-lap-label">
        LAP {lapLabel} / {totalLaps}
      </span>
    </div>
  );
}
