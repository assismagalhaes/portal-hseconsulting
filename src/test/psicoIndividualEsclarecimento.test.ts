import { describe, expect, it } from "vitest";
import {
  gerarTokenEsclarecimento,
  hashTokenEsclarecimento,
} from "@/lib/psicoIndividualEsclarecimento";

describe("tokens de esclarecimento AQI", () => {
  it("gera tokens opacos distintos e persiste somente hashes SHA-256", async () => {
    const primeiro = gerarTokenEsclarecimento();
    const segundo = gerarTokenEsclarecimento();

    expect(primeiro).toMatch(/^esc\.[A-Za-z0-9_-]{43}$/);
    expect(segundo).not.toBe(primeiro);
    await expect(hashTokenEsclarecimento(primeiro)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});
