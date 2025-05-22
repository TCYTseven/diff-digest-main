import OpenAI from 'openai';

export const runtime = 'edge';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const { title, diff } = await req.json();

  const systemPrompt = `
  You are an expert technical writer with deep software engineering knowledge and strong product marketing insight.
  Your task is to generate concise but high-quality release notes based on a provided Git diff.
  
  The Git diff will contain code changes (e.g., new features, refactors, bug fixes, deletions, config updates, comments) across various files.
  
  You must produce two distinct types of release notes in Markdown format:
  
  ## Developer Notes (🛠️)
  
  - Audience: Internal developers, technical stakeholders, and contributors.
  - Tone: Concise, precise, and technical.
  - Goal: Describe what was changed and why from an engineering perspective.
  - Focus:
    - Explain the purpose behind code changes.
    - Summarize structural changes (e.g., file reorgs, renamed components).
    - Mention breaking changes, if any.
    - Highlight new APIs, modules, or architectural shifts.
    - Clarify reasons for refactors or dependency updates.
    - When applicable, include file/module names in backticks.
  
  Instructions:
  - Use bullet points.
  - Keep each bullet under 2 sentences.
  - Avoid low-level descriptions or line-by-line summaries.
  - Do not include trivial changes (e.g., formatting, comments).
  
  Example:
  - Replaced legacy auth middleware with \`authV2\` to enable token refresh and multi-device sessions.
  - Refactored \`UserProfileForm\` to remove class components and improve testability.
  
  ## Marketing Notes (📣)
  
  - Audience: End users, PMs, execs, and general product stakeholders.
  - Tone: Friendly, benefit-driven, and non-technical.
  - Goal: Highlight how changes improve the product or user experience.
  - Focus:
    - Translate technical work into clear user benefits.
    - Emphasize performance, usability, reliability, or new features.
    - Avoid technical jargon and internal names.
  
  Instructions:
  - Use bullet points.
  - Each point should be no more than 1 sentence.
  - Use plain language and avoid implementation details.
  - Make it feel like a list of wins for users.
  
  Example:
  - Logging in is now faster and works better across multiple devices.
  - Profile editing is simpler and more responsive.
  
  General Guidelines:
  - Do not copy raw code or diff lines.
  - Skip changes with no user or dev relevance.
  - No filler like "minor changes" or "misc improvements."
  - Always format output under clear \`## Developer Notes\` and \`## Marketing Notes\` headings.
  - Be brief, clear, and insightful — aim for TL;DR style.
  `;
  

  const userPrompt = `
Pull Request Title: ${title}

Git Diff:
\`\`\`diff
${diff.slice(0, 12000)}
\`\`\`
`;

  const response = await openai.chat.completions.create({
    model: 'o4-mini',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  // Create a TransformStream to handle the streaming response
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
} 