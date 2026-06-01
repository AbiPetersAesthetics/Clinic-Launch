import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Brain, RefreshCw, AlertCircle, Loader2, ChevronDown, Lock } from "lucide-react";

const PROJECT_ID = 1;

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const PARTS = [
  { id: "1", label: "Blind Spots", subtitle: "Risks the founders almost certainly have not modelled" },
  { id: "2", label: "Early Warning Signals", subtitle: "The tripwire before each risk becomes a crisis" },
  { id: "3", label: "The Response Playbook", subtitle: "Exactly what to do, in what order, with what lead time" },
  { id: "4", label: "The One Thing", subtitle: "Most likely failure — month-by-month sequence to crisis" },
  { id: "5", label: "Competitor Response", subtitle: "How established local competitors will react in months 1–6" },
  { id: "6", label: "The Recovery Question", subtitle: "Three fastest levers to buy 90 days of runway" },
  { id: "7", label: "Seasonal Collision", subtitle: "Where weak ramp months meet slow trading windows" },
  { id: "8", label: "Human Factors", subtitle: "Where the human system breaks before the financial one does" },
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
    // Strip the PART N — HEADING line from the content body
    const body = content.replace(/^PART\s+\d+\s*[—–-]+\s*[^\n]*\n?/i, "").trim();
    result[matches[i].id] = body;
  }

  return result;
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        // Bold headers (lines ending with :, or lines that start with ** )
        if (/^\*\*[^*]+\*\*:?$/.test(line.trim()) || /^#+\s/.test(line.trim())) {
          const cleaned = line.replace(/^#+\s+/, "").replace(/\*\*/g, "");
          return <p key={i} className="font-semibold text-foreground mt-3 mb-0.5">{cleaned}</p>;
        }
        // Bullet points
        if (/^[-•]\s/.test(line.trim())) {
          const content = line.replace(/^[-•]\s+/, "");
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
            </div>
          );
        }
        // Numbered lists
        if (/^\d+\.\s/.test(line.trim())) {
          const num = line.match(/^(\d+)\.\s/)![1];
          const content = line.replace(/^\d+\.\s+/, "");
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground font-medium shrink-0 w-5 text-right">{num}.</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
            </div>
          );
        }
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      })}
    </div>
  );
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/£([\d,]+)/g, '<span class="font-semibold text-foreground">£$1</span>')
    .replace(/(\d+)%/g, '<span class="font-semibold text-foreground">$1%</span>');
}

export default function RiskIntelligencePage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [parts, setParts] = useState<Record<string, string>>({});
  const [fullText, setFullText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef("");

  const generate = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setStatus("loading");
    setError(null);
    setFullText("");
    setParts({});
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
              setFullText(fullTextRef.current);
              const newParts = splitIntoParts(fullTextRef.current);
              setParts(newParts);
              // Auto-open part as it first appears
              setOpenItems(prev => {
                const keys = Object.keys(newParts);
                const lastKey = keys[keys.length - 1];
                if (lastKey && !prev.includes(lastKey)) {
                  return [...prev, lastKey];
                }
                return prev;
              });
            }
          } catch (e: any) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      setStatus("done");
      // Open all parts when complete
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
        description="Deep risk briefing generated from your live financial model by Claude AI — specific to these numbers, not generic startup advice."
      />

      {/* Generate button + status */}
      <div className="flex items-center gap-4">
        <Button
          onClick={generate}
          disabled={status === "loading"}
          size="lg"
          className="gap-2"
        >
          {status === "loading" ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Analysing model…</>
          ) : hasContent ? (
            <><RefreshCw className="w-4 h-4" />Regenerate</>
          ) : (
            <><Brain className="w-4 h-4" />Generate Risk Briefing</>
          )}
        </Button>
        {status === "loading" && (
          <p className="text-sm text-muted-foreground animate-pulse">
            Reading your full financial model and writing the briefing…
          </p>
        )}
        {status === "done" && (
          <p className="text-sm text-muted-foreground">
            Analysis complete — based on live model data
          </p>
        )}
      </div>

      {/* Error state */}
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

      {/* Idle state — show locked sections */}
      {status === "idle" && (
        <div className="space-y-2">
          {PARTS.map((part) => (
            <Card key={part.id} className="border-border/40 opacity-60">
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

      {/* Sections — rendered as they stream in */}
      {(status === "loading" || status === "done") && (
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="space-y-2"
        >
          {PARTS.map((part) => {
            const content = parts[part.id];
            const isStreaming = status === "loading" && !content && parseInt(part.id) === Math.max(...Object.keys(parts).map(Number), 0) + 1;
            const hasData = !!content;
            const isPending = !hasData && !isStreaming;

            return (
              <AccordionItem
                key={part.id}
                value={part.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  hasData
                    ? "border-border bg-card shadow-sm"
                    : isPending
                    ? "border-border/30 bg-muted/20 opacity-40"
                    : "border-primary/30 bg-primary/5"
                }`}
              >
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 transition-colors [&>svg]:hidden">
                  <div className="flex items-center gap-3 w-full">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                      hasData
                        ? "bg-primary/15 text-primary"
                        : isStreaming
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isStreaming ? <Loader2 className="w-3 h-3 animate-spin" /> : part.id}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold">Part {part.id} — {part.label}</p>
                      <p className="text-xs text-muted-foreground">{part.subtitle}</p>
                    </div>
                    {hasData && (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    )}
                  </div>
                </AccordionTrigger>

                {hasData && (
                  <AccordionContent className="px-5 pb-5 pt-0">
                    <div className="border-t border-border/40 pt-4 text-muted-foreground">
                      <MarkdownText text={content} />
                      {/* Streaming cursor for the active part */}
                      {status === "loading" && part.id === String(Math.max(...Object.keys(parts).map(Number))) && (
                        <span className="inline-block w-0.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  </AccordionContent>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Disclaimer */}
      {hasContent && (
        <p className="text-xs text-muted-foreground/60 text-center pb-4">
          Generated from live model data · Not financial advice · Regenerate after any model change
        </p>
      )}
    </div>
  );
}
