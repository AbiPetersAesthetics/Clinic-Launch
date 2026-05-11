import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM_PROMPT = `You are a specialist research assistant helping Abi Peters set up a private aesthetics clinic at 9A Jewry Street, Winchester, Hampshire, UK. Target opening: 1 November 2026.

Context:
- Solo practitioner clinic offering aesthetic treatments (injectables, skin treatments)
- Self-funded launch, budget-conscious
- CQC registration required
- Winchester city centre location
- Key challenges: finding suitable property, CQC compliance, clinical governance, marketing

Your role:
- Give practical, UK-specific advice for each project task
- When finding suppliers or contractors: focus on Hampshire/South East England first, then national specialists
- When giving costs: use realistic UK market rates (2025/2026 prices) in GBP
- When recommending contacts: suggest types of professionals, trade bodies, or directories to search (e.g. RICS, BAPAM, CQC-registered consultants)
- Be concise and actionable — bullet points preferred
- If asked for quotes/suppliers, give 3-5 concrete suggestions with how to contact them
- Always flag CQC or clinical governance implications where relevant`;

router.post("/api/ai/task-research", async (req, res) => {
  const { taskTitle, taskDescription, taskPhase, query } = req.body as {
    taskTitle?: string;
    taskDescription?: string;
    taskPhase?: string;
    query: string;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const taskContext = [
    taskTitle && `Task: ${taskTitle}`,
    taskPhase && `Phase: ${taskPhase}`,
    taskDescription && `Description: ${taskDescription}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userMessage = taskContext
    ? `${taskContext}\n\nQuestion: ${query}`
    : query;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

export default router;
