import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Heading, List, Link as LinkIcon, Maximize2, X, Pencil, Check, type LucideIcon } from 'lucide-react';
import { markdownToHtml } from '../utils/markdown';
import { htmlToMarkdown } from '../utils/htmlToMarkdown';

/**
 * Champ de texte "markdown léger" (cf. utils/markdown.ts) :
 * - en lecture, affiche UNIQUEMENT le rendu mis en forme ;
 * - en édition (bouton crayon, ou « Agrandir » pour un éditeur plein écran),
 *   affiche un éditeur WYSIWYG (contentEditable + barre d'outils) — l'auteur
 *   voit directement le texte mis en forme pendant qu'il l'écrit, jamais la
 *   syntaxe # / ** brute. Le contenu est sérialisé en markdown léger à la
 *   validation (htmlToMarkdown), c'est toujours ce format qui est stocké.
 */
export function MarkdownField({
  label, value, onChange, disabled, rows = 6,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [expanded, setExpanded] = useState(false);

  const viewer = (
    <div
      className="rendered-content text-sm border rounded p-3 bg-gray-50 overflow-y-auto"
      style={{ minHeight: rows * 20 }}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || '<p class="text-gray-400">Aucun contenu.</p>' }}
    />
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {label ? <label className="text-xs text-gray-500">{label}</label> : <span />}
        {!disabled && mode === 'view' && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMode('edit')} className="flex items-center gap-1 text-xs text-ville hover:underline">
              <Pencil size={12} /> Éditer
            </button>
            <button type="button" onClick={() => { setMode('edit'); setExpanded(true); }} className="flex items-center gap-1 text-xs text-ville hover:underline">
              <Maximize2 size={12} /> Agrandir
            </button>
          </div>
        )}
      </div>

      {mode === 'view' && viewer}

      {mode === 'edit' && !expanded && (
        <WysiwygEditor
          value={value}
          rows={rows}
          onDone={(v) => { onChange(v); setMode('view'); }}
          onCancel={() => setMode('view')}
          onExpand={() => setExpanded(true)}
        />
      )}

      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{label || 'Édition'}</h3>
              <button onClick={() => { setExpanded(false); setMode('view'); }} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <WysiwygEditor
                value={value}
                fill
                onDone={(v) => { onChange(v); setExpanded(false); setMode('view'); }}
                onCancel={() => { setExpanded(false); setMode('view'); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WysiwygEditor({ value, rows = 6, fill, onDone, onCancel, onExpand }: {
  value: string;
  rows?: number;
  fill?: boolean;
  onDone: (v: string) => void;
  onCancel: () => void;
  onExpand?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Contenu initialisé une seule fois (à l'entrée en édition) — ensuite le
  // DOM contentEditable est laissé "non contrôlé" par React pour ne pas
  // perturber la position du curseur pendant la frappe.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = markdownToHtml(value) || '<p></p>';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
  }

  function insertLink() {
    const url = window.prompt('URL du lien :', 'https://');
    if (url) exec('createLink', url);
  }

  function save() {
    onDone(htmlToMarkdown(ref.current?.innerHTML || ''));
  }

  const toolBtn = (onClick: () => void, Icon: LucideIcon, title: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
    >
      <Icon size={14} />
    </button>
  );

  return (
    <div className={`border rounded overflow-hidden ${fill ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
      <div className="flex items-center gap-0.5 bg-gray-100 border-b px-1.5 py-1">
        {toolBtn(() => exec('bold'), Bold, 'Gras')}
        {toolBtn(() => exec('italic'), Italic, 'Italique')}
        {toolBtn(() => exec('formatBlock', 'H3'), Heading, 'Titre')}
        {toolBtn(() => exec('insertUnorderedList'), List, 'Liste à puces')}
        {toolBtn(insertLink, LinkIcon, 'Lien')}
        <div className="flex-1" />
        {onExpand && toolBtn(onExpand, Maximize2, 'Agrandir')}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`rendered-content text-sm px-3 py-2 outline-none overflow-y-auto ${fill ? 'flex-1' : ''}`}
        style={!fill ? { minHeight: rows * 20 } : undefined}
      />
      <div className="flex justify-end gap-2 border-t bg-gray-50 px-2 py-1.5">
        <button type="button" onClick={onCancel} className="text-xs px-2 py-1 rounded border hover:bg-gray-100">Annuler</button>
        <button type="button" onClick={save} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-ville text-white hover:bg-ville-dark">
          <Check size={12} /> Valider
        </button>
      </div>
    </div>
  );
}
