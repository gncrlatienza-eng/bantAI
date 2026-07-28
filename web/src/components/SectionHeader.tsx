export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
  reveal = "reveal-up",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  reveal?: string;
}) {
  return (
    <div
      className={`section-header ${align === "left" ? "align-left" : ""} ${reveal} reveal`.trim()}
      data-reveal
    >
      {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}
