import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.ts";
import type { GeneratedMetadata } from "./types.ts";

const EMPTY: GeneratedMetadata = { description: "", tags: [], keywords: [] };

const client = config.hasApiKey ? new Anthropic() : null;

const METADATA_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: ["description", "tags", "keywords"],
  additionalProperties: false,
} as const;

const IMAGE_PROMPT =
  "Describe this image for a searchable knowledge base. In `description`, " +
  "write 1-3 sentences covering the main subject, notable objects, any " +
  "documents or visible text, dominant colors, and visible attributes of any " +
  "people (e.g. hair color, clothing). Provide `tags` (broad categories) and " +
  "`keywords` (specific searchable terms) as lowercase arrays.";

const TEXT_PROMPT =
  "Summarize this text file for a searchable knowledge base. In `description`, " +
  "write 1-3 sentences on what it is about. Provide `tags` (broad topics) and " +
  "`keywords` (specific searchable terms) as lowercase arrays. Text follows:\n\n";

async function callClaude(content: Anthropic.MessageParam["content"]): Promise<GeneratedMetadata> {
  if (!client) return EMPTY;
  try {
    // The installed @anthropic-ai/sdk's TS types don't yet know about
    // `output_config` (structured outputs); the runtime API accepts it.
    // Cast through the SDK's param type so the type-checker allows the
    // extra field while keeping the real request shape unchanged.
    const res = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: METADATA_SCHEMA } },
      messages: [{ role: "user", content }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return EMPTY;
    const parsed = JSON.parse(textBlock.text) as GeneratedMetadata;
    return {
      description: parsed.description ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch (err) {
    console.error("AI metadata generation failed:", err);
    return EMPTY;
  }
}

type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export function generateImageMetadata(base64: string, mediaType: string): Promise<GeneratedMetadata> {
  return callClaude([
    { type: "image", source: { type: "base64", media_type: mediaType as SupportedImageMediaType, data: base64 } },
    { type: "text", text: IMAGE_PROMPT },
  ]);
}

export function generateTextMetadata(text: string): Promise<GeneratedMetadata> {
  // Cap the amount of text sent to keep requests bounded.
  const clipped = text.slice(0, 20000);
  return callClaude(TEXT_PROMPT + clipped);
}
