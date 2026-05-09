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
          className="text-foreground leading-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.9rem", fontWeight: 500 }}
        >
          {title}
        </h1>
        {subtitle && (
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-6 h-px bg-primary shrink-0" />
            <p className="text-sm text-muted-foreground leading-snug">{subtitle}</p>
          </div>
        )}
      </div>
      {action && <div className="shrink-0 mt-1">{action}</div>}
    </div>
  );
}
