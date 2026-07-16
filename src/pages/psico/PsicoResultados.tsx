import { useEffect } from "react";
import { EmptyState, ModuloHeader } from "./_ModuloShared";

export function PsicoResultados() {
  useEffect(() => { document.title = "Resultados | Avaliação Psicossocial"; }, []);
  return (
    <div>
      <ModuloHeader />
      <div className="p-6">
        <EmptyState
          title="Sem resultados disponíveis"
          message="Os resultados serão exibidos após o encerramento da coleta e o processamento das respostas."
        />
      </div>
    </div>
  );
}