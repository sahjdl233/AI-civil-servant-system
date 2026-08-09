type Tone = "accent" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

interface ScoreBarProps {
  value: number;
  tone?: Tone;
  className?: string;
  trackClassName?: string;
}

export default function ScoreBar({
  value,
  tone = "accent",
  className = "",
  trackClassName = "",
}: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`w-full bg-surface-muted rounded-full overflow-hidden ${trackClassName}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`${toneClasses[tone]} rounded-full transition-all duration-700 ease-out ${className}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
