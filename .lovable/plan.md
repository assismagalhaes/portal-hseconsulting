
# PR 2 — Instrumentos e criação da avaliação individual

## Escopo
Publicar dois instrumentos versionados (AQI-EMPREGADO-1.0 e AQI-EMPREGADOR-1.0), permitir escolher a modalidade ao criar avaliação, congelar as versões usadas e restringir recursos incompatíveis. Coletiva HSE continua o padrão.

## 1. Migração — enriquecimento do modelo de perguntas

`ALTER TABLE public.psico_individual_perguntas`:
- `codigo text` (código permanente, único por versão de instrumento)
- `chave_pareamento text` (usada para cruzar empregador × empregado)
- `regra_condicional jsonb` (condição para exibição, ex.: `{"depende_de":"AQI-E-12","valor_min":3}`)
- `limite_texto integer` (para tipo `livre`)
- `status text CHECK IN ('publicada','arquivada') DEFAULT 'publicada'`
- `periodo_referencia text` (ex.: "últimos 3 meses")
- Unicidade `(instrumento_versao_id, codigo)`

`psico_avaliacoes`:
- `instrumento_empregado_versao_id uuid REFERENCES psico_individual_instrumentos_versoes(id)`
- `instrumento_empregador_versao_id uuid REFERENCES psico_individual_instrumentos_versoes(id)`
- CHECK: se `modalidade='individual_microempresa'` então os 2 ids são NOT NULL.

Trigger de imutabilidade: bloquear `UPDATE`/`DELETE` em `psico_individual_perguntas`/`_opcoes`/`_instrumentos_versoes` quando `vigente=true` — apenas troca de `status` para `arquivada` permitida.

## 2. Seed dos 2 instrumentos (migração de dados)

Sete fatores:
```text
F1 Demandas de trabalho
F2 Controle e autonomia
F3 Apoio social e liderança
F4 Relações interpessoais
F5 Reconhecimento e crescimento
F6 Justiça organizacional
F7 Interface trabalho-vida
```

- `AQI-EMPREGADO-1.0`: 32 perguntas (4–5 por fator), tipo `escala` Likert-5, mais 3 campos `livre` condicionais (aparecem se escala ≤ 2 em fatores críticos). Período: últimos 3 meses.
- `AQI-EMPREGADOR-1.0`: 27 perguntas (3–4 por fator), foco em existência/eficácia de controles, mais 2 campos `livre` condicionais.

Cada pergunta ganha `codigo` (AQI-E-01…, AQI-R-01…) e `chave_pareamento` compartilhada entre pares (ex.: `PAR-F1-CARGA`), para o PR 4 (convergência).

Opções Likert-5 padrão com `valor_numerico 1–5` e `significa_exposicao` marcado para pontas críticas.

Ambas as versões marcadas `vigente=true` e `publicado_em=now()`. Trigger de imutabilidade passa a proteger.

## 3. Biblioteca — `src/lib/psicoIndividual.ts`

- `listarInstrumentosVigentes()` → devolve o par (empregado + empregador).
- `criarAvaliacaoIndividual({...})` — insert em `psico_avaliacoes` com `modalidade='individual_microempresa'`, `quantidade_participantes_prevista=1`, ids dos instrumentos congelados.
- `descreverImutabilidade(instrumento)` — helper de UI.
- Constantes: `PSICO_INDIVIDUAL_LABEL_MODALIDADE`, `PSICO_INDIVIDUAL_AVISO_PRIVACIDADE`, `PSICO_INDIVIDUAL_AVISO_METODOLOGICO`.

Nenhuma UI aparece se `PSICO_INDIVIDUAL_ENABLED=false`. Para o PR2 a flag continua desligada por padrão; o seletor só é mostrado quando ligada.

## 4. `PsicoAvaliacaoNova.tsx`

- Novo bloco no topo do form: `RadioGroup` "Modalidade" com 2 opções (Coletiva HSE / Assistida Individual). Só renderiza se a flag estiver ligada.
- Ao escolher **Individual**:
  - `quantidade_participantes_prevista` = 1 e campo fica `disabled` com nota "Modalidade individual: 1 empregado por avaliação".
  - Esconde os cards de "importação histórica" (não estão nessa tela; documentar) e desabilita seleção de segmentações (não estão nessa tela).
  - Carrega o par de instrumentos vigentes e exibe um `Card` "Instrumentos congelados nesta avaliação" com `codigo — versao` e status `Publicada`.
  - Renderiza `Alert` metodológico + privacidade (2 blocos amarelos com `ShieldAlert`/`Info`) — botão "Salvar" fica `disabled` até checkbox "Li e concordo com o aviso metodológico e de privacidade".
- Salvamento:
  - Modalidade coletiva → mantém insert atual (sem regressão).
  - Modalidade individual → usa `criarAvaliacaoIndividual` (não grava `questionario_versao_id`/`metodologia_versao_id`, grava os dois `instrumento_*_versao_id`).

## 5. `PsicoAvaliacaoDetalhes.tsx`

- Ler `modalidade`, `instrumento_empregado_versao_id`, `instrumento_empregador_versao_id`.
- Adicionar `Badge` da modalidade no cabeçalho.
- Se `individual_microempresa`:
  - Ocultar/desabilitar as abas de importação histórica, segmentações e link público (mantendo somente Detalhes/Documentos por ora — as abas dedicadas virão no PR 3).
  - Mostrar `Card` "Instrumentos congelados" com os códigos/versões.
  - Mostrar `Alert` reforçando que não há anonimato estatístico.
- Sem alteração para coletiva.

## 6. Aceite (verificação após o build)

1. Criar avaliação **coletiva** continua funcionando idêntico ao atual (sem regressão).
2. Ligando a flag, é possível escolher **Individual**; quantidade trava em 1; instrumentos aparecem congelados.
3. Publicação bloqueia UPDATE em pergunta de instrumento vigente (validado via query direta na migração de teste).
4. Registro em `psico_avaliacoes` contém os dois `instrumento_*_versao_id` corretos.
5. Salvar sem marcar o checkbox de aviso é bloqueado no cliente e o CHECK server-side garante os ids obrigatórios.

## 7. Rollback

Desligar `VITE_PSICO_INDIVIDUAL_ENABLED`. O seletor desaparece, novas avaliações voltam a ser sempre coletivas. Registros já criados permanecem como rascunho e continuam listados.

## 8. Fora do escopo (fica para PRs seguintes)

- PR 3: geração de convites, links dos dois formulários e coleta.
- PR 4: processamento de convergência, achados e revisão.
- PR 5: relatório e parecer individual.

## Detalhes técnicos

- Todas as inserções de perguntas/opções são feitas via `supabase--migration` (DDL + INSERTs sementes) em um único arquivo, dentro de bloco `DO $$ ... $$` para garantir atomicidade.
- Validação server-side via CHECK e trigger; validação cliente com Zod (`z.discriminatedUnion('modalidade', ...)`).
- Nenhuma alteração no fluxo coletivo (`psico_questionarios_versoes`, `psico_metodologias_versoes` intocados).
