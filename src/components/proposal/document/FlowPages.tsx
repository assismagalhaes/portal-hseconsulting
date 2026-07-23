import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PAGE_STYLE } from "./atoms";

export type Block = { key: string; label: string; node: React.ReactNode; keepWithNext?: boolean };

/**
 * FlowPages — paginador dinâmico.
 * Mede a altura real de cada bloco em um container invisível de mesma largura
 * útil das páginas e distribui os blocos em páginas A4, garantindo que:
 *  - blocos entrem em sequência sem espaços forçados;
 *  - se um bloco não couber no restante da página, ele vai inteiro pra próxima;
 *  - se um bloco tem `keepWithNext`, tenta mantê-lo junto do próximo.
 */
export function FlowPages({ ctx, blocks, onReady }: { ctx: any; blocks: Block[]; onReady?: () => void }) {
  const [pages, setPages] = useState<number[][] | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // altura útil de uma página (297mm - cabeçalho - rodapé - padding vertical)
  // Cabeçalho ~30mm, rodapé ~22mm, padding 10mm+10mm = 20mm → ~225mm.
  // Usamos margem de segurança para evitar overflow físico durante impressão,
  // que geraria páginas extras sem cabeçalho (sem numeração) e/ou cortaria
  // o último card da página (ex.: "Condições comerciais").
  const MM_TO_PX = 96 / 25.4;
  const CONTENT_H_PX = 198 * MM_TO_PX;

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const children = Array.from(measureRef.current.children) as HTMLElement[];
    if (children.length !== blocks.length) return;
    const heights = children.map((el) => el.getBoundingClientRect().height);

    const result: number[][] = [[]];
    let used = 0;
    for (let i = 0; i < blocks.length; i++) {
      const h = heights[i];
      const current = result[result.length - 1];

      // keepWithNext: se este bloco (ex.: título de seção) e o próximo juntos
      // não couberem no restante da página, força quebra antes.
      let neededH = h;
      if (blocks[i].keepWithNext && i + 1 < blocks.length) {
        neededH = h + heights[i + 1];
      }

      const remaining = CONTENT_H_PX - used;
      if (h > CONTENT_H_PX) {
        // bloco maior que uma página: joga sozinho (vai transbordar; edge case).
        if (current.length > 0) result.push([]);
        result[result.length - 1].push(i);
        result.push([]);
        used = 0;
        continue;
      }
      if (neededH > remaining && current.length > 0) {
        result.push([i]);
        used = h;
      } else {
        current.push(i);
        used += h;
      }
    }
    if (result[result.length - 1].length === 0) result.pop();
    setPages(result);
  }, [blocks.length, blocks.map((b) => b.key).join("|")]);

  // Notify parent when pages are actually rendered in the DOM, so printers
  // can safely snapshot the full document (avoids missing middle pages).
  useEffect(() => {
    if (pages && onReady) {
      // Two RAFs to ensure paint completed after the DocPages mount.
      requestAnimationFrame(() => requestAnimationFrame(() => onReady()));
    }
  }, [pages, onReady]);

  const pageLabelFor = (idxs: number[]) => (idxs.length ? blocks[idxs[0]].label : "");

  return (
    <>
      {/* Container de medição: fora da tela, mas com a largura real do conteúdo. */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          width: "174mm", // 210mm - 2*18mm de padding lateral do DocPage
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {blocks.map((b) => (
          <div key={"m-" + b.key}>{b.node}</div>
        ))}
      </div>

      {pages &&
        pages.map((idxs, pi) => (
          <DocPage
            key={"flow-" + pi}
            ctx={ctx}
            pageLabel={pageLabelFor(idxs)}
            pageNum={String(pi + 1).padStart(2, "0")}
          >
            {idxs
              .filter((i) => i < blocks.length && blocks[i])
              .map((i) => (
                <div key={blocks[i].key}>{blocks[i].node}</div>
              ))}
          </DocPage>
        ))}
    </>
  );
}

export function DocPage({ ctx, pageNum, pageLabel, children }: any) {
  const { proposal, client, primary, accent, logoSrc, tpl } = ctx;
  return (
    <section className="pdf-page" style={PAGE_STYLE}>
      <div style={{ height: "297mm", display: "flex", flexDirection: "column" }}>
        {/* Cabeçalho */}
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

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: "10mm 18mm", overflow: "hidden" }}>{children}</div>

        {/* Rodapé */}
        <footer style={{ padding: "6mm 18mm 10mm", borderTop: `1px solid #e5e7eb`, display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b" }}>
          <span>HSE Consulting · {tpl.site}</span>
          <span>{tpl.telefone} · {tpl.email}</span>
        </footer>
      </div>
    </section>
  );
}