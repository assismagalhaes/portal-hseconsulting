## Etapa 6 — Documentos Técnicos

Esta etapa cria toda a estrutura documental técnica do Portal HSE Consulting, mantendo a arquitetura modular e preparada para IA, assinatura eletrônica e Portal do Cliente. Implementação em 3 ondas dentro desta execução.

---

### Onda 1 — Banco de dados (1 migração)

Novas tabelas em `public`, todas com RLS para `authenticated` + GRANTs para `service_role`. Triggers de `updated_at`, auditoria de revisão e numeração automática `DOC-AAAA-NNNNNN`.

- **`documentos_tecnicos`** — número auto, tipo (enum), título, versão, revisão, status (enum), cliente_id, proposal_id, execucao_id, os_id, responsável_técnico_id, responsável_revisao_id, datas (criação, alteração, aprovação, emissão, vencimento), conteúdo_json (estrutura do editor), arquivo_final_path, observações_internas, visivel_para_cliente, assinatura_* (registro, cargo, ART, assinatura_path), aprovado_por, aprovado_em, aprovacao_obs, dias_restantes (generated), status_validade (generated).
- **`documentos_modelos`** — nome, tipo, categoria, descrição, texto_padrao, secoes_json, campos_variaveis_json, responsavel_padrao_id, validade_padrao_dias, ativo.
- **`documentos_secoes`** — modelo_id, ordem, titulo, conteudo_padrao, obrigatoria.
- **`documentos_campos_variaveis`** — chave, label, origem (cliente|proposta|execucao|os|profissional|empresa), campo_origem, descricao.
- **`documentos_revisoes`** — documento_id, numero_revisao, descricao, status, arquivo_path, user_id, criada_em.
- **`documentos_anexos`** — documento_id, nome, tipo (foto|art|certificado|planilha|pdf|imagem|outro), arquivo_path, descricao, origem (os|visita|cliente|upload), origem_id.
- **`documentos_aprovacoes`** — documento_id, aprovado_por, aprovado_em, observacoes, revisao_id.
- **`documentos_recebidos`** — cliente_id, execucao_id, nome, data_recebimento, recebido_por, status (recebido|parcial|pendente|dispensado), observacoes, arquivo_path.
- **`documentos_pendentes`** — cliente_id, execucao_id, documento_solicitado, responsavel_envio, data_solicitacao, prazo, status (solicitado|recebido|parcial|pendente|dispensado), observacao.
- **`documentos_notificacoes`** — documento_id, tipo (revisao_atrasada|proximo_vencimento|vencido|aguardando_cliente|pendencia), mensagem, lida, user_id_destino, criada_em.
- **`documentos_permissoes`** — role (app_role), pode_criar, pode_editar, pode_revisar, pode_aprovar, pode_emitir, pode_cancelar.

Enums: `documento_tipo` (PGR, PCMSO, LTCAT, Laudo_Insalubridade, Laudo_Periculosidade, Avaliacao_Ergonomica, Avaliacao_Psicossocial, Parecer_Tecnico, Relatorio_Tecnico, Relatorio_Visita, Relatorio_Medicao, Certificado_Treinamento, Lista_Presenca, OS_SST, PPP, Outros), `documento_status` (rascunho, em_elaboracao, em_revisao, aguardando_cliente, aguardando_assinatura, aprovado, emitido, entregue, revisado, cancelado, vencido).

Bucket privado: **`documentos-tecnicos`** (arquivos finais, anexos, assinaturas).

Sequence + função `gerar_numero_documento()`. Trigger `documentos_audit` para histórico automático em mudança de status. Função `criar_revisao_documento(doc_id, descricao)`. Seed de `documentos_campos_variaveis` com as chaves do briefing.

### Onda 2 — Frontend funcional (CRUD + editor + dashboard)

- **`/documentos`** — Dashboard + lista. Cards (em elaboração, em revisão, aguardando cliente, emitidos, entregues, próximos vencimento, vencidos). Filtros: cliente, tipo, responsável, status, período, vencimento. Indicador de validade 🟢🟡🔴.
- **`/documentos/novo`** — Wizard de criação: tipo → modelo (opcional) → vínculos (cliente, proposta, execução, OS) → criação.
- **`/documentos/:id`** — Editor com abas:
  1. **Geral** — metadados, vínculos, responsável técnico, datas, status.
  2. **Editor** — editor rich-text (TipTap) com toolbar: títulos, listas, tabelas, imagens, quebra de página, **inserir campo variável** (popover com chaves disponíveis), salvar rascunho, gerar revisão.
  3. **Revisões** — histórico completo com diff de status e arquivos.
  4. **Anexos** — galeria com upload, importar de OS/visitas/evidências.
  5. **Assinatura** — responsável, registro, cargo, ART, upload de assinatura digitalizada.
  6. **Aprovação** — fluxo Rascunho → Em elaboração → Em revisão → Aprovado → Emitido → Entregue (botão por etapa, registra usuário/data/observação).
  7. **Histórico** — timeline automática.
- **`/documentos/modelos`** — CRUD de modelos técnicos (nome, tipo, seções, campos, validade padrão, ativar/desativar, duplicar).
- **`/documentos/recebidos`** — Lista de documentos recebidos do cliente (upload + categorização).
- **`/documentos/pendentes`** — Lista de pendências por cliente/serviço com prazo e status.
- **Vínculos**: nova aba "Documentos" em `ExecucaoEditor` e "Documentos gerados" em `OrdemServicoEditor`.
- **Navegação**: adicionar grupo "Documentos" no `AppLayout`.

### Onda 3 — PDF técnico, validade e notificações

- **`DocumentoTecnicoPDF.tsx`** — Componente A4 com layout **técnico/institucional** (distinto da proposta comercial premium):
  - Capa: logo HSE, tipo de documento, título, cliente, número, revisão, datas.
  - Sumário (gerado das seções).
  - Corpo técnico (renderiza conteúdo do editor + resolve campos variáveis).
  - Tabelas e anexos.
  - Página de assinatura técnica (responsável, registro, ART).
  - Histórico de revisões.
  - Rodapé institucional em todas as páginas.
- **`/documentos/:id/pdf`** — rota de impressão otimizada print-to-PDF.
- **Resolver de campos variáveis** (`src/lib/documentos.ts`): substitui `{{chave}}` por dados reais de cliente/proposta/execução/OS/profissional/template.
- **Indicadores de validade**: cálculo `dias_restantes`, badges, ordenação por urgência.
- **Notificações internas**: bell icon no header com contagem; lista filtrada por usuário; geradas via função SQL diária (placeholder — gatilho manual nesta etapa, agendamento futuro).
- **Permissões por role**: helper `usePodeDocumento(action)` consumindo `documentos_permissoes` + roles do usuário; bloqueios visuais nos botões.

---

### Detalhes técnicos

- Editor: **TipTap** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-image`) — leve, headless, integra com Tailwind.
- Conteúdo do editor salvo como JSON em `documentos_tecnicos.conteudo_json` (preserva versões).
- Cada `Salvar como revisão` cria snapshot em `documentos_revisoes` com `conteudo_json` congelado.
- PDF reaproveita o pipeline atual de print-to-PDF (mesmo padrão de `ProposalDocument` e `OrdemServicoPrint`).
- Bucket `documentos-tecnicos` privado com signed URLs.
- Campo `visivel_para_cliente` default `false` — preparado para o futuro Portal do Cliente.
- Estrutura de `conteudo_json` por seção (heading + blocos) facilita futura geração por IA.

### Fora do escopo desta etapa (intencional)

- IA generativa (sugestão de texto, resumo de evidências, comparação de versões).
- Assinatura eletrônica real (apenas estrutura de campos + upload de imagem).
- Envio de e-mail (apenas notificação interna).
- Portal do Cliente (apenas o campo `visivel_para_cliente`).

---

Posso seguir com a Onda 1 (migração)? Após aprovação da migração, sigo direto para Ondas 2 e 3.