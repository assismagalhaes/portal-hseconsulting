# Auditoria de permissões do módulo psicossocial

Data: 05/08/2026  
Escopo: fluxo operacional das avaliações psicossociais coletivas e integrações compartilhadas com a modalidade individual.

## Modelo de acesso esperado

- `admin`: acesso operacional completo e ações administrativas/destrutivas.
- `tecnico`: acesso operacional completo às avaliações, da coleta ao relatório.
- `comercial`: preserva o acesso histórico concedido por `can_see_internal`/`can_see_psico`.
- demais usuários autenticados: sem acesso às avaliações internas.
- `anon`: somente questionários públicos, respostas com token válido e validação pública de relatório.

## Matriz revisada

| Superfície | Frontend/backend revisado | Regra operacional | Resultado |
|---|---|---|---|
| Avaliação e participantes | `psico_avaliacoes`, `psico_participantes`, `psico_atualizar_participante`, importação histórica | `can_see_psico`/admin ou técnico na importação | Coberto |
| Link público e coleta | `psico_gerar_link_publico`, `psico_abrir_coleta`, `psico_prorrogar_coleta`, `psico_encerrar_coleta`, `psico_resumo_coleta` | `can_see_psico` | Coberto |
| Resultados | validação, processamento, resumos, escopos, fatores, perguntas, dashboard e comparações | `can_see_psico` | Coberto |
| Tratamento por fator | criação de revisão e geração/regeneração de recomendações | `can_see_psico` | Corrigido |
| Plano de ação | tabelas do plano, marcação de revisão, contexto e aplicação do plano por IA | `can_see_psico` | Corrigido pela auditoria final |
| IA | parecer coletivo, plano coletivo, parecer individual e sugestão individual | usuário autenticado + RLS/RPC; modalidade individual valida admin ou técnico | Coberto |
| Revisão técnica | validação, salvamento do parecer e aprovação | `can_see_psico` | Corrigido pela auditoria final |
| Relatório | validação, snapshot aprovado, preparação, geração, download e storage privado | `can_see_psico`; conclusão interna por `service_role` | Corrigido pela auditoria final |
| Assinatura | upload da própria assinatura; alteração de outro responsável somente por admin | proprietário ou admin | Mantido intencionalmente |
| Modalidade individual | processamento, conciliação, plano, revisão e relatório | admin ou técnico / RLS psicossocial | Coberto |

## Exceções administrativas preservadas

- Reabrir revisão técnica aprovada.
- Revogar uma versão de relatório emitido.
- Remover respostas públicas administrativamente.
- Publicar ou duplicar questionários, metodologias e bibliotecas de medidas.
- Alterar dados identificadores de participante que já respondeu, quando a regra exige administrador.
- Alterar assinatura pertencente a outro perfil ou profissional.

## Correção aplicada ao código

A migration `20260805193000_audit_tecnico_full_psico_workflow.sql` usa uma lista explícita de RPCs operacionais. Para cada função existente, ela:

1. substitui apenas o gate legado `can_see_internal` por `can_see_psico`;
2. falha se qualquer RPC da lista continuar usando o gate antigo;
3. remove execução herdada de `PUBLIC` e `anon`;
4. concede execução somente a `authenticated` e `service_role`;
5. falha se alguma tabela `psico_*` estiver com RLS desativada.

## Segurança e limitações da validação

- Não foi encontrada exposição nova a usuários anônimos nas ações internas revisadas.
- As Edge Functions que usam `service_role` primeiro validam usuário/token e uma leitura ou RPC protegida, ou são rotas públicas com token próprio.
- O conector Supabase disponível nesta sessão não possui permissão para consultar funções, aplicar migrations ou executar advisors no projeto remoto. Portanto, a confirmação final do estado implantado depende da aplicação da migration no Supabase conectado e do teste com uma conta técnica real.
- A auditoria foi executada no agente principal, sem trabalhadores delegados; todos os arquivos do escopo foram inventariados diretamente.

## Verificação pós-implantação

Testar com perfil técnico, nesta ordem:

1. ativar link público, abrir, prorrogar e encerrar coleta;
2. validar e processar resultados;
3. iniciar tratamento por fator e editar tratamentos;
4. editar plano, gerar sugestões com IA e marcar plano revisado;
5. gerar/salvar parecer com IA e aprovar revisão técnica;
6. visualizar prévia, emitir e baixar relatório.

Confirmar também que o técnico **não** consegue reabrir revisão aprovada nem revogar relatório emitido.
