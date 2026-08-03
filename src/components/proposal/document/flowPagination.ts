export type PaginationBlock = {
  keepWithNext?: boolean | number;
  hasPageStart?: boolean;
};

export type PageLayout = {
  indexes: number[];
  pageStartNodeFrom?: number;
};

/**
 * Distribui alturas já medidas. O cabeçalho de continuação é contabilizado
 * somente quando o respectivo bloco abre uma nova página.
 */
export function paginateBlockHeights(
  blocks: PaginationBlock[],
  heights: number[],
  pageStartHeights: number[],
  contentHeight: number,
): PageLayout[] {
  const result: PageLayout[] = [{ indexes: [] }];
  let used = 0;

  const preparePageStart = (blockIndex: number) => {
    if (!blocks[blockIndex]?.hasPageStart) return;
    result[result.length - 1].pageStartNodeFrom = blockIndex;
    used += pageStartHeights[blockIndex] || 0;
  };

  for (let i = 0; i < blocks.length; i++) {
    const height = heights[i] || 0;
    let current = result[result.length - 1];

    if (current.indexes.length === 0 && used === 0) preparePageStart(i);

    const keepCount =
      blocks[i].keepWithNext === true
        ? 1
        : Math.max(0, Number(blocks[i].keepWithNext) || 0);
    let neededHeight = height;
    for (let offset = 1; offset <= keepCount && i + offset < blocks.length; offset++) {
      neededHeight += heights[i + offset] || 0;
    }

    if (neededHeight > contentHeight - used && current.indexes.length > 0) {
      result.push({ indexes: [] });
      used = 0;
      preparePageStart(i);
      current = result[result.length - 1];
    }

    if (height > contentHeight - used && current.indexes.length > 0) {
      result.push({ indexes: [] });
      used = 0;
      preparePageStart(i);
      current = result[result.length - 1];
    }

    current.indexes.push(i);
    used += height;
  }

  return result.filter((page) => page.indexes.length > 0);
}
