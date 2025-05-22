# 🧑‍💻 Diff Digest – Developer Guide (Take-Home Assignment for a0.dev)

This guide walks you through completing the a0.dev "Diff Digest" challenge in a structured, step-by-step way. All decisions (e.g., LLM model, streaming method, markdown rendering) have been pre-selected by OpenAI to save you time.

---

## ✅ Prerequisites

- ✅ Repo cloned
- ✅ All packages installed (`npm install`)
- ✅ Running dev server: `npm run dev`

---

## 🧠 Step 2: Create API Route to Stream Release Notes

Edit  the file:

```
src/app/api/generate-notes/route.ts
```

Paste this code:

```ts
import { OpenAIStream, StreamingTextResponse } from 'openai-streams';
import OpenAI from 'openai';

export const runtime = 'edge';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const { title, diff } = await req.json();

  const systemPrompt = \`
You are an expert software release note writer. 
Based on a Git diff, generate two types of release notes in markdown:
1. Developer Notes — technical (what and why).
2. Marketing Notes — user-friendly (benefits).
\`;

  const userPrompt = \`
Pull Request Title: \${title}

Git Diff:
\`\`\`diff
\${diff.slice(0, 12000)}
\`\`\`
\`;

  const response = await openai.chat.completions.create({
    model: 'o4-mini',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
```

---

## 🖥️ Step 3: Update Frontend to Send PRs to LLM

In `src/app/page.tsx`, import and define:

```tsx
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
```

Add the state near the top of the component:

```tsx
const [loadingPR, setLoadingPR] = useState<string | null>(null);
const [output, setOutput] = useState<string>("");
```

Add this function inside the component:

```tsx
const generateNotes = async (pr: { id: string, description: string, diff: string }) => {
  try {
    setLoadingPR(pr.id);
    setOutput("");

    const res = await fetch("/api/generate-notes", {
      method: "POST",
      body: JSON.stringify({ title: pr.description, diff: pr.diff }),
    });

    if (!res.body) throw new Error("No stream received");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      setOutput(prev => prev + chunk);
    }

    setLoadingPR(null);
  } catch (err) {
    console.error("Failed to generate notes", err);
    setOutput("⚠️ Failed to generate notes. Please try again.");
    setLoadingPR(null);
  }
};
```

---

## 🧩 Step 4: Update the PR List UI

In your PR listing JSX (`page.tsx`), update each PR card like this:

```tsx
{diffs.map(pr => (
  <div key={pr.id} className="border rounded p-4 mb-4">
    <h3 className="text-lg font-semibold">{pr.description}</h3>
    <p className="text-sm text-gray-500">{pr.url}</p>

    <button 
      onClick={() => generateNotes(pr)} 
      className="mt-2 px-4 py-1 bg-blue-600 text-white rounded"
    >
      Generate Notes
    </button>

    {loadingPR === pr.id && (
      <p className="text-sm text-blue-600 mt-2">Generating notes...</p>
    )}

    {output && loadingPR === pr.id && (
      <div className="mt-4 p-4 bg-gray-50 rounded whitespace-pre-wrap">
        <ReactMarkdown>{output}</ReactMarkdown>
      </div>
    )}
  </div>
))}
```

## 💄 Step 5: Polish UI with Tailwind

Suggestions:
- Add hover states for buttons
- Add shadows to PR cards
- Make output area scrollable for large notes

---

## ✅ Final Checklist

| Task | Complete |
|------|----------|
| PR selection UI | ✅ |
| Backend LLM prompt API | ✅ |
| Streaming handled with OpenAI Streams | ✅ |
| Live markdown output with ReactMarkdown | ✅ |
| Tailwind styling | ✅ |
| Error fallback messages | ✅ |