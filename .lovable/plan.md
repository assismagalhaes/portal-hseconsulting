## Etapa 5 — Ordens de Serviço, Planejamento e Agenda

Esta etapa é grande. Vou implementá-la em **3 ondas** dentro desta mesma execução, mantendo a arquitetura modular e preparada para CRM/Financeiro/App futuros.

### Mudança de arquitetura (importante)

Adotamos a hierarquia que você sugeriu:

```
Proposta
 └─ Serviço em Execução (execucao_servicos)   ← contrato/serviço vendido
     └─ Ordem de Serviço (ordens_servico)     ← atividade operacional (1:N)
         ├─ Visitas técnicas (1:N)
         ├─ Logística (1:1)
         ├─ Documentos / Evidências (1:N)
         └─ Checklist (1:N)
```

A tela atual de Execução continua existindo (visão do contrato) e passa a listar/abrir as OS filhas.

---

### Onda 1 — Banco de dados (1 migração)

Novas tabelas em `public`, todas com RLS para `authenticated` + GRANTs para `service_role`:

- `ordens_servico` — número auto (`OS-YYYY-NNNNNN`), execucao_id, client_id, proposal_id, service_id, responsável comercial/técnico, datas (abertura/prevista/início/fim real), status (enum), prioridade, objetivo, descrição, escopo, observações técnicas, percentual_executado, qr_token (uuid).
- `os_equipe` — OS × profissional (papel: apoio/líder).
- `os_recursos` — itens livres (tipo: equipamento, veículo, documento, EPI, outro) + quantidade + observação.
- `os_checklist` — itens do checklist da OS (ordem, descrição, obrigatório, concluído, concluído_por, concluído_em).
- `os_visitas` — data, hora_inicio, hora_fim, local, responsável, objetivo, situação (planejada/realizada/cancelada), observações, registrado_em.
- `os_visita_checklist` — checklist por visita.
- `os_logistica` — cidade, endereço, distância_km, tempo_estimado_min, veículo, motorista, hospedagem, alimentação, pedágios, combustível, observações.
- `os_documentos` — categoria (recebido/gerado/pendente), nome, descrição, status, anexo_path.
- `os_evidencias` — visita_id (opc), tipo (foto/vídeo/pdf/áudio/doc), arquivo_path, legenda.
- `os_eventos_agenda` — espelho da OS para a agenda (start_at, end_at, tipo: visita/execução/reunião) — permite mover sem alterar a OS-mãe.
- Enum `os_status` com os 9 status pedidos; enum `os_prioridade` (baixa/media/alta/urgente).
- Trigger de auditoria + trigger de numeração automática + trigger `updated_at`.
- Buckets de storage: `os-evidencias` e `os-documentos` (privados) com policies por `authenticated`.

### Onda 2 — Frontend funcional (CRUD + planejamento)

- `/ordens-servico` (lista global): filtros por status, prioridade, técnico, cidade, período; busca; criação rápida vinculando a um serviço em execução.
- `/ordens-servico/:id` (editor) com abas:
  1. **Visão geral** — dados, status, prioridade, percentual, cronograma.
  2. **Planejamento** — objetivo, escopo, recursos, equipamentos, veículos, documentos necessários, EPIs, observações.
  3. **Equipe** — responsável técnico (com registro/CREA, cargo, contato) + equipe de apoio (com aviso de conflito de agenda).
  4. **Checklist** — itens obrigatórios/opcionais com progresso.
  5. **Visitas** — lista + criação; cada visita abre drawer com dados, checklist próprio e evidências.
  6. **Logística** — formulário completo (cidade, distância, veículo, hospedagem, etc.).
  7. **Documentos** — recebidos / gerados / pendentes com upload.
  8. **Evidências** — galeria (fotos/vídeos/pdf/áudio) agrupada por visita.
  9. **Histórico** — timeline herdada da execução + eventos da OS.
- Atualização do editor de **Execução** para listar as OS filhas e botão "+ Nova OS".
- Atualização de `Profissionais` com agenda própria + cards (carga horária, qtd. serviços, disponibilidade).

### Onda 3 — Agenda, Dashboard, Impressão e QR

- `/agenda` — calendário (dia/semana/mês) baseado em `os_eventos_agenda`, drag-and-drop para mover horário/dia (usando uma lib leve — `react-big-calendar` ou implementação custom com `date-fns`). Filtro por técnico/cliente/cidade. Conflito de horário destacado em vermelho.
- `/planejamento` — Centro de Planejamento operacional: cards (hoje, amanhã, em campo, em elaboração, em atraso, aguardando cliente, finalizados na semana) + 4 gráficos (técnico, cidade, categoria, mês) com `recharts`.
- `/meu-painel` — Dashboard do técnico logado: próximas visitas, OS em andamento, checklists pendentes, horas previstas/executadas.
- **Impressão da OS** — `OSDocument.tsx` (A4, mesmo padrão visual da proposta) com logo HSE, dados, cliente, serviço, escopo, equipe, cronograma, checklist, assinaturas e QR Code (lib `qrcode`). Botão "Imprimir OS" usa o fluxo print-to-PDF existente.
- **QR Code** — gerado a partir de `qr_token` apontando para rota pública futura `/os/qr/:token` (placeholder pronto para o app mobile ler).
- Atualização da navegação lateral com novas rotas.

### Detalhes técnicos

- Numeração `OS-YYYY-NNNNNN` via função SQL `gerar_numero_os()` + sequence anual.
- `react-big-calendar` + `date-fns` para agenda (pequeno, já alinhado com Tailwind).
- `qrcode` (geração SVG no client) para QR Code.
- Toda mutação respeita RLS (`authenticated`); uploads vão para buckets privados com signed URLs.
- Mobile-ready: schema desnormaliza dados úteis na OS (cliente_nome, cidade, etc.) para sincronização offline futura; campos `synced_at` e `device_id` reservados nas tabelas de visita/evidência.

### Fora do escopo desta etapa (intencional)

- Financeiro (custos de logística serão **somente armazenados**, sem cálculo).
- CRM e Portal do Cliente.
- App mobile real (apenas estrutura preparada).

---

Posso seguir com a Onda 1 (migração) já? Após sua aprovação da migração, sigo direto para Ondas 2 e 3.