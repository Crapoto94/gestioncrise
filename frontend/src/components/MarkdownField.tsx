import React, { useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { markdownToHtml } from '../utils/markdown';

/**
 * Champ de texte "markdown léger" avec aperçu mis en forme toujours visible
 * en regard de la saisie (mini-WYSIWYG sans dépendance lourde ni risque
 * d'injection HTML — cf. utils/markdown.ts) et un bouton pour agrandir la
 * zone de saisie en plein écran quand le texte est long.
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
  const [expanded, setExpanded] = useState(false);

  const editor = (big: boolean) => (
    <div className={big ? 'grid grid-cols-2 gap-4 h-full' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
      <textarea
        className={`w-full border rounded px-3 py-2 text-sm font-mono ${big ? 'h-full resize-none' : ''}`}
        rows={big ? undefined : rows}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Titres avec #, gras **texte**, listes avec -"
      />
      <div
        className={`rendered-content text-sm border rounded p-3 bg-gray-50 overflow-y-auto ${big ? 'h-full' : ''}`}
        style={!big ? { maxHeight: rows * 24 + 16 } : undefined}
        dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || '<p class="text-gray-400">Aperçu…</p>' }}
      />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {label ? <label className="text-xs text-gray-500">{label}</label> : <span />}
        {!disabled && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-xs text-ville hover:underline"
          >
            <Maximize2 size={12} /> Agrandir
          </button>
        )}
      </div>

      {editor(false)}

      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{label || 'Édition'}</h3>
              <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0">{editor(true)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
