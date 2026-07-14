# Unificação: Ordens de Serviço dentro do Projeto

## Diagnóstico atual

Hoje o fluxo operacional está fragmentado:

```text
Proposta aprovada
   └─> Projeto (contém serviços contratados)
         └─> Ordem de Serviço (entidade separada, com nº próprio, editor próprio, listagem própria)
                └─> Visitas, equipe, checklist, evidências, documentos, timeline
```

Isso obriga o técnico a: (1) abrir o projeto, (2) criar uma OS, (3) sair do projeto para trabalhar dentro da OS, (4) voltar para o projeto para ver o todo. Muita navegação e duplicidade de cadastro (cliente, endereço, responsável, prazos já existem no projeto).

## Proposta

**Eliminar o conceito de "OS" da interface.** Tudo que hoje é feito dentro de uma OS passa a ser feito **dentro do próprio Projeto**, organizado por **Atividades** (nome interno mais leve — ou "Etapas de campo", a definir).

```text
Proposta aprovada
   └─> Projeto
         ├─ Visão geral / Cliente / Financeiro (como hoje)
         ├─ Serviços contratados (como hoje)
         ├─ Atividades  ← NOVO: absorve visitas, equipe, checklist, evidências
         ├─ Documentos  (como hoje, já é do projeto)
         └─ Timeline    (unificada: projeto + atividades)
```

Uma **Atividade** pode ser: uma visita técnica, uma inspeção, uma coleta, uma entrega em campo — o que hoje virava uma OS. Ela vive dentro do projeto, herda cliente/endereço/responsável, e tem seu próprio prazo, status, equipe e evidências.

## Escopo funcional

### O que some da interface
- Menu lateral **"Ordens de Serviço"** (interno e no portal do cliente vira **"Atividades"** ou é fundido em "Serviços").
- Página de listagem global `/ordens-servico`.
- Botão "Nova OS" isolado.
- Editor `/ordens-servico/:id` como página raiz.
- Impressão `/ordens-servico/:id/print` → passa a ser `/projetos/:id/atividades/:aid/print`.

### O que passa para dentro do Projeto
Nova aba **"Atividades"** no `ProjetoEditor` com:
- Lista de atividades do projeto (nº curto, título, responsável, prazo, status, prioridade).
- Botão "Nova atividade" (herda cliente/endereço do projeto — 1 clique).
- Ao abrir uma atividade → drawer/painel lateral (ou sub-rota `/projetos/:id/atividades/:aid`) com as sub-abas que hoje existem na OS: **Detalhes · Equipe · Checklist · Visitas · Evidências · Documentos · Timeline**.

### Visão global para quem executa
Para não perder a visão consolidada de "o que preciso fazer hoje", a página **Planejamento** e o **Meu Painel** continuam listando as atividades de todos os projetos filtráveis por responsável / prazo / status — apenas mudam o rótulo de "OS" para "Atividades" e o link passa a abrir o projeto na aba certa.

### Portal do cliente
- Aba "Ordens de Serviço" do portal é fundida em **"Serviços"** (o cliente vê o serviço contratado e, abaixo, as atividades planejadas/realizadas com datas e status). Menos jargão para o cliente.

## Estratégia de migração (sem perda de dados)

Não vamos deletar a tabela `ordens_servico` nem os dados históricos. A abordagem é **renomear conceito, manter estrutura**:

1. Manter a tabela `ordens_servico` e todas as suas satélites (`os_equipe`, `os_checklist`, `os_visitas`, `os_evidencias`, `os_documentos`, `os_timeline`, `os_recursos`, `os_eventos_agenda`, `os_logistica`, `os_visita_checklist`, `os_checklist_sugestoes`).
2. Tornar **obrigatório** o vínculo `projeto_id` em novas atividades (hoje é opcional). Atividades antigas sem projeto continuam acessíveis via Planejamento.
3. Ajustar a numeração/rótulo para "ATV-####" internamente (ou manter "OS-####" no banco e só mudar o rótulo — decisão de UI).
4. Nenhuma migração destrutiva; apenas ajuste de defaults e, se quiser, um `check` garantindo `projeto_id NOT NULL` para novos registros.

## Impacto em código (alto nível, para o time técnico)

### Rotas / navegação
- Remover entradas de menu "Ordens de Serviço" em `AppLayout.tsx` e `ClienteLayout.tsx`.
- Em `App.tsx`: manter as rotas `/ordens-servico/:id` e `/ordens-servico/:id/print` como **redirects** para `/projetos/:projeto_id/atividades/:id` (compatibilidade com links já enviados por e-mail).
- Remover rota `/ordens-servico` (listagem).

### Páginas
- **`ProjetoEditor.tsx`**: nova aba "Atividades" com listagem + criação inline; abrir atividade em drawer OU navegar para sub-rota que renderiza o conteúdo hoje em `OrdemServicoEditor.tsx`.
- **`OrdemServicoEditor.tsx`**: refatorado para ser um componente reutilizável (`AtividadeEditor`) montado dentro do projeto; deixa de ser uma "página cheia" e vira o conteúdo da sub-rota.
- **`OrdensServico.tsx`**: deletado (a listagem vive em `Planejamento` e dentro do projeto).
- **`Planejamento.tsx`** e **`MeuPainel.tsx`**: renomear coluna/rótulo "OS" → "Atividade"; link passa a apontar para o projeto.
- **`ClienteOS.tsx`**: deletado; conteúdo fundido em `ClienteServicos.tsx`.
- **`OrdemServicoPrint.tsx`**: mantido, apenas retitulado.

### Textos e rótulos
- Substituir "Ordem de Serviço" / "OS" por "Atividade" nos rótulos visíveis (páginas, badges, e-mails, alertas do módulo IA, notificações). O nome interno de tabelas/colunas fica igual.

### Não muda
- Documentos técnicos (já pertencem ao projeto).
- Financeiro, propostas, CRM, IA — nenhum impacto estrutural.
- Automações que referenciam OS continuam funcionando (mesma tabela).

## Fases de execução sugeridas

1. **Fase 1 – Backend leve**: garantir que toda OS futura tenha `projeto_id` (criar projeto "avulso" automaticamente ao criar uma atividade sem projeto, se for necessário — a definir).
2. **Fase 2 – Refatorar `OrdemServicoEditor` em componente `AtividadeEditor`** reutilizável.
3. **Fase 3 – Integrar no `ProjetoEditor`** como aba, com criação inline.
4. **Fase 4 – Remover menus e listagem global**, adicionar redirects de compatibilidade.
5. **Fase 5 – Unificar portal do cliente** (Serviços + OS).
6. **Fase 6 – Renomear textos** ("OS" → "Atividade") e revisar e-mails/notificações/alertas IA.

## Pontos que preciso confirmar antes de codar

1. **Nome do novo conceito**: "Atividade", "Etapa de campo", "Tarefa de campo" ou manter "Ordem de Serviço" só que dentro do projeto? (Você disse para retirar o nome OS — sugiro **"Atividade"**, curto e neutro.)
2. **Atividades sem projeto**: hoje é possível. Devemos **forçar** vínculo com projeto (recomendo sim) ou permitir avulsas?
3. **Portal do cliente**: fundir "OS" dentro de "Serviços" numa única aba, ou renomear a aba para "Atividades"?
4. **Abrir a atividade**: prefere **drawer lateral** dentro do projeto (mais rápido, sem perder contexto) ou **sub-página** dedicada (mais espaço, URL própria)?

Me confirme esses 4 pontos que eu já parto para a execução.
