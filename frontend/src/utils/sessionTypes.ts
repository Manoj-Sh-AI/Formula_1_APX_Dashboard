export interface ScheduleEvent {
  round_number: number;
  event_name: string;
  date: string;
  country: string;
  type: string;
  session_dates?: Record<string, string>;
}

export const SESSION_TYPE_OPTIONS = [
  { value: "SQ", label: "Sprint Qualifying" },
  { value: "S", label: "Sprint" },
  { value: "Q", label: "Qualifying" },
  { value: "R", label: "Race" },
] as const;

export type SessionTypeCode = (typeof SESSION_TYPE_OPTIONS)[number]["value"];

const SESSION_DATE_KEYS: Record<string, string[]> = {
  R: ["Race"],
  S: ["Sprint"],
  Q: ["Qualifying"],
  SQ: ["Sprint Qualifying", "Sprint Shootout"],
};

export function isSprintWeekend(event: { type?: string }): boolean {
  return (event.type ?? "").toLowerCase().includes("sprint");
}

export function isSessionPast(
  event: ScheduleEvent,
  code: SessionTypeCode,
): boolean {
  const keys = SESSION_DATE_KEYS[code] ?? [];
  const dates = event.session_dates ?? {};
  for (const key of keys) {
    const iso = dates[key];
    if (iso) return new Date(iso) <= new Date();
  }
  return true;
}

export function sessionTypesForEvent(
  event: ScheduleEvent | undefined,
  filterPast = true,
): typeof SESSION_TYPE_OPTIONS[number][] {
  if (!event) return [...SESSION_TYPE_OPTIONS];

  const base: typeof SESSION_TYPE_OPTIONS[number][] = isSprintWeekend(event)
    ? [
        { value: "SQ", label: "Sprint Qualifying" },
        { value: "S", label: "Sprint" },
        { value: "Q", label: "Qualifying" },
        { value: "R", label: "Race" },
      ]
    : [
        { value: "Q", label: "Qualifying" },
        { value: "R", label: "Race" },
      ];

  if (!filterPast) return base;
  return base.filter((st) => isSessionPast(event, st.value));
}
