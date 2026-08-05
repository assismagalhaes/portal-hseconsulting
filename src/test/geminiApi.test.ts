import { afterEach, describe, expect, it, vi } from "vitest";
import { callGemini } from "../../supabase/functions/_shared/gemini";

describe("Gemini API adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envia system instruction, histórico e modo JSON para a API oficial", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await callGemini({
      apiKey: "secret-test-key",
      model: "google/gemini-3.6-flash",
      temperature: 0.2,
      jsonMode: true,
      messages: [
        { role: "system", content: "Responda em JSON." },
        { role: "user", content: "Pergunta" },
        { role: "assistant", content: "Resposta anterior" },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("secret-test-key");
    expect(body.systemInstruction.parts[0].text).toBe("Responda em JSON.");
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Pergunta" }] },
      { role: "model", parts: [{ text: "Resposta anterior" }] },
    ]);
    expect(body.generationConfig.responseMimeType).toBe("application/json");

    await expect(response.json()).resolves.toMatchObject({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    });
  });

  it("preserva status e corpo de erro retornados pelo Google", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota exceeded", { status: 429 })));
    const response = await callGemini({
      apiKey: "secret-test-key",
      model: "gemini-3.6-flash",
      messages: [{ role: "user", content: "Pergunta" }],
    });
    expect(response.status).toBe(429);
    await expect(response.text()).resolves.toBe("quota exceeded");
  });
});
