import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent hover:bg-accent-hover text-white font-medium",
  secondary:
    "bg-surface border border-border text-ink hover:bg-surface-muted font-medium",
  ghost:
    "text-ink-secondary hover:text-ink hover:bg-surface-muted font-medium",
};

const sizeClasses: Record<Size, string> = {
  md: "h-10 px-5 text-sm rounded-lg",
  lg: "h-12 px-7 text-base rounded-lg",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
}

interface LinkButtonProps extends BaseProps {
  href: string;
  target?: string;
}

interface ActionButtonProps extends BaseProps {
  onClick?: () => void;
  type?: "button" | "submit";
}

export default function Button(props: LinkButtonProps | ActionButtonProps) {
  const { variant = "primary", size = "md", className = "", children, disabled } =
    props;

  const classes = [
    "inline-flex items-center justify-center gap-2 transition-colors duration-150 select-none",
    variantClasses[variant],
    sizeClasses[size],
    disabled ? "opacity-40 pointer-events-none" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        target={props.target}
        className={classes}
        aria-disabled={disabled}
      >
        {children}
      </Link>
    );
  }

  const actionProps = props as ActionButtonProps;
  return (
    <button
      type={actionProps.type ?? "button"}
      onClick={actionProps.onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
