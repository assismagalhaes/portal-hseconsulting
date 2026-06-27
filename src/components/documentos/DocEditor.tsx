import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3,
  Table as TableIcon, Image as ImageIcon, Minus, Variable, Undo, Redo,
} from "lucide-react";
import { useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  variaveis?: { chave: string; label: string }[];
  readOnly?: boolean;
};

export default function DocEditor({ value, onChange, variaveis = [], readOnly = false }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      Image,
      Placeholder.configure({ placeholder: "Comece a redigir o documento técnico..." }),
    ],
    content: value || "",
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-slate dark:prose-invert max-w-none min-h-[600px] p-6 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `h-8 px-2 ${active ? "bg-accent text-accent-foreground" : ""}`;

  return (
    <div className="rounded-md border bg-card">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b p-2">
          <Button type="button" size="sm" variant="ghost" className={btn(editor.isActive("bold"))}
            onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" className={btn(editor.isActive("italic"))}
            onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button type="button" size="sm" variant="ghost" className={btn(editor.isActive("heading", { level: 1 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" className={btn(editor.isActive("heading", { level: 2 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" className={btn(editor.isActive("heading", { level: 3 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button type="button" size="sm" variant="ghost" className={btn(editor.isActive("bulletList"))}
            onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" className={btn(editor.isActive("orderedList"))}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2"
            onClick={() => {
              const url = window.prompt("URL da imagem");
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}><ImageIcon className="h-4 w-4" /></Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2 gap-1">
                <Variable className="h-4 w-4" /> Campo
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 max-h-72 overflow-auto" align="start">
              {variaveis.length === 0 && <div className="p-2 text-sm text-muted-foreground">Nenhum campo disponível.</div>}
              {variaveis.map((v) => (
                <button key={v.chave} type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => editor.chain().focus().insertContent(`{{${v.chave}}}`).run()}>
                  <div className="font-medium">{v.label}</div>
                  <div className="text-xs text-muted-foreground">{`{{${v.chave}}}`}</div>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2"
              onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2"
              onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}