"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, type Editor, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import DOMPurify from "dompurify";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { MAX_KEPT_FILE, cn, fmtSize, isHtml, readFileAsDataUrl, safeHttpUrl, textToHtml } from "@/lib/utils";

const FONTS = [
  { label: "Sans Serif", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Fixed width", value: "ui-monospace, Menlo, Consolas, monospace" },
  { label: "Wide", value: "'Arial Black', Arial, sans-serif" },
  { label: "Narrow", value: "'Arial Narrow', Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];
const SIZES = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "" },
  { label: "Large", value: "18px" },
  { label: "Huge", value: "26px" },
];
const SWATCHES = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff",
  "#4a86e8", "#0000ff", "#9900ff", "#ff00ff", "#1e3a8a", "#065f46",
];

/** Toolbar button; mousedown is cancelled so the editor keeps its selection */
function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-40",
        active && "bg-brand-50 text-brand-700",
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden />;

const toolSelect =
  "h-8 shrink-0 rounded-md border-0 bg-transparent px-1.5 text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500";

/** Text and background colour picker */
function ColorMenu({ editor, color, highlight }: { editor: Editor; color?: string; highlight?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const grid = (title: string, current: string | undefined, apply: (c: string) => void, clear: () => void) => (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
        {title}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={clear} className="font-medium text-brand-700 normal-case hover:underline">
          Reset
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${title} ${c}`}
            aria-pressed={current?.toLowerCase() === c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(c)}
            className={cn("size-5 rounded-sm ring-1 ring-slate-300 hover:scale-110", current?.toLowerCase() === c && "ring-2 ring-brand-600")}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <Tool label="Text colour" active={open} onClick={() => setOpen((o) => !o)}>
        <span className="relative">
          <Baseline size={16} aria-hidden />
          <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded" style={{ background: color || "currentColor" }} />
        </span>
      </Tool>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-56 space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          {grid(
            "Text colour",
            color,
            (c) => editor.chain().focus().setColor(c).run(),
            () => editor.chain().focus().unsetColor().run(),
          )}
          {grid(
            "Background colour",
            highlight,
            (c) => editor.chain().focus().setHighlight({ color: c }).run(),
            () => editor.chain().focus().unsetHighlight().run(),
          )}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onAttach }: { editor: Editor; onAttach?: (files: FileList) => void }) {
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      align: (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
      font: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      size: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      color: e.getAttributes("textStyle").color as string | undefined,
      highlight: e.getAttributes("highlight").color as string | undefined,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      canIndent: e.can().sinkListItem("listItem"),
      canOutdent: e.can().liftListItem("listItem"),
    }),
  });
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt("Link address (leave empty to remove)", prev ?? "https://");
    if (input === null) return;
    const href = input.trim().startsWith("mailto:") ? input.trim() : safeHttpUrl(input);
    if (!href) return void chain().extendMarkRange("link").unsetLink().run();
    if (editor.state.selection.empty && !s.link) chain().insertContent({ type: "text", text: input.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    else chain().extendMarkRange("link").setLink({ href }).run();
  };

  const addImage = async (files: FileList | null) => {
    const f = files?.[0];
    if (imageRef.current) imageRef.current.value = "";
    if (!f) return;
    if (f.size > MAX_KEPT_FILE) return window.alert(`Images up to ${fmtSize(MAX_KEPT_FILE)} can be placed in the message. Attach larger ones instead.`);
    chain().setImage({ src: await readFileAsDataUrl(f), alt: f.name }).run();
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/70 px-1.5 py-1">
      <Tool label="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 size={16} aria-hidden />
      </Tool>
      <Tool label="Redo (Ctrl+Y)" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 size={16} aria-hidden />
      </Tool>
      <Divider />
      <select
        aria-label="Font"
        value={FONTS.some((f) => f.value === s.font) ? s.font : ""}
        onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
        className={cn(toolSelect, "w-24")}
      >
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Font size"
        value={SIZES.some((f) => f.value === s.size) ? s.size : ""}
        onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
        className={toolSelect}
      >
        {SIZES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <Divider />
      <Tool label="Bold (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold size={16} aria-hidden />
      </Tool>
      <Tool label="Italic (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic size={16} aria-hidden />
      </Tool>
      <Tool label="Underline (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline size={16} aria-hidden />
      </Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough size={16} aria-hidden />
      </Tool>
      <ColorMenu editor={editor} color={s.color} highlight={s.highlight} />
      <Divider />
      <Tool label="Align left" active={s.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft size={16} aria-hidden />
      </Tool>
      <Tool label="Align centre" active={s.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter size={16} aria-hidden />
      </Tool>
      <Tool label="Align right" active={s.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight size={16} aria-hidden />
      </Tool>
      <Tool label="Justify" active={s.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
        <AlignJustify size={16} aria-hidden />
      </Tool>
      <Divider />
      <Tool label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered size={16} aria-hidden />
      </Tool>
      <Tool label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List size={16} aria-hidden />
      </Tool>
      <Tool label="Indent less" disabled={!s.canOutdent} onClick={() => chain().liftListItem("listItem").run()}>
        <IndentDecrease size={16} aria-hidden />
      </Tool>
      <Tool label="Indent more" disabled={!s.canIndent} onClick={() => chain().sinkListItem("listItem").run()}>
        <IndentIncrease size={16} aria-hidden />
      </Tool>
      <Tool label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote size={16} aria-hidden />
      </Tool>
      <Divider />
      <Tool label="Insert link" active={s.link} onClick={setLink}>
        <Link2 size={16} aria-hidden />
      </Tool>
      <Tool label="Insert image" onClick={() => imageRef.current?.click()}>
        <ImagePlus size={16} aria-hidden />
      </Tool>
      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e) => addImage(e.target.files)} />
      {onAttach && (
        <>
          <Tool label="Attach files" onClick={() => fileRef.current?.click()}>
            <Paperclip size={16} aria-hidden />
          </Tool>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAttach(e.target.files);
              e.target.value = "";
            }}
          />
        </>
      )}
      <Tool label="Remove formatting" onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()}>
        <RemoveFormatting size={16} aria-hidden />
      </Tool>
    </div>
  );
}

/**
 * Gmail-style message editor. `value` / `onChange` carry HTML ("" when empty);
 * a plain-text value (an older draft) is converted to paragraphs on load.
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder,
  onAttach,
  children,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
  placeholder?: string;
  /** Shows the paperclip button; receives the picked files */
  onAttach?: (files: FileList) => void;
  /** Shown under the writing area, e.g. the attachment list */
  children?: React.ReactNode;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value && !isHtml(value) ? textToHtml(value) : value,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-text min-h-64 max-h-[32rem] overflow-y-auto px-3 py-2.5 text-sm text-slate-800 focus:outline-none",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
      {editor ? <Toolbar editor={editor} onAttach={onAttach} /> : <div className="h-10 border-b border-slate-200 bg-slate-50/70" aria-hidden />}
      <EditorContent editor={editor} />
      {children}
    </div>
  );
}

// Links in mail bodies open in a new tab
if (typeof window !== "undefined" && DOMPurify.isSupported) {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

const noop = () => () => {};

/** Shows a mail body: sanitised HTML from the editor, or plain text as written */
export function MailBody({ body, className }: { body: string; className?: string }) {
  // The sanitiser needs the browser DOM, so the server render shows nothing for HTML bodies
  const client = useSyncExternalStore(noop, () => true, () => false);
  if (!isHtml(body)) return <pre className={cn("font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-700", className)}>{body}</pre>;
  if (!client) return null;
  return <div className={cn("rich-text text-sm text-slate-700", className)} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body, { ADD_ATTR: ["target"] }) }} />;
}
