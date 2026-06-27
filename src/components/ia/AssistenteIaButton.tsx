import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import IaContextDrawer from "./IaContextDrawer";
import type { ModuloIa, EntidadeTipo } from "@/lib/iaActions";

export default function AssistenteIaButton(props: {
  modulo: ModuloIa;
  entidade_tipo?: EntidadeTipo;
  entidade_id?: string;
  client_id?: string | null;
  titulo?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={props.variant ?? "outline"} size={props.size ?? "sm"} onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4 mr-2" />
        {props.label ?? "Assistente IA"}
      </Button>
      <IaContextDrawer
        open={open} onOpenChange={setOpen}
        modulo={props.modulo}
        entidade_tipo={props.entidade_tipo}
        entidade_id={props.entidade_id}
        client_id={props.client_id}
        titulo={props.titulo}
      />
    </>
  );
}