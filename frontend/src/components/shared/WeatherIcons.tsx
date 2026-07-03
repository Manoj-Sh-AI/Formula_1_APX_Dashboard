interface IconProps {
  className?: string;
}

export function TrackTempIcon({ className = "weather-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="3" y="15" width="4" height="1" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="9" y="15" width="4" height="1" rx="0.5" fill="currentColor" opacity="0.6" />
      <path
        d="M10 2v8.5M10 2a2 2 0 0 0-2 2v1a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function AirTempIcon({ className = "weather-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="3.5" fill="currentColor" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HumidityIcon({ className = "weather-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path
        d="M10 3c-3.5 5-6 7.5-6 10.2a6 6 0 0 0 12 0C16 10.5 13.5 8 10 3Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M8.5 14.5c.8 1 2.2 1 3 0"
        fill="none"
        stroke="var(--bg, #0a0a0a)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WindIcon({ className = "weather-icon", direction = 0 }: IconProps & { direction?: number | null }) {
  const rotate = direction != null ? direction : 0;
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <g transform={`rotate(${rotate} 10 10)`}>
        <path
          d="M3 7h9a2 2 0 1 0 0-4H5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M3 12h11a2.5 2.5 0 1 1 0 5H7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M3 17h6a1.5 1.5 0 1 0 0-3H5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function RainIcon({ className = "weather-icon", raining = false }: IconProps & { raining?: boolean }) {
  if (!raining) {
    return (
      <svg className={className} viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="8" r="3.5" fill="currentColor" />
        <path
          d="M10 2v1.5M10 13.5V15M4.2 5.8l1 1M14.8 5.8l-1 1M3 10h1.5M15.5 10H17"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path
        d="M5 9a4 4 0 0 1 7.2-2.2A3.2 3.2 0 0 1 16 9.5a3 3 0 0 1-.5 5.9H6.5A3.5 3.5 0 0 1 5 9Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M7 16l-.8 2M10 15l-.8 2M13 16l-.8 2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
