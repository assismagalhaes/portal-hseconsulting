## Contexto atual

- Já existe enum `app_role` com valores `admin`, `comercial`, `tecnico` e tabela `user_roles` com função `has_role()`.
- `handle_new_user` cria papel `comercial` por padrão (primeiro usuário vira `admin`).
- Existe `execucao_profissionais` (cadastro operacional, sem login) e `profiles` (vinculada a `auth.users`).
- `AuthProvider` já expõe `roles` e `isInternal` (admin || comercial).
- Sidebar (`AppLayout`) hoje mostra tudo para qualquer usuário logado.
- RLS de tabelas comerciais/financeiras precisa ser revista para bloquear `tecnico`.

## O que será entregue (Fase 1)

### 1. Backend — papéis e segurança

- Migration para:
  - Ajustar `handle_new_user`: novos usuários passam a nascer com papel `tecnico` (o primeiro continua `admin`).
  - Criar função `public.is_admin()` (wrapper de `has_role(auth.uid(),'admin')`) para simplificar policies.
  - Revisar policies das tabelas sensíveis para exigir `is_admin()` ou `can_see_internal()` (bloquear `tecnico`):
    - Comercial: `proposals`, `proposal_items`, `proposal_revisions`, `proposal_item_pricing`, `proposal_template`, `crm_*`, `historico_precificacao`, `simulacoes_precificacao`, `simulacao_*`, `pricing_params`, `valor_hora_tecnica_historico`, `approved_services`, `services` (leitura ok, escrita admin).
    - Financeiro: todas `financeiro_*`.
    - Config/usuários: `user_roles`, `profiles` (tecnico só lê o próprio), `automacoes*`, `ia_*` restritos, `documentos_modelos`.
  - Projetos: `projetos`, `projeto_servicos`, `projeto_timeline`, `projeto_renovacoes`, `ordens_servico`, `os_*`, `execucao_*`, `tarefas*`, `documentos_tecnicos` (somente arquivos liberados), `clients` (leitura ok para nome/serviço) — permitir SELECT para `tecnico`.
  - Restringir UPDATE de campos de responsável em `projetos` (`responsavel_comercial_id`, etc.) — via policy `WITH CHECK` que exige `is_admin()` para UPDATE.
- Vincular `execucao_profissionais.auth_user_id` (adicionar coluna opcional) para conectar cadastro operacional com login.

### 2. Frontend — módulo Usuários (admin only)

- Nova página `/usuarios` (`src/pages/Usuarios.tsx`):
  - Lista de usuários (join `profiles` + `user_roles`).
  - Criar usuário: chama edge function `admin-create-user` (usa `service_role`) — cria em `auth.users`, insere `profiles`, atribui papel.
  - Editar: nome, telefone, cargo, área, registro, foto, status, papel.
  - Status (`ativo`/`inativo`/`bloqueado`) armazenado em `profiles` (novas colunas).
- Edge function `supabase/functions/admin-create-user/index.ts` protegida por checagem de papel admin do chamador.

### 3. Frontend — controle de acesso e navegação

- `AuthProvider`: expor `isAdmin`, `isTecnico`.
- `AppLayout`: filtrar itens do menu conforme papel. Técnico vê apenas: Dashboard, Projetos, Meu Perfil.
- Novo componente `RequireRole` para proteger rotas admin (`/clientes`, `/servicos`, `/propostas*`, `/execucao*`, `/crm/*`, `/financeiro/*`, `/documentos*`, `/ia/*`, `/automacoes/*`, `/portal-cliente`, `/configuracoes`, `/profissionais`, `/usuarios`, `/agenda`, `/ordens-servico*`, `/planejamento`, `/notificacoes`, `/tarefas`).
- `/` (Dashboard): renderizar `DashboardTecnico` quando papel = tecnico; senão o atual.
- Nova página `DashboardTecnico`: cards (em andamento / concluídos / próximos do prazo / atrasados), últimos projetos atualizados, próximos prazos, checklists pendentes.
- `Projetos` e `ProjetoEditor`: ocultar/omitir para técnico os campos e seções financeiras (`valor_contratado`, contratos, financeiro, valores em `projeto_servicos`). Bloquear edição de responsáveis (inputs somente-leitura).
- Nova página `MeuPerfil` reutilizando parte de `Settings` (dados pessoais e foto), sem seções administrativas.

### 4. Storage

- Bucket `avatares` (novo, público) para foto de perfil, com policies de upload restritas ao próprio usuário.

## Fora de escopo desta fase

- Restringir projetos aos que o técnico participa (fica para fase futura, já indicado no requisito).
- Perfis Comercial, Financeiro, etc. — arquitetura pronta via enum + policies, sem UI ainda.

## Detalhes técnicos

```text
Papéis (app_role)
  admin      → tudo
  comercial  → (reservado, sem UI de atribuição nesta fase)
  tecnico    → SELECT em projetos/OS/execução/tarefas/documentos liberados
             → SEM acesso a proposals/crm/financeiro/pricing/config

Policies-chave (padrão)
  ADMIN ALL:      USING (public.is_admin())        WITH CHECK (public.is_admin())
  INTERNAL READ:  USING (public.can_see_internal(auth.uid()))
  TECNICO READ:   USING (auth.uid() IS NOT NULL)   -- em tabelas operacionais
```

Após aprovação eu executo migration + edge function + páginas em paralelo.
