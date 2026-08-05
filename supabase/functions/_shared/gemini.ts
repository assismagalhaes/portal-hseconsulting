export type GeminiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GeminiRequest = {
  apiKey: string;
  model: string;
  messages: GeminiChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
};

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

function normalizeModel(model: string): string {
  return model.replace(/^google\//, "").replace(/^models\//, "") || DEFAULT_GEMINI_MODEL;
}

/**
 * Calls the official Gemini generateContent API and adapts its successful
 * response to the small OpenAI-compatible shape already consumed by the Edge
 * Functions. Error responses keep Google's original status and body.
 */
export async function callGemini(request: GeminiRequest): Promise<Response> {
  const model = normalizeModel(request.model);
  const systemText = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": request.apiKey,
      },
      body: JSON.stringify({
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: {
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          ...(request.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!response.ok) return response;

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");

  return new Response(JSON.stringify({
    choices: [{ message: { content: text } }],
    usage: {
      prompt_tokens: payload.usageMetadata?.promptTokenCount ?? null,
      completion_tokens: payload.usageMetadata?.candidatesTokenCount ?? null,
    },
    gemini: payload,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
