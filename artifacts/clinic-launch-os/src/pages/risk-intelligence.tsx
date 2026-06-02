import { useState, useRef, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Brain, RefreshCw, AlertCircle, Loader2, ChevronDown, Lock, Clock } from "lucide-react";

const PROJECT_ID = 1;
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const PARTS = [
  { id: "1", label: "Blind Spots", subtitle: "Second-order effects and dependency chains the model hasn't captured" },
  { id: "2", label: "Early Warning Signals", subtitle: "The exact number that moves first before each risk becomes a crisis" },
  { id: "3", label: "The Response Playbook", subtitle: "Specific actions, costs, channels and lead times — not generic advice" },
  { id: "4", label: "The One Thing", subtitle: "Most likely failure — month-by-month sequence to the point of no return" },
  { id: "5", label: "Competitor Response", subtitle: "How Winchester's established competitors will retaliate in months 1–6" },
  { id: "6", label: "The Recovery Question", subtitle: "Three fastest levers to buy 90 days of runway at 50% revenue" },
  { id: "7", label: "Seasonal Collision", subtitle: "Where weak ramp months collide with slow trading windows" },
  { id: "8", label: "Human Factors", subtitle: "Where the human system breaks before the financial model does" },
];

function splitIntoParts(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const partRegex = /PART\s+(\d+)\s*[—–-]+\s*[^\n]*/gi;
  const matches: { index: number; id: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = partRegex.exec(text)) !== null) {
    matches.push({ index: m.index, id: m[1] });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    const body = content.replace(/^PART\s+\d+\s*[—–-]+\s*[^\n]*\n?/i, "").trim();
    result[matches[i].id] = body;
  }
  return result;
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;
        // Bold section header (standalone bold line)
        if (/^\*\*[^*]+\*\*$/.test(trimmed) || /^#+\s/.test(trimmed)) {
          const cleaned = trimmed.replace(/^#+\s+/, "").replace(/\*\*/g, "");
          return <p key={i} className="font-semibold text-foreground mt-4 mb-1">{cleaned}</p>;
        }
        // Bullet list
        if (/^[-•]\s/.test(trimmed)) {
          const items = trimmed.split("\n").filter(l => l.trim());
          return (
            <ul key={i} className="space-y-1.5 ml-1">
              {items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                  <span dangerouslySetInnerHTML={{ __html: formatInline(item.replace(/^[-•]\s+/, "")) }} />
                </li>
              ))}
            </ul>
          );
        }
        // Numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const items = trimmed.split("\n").filter(l => l.trim());
          return (
            <ol key={i} className="space-y-1.5 ml-1">
              {items.map((item, j) => {
                const num = item.match(/^(\d+)\./)?.[1] ?? String(j + 1);
                return (
                  <li key={j} className="flex gap-2">
                    <span className="text-muted-foreground font-medium shrink-0 w-5 text-right">{num}.</span>
                    <span dangerouslySetInnerHTML={{ __html: formatInline(item.replace(/^\d+\.\s+/, "")) }} />
                  </li>
                );
              })}
            </ol>
          );
        }
        // Normal paragraph (may contain inline bold)
        return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace(/\n/g, " ")) }} />;
      })}
    </div>
  );
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/(£[\d,]+)/g, '<span class="font-semibold text-foreground">$1</span>')
    .replace(/(\d+(?:\.\d+)?%)/g, '<span class="font-semibold text-foreground">$1</span>');
}

export default function RiskIntelligencePage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [parts, setParts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef("");

  // Load last saved briefing on mount
  useEffect(() => {
    fetch(`${BASE_URL}/api/projects/${PROJECT_ID}/risk-intelligence/latest`)
      .then(r => r.json())
      .then(({ data, generatedAt }) => {
        if (data?.parts && Object.keys(data.parts).length > 0) {
          setParts(data.parts);
          setStatus("done");
          setIsStale(true);
          setOpenItems(Object.keys(data.parts));
          // Extract date from contextNote
          if (generatedAt) {
            const match = generatedAt.match(/Generated (.+)/);
            if (match) {
              setSavedAt(new Date(match[1]).toLocaleString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
              }));
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setStatus("loading");
    setError(null);
    setParts({});
    setIsStale(false);
    setSavedAt(null);
    fullTextRef.current = "";
    setOpenItems([]);

    try {
      const response = await fetch(
        `${BASE_URL}/api/projects/${PROJECT_ID}/risk-intelligence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            const parsed = JSON.parse(json);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.done) break;
            if (parsed.content) {
              fullTextRef.current += parsed.content;
              const newParts = splitIntoParts(fullTextRef.current);
              setParts(newParts);
              setOpenItems(prev => {
                const keys = Object.keys(newParts);
                const lastKey = keys[keys.length - 1];
                if (lastKey && !prev.includes(lastKey)) return [...prev, lastKey];
                return prev;
              });
            }
          } catch (e: any) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      setStatus("done");
      setSavedAt(new Date().toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      }));
      setOpenItems(PARTS.map(p => p.id));
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setError(e.message ?? "Unknown error");
      setStatus("error");
    }
  }, []);

  const hasContent = Object.keys(parts).length > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Risk Intelligence"
        description="A hostile due diligence assessment of your financial model — specific to your numbers, not generic startup advice. Regenerate any time the model changes."
      />

      {/* Controls bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          onClick={generate}
          disabled={status === "loading"}
          size="lg"
          className="gap-2"
        >
          {status === "loading" ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Analysing model…</>
          ) : hasContent ? (
            <><RefreshCw className="w-4 h-4" />Regenerate Briefing</>
          ) : (
            <><Brain className="w-4 h-4" />Generate Risk Briefing</>
          )}
        </Button>
        {status === "loading" && (
          <p className="text-sm text-muted-foreground animate-pulse">
            Reading your full financial model — this takes 30–60 seconds…
          </p>
        )}
        {status === "done" && savedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {isStale ? `Last generated ${savedAt}` : `Generated ${savedAt}`}
          </div>
        )}
      </div>

      {/* Error */}
      {status === "error" && error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Generation failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Idle — locked placeholders */}
      {status === "idle" && (
        <div className="space-y-2">
          {PARTS.map((part) => (
            <Card key={part.id} className="border-border/40 opacity-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">
                  {part.id}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{part.label}</p>
                  <p className="text-xs text-muted-foreground">{part.subtitle}</p>
                </div>
                <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stale notice */}
      {isStale && status === "done" && (
        <div className="text-xs text-muted-foreground/70 bg-muted/40 border border-border/40 rounded-lg px-3 py-2">
          Showing saved briefing from {savedAt}. Hit Regenerate after any model change to refresh the analysis.
        </div>
      )}

      {/* Sections */}
      {(status === "loading" || status === "done") && (
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="space-y-2"
        >
          {PARTS.map((part) => {
            const content = parts[part.id];
            const activeParts = Object.keys(parts);
            const isActivelyStreaming = status === "loading" &&
              activeParts.length > 0 &&
              part.id === activeParts[activeParts.length - 1];
            const hasData = !!content;
            const isPending = !hasData;

            return (
              <AccordionItem
                key={part.id}
                value={part.id}
                className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                  hasData
                    ? "border-border bg-card shadow-sm"
                    : isPending && status === "loading"
                    ? "border-border/25 bg-muted/10 opacity-35"
                    : "border-border/25 bg-muted/10 opacity-35"
                }`}
              >
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/20 transition-colors [&>svg]:hidden">
                  <div className="flex items-center gap-3 w-full">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
                      hasData
                        ? "bg-primary/12 text-primary"
                        : isActivelyStreaming
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isActivelyStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : part.id}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold leading-tight">Part {part.id} — {part.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{part.subtitle}</p>
                    </div>
                    {hasData && (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    )}
                  </div>
                </AccordionTrigger>

                {hasData && (
                  <AccordionContent className="px-5 pb-6 pt-0">
                    <div className="border-t border-border/30 pt-4">
                      <MarkdownText text={content} />
                      {isActivelyStreaming && (
                        <span className="inline-block w-0.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  </AccordionContent>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {hasContent && (
        <p className="text-xs text-muted-foreground/50 text-center pb-4">
          Generated from live model data · Not financial advice · Regenerate after any model change
        </p>
      )}
    </div>
  );
}
