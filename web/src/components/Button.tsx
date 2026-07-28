import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "ghost" | "outline";

export function Button({
  children,
  to,
  href,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
  type?: "button" | "submit";
}) {
  const classes = `btn btn-${variant} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick}>
      {children}
    </button>
  );
}
