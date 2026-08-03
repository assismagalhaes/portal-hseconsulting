# Fixtures — Relatório Individual (PR7)

Snapshots JSON sanitizados, compatíveis com o retorno de
`psico_ind_snapshot_relatorio`, para validar o PDF individual sem depender
de dados reais.

| Fixture | Situação |
|---|---|
| `todos_controlados.json` | Todos os fatores `controlado`. |
| `um_fator_prioritario.json` | Um único fator `prioritario` coberto pelo plano. |
| `multiplos_fatores.json` | Vários fatores em estados distintos. |
| `divergencia_relevante.json` | Divergência forte entre empregado e empregador. |
| `evidencia_insuficiente.json` | Achado sem convergência suficiente. |
| `plano_extenso.json` | 15+ itens de plano — testa quebra de página. |
| `textos_longos.json` | Parecer com blocos longos. |

## Validações obrigatórias
- PDF abre em Chrome/Adobe/Preview.
- Todas as páginas renderizam.
- Nenhum campo reservado aparece (`respostas_brutas`, `pii`, `email`, `cpf`, `telefone`).
- Nenhuma resposta bruta (texto livre) no PDF.
- QR Code resolve para `/validar/relatorio-psicossocial?codigo=<codigo_validacao>`.
- `codigo_validacao` bate com `psico_ind_relatorios`.
- Hash SHA-256 da assinatura confere com `psico_individual_revisoes`.

Empresa fictícia: `EMPRESA MODELO LTDA`, códigos `AFP-PILOTO-*`.
