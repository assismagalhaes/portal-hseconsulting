# PR 7 — Hardening, Piloto e Liberação

## 1. Feature flags

| Flag | Escopo | Default | Efeito |
|---|---|---|---|
| `VITE_PSICO_INDIVIDUAL_ENABLED` | Client | `false` | Libera criação/uso da modalidade individual. |
| `VITE_PSICO_INDIVIDUAL_AI_PLAN_ENABLED` | Client | `false` | Mostra o botão "Sugerir com IA" no plano individual. |
| `PSICO_INDIVIDUAL_AI_PLAN_ENABLED` | Edge Function (server) | `false` | Autoriza a Edge Function `psico-individual-sugerir-plano` a chamar a IA. |

**Ordem de liberação:**
1. Habilitar `PSICO_INDIVIDUAL_ENABLED=true` (client + server).
2. Acompanhar o **primeiro ciclo real** (coleta + processamento + revisão + plano manual + parecer manual + PDF).
3. Habilitar `PSICO_INDIVIDUAL_AI_PLAN_ENABLED=true` (client + server) só depois de validar o ciclo manual.
4. Acompanhar sugestões da IA; se ok, manter parecer/PDF como já estão.
5. Monitorar `psico_ind_sugestoes_ia` (status, rejeitadas) e logs das Edge Functions.

## 2. Checklist de RLS/DB

- [ ] `anon` não lê nenhuma tabela `psico_individual_*` / `psico_ind_*`.
- [ ] Empregador não acessa `psico_individual_respostas` do empregado (e vice-versa).
- [ ] Técnico só vê registros do cliente permitido (`can_see_internal` + escopo por cliente).
- [ ] Cross-tenant negado: mesmo com JWT válido, `SELECT` de outra empresa retorna vazio.
- [ ] `psico_ind_ler_respostas_livres` / `psico_ind_persistir_processamento` NÃO executáveis por `PUBLIC/anon/authenticated`.
- [ ] `psico_individual_revisoes.imutavel=true` bloqueia UPDATE (via trigger).
- [ ] `supabase--linter` roda sem `error` (warnings de perf documentados).

## 3. Checklist Edge Functions

Para cada função (`invite-token`, `validar-convite`, `enviar-respostas`, `processar`, `sugerir-plano`, `gerar-parecer-individual`, `gerar-relatorio-individual`):

- [ ] Token ausente → 400/401.
- [ ] Token inválido/expirado/revogado → 401/403 sem vazar internals.
- [ ] Replay: reenvio da mesma submissão retorna estado idempotente (não duplica linhas).
- [ ] Rate limit: 10 req/min por IP na `invite-token`/`validar-convite`.
- [ ] Payload > 1MB → rejeitado em < 10s.
- [ ] Caracteres inválidos em `token` (`!`, `..`, unicode) → 400.
- [ ] Falha da IA (5xx) → resposta 502 com `detail` sanitizado, log em `ia_feedbacks`.
- [ ] Timeout (25s): retorna 504, mantém idempotência.
- [ ] Resposta da IA fora do schema → 422 `resposta_invalida`.

Rodar: `supabase functions test` ou `deno test --allow-net --allow-env supabase/functions/psico-individual-*/index.test.ts`.

## 4. Checklist Frontend

- [ ] Criação da avaliação nas duas modalidades (coletiva/individual).
- [ ] Formulário empregado e empregador — perguntas + escalas condicionais.
- [ ] Progresso salvo entre rascunhos.
- [ ] Submissão bloqueia envio duplicado (botão desabilitado após click).
- [ ] Aba Conciliação: aprovar exige justificativa quando muda classificação.
- [ ] Aba Revisão: parecer trava após aprovação; assinatura obrigatória.
- [ ] Aba Plano: aprovação exige todos os prioritários cobertos.
- [ ] Aba Relatório: emitir bloqueia se qualquer gate falha; mostra os códigos.

## 5. Checklist PDF (por fixture)

Fixtures em `supabase/functions/psico-gerar-relatorio-individual/fixtures/`:

- [x] `todos_controlados.json`
- [x] `um_fator_prioritario.json`
- [x] `multiplos_fatores.json`
- [x] `divergencia_relevante.json`
- [x] `evidencia_insuficiente.json`
- [x] `plano_extenso.json`
- [x] `textos_longos.json`

Para cada fixture:
- [ ] PDF abre em Chrome/Adobe/macOS Preview.
- [ ] Todas as páginas renderizam (`pdfinfo` reporta >= 6 páginas).
- [ ] Nenhum campo reservado aparece (grep negativo: `respostas_brutas`, `pii`, `email`, `cpf`, `telefone`).
- [ ] Nenhuma resposta bruta.
- [ ] QR Code decodifica para `/validar/relatorio-psicossocial?codigo=<codigo_validacao>`.
- [ ] `codigo_validacao` bate com `psico_ind_relatorios`.
- [ ] Hash SHA-256 da assinatura confere.

## 6. Piloto — Roteiro

### Fase A — Piloto simulado (empresa fictícia)
1. Criar cliente `EMPRESA MODELO LTDA` (CNPJ fictício `00.000.000/0001-00`).
2. Criar avaliação individual `AFP-PILOTO-000X`.
3. Convidar empregado e empregador com e-mails controlados (`piloto+emp@hseconsulting.com.br`, `piloto+empr@hseconsulting.com.br`).
4. Submeter combinações conhecidas (todas as fixtures acima).
5. Conferir motor de conciliação; aprovar.
6. Revisar plano; aprovar.
7. Revisar parecer; aprovar.
8. Emitir PDF; validar QR + hash.
9. Tentativa de acesso indevido: outro técnico sem permissão tenta abrir a avaliação — deve receber 403.

### Fase B — Piloto real (1 empresa)
- Autorização por escrito da empresa.
- Aviso de privacidade revisado por Jurídico/DPO.
- Repetir Fase A com dados reais.
- Monitorar `psico_ind_sugestoes_ia` e logs por 7 dias.

## 7. Monitoramento pós-liberação

- Logs `psico-individual-*` — erros/timeout/rate limit.
- Tabela `psico_ind_sugestoes_ia` — % rejeitadas por motivo.
- Tabela `psico_ind_relatorios` — status `falhou` deve ser 0.
- Alertas: se `falhou > 0` em 24h, revisar antes de escalar.

## 8. Piloto simulado — Fase A (execução automatizada 2026-07-23)

### Backend / RLS
- [x] `anon` sem grants em nenhuma tabela `psico_individual_*` / `psico_ind_*`.
- [x] RLS habilitado em 14/14 tabelas da modalidade individual.
- [x] `psico_ind_ler_respostas_livres` / `psico_ind_persistir_processamento` restritos a `service_role`.
- [x] `psico_ind_snapshot_relatorio`, `psico_ind_preparar_relatorio`, `psico_ind_concluir_relatorio`, `psico_ind_falhar_relatorio` revogados de `anon`/`authenticated` (apenas `service_role`).
- [x] `psico_ind_gates_emissao`, `psico_ind_contexto_para_ia`, `psico_ind_salvar_parecer` revogados de `anon` (mantidos para `authenticated`, pois são chamados pela Edge Function com o JWT do técnico).

### Edge Functions em produção
- [x] Todas as 7 funções da modalidade individual implantadas (`invite-token`, `validar-convite`, `enviar-respostas`, `processar`, `sugerir-plano`, `gerar-parecer-individual`, `gerar-relatorio-individual`).
- [x] `sugerir-plano`: 405 em GET, 401 sem JWT.
- [x] `gerar-parecer-individual` / `gerar-relatorio-individual` / `processar`: 401 sem `Authorization` header.
- [x] `validar-convite`: tokens ausentes/malformados/com caracteres inválidos (`..`, `/`, espaço, `!@#$%`, unicode) retornam mensagem genérica sem vazar detalhes.
- [x] Payload de 1.5 MB rejeitado em ~1s (limite interno de 4 KB no `raw.length`).
- [x] Rate-limit de `validar-convite` verificado: 12 requisições passam, 13ª+ retornam `429 rate_limited`.

### Correções aplicadas durante o piloto simulado
1. Bundler recusava JSX em `.ts` → `psico-gerar-relatorio-individual` reorganizada no padrão do relatório coletivo (`index.ts` → `template.tsx` + `deno.json` com `jsx: react-jsx`).
2. Import cross-function `../psico-gerar-relatorio/brand-assets.ts` não entrava no bundle → asset copiado para dentro da função.
3. RPC `psico_rate_limit_hit` estava gravando na coluna inexistente `created_at` e o `EXCEPTION WHEN OTHERS RETURN true` engolia o erro, permitindo abuso silencioso → reescrita usando `window_start` alinhado por `floor(epoch/window)*window` e `RETURN false` no fail-closed.

### Pendências para execução manual (Fase A / Fase B)
- Criar `EMPRESA MODELO LTDA` + `AFP-PILOTO-000X` na UI (requer sessão de técnico logado).
- Enviar convites para `piloto+emp@…` e `piloto+empr@…`, submeter as 7 combinações das fixtures.
- Aprovar conciliação, plano, parecer; emitir PDF; validar QR + hash.
- Teste de acesso indevido: outro técnico sem permissão abre a avaliação (esperado: 403).
- Piloto real (Fase B) só após autorização escrita da empresa e revisão de DPO.

