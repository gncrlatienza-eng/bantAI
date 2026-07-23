import type { LucideIcon } from "lucide-react";

type Tone = "red" | "amber" | "blue";

export function ThreatCard({
  tone,
  icon: Icon,
  title,
  description,
  badge,
  reveal,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string;
  reveal: "reveal-left" | "reveal-right" | "reveal-up";
}) {
  return (
    <article className={`threat-card ${reveal} reveal`} data-reveal>
      <div className={`threat-icon tone-${tone}`}>
        <Icon size={22} aria-hidden="true" />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      <span className={`badge ${tone === "amber" ? "amber" : tone === "blue" ? "gray" : "red"}`}>{badge}</span>
    </article>
  );
}
