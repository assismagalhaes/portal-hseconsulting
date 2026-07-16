## Objetivo

Reduzir `src/pages/ProposalEditor.tsx` (1524 linhas) sem alterar comportamento, extraindo os subcomponentes já declarados no arquivo para arquivos próprios. Nenhuma regra de negócio, cálculo ou chamada ao banco muda — é apenas movimentação de código com ajuste de imports.

## Escopo

Extrair para `src/components/proposal/`:

1. `ClientCard.tsx` — cartão de dados do cliente (linhas ~841-885)
2. `DatesCard.tsx` — datas/validade da proposta (linhas ~896-967)
3. `ItemEditor.tsx` — editor de item da proposta (linhas ~969-1079)
4. `RevisionsCard.tsx` — histórico de revisões + constante `REVISAO_STATUS` (linhas ~1081-1203)
5. `PricingPanel.tsx` — painel de precificação inline + `Mini`/`MiniPct` (linhas ~1205-1446)
6. `ClientPreview.tsx` — preview lateral do cliente (linhas ~1448-1524)
7. `InternalSummary.tsx` — resumo interno + `Row` + `calcDescontoRevisao` + `ResumoValor` (linhas ~765-839)

Utilitário `newId` fica onde está (usado no editor principal).

Observação: já existe `src/components/proposal/PricingPanel.tsx` (294 linhas) — o `PricingPanel` interno do `ProposalEditor` é uma **variante inline** diferente. Vou renomear a extração para `InlinePricingPanel.tsx` para não colidir.

## O que NÃO faço nesta rodada

- Não mexo em fetch/mutations do Supabase que estão no componente `ProposalEditor` principal (isso seria o próximo passo, extrair para `src/lib/propostas.ts`).
- Não tipo os `any` que já existem nas assinaturas — mantenho as assinaturas atuais para reduzir risco. Melhoria de tipagem fica para uma rodada separada.
- Não altero a UI nem a ordem dos componentes na página.

## Resultado esperado

- `ProposalEditor.tsx` reduzido para ~700 linhas (apenas o componente principal + `newId`).
- 7 novos arquivos em `src/components/proposal/`, cada um <300 linhas.
- Build e comportamento idênticos.

## Risco e mitigação

Risco: componentes internos podem estar usando closures do componente pai (variáveis fora dos props). Mitigação: antes de mover cada um, verifico dependências e, se houver referência externa, passo por props explícitas. Se algum componente exigir refactor não trivial, paro e reporto antes de continuar.
