import { Badge } from "@/components/ui/badge";

export function ResumoGrupos({ titulo, itens }: { titulo: string; itens: { nome: string; qtd: number }[] }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs uppercase text-muted-foreground mb-2">{titulo}</div>
      <ul className="space-y-1 text-sm">
        {itens.slice(0, 8).map((g) => (
          <li key={g.nome} className="flex justify-between">
            <span>{g.nome}</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{g.qtd}</span>
              {g.qtd < 3 && <Badge variant="outline" className="text-[10px]">Abaixo do mínimo para segmentação</Badge>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}