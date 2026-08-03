# Relatório de Segurança — portal-hseconsulting

Data da revisão: 2026-07-16. Escopo: código React/Vite, Edge Functions e 111 migrações Supabase. A revisão estática incluiu 358 arquivos em inventário, 31 fontes de funções e 212 arquivos `src`.

## Achados confirmados

### Crítico — Aceite de proposta pode ser alterado anonimamente

Em `supabase/migrations/20260709125713_326b06cb-41e9-47da-b723-9d6a7e9215f0.sql:41,55-58`, a role `anon` possui `UPDATE` em `proposal_aceites` e a política só exige que o status atual seja `pendente`; ela não exige nem verifica o token público. O trigger definido nas linhas 86-137 propaga a mudança ao status da proposta. Uma chamada REST anônima pode aceitar ou recusar registros pendentes. Remover o grant/política anônimos e expor uma RPC que valide um token não adivinhável antes da alteração.

### Alto — Edge Function de automações não verifica autorização

`supabase/functions/automacoes-runner/index.ts:9-19,28,34-50` cria um cliente `service_role` e executa automações solicitadas pelo corpo HTTP, sem ler ou validar identidade, papel ou segredo de agendamento. Um invocador que alcance a função pode criar notificações, alertas, tarefas e execuções em massa. Exigir papel administrativo ou segredo de job antes de criar o cliente privilegiado.

### Alto — Relay de e-mail sem RBAC

`supabase/functions/send-transactional-email/index.ts:28-30,52-66,120-121,298-322` recebe dados e destinatário do chamador e usa `service_role` para enfileirar o envio. `verify_jwt=true` apenas exige JWT válido, não autorização. Restringir a função a um papel interno/serviço e validar ownership do objeto que origina o envio.

### Alto — Qualquer autenticado pode gerar alertas globais

`supabase/functions/ia-gerar-alertas/index.ts:17-22,28-64` confirma somente que existe usuário e depois consulta/grava com `SERVICE_ROLE`. Um usuário comum pode disparar processamento sobre registros globais e poluir alertas. Exigir papel interno apropriado ou mover a operação para job de serviço.

### Alto — CRUD entre projetos em `projeto_pendencias`

`supabase/migrations/20260716140125_14bc2cca-23ff-42f3-aec9-0fe4e67c6583.sql:20-30` concede CRUD a `authenticated` e a política permite toda ação para qualquer `auth.uid()` não nulo. Aplicar predicado de associação ao projeto/cliente e usar `USING` e `WITH CHECK` equivalentes.

### Alto — XSS persistente no renderer de documentos

`src/lib/documentos.ts:72-77` interpola valores diretamente em HTML e `src/pages/DocumentoPDF.tsx:49-50,112` injeta o resultado com `dangerouslySetInnerHTML`. Usuários internos capazes de editar documento ou variáveis podem executar JavaScript na sessão de um visualizador. Sanitizar HTML no servidor e antes da renderização, com lista explícita de elementos/atributos/URLs permitidos; não confiar no editor Tiptap como fronteira de segurança.

### Médio — Arquivos enviados são abertos com `window.opener`

`window.open(signedUrl, '_blank')` aparece em `DocumentoEditor.tsx:140`, `ClienteDocumentos.tsx:26`, `DocumentosRecebidos.tsx:62`, `ExecucaoEditor.tsx:445` e `OrdemServicoEditor.tsx:633`. Arquivos controlados por usuário podem manter referência à aba do portal e redirecioná-la. Usar `window.open(url, '_blank', 'noopener,noreferrer')` e configurar Storage para download/attachment de tipos não confiáveis. A exploração final depende de como o Storage entrega MIME e Content-Disposition.

## Itens descartados

A política anônima histórica de `proposal_clients` não é explorável no estado final: uma migração posterior remove a política `SELECT` de `proposal_aceites`, portanto o `EXISTS` da política restante não observa linhas sob RLS.

## Limitações

Não foram fornecidas credenciais nem acesso ao projeto Supabase implantado. As conclusões são estáticas; principalmente a configuração efetiva de gateway, RLS e Content-Disposition do Storage deve ser verificada no ambiente de produção antes de qualquer mudança operacional.
