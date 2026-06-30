# Plano — Reestruturação para Arquitetura Centrada em Projetos

Vamos introduzir o módulo **Projetos / Contratos** como o "pai" da operação após a aprovação da proposta, substituindo o modelo atual de "1 serviço = N OS" por "1 projeto = N serviços contratados = 1 OS principal = N visitas".

## Fases

### Fase 1 — Modelo de Dados (migration)

Novas tabelas:
- `projetos` — núcleo do contrato operacional
  - vínculo: `proposal_id`, `client_id`, `financeiro_contrato_id`
  - campos: `numero` (PRJ-AAAA-NNNNN), `titulo`, `status` (planejamento, em_execucao, em_revisao, concluido, atrasado, cancelado), `gestor_id`, `responsavel_comercial_id`, `valor_contratado`, `data_inicio`, `data_fim_prevista`, `data_fim_real`, `percentual_progresso`, `observacoes`
- `projeto_servicos` — serviços contratados dentro do projeto (substitui `approved_services` como entidade operacional)
  - vínculo: `projeto_id`, `proposal_item_id`, `service_id`, `responsavel_id`
  - campos: `nome`, `categoria`, `status` (pendente, em_andamento, concluido, cancelado), `percentual_progresso`, `validade_meses`, `data_validade`, `valor`
- `projeto_timeline` — histórico de eventos do projeto
- `projeto_renovacoes` — controle de renovações próximas (job/automação cria)

Ajustes em tabelas existentes:
- `ordens_servico`: adicionar `projeto_id` (1 OS principal por projeto)
- `os_visitas`: já existe, manter (visitas vinculadas à OS principal)
- `documentos_tecnicos`: adicionar `projeto_id` para vinculação direta
- `financeiro_contratos`: adicionar `projeto_id`
- `execucao_servicos`: marcar como legado (manter para compatibilidade, não usar em novos fluxos)

Funções/triggers:
- `criar_projeto_da_proposta(_proposal_id)` — chamada quando proposta vira aprovada; cria projeto + projeto_servicos (a partir dos proposal_items) + 1 OS principal + vincula contrato financeiro
- Substituir trigger `on_proposal_status_change` para chamar `criar_projeto_da_proposta` no lugar de `criar_execucoes_da_proposta`
- `projeto_recalcular_progresso(_projeto_id)` — recalcula % com base em projeto_servicos
- Trigger em `projeto_servicos` para recalcular progresso do projeto
- Função `projetos_gerar_renovacoes()` — varre projetos concluídos e gera oportunidades CRM próximas do vencimento

Sequence: `projeto_numero_seq`.

### Fase 2 — Páginas e rotas

Novo módulo **Projetos**:
- `/projetos` — lista com KPIs (em planejamento, em execução, em revisão, concluídos, atrasados)
- `/projetos/:id` — editor do projeto com abas:
  - **Visão Geral**: dados, gestor, datas, progresso geral
  - **Serviços Contratados**: tabela com status/progresso por serviço, responsável
  - **Ordem de Serviço**: link para OS principal + visitas
  - **Documentos**: todos documentos vinculados ao projeto
  - **Financeiro**: contrato, parcelas, recebimentos
  - **Timeline**: histórico
  - **Renovações**: serviços com validade

Ajustes em páginas existentes:
- `Dashboard.tsx`: adicionar KPIs de Projetos (Em Planejamento / Execução / Revisão / Concluídos / Atrasados)
- `OrdensServico.tsx` / `OrdemServicoEditor.tsx`: mostrar `projeto_id` e link de volta
- `Documentos.tsx`: filtro por projeto
- `FinanceiroDashboard.tsx`: agrupar contratos por projeto
- Sidebar: nova categoria **Operacional** com Projetos antes de OS

Marcar como legado/secundário:
- `Execucao.tsx` e `ExecucaoEditor.tsx` — manter rota mas tirar do menu principal (modelo antigo de 1 execução por item)

### Fase 3 — Renovação automática

- Edge function ou automação agendada `projetos-gerar-renovacoes`:
  - 60 dias antes do `data_validade` de um `projeto_servicos`, criar `crm_oportunidades` automática com etapa `qualificado` e título "Renovação - {serviço} - {cliente}"
- Adicionar configuração em `service_categories` ou `services` para `validade_padrao_meses`

### Fase 4 — Migração de dados existentes

Script para projetos já aprovados:
- Para cada proposta aprovada sem projeto, criar projeto retroativo
- Migrar OS existentes vinculando ao projeto criado
- Vincular contratos financeiros existentes

## Detalhes técnicos

- Numeração: `PRJ-YYYY-NNNNNN` via sequence
- RLS: admin/comercial veem tudo; outros papéis filtram por `gestor_id` ou equipe
- Progresso do projeto = média ponderada dos `percentual_progresso` dos `projeto_servicos`
- Status do projeto auto-derivado:
  - todos serviços `concluido` → projeto `concluido`
  - algum serviço `em_andamento` → `em_execucao`
  - data_fim_prevista < today e não concluído → `atrasado`
- Manter compatibilidade: rotas `/execucao` continuam funcionando, mas projetos viram o caminho oficial

## Ordem de execução proposta

1. Migration Fase 1 (modelo + funções + trigger novo)
2. Página de Projetos (lista + editor com abas Visão Geral, Serviços, OS, Documentos, Financeiro, Timeline)
3. Ajustes em Dashboard, OS, Documentos, Financeiro, Sidebar
4. Renovação automática (Fase 3)
5. Script de migração de dados existentes (Fase 4) — apenas se houver propostas aprovadas em produção

## Decisões a confirmar

1. **Migração retroativa**: criar projetos para propostas já aprovadas? (Sim/Não)
2. **Renovação**: 60 dias de antecedência está bom, ou prefere outro prazo?
3. **Módulo Execução antigo**: remover do menu ou manter como "Execução Legada"?
4. **Validade padrão**: configurar por serviço (na tabela `services`) ou por categoria?

Posso seguir com a Fase 1 (migration) assim que você confirmar essas 4 decisões — ou se preferir, sigo com defaults (Sim para retroativa, 60 dias, remover do menu, validade por serviço).
