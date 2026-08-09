import type { ReactNode } from "react";

interface CardProps {
  className?: string;
  children: ReactNode;
}

export default function Card({ className = "", children }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl ${className}`}
    >
      {children}
    </div>
  );
}
