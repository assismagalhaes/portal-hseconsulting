import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { ImageIcon, Plus, Upload, X } from "lucide-react";
import { formatCnpjCpf } from "@/lib/format";
import { toast } from "sonner";
import CnpjLookupField from "@/components/CnpjLookupField";
import CepLookupField from "@/components/CepLookupField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLIENT_LOGO_BUCKET,
  clientLogoPath,
  type ValidatedClientLogo,
  validateClientLogo,
} from "@/lib/clientBranding";

const empty = { razao_social:"", nome_fantasia:"", cnpj_cpf:"", email:"", telefone:"", whatsapp:"", endereco:"", cidade:"", uf:"", solicitante:"", cargo:"", qtd_funcionarios:0, observacoes:"", logo_storage_path:null, logo_mime_type:null, logo_hash_sha256:null };

export default function Clients() {
  const [list, setList] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupNome, setGroupNome] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPrepared, setLogoPrepared] = useState<ValidatedClientLogo | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => { document.title = "Clientes | Portal HSE Consulting"; load(); }, []);
  async function load() {
    const [c, g] = await Promise.all([
      supabase.from("clients").select("*, client_groups(id,nome)").order("created_at",{ascending:false}),
      supabase.from("client_groups").select("id, nome").order("nome"),
    ]);
    setList(c.data || []);
    setGroups(g.data || []);
  }

  async function criarGrupo(e?: React.FormEvent) {
    e?.preventDefault();
    const nome = groupNome.trim();
    if (!nome) return toast.error("Informe o nome do grupo.");
    setCreatingGroup(true);
    const { data, error } = await supabase.from("client_groups").insert({ nome }).select("id,nome").single();
    setCreatingGroup(false);
    if (error) return toast.error(error.message);
    setGroups(g => [...g, data!].sort((a,b)=>a.nome.localeCompare(b.nome)));
    setForm((f:any)=>({ ...f, group_id: data!.id }));
    setGroupNome("");
    setGroupOpen(false);
    toast.success("Grupo econômico criado e vinculado.");
  }

  function resetLogoState() {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPrepared(null);
    setLogoPreview(null);
    setRemoveLogo(false);
  }

  function openNew() {
    resetLogoState();
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  async function openEdit(c:any) {
    resetLogoState();
    setEditing(c);
    setForm({ ...empty, ...c });
    setOpen(true);
    if (c.logo_storage_path) {
      const signed = await supabase.storage
        .from(CLIENT_LOGO_BUCKET)
        .createSignedUrl(c.logo_storage_path, 10 * 60);
      if (!signed.error) setLogoPreview(signed.data.signedUrl);
    }
  }

  async function selectLogo(file?: File) {
    if (!file) return;
    try {
      const prepared = await validateClientLogo(file);
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPrepared(prepared);
      setLogoPreview(URL.createObjectURL(file));
      setRemoveLogo(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logomarca inválida.");
    }
  }

  function markLogoForRemoval() {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPrepared(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, qtd_funcionarios: Number(form.qtd_funcionarios) || 0 };
    // remover campo virtual injetado pelo select embed
    delete (payload as any).client_groups;
    delete (payload as any).logo_storage_path;
    delete (payload as any).logo_mime_type;
    delete (payload as any).logo_hash_sha256;

    setSaving(true);
    const saved = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("clients").insert(payload).select("id").single();
    if (saved.error || !saved.data?.id) {
      setSaving(false);
      return toast.error(saved.error?.message || "Não foi possível salvar o cliente.");
    }

    const clientId = saved.data.id;
    const previousPath = editing?.logo_storage_path as string | null | undefined;

    if (logoPrepared) {
      const path = clientLogoPath(clientId, logoPrepared.extension);
      const upload = await supabase.storage
        .from(CLIENT_LOGO_BUCKET)
        .upload(path, logoPrepared.bytes, {
          contentType: logoPrepared.mimeType,
          cacheControl: "3600",
          upsert: true,
        });
      if (upload.error) {
        setSaving(false);
        return toast.error(`Cliente salvo, mas a logomarca não foi enviada: ${upload.error.message}`);
      }

      const logoUpdate = await supabase.from("clients").update({
        logo_storage_path: path,
        logo_mime_type: logoPrepared.mimeType,
        logo_hash_sha256: logoPrepared.hashSha256,
      }).eq("id", clientId);
      if (logoUpdate.error) {
        await supabase.storage.from(CLIENT_LOGO_BUCKET).remove([path]);
        setSaving(false);
        return toast.error(`Cliente salvo, mas a logomarca não foi vinculada: ${logoUpdate.error.message}`);
      }

      const stalePaths = [
        previousPath,
        clientLogoPath(clientId, logoPrepared.extension === "png" ? "jpg" : "png"),
      ].filter((candidate): candidate is string => !!candidate && candidate !== path);
      if (stalePaths.length) await supabase.storage.from(CLIENT_LOGO_BUCKET).remove(stalePaths);
    } else if (removeLogo && previousPath) {
      const logoUpdate = await supabase.from("clients").update({
        logo_storage_path: null,
        logo_mime_type: null,
        logo_hash_sha256: null,
      }).eq("id", clientId);
      if (logoUpdate.error) {
        setSaving(false);
        return toast.error(logoUpdate.error.message);
      }
      await supabase.storage.from(CLIENT_LOGO_BUCKET).remove([previousPath]);
    }

    setSaving(false);
    toast.success(editing ? "Cliente atualizado" : "Cliente criado");
    setOpen(false);
    resetLogoState();
    load();
  }

  const filtered = list.filter(c => {
    const s = q.toLowerCase();
    return !s || [c.razao_social, c.nome_fantasia, c.cnpj_cpf, c.cidade].some(v => (v||"").toLowerCase().includes(s));
  });

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Carteira de empresas atendidas pela HSE Consulting"
        actions={
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) resetLogoState();
            }}
          >
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo cliente</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
                <Field label="Razão social" className="sm:col-span-2" required value={form.razao_social} onChange={v=>setForm({...form,razao_social:v})} />
                <Field label="Nome fantasia" value={form.nome_fantasia} onChange={v=>setForm({...form,nome_fantasia:v})} />
                <CnpjLookupField
                  value={form.cnpj_cpf}
                  onChange={(v)=>setForm({...form, cnpj_cpf:v})}
                  formSnapshot={form}
                  onAutofill={(patch)=>setForm({...form, ...patch})}
                  onExistingClient={(c)=>{ setEditing(c); setForm({ ...empty, ...c }); toast.message("Cadastro existente carregado."); }}
                  ignoreClientId={editing?.id || null}
                  ultimaConsulta={form.ultima_consulta_cnpj}
                  label="CNPJ / CPF"
                />
                <Field label="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} />
                <Field label="Telefone" value={form.telefone} onChange={v=>setForm({...form,telefone:v})} />
                <Field label="WhatsApp" value={form.whatsapp} onChange={v=>setForm({...form,whatsapp:v})} />
                <Field label="Endereço" className="sm:col-span-2" value={form.endereco} onChange={v=>setForm({...form,endereco:v})} />
                <Field label="Bairro" value={form.bairro||""} onChange={v=>setForm({...form,bairro:v})} />
                <CepLookupField
                  value={form.cep || ""}
                  onChange={(v)=>setForm({...form, cep:v})}
                  formSnapshot={form}
                  onAutofill={(patch)=>setForm({...form, ...patch})}
                />
                <Field label="Cidade" value={form.cidade} onChange={v=>setForm({...form,cidade:v})} />
                <Field label="UF" value={form.uf} onChange={v=>setForm({...form,uf:v.toUpperCase().slice(0,2)})} />
                <Field label="Solicitante" value={form.solicitante} onChange={v=>setForm({...form,solicitante:v})} />
                <Field label="Cargo" value={form.cargo} onChange={v=>setForm({...form,cargo:v})} />
                <Field label="Qtd. funcionários" type="number" value={String(form.qtd_funcionarios)} onChange={v=>setForm({...form,qtd_funcionarios:v})} />
                <div className="sm:col-span-2 space-y-2">
                  <Label>Logomarca para documentos técnicos</Label>
                  <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                    <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded border bg-muted/40">
                      {logoPreview
                        ? <img src={logoPreview} alt="Logomarca do cliente" className="h-full w-full object-contain p-1" />
                        : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        PNG ou JPEG, até 2 MB. A imagem será mantida em armazenamento privado e usada no cabeçalho dos relatórios.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
                          <Upload className="mr-2 h-4 w-4" />
                          Escolher imagem
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="sr-only"
                            onChange={(event) => selectLogo(event.target.files?.[0])}
                          />
                        </label>
                        {logoPreview && (
                          <Button type="button" size="sm" variant="ghost" onClick={markLogoForRemoval}>
                            <X className="mr-2 h-4 w-4" />
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Grupo econômico (holding)</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={()=>{ setGroupNome(""); setGroupOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Criar novo
                    </Button>
                  </div>
                  <Select value={form.group_id || "__none__"} onValueChange={(v)=>setForm({ ...form, group_id: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sem grupo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem grupo</SelectItem>
                      {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Vincule empresas do mesmo grupo econômico. Usa nos orçamentos multi-CNPJ e no acesso do portal por grupo.
                  </p>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={form.observacoes||""} onChange={e=>setForm({...form,observacoes:e.target.value})} />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={()=>setOpen(false)} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo grupo econômico</DialogTitle>
          </DialogHeader>
          <form onSubmit={criarGrupo} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome do grupo (holding) <span className="text-danger">*</span></Label>
              <Input
                autoFocus
                value={groupNome}
                onChange={e=>setGroupNome(e.target.value)}
                placeholder="Ex.: Grupo Alfa Participações"
              />
              <p className="text-[11px] text-muted-foreground">
                Este nome aparecerá no seletor de grupo econômico e agrupará as empresas coligadas no portal do cliente.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={()=>setGroupOpen(false)} disabled={creatingGroup}>Cancelar</Button>
              <Button type="submit" disabled={creatingGroup || !groupNome.trim()}>
                {creatingGroup ? "Criando…" : "Criar grupo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <div className="p-6 space-y-4">
        <Input placeholder="Buscar por razão social, CNPJ, cidade…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-md" />
        <Card className="overflow-hidden shadow-elegant">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Razão Social</th><th className="text-left px-4 py-2">CNPJ/CPF</th><th className="text-left px-4 py-2">Cidade</th><th className="text-left px-4 py-2">Grupo</th><th className="text-left px-4 py-2">Func.</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="font-medium">{c.razao_social}</div><div className="text-xs text-muted-foreground">{c.nome_fantasia}</div></td>
                  <td className="px-4 py-3 font-mono text-xs">{c.cnpj_cpf || "—"}</td>
                  <td className="px-4 py-3">{[c.cidade, c.uf].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.client_groups?.nome || "—"}</td>
                  <td className="px-4 py-3">{c.qtd_funcionarios || 0}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={()=>openEdit(c)}>Editar</Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum cliente.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", required, className }: any) {
  return (
    <div className={`space-y-1.5 ${className||""}`}>
      <Label>{label}{required && <span className="text-danger"> *</span>}</Label>
      <Input type={type} value={value} required={required} onChange={(e:any)=>onChange(e.target.value)} />
    </div>
  );
}
