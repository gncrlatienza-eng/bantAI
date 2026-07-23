import type { ReactNode } from "react";

export function StepCard({
  number,
  title,
  description,
  icon,
  reveal = "reveal-up",
  timeline,
}: {
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
  reveal?: string;
  timeline?: boolean;
}) {
  return (
    <article className={`step-card ${timeline ? "step-card-timeline" : ""} ${reveal} reveal`.trim()} data-reveal>
      <div className="step-card-icon">{icon}</div>
      <span className="step-card-number">{number}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  );
}
