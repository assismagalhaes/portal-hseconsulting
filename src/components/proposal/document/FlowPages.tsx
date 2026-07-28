import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PAGE_STYLE } from "./atoms";
import { paginateBlockHeights, type PageLayout } from "./flowPagination";

export type Block = {
  key: string;
  label: string;
  node: React.ReactNode;
  keepWithNext?: boolean | number;
  pageStartNode?: React.ReactNode;
};

type FlowContext = {
  proposal: { numero?: string | null };
  client?: { nome_fantasia?: string | null; razao_social?: string | null } | null;
  primary: string;
  accent: string;
  logoSrc: string;
  tpl: { site?: string | null; telefone?: string | null; email?: string | null };
};

const MM_TO_PX = 96 / 25.4;
const CONTENT_H_PX = 198 * MM_TO_PX;

/**
 * Paginador dinâmico: mede a altura real dos blocos e os distribui em páginas
 * A4. Blocos comuns permanecem inteiros; blocos fragmentáveis são fornecidos
 * pelo chamador como unidades menores (por exemplo, uma linha de tabela).
 */
export function FlowPages({ ctx, blocks, onReady }: { ctx: FlowContext; blocks: Block[]; onReady?: () => void }) {
  const [pages, setPages] = useState<PageLayout[] | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // 297mm menos cabeçalho, rodapé e paddings, com margem de segurança para a
  // impressão física não criar páginas extras nem cortar o último bloco.
  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const children = Array.from(measureRef.current.children) as HTMLElement[];
    if (children.length !== blocks.length) return;

    const heights = children.map((el) =>
      (el.querySelector("[data-flow-node]") as HTMLElement | null)?.getBoundingClientRect().height || 0
    );
    const pageStartHeights = children.map((el) =>
      (el.querySelector("[data-flow-page-start]") as HTMLElement | null)?.getBoundingClientRect().height || 0
    );

    setPages(paginateBlockHeights(
      blocks.map((block) => ({
        keepWithNext: block.keepWithNext,
        hasPageStart: Boolean(block.pageStartNode),
      })),
      heights,
      pageStartHeights,
      CONTENT_H_PX,
    ));
  }, [blocks]);

  useEffect(() => {
    if (pages && onReady) {
      requestAnimationFrame(() => requestAnimationFrame(() => onReady()));
    }
  }, [pages, onReady]);

  const pageLabelFor = (page: PageLayout) =>
    page.indexes.length && blocks[page.indexes[0]] ? blocks[page.indexes[0]].label : "";

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          width: "174mm",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {blocks.map((block) => (
          <div key={"m-" + block.key}>
            <div data-flow-node>{block.node}</div>
            {block.pageStartNode && <div data-flow-page-start>{block.pageStartNode}</div>}
          </div>
        ))}
      </div>

      {pages?.map((page, pageIndex) => (
        <DocPage
          key={"flow-" + pageIndex}
          ctx={ctx}
          pageLabel={pageLabelFor(page)}
          pageNum={String(pageIndex + 1).padStart(2, "0")}
        >
          {page.pageStartNodeFrom != null && blocks[page.pageStartNodeFrom]?.pageStartNode}
          {page.indexes
            .filter((index) => index < blocks.length && blocks[index])
            .map((index) => (
              <div key={blocks[index].key}>{blocks[index].node}</div>
            ))}
        </DocPage>
      ))}
    </>
  );
}

type DocPageProps = {
  ctx: FlowContext;
  pageNum: string;
  pageLabel: string;
  children: React.ReactNode;
};

export function DocPage({ ctx, pageNum, pageLabel, children }: DocPageProps) {
  const { proposal, client, primary, accent, logoSrc, tpl } = ctx;
  return (
    <section className="pdf-page" style={PAGE_STYLE}>
      <div style={{ height: "297mm", display: "flex", flexDirection: "column" }}>
        <header style={{ padding: "12mm 18mm 6mm", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${primary}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logoSrc} alt="HSE" style={{ height: 32, objectFit: "contain" }} />
            <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 10 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "#64748b" }}>{pageLabel}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: primary }}>{client?.nome_fantasia || client?.razao_social || "—"}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>
            <div style={{ fontFamily: "monospace", color: primary, fontWeight: 700 }}>Proposta {proposal.numero}</div>
            <div>Página {pageNum || "01"}</div>
          </div>
        </header>

        <div style={{ flex: 1, padding: "10mm 18mm", overflow: "hidden" }}>{children}</div>

        <footer style={{ padding: "6mm 18mm 10mm", borderTop: `1px solid #e5e7eb`, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b" }}>
          <span>HSE Consulting · {tpl.site}</span>
          <span>{tpl.telefone} · {tpl.email}</span>
        </footer>
      </div>
    </section>
  );
}
