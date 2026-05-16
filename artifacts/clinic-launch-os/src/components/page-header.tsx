import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h1
          className="text-foreground tracking-[-0.01em] leading-[1.15] text-[1.65rem] sm:text-[2.1rem]"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600 }}
        >
          {title}
        </h1>
        {subtitle && (
          <div className="flex items-center gap-3 mt-2">
            <div className="w-5 h-[1.5px] bg-primary/60 shrink-0 rounded-full" />
            <p className="text-[0.8rem] text-muted-foreground leading-snug tracking-wide uppercase font-medium" style={{ letterSpacing: "0.04em" }}>
              {subtitle}
            </p>
          </div>
        )}
      </div>
      {action && <div className="shrink-0 mt-1.5">{action}</div>}
    </div>
  );
}
