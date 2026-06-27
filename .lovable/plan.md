## Contexto

Você mencionou "projeto já iniciado" e "arquivos enviados" (logos HSE verde/azul, proposta Word, planilha Excel de precificação), mas eu não encontrei nenhum desses anexos nesta sessão nem código além do placeholder padrão (`src/pages/Index.tsx` com a logo branca do template). Antes de executar uma reescrita grande, preciso alinhar alguns pontos.

## Pressupostos que vou assumir se você confirmar

- Construir o MVP **do zero** nesta sessão, já com a nova arquitetura centrada em proposta.
- Habilitar **Lovable Cloud** (Postgres + Auth) para persistir clientes, serviços, propostas, itens, precificação, parâmetros e histórico.
- Identidade visual: verde HSE neon (destaque/ação), azul-marinho profundo (institucional), branco/cinza claro (leitura), preto/cinza escuro (texto). Vou **gerar uma logo HSE** provisória (verde+azul) até você subir a oficial.
- Tipografia: par institucional não-genérico (ex.: display geométrica + sans humanista) — sem Inter/Poppins padrão.

## Arquitetura de dados (Lovable Cloud)

```text
clients(id, razao_social, nome_fantasia, cnpj_cpf, qtd_funcionarios,
        cidade, uf, solicitante, telefone, email, observacoes)
services(id, nome, descricao_comercial, escopo_tecnico, unidade_padrao)
pricing_params(id, custo_fixo_mensal, horas_produtivas_mes,
        aliquota_imposto, margem_minima, custo_por_vida,
        markup_minimo, regra_arredondamento)
proposals(id, numero, client_id, status, validade,
        condicoes_pagamento, outras_condicoes,
        aceite_data, assinatura_prestador, assinatura_tomador,
        valor_total, criado_em, atualizado_em)
proposal_items(id, proposal_id, service_id, numero_item,
        descricao_comercial, escopo_tecnico, quantidade, unidade,
        valor_unitario, valor_total)
proposal_item_pricing(id, proposal_item_id,
        custos_diretos_json, horas_json, imposto, margem,
        lucro_desejado, desconto, preco_sugerido,
        preco_arredondado, preco_aprovado, indicadores_json)
proposal_revisions(id, proposal_id, revisao, descricao, data, user_id)
approved_services(id, proposal_item_id, responsavel_id,
        prazo_previsto, status)
profiles(id, nome, papel)  -- equipe HSE + RLS via user_roles
user_roles(user_id, role)  -- admin | comercial | tecnico
```

RLS em todas as tabelas, grants explícitos para `authenticated`/`service_role`, `has_role()` security-definer.

## Estrutura de rotas

```text
/login
/                       -> Dashboard
/clientes               -> consulta/edição
/clientes/:id
/servicos               -> consulta/edição
/servicos/:id
/propostas              -> lista + filtros + status comercial
/propostas/nova         -> wizard
/propostas/:id          -> wizard em edição
/propostas/:id/cliente-view  -> "Modo Cliente" (sem custos)
/aprovados              -> serviços em execução
/equipe
/configuracoes          -> parâmetros de precificação + condições padrão
```

## Wizard da Proposta (núcleo do MVP)

Layout em abas/etapas com toggle **Modo Interno HSE ↔ Modo Cliente** sempre visível:

1. **Cliente** — formulário com autocomplete por CNPJ/CPF ou razão social. Se existir, sugere reutilizar/atualizar; se não, marca para autocadastro no save.
2. **Itens / Escopo** — tabela editável de itens. Cada linha: nº, descrição comercial, qtd, unidade, valor unitário, valor total, escopo técnico, vínculo a serviço existente ou autocadastro.
3. **Precificação interna** (oculta no Modo Cliente) — drawer/painel por item com todos os campos de custo, horas, impostos, margem, desconto, preço sugerido/arredondado/aprovado, e os indicadores calculados (custo total, lucro, margem líquida, markup, preço mínimo, status colorido OK/Baixa/Atenção/Prejuízo).
4. **Condições comerciais** — pagamento (default 50/50) + outras condições (texto editável com template inicial).
5. **Visualização da proposta** — render fiel ao Word: capa, dados do cliente, tabela de itens, total, pagamento, condições, aceite, histórico de revisões, rodapé HSE. Botão "Exportar PDF" (impressão via `window.print` com CSS dedicado).
6. **Envio / Status / Follow-up** — status (rascunho, enviada, em negociação, aprovada, recusada), data de envio, próximo follow-up, observações comerciais. Ao marcar **aprovada**, cria `approved_services` automaticamente para cada item.

### Regras de autocadastro (no save da proposta)

- Cliente sem `id` → procura por CNPJ/CPF; se achar, pergunta reutilizar/atualizar; senão, insere novo.
- Item sem `service_id` → procura por nome/descrição; se achar, vincula; senão, cria em `services`.
- Tudo dentro de uma transação RPC para consistência.

### Regras de visibilidade

Modo Cliente esconde: precificação, custos, margem, lucro, markup, impostos detalhados, observações internas. Mostra apenas: descrição, escopo comercial, valores, total, pagamento, condições, aceite, rodapé.

## Configurações → Parâmetros de Precificação

Form único editando `pricing_params`:
custo fixo mensal, horas produtivas/mês, custo fixo/hora (auto = fixo / horas), alíquota imposto, margem mínima, custo por vida, markup mínimo, regra de arredondamento (múltiplo de R$ 10/50/100). Esses valores alimentam o cálculo de cada item.

## Design system

`index.css` + `tailwind.config.ts` com tokens HSL:

```text
--hse-green        (verde neon HSE, ação primária)
--hse-green-glow
--hse-navy         (azul-marinho institucional)
--hse-navy-deep
--background       branco
--surface          cinza claro de leitura
--foreground       cinza-escuro/preto
--success / --warning / --danger  (status de margem)
--gradient-hse     linear-gradient(135deg, navy → green)
--shadow-elegant
```

Variantes shadcn: `Button variant="hse"` (verde), `variant="navy"`, `variant="outline-navy"`; `Card variant="elevated"`; `Badge` para status de proposta e status de margem.

## Entregáveis desta atualização

1. Habilitar Lovable Cloud + migration completa (tabelas, RLS, grants, `user_roles`, `has_role`).
2. Design system + logo provisória + layout com sidebar (logo, navegação).
3. Auth (login/registro, primeiro usuário = admin).
4. CRUD de consulta para Clientes, Serviços, Equipe, Configurações.
5. Wizard de Proposta completo com autocadastro, precificação interna, indicadores, Modo Interno/Cliente.
6. Visualização imprimível da proposta no padrão Word enviado.
7. Lista de Propostas com status comercial e follow-up.
8. Serviços Aprovados/Execução gerados na aprovação.
9. Dashboard com KPIs (propostas por status, valor em pipeline, taxa de conversão, margem média).

## O que preciso de você antes de codar

1. **Pode subir novamente** as logos HSE (verde e azul), a proposta Word e a planilha Excel? Nada chegou nesta sessão. Sem isso, vou gerar logo provisória e usar o template de proposta que descrevi acima.
2. Confirma habilitar **Lovable Cloud** agora? É necessário para persistência, auth e a regra de autocadastro transacional.
3. Algum **número/sequência de proposta** específico (ex.: `HSE-2026-0001`)?
4. Os **textos padrão** de "Dados de pagamento" e "Outras condições" que listei estão ok como default, ou prefere colar os textos exatos da proposta atual?
5. Papéis de usuário: `admin`, `comercial`, `tecnico` cobrem ou quer outros?

Assim que você responder (mesmo que só "pode seguir com os pressupostos"), começo a implementação.