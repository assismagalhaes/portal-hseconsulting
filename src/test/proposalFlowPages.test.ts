import { describe, expect, it } from "vitest";
import {
  paginateBlockHeights,
  type PaginationBlock,
} from "@/components/proposal/document/flowPagination";

const block = (
  key: string,
  options: PaginationBlock = {},
): PaginationBlock & { key: string } => ({
  key,
  ...options,
});

describe("paginateBlockHeights", () => {
  it("move título, cabeçalho e primeira linha juntos quando não cabem no restante", () => {
    const blocks = [
      block("anterior"),
      block("titulo", { keepWithNext: 2 }),
      block("cabecalho", { keepWithNext: true }),
      block("linha-1"),
      block("linha-2", { hasPageStart: true }),
    ];

    const pages = paginateBlockHeights(
      blocks,
      [220, 50, 35, 80, 80],
      [0, 0, 0, 0, 35],
      300,
    );

    expect(pages.map((page) => page.indexes)).toEqual([
      [0],
      [1, 2, 3, 4],
    ]);
  });

  it("repete o cabeçalho quando uma linha inicia a página seguinte", () => {
    const blocks = [
      block("titulo", { keepWithNext: 2 }),
      block("cabecalho", { keepWithNext: true }),
      block("linha-1"),
      block("linha-2", { hasPageStart: true }),
      block("linha-3", { hasPageStart: true }),
    ];

    const pages = paginateBlockHeights(
      blocks,
      [50, 35, 150, 100, 100],
      [0, 0, 0, 35, 35],
      300,
    );

    expect(pages).toEqual([
      { indexes: [0, 1, 2] },
      { indexes: [3, 4], pageStartNodeFrom: 3 },
    ]);
  });
});
