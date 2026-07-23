# PR 1 — Fundação da Avaliação Assistida Individual (Microempresa)

Objetivo: criar a base de dados, segurança (RLS) e feature flag da nova modalidade **sem alterar** a metodologia coletiva atual (35 perguntas, mínimo de 2 respondentes, scores, agregados, PDF coletivo). Nenhuma UI nova em produção enquanto a flag estiver desligada.

Esta é a primeira de 7 entregas independentes. As demais (convites, formulários, conciliação, revisão, plano+IA, PDF individual) virão em PRs próprios.

## Escopo do PR 1

### 1. Modalidade da avaliação
- Adicionar coluna `modalidade` em `public.psico_avaliacoes` com dois valores permitidos:
  - `coletiva_hse` (default — comportamento atual, sem impacto)
  - `individual_microempresa`
- Backfill: todas as avaliações existentes recebem `coletiva_hse`.
- Guardas: nenhuma função/RPC coletiva atual passa a considerar a nova modalidade neste PR.

### 2. Novas tabelas (schema `public`)
Todas com `id uuid pk`, `created_at`, `updated_at`, GRANTs explícitos e RLS habilitada.

- `psico_individual_instrumentos_versoes` — versionamento do instrumento individual (código, versão, vigente, publicado_em).
- `psico_individual_perguntas` — perguntas do instrumento (fator, ordem, texto, tipo, obrigatoriedade).
- `psico_individual_opcoes` — opções de resposta por pergunta.
- `psico_individual_convites` — convites separados para empregador e empregado (papel, token, expira_em, consumido_em).
- `psico_individual_formularios` — instância do formulário respondido (avaliacao_id, convite_id, papel).
- `psico_individual_respostas` — respostas objetivas (formulario_id, pergunta_id, opcao_id, valor_numerico).
- `psico_individual_respostas_livres` — texto livre sanitizável (formulario_id, pergunta_id, conteudo). Acesso restrito.
- `psico_individual_processamentos` — execução da conciliação determinística (avaliacao_id, versao_regra, iniciado_em, concluido_em, status).
- `psico_individual_achados` — resultado consolidado por fator/perigo, com campos:
  `avaliacao_id, processamento_id, fator_codigo, perigo_codigo, descricao_organizacional, frequencia_exposicao, intensidade_exigencia, controle_existente, eficacia_controle, condicao_preliminar, nivel_evidencia, estado_convergencia, fundamentacao_sanitizada, regra_codigo, regra_versao, revisado_por, revisado_em`.
- `psico_individual_revisoes` — revisão técnica da modalidade individual (avaliacao_id, status, aprovado_em, aprovado_por, observacoes).

### 3. Segurança (RLS + GRANTs)
Regra por tabela, na ordem obrigatória: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY.

- `anon`: nenhum acesso direto a nenhuma tabela nova.
- `authenticated` técnico interno (via `has_role`/`can_see_internal`): SELECT em instrumentos, perguntas, opções, convites, formulários, respostas objetivas, processamentos, achados, revisões.
- `authenticated` cliente/empregador: **sem acesso** a respostas objetivas, respostas livres ou achados brutos. Ver apenas o próprio convite (por token via Edge Function, não por PostgREST).
- `psico_individual_respostas_livres`: acesso somente via função `security definer` dedicada (a ser usada em PR de conciliação). `REVOKE ALL FROM PUBLIC/anon/authenticated` na função e `EXECUTE` só para roles internas.
- `service_role`: `ALL` em todas as tabelas — usada apenas dentro de Edge Functions.
- Nenhuma view pública exposta com dados individuais.
- Auditoria (se registrada) NÃO grava o conteúdo das respostas.

### 4. Feature flag
- Constante `PSICO_INDIVIDUAL_ENABLED` no frontend (env `VITE_PSICO_INDIVIDUAL_ENABLED`, default `false`).
- Enquanto `false`: seletor de modalidade, telas e rotas novas ficam ocultos. Fluxo coletivo permanece idêntico.
- Nenhuma mudança em `PsicoAvaliacaoNova.tsx`, listagens ou dashboards neste PR além de leitura da flag (sem UI visível).

### 5. Isolamento em relação à metodologia coletiva
- Nenhuma alteração em: `psico_questionarios_versoes`, `psico_metodologias_versoes`, `psico_fatores`, `psico_perguntas`, `psico_opcoes_resposta`, `psico_avaliacoes` (fora da nova coluna), funções `psico_*` existentes.
- Nenhuma alteração no motor de relatório coletivo, nem no `psico-gerar-relatorio`.

## Detalhes técnicos

### Migração (uma única, transacional)
Ordem:
1. `ALTER TYPE`/coluna `modalidade` + backfill + `NOT NULL` + `CHECK`.
2. CREATE TABLE de cada nova tabela.
3. GRANTs por tabela (authenticated conforme política; service_role ALL; sem anon).
4. `ENABLE ROW LEVEL SECURITY`.
5. POLICIES por tabela — leitura por `can_see_internal(auth.uid())` para técnicos; escrita apenas via `service_role` (Edge Function) nesta fase.
6. Trigger `update_updated_at_column` em todas.

### Função protegida para respostas livres
```sql
create or replace function public.psico_ind_ler_respostas_livres(_formulario_id uuid)
returns setof public.psico_individual_respostas_livres
language sql stable security definer set search_path = public as $$
  select * from public.psico_individual_respostas_livres
  where formulario_id = _formulario_id
    and public.can_see_internal(auth.uid());
$$;
revoke all on function public.psico_ind_ler_respostas_livres(uuid) from public, anon, authenticated;
grant execute on function public.psico_ind_ler_respostas_livres(uuid) to service_role;
```

### Frontend
- `src/lib/psicoIndividual.ts` (novo): exporta `PSICO_INDIVIDUAL_ENABLED` e tipos base.
- Nenhum componente/rota novo neste PR.

## Diagrama de dependências entre PRs

```text
PR1 schema+flag
  ├─ PR2 instrumento individual (perguntas/opções + seed)
  ├─ PR3 convites (empregador + empregado) + edge functions de token
  ├─ PR4 formulários públicos (2 fluxos) + respostas
  ├─ PR5 conciliação determinística + achados
  ├─ PR6 revisão técnica + plano assistido por IA (sanitizado)
  └─ PR7 PDF individual + assinatura + QR
```

## Critérios de aceite (PR 1)

- Migração aplica e reverte em ambiente local.
- Metodologia coletiva permanece 100% inalterada (testes existentes passam).
- `anon` não consulta nenhuma tabela nova (verificado por linter/policies).
- Cliente de uma empresa não vê avaliação de outra (RLS por `can_see_internal` + isolamento por empresa herdado de `psico_avaliacoes`).
- `psico_individual_respostas_livres` não aparece em SELECTs administrativos comuns; só via função dedicada.
- Tipos do Supabase regenerados após approval da migração.
- `supabase--linter` sem alertas relevantes introduzidos por este PR.

## Rollback
- Desligar `VITE_PSICO_INDIVIDUAL_ENABLED`.
- Como nada da nova modalidade é referenciado pelo fluxo coletivo, os dados podem ficar preservados até remoção planejada. Migração reversa disponível se necessário (DROP TABLE + DROP COLUMN + DROP TYPE).

## Fora de escopo neste PR
- Telas de criação da avaliação individual.
- Convites, formulários públicos, conciliação, revisão individual, plano IA, PDF individual — cada um em seu PR.
