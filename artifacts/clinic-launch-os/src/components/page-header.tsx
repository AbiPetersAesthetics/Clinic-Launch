import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Hide the subtitle on phones (boards repeat it inside). */
  compact?: boolean;
}

export function PageHeader({ title, subtitle, action, compact }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6 sm:mb-8">
      <div className="min-w-0">
        <h1
          className="text-foreground tracking-[-0.01em] leading-[1.15] text-[1.6rem] sm:text-[2.1rem]"
          style={{ fontFamily: "var(--app-font-serif)", fontWeight: 500 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className={`mt-2 text-[0.95rem] text-muted-foreground leading-relaxed max-w-[70ch] ${compact ? "hidden sm:block" : ""}`}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 sm:mt-1.5">{action}</div>}
    </div>
  );
}
