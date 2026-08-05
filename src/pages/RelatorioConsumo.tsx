import React from 'react';

const RelatorioConsumo = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 font-sans text-slate-900">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Relatório de Auditoria de Consumo e Créditos</h1>
        <p className="text-slate-500 mt-2">HSE Consulting Portal • Gerado em 05/08/2026 às 11:45 BRT</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-l-4 border-primary pl-3">1. Consumo da IA Gateway</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Acumulado (Período)</h3>
            <p className="text-2xl font-bold">1,029 créditos</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Média por Chamada</h3>
            <p className="text-2xl font-bold">~0,084 créditos</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border">
            <thead className="bg-slate-100 text-slate-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-2 border">Data</th>
                <th className="px-4 py-2 border">Chamadas</th>
                <th className="px-4 py-2 border">Tokens (In/Out)</th>
                <th className="px-4 py-2 border">Custo (Créditos)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2 border">Hoje (05/08)</td>
                <td className="px-4 py-2 border">0</td>
                <td className="px-4 py-2 border">-</td>
                <td className="px-4 py-2 border">0,000</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-4 py-2 border">Ontem (04/08)</td>
                <td className="px-4 py-2 border">0</td>
                <td className="px-4 py-2 border">-</td>
                <td className="px-4 py-2 border">0,000</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border">30/07</td>
                <td className="px-4 py-2 border">4</td>
                <td className="px-4 py-2 border">45.432 / 18.100</td>
                <td className="px-4 py-2 border">0,815</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border">29/07</td>
                <td className="px-4 py-2 border">4</td>
                <td className="px-4 py-2 border">57.444 / 9.190</td>
                <td className="px-4 py-2 border">0,340</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p><strong>Modelos Utilizados:</strong> <code>google/gemini-3.6-flash</code> (predominante) e <code>google/gemini-3-flash-preview</code>.</p>
          <p><strong>Funcionalidades Responsáveis:</strong> Emissão de Relatórios Psicossociais, Geração de Parecer Individual e Sugestão de Planos de Ação (AQI 2.1).</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-l-4 border-blue-500 pl-3">2. Consumo de Infraestrutura</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 border rounded-lg">
            <span className="block text-xs text-slate-500 uppercase">Banco de Dados</span>
            <span className="text-lg font-bold">36.2 MB / Tiny</span>
          </div>
          <div className="p-4 border rounded-lg">
            <span className="block text-xs text-slate-500 uppercase">Storage</span>
            <span className="text-lg font-bold">41 arquivos</span>
          </div>
          <div className="p-4 border rounded-lg">
            <span className="block text-xs text-slate-500 uppercase">Auth</span>
            <span className="text-lg font-bold">4 usuários ativos</span>
          </div>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          <li><strong>Banco de Dados:</strong> Ocupação de 16% do disco alocado. O motor de auditoria processa cerca de 19k transações revertidas (normais em fluxos de validação/rollback).</li>
          <li><strong>Edge Functions:</strong> 13 funções implantadas. Picos de consumo vinculados à geração de PDFs e processamento de importações (Fase 9A).</li>
          <li><strong>Realtime:</strong> Utilizado principalmente no Dashboard para atualização da adesão (Coleta Pública).</li>
        </ul>
      </section>

      <section className="bg-slate-900 text-white p-6 rounded-xl space-y-4">
        <h2 className="text-lg font-bold border-b border-slate-700 pb-2">Conclusão Objetiva</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm">
          <div><span className="text-slate-400">Consumo total (Período):</span> 153.87 créditos</div>
          <div><span className="text-slate-400">Consumo da IA Gateway:</span> ~0.66% do total</div>
          <div><span className="text-slate-400">Consumo da Infraestrutura:</span> ~99.34% do total</div>
          <div><span className="text-slate-400">Principal fonte:</span> Manutenção de instâncias e storage de PDFs</div>
          <div className="sm:col-span-2">
            <span className="text-slate-400 block mb-1">Recomendações:</span>
            <p>O consumo está dentro do esperado para a fase de implementação. A migração para o Gemini 3.6 Flash reduziu o custo por token. Recomenda-se limpeza periódica de snapshots de PDF antigos no storage para otimizar custos de persistência.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RelatorioConsumo;
