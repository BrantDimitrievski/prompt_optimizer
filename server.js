// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// default is markdown, find what is best for different AI tools, have a button for each model and a the optimized input for each model as follows
const SYSTEM_MD = `
You are an AI prompt optimizer.

Return every response in **Markdown** using exactly these top-level sections and nothing else:

# Task
# Context
# References
# Evaluate
# Iterate

Requirements:
- Use the section headers verbatim and in this order.
- Keep all content under the appropriate section; do not add extra sections or pre/post text.
- If a section has no content, write a single hyphen (-).
- For "References", use a bulleted list with descriptive titles and URLs (if applicable).
- For "Evaluate", give objective criteria or test cases to judge the quality of the output.
- For "Iterate", propose concrete next steps or questions to refine the result.
- Be concise but information-dense; extract as much actionable detail from the user prompt as possible.
- Do not include JSON in your output.

When you receive a user prompt, analyze it and respond in this exact Markdown structure.
`.trim();

const SYSTEM_XML = `
You are an AI prompt optimizer.

Return every response as **XML** with the exact root element <response> and these child elements in order:
<task>, <context>, <references>, <evaluate>, <iterate>.

Requirements:
- Output must be well-formed XML (UTF-8, no XML declaration needed).
- Use only the five elements listed; no attributes.
- If a section is empty, include the tag with a single hyphen (-) as its text content.
- In <references>, use bullet-like lines separated by newlines; include titles and URLs where relevant.
- In <evaluate>, provide objective criteria or test cases.
- In <iterate>, propose concrete next steps or clarification questions.
- Extract as much actionable detail from the user prompt as possible.

Respond only with XML; do not include Markdown or JSON.
`.trim();

async function optimizeOnce({ model, systemContent, userPrompt }) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userPrompt },
    ],
  });
  return completion.choices?.[0]?.message?.content ?? "";
}

app.post("/optimize", async (req, res) => {
  const userPrompt = (req.body?.prompt ?? "").toString();
  const mode = (req.body?.mode ?? "markdown").toLowerCase();
  const model = req.body?.model || "gpt-4o";

  if (!userPrompt.trim()) {
    return res.status(400).json({ error: "Missing 'prompt' in request body." });
  }

  try {
    if (mode === "both") {
      const [markdown, xml] = await Promise.all([
        optimizeOnce({ model, systemContent: SYSTEM_MD, userPrompt }),
        optimizeOnce({ model, systemContent: SYSTEM_XML, userPrompt }),
      ]);
      return res.json({ markdown, xml });
    }

    if (mode === "xml") {
      const xml = await optimizeOnce({ model, systemContent: SYSTEM_XML, userPrompt });
      return res.json({ xml });
    }

    const markdown = await optimizeOnce({ model, systemContent: SYSTEM_MD, userPrompt });
    return res.json({ markdown });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to process prompt" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
