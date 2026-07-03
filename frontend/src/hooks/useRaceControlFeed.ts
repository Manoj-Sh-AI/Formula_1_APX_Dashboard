import { useMemo } from "react";
import type { RaceControlMessage } from "../types";
import { eventHash } from "../utils/raceControlColors";

export function useRaceControlFeed(
  messages: RaceControlMessage[] | undefined,
  currentTime: number,
  frameIndex: number,
) {
  const visibleEvents = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const seen = new Set<string>();
    const result: RaceControlMessage[] = [];

    for (const event of messages) {
      if (event.time > currentTime) continue;
      const hash = eventHash(event);
      if (seen.has(hash)) continue;
      seen.add(hash);
      result.push(event);
    }

    return result.sort((a, b) => a.time - b.time);
  }, [messages, currentTime, frameIndex]);

  const hasData = (messages?.length ?? 0) > 0;
  const latest =
    visibleEvents.length > 0
      ? visibleEvents[visibleEvents.length - 1]
      : null;

  return { visibleEvents, hasData, latest };
}
