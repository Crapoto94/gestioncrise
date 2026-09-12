// Miroir front-end de backend/utils/markdown.js — même conventions légères
// (titres #, **gras**, *italique*, listes -, liens) pour la prévisualisation
// des rubriques du PCGCN. Le texte est échappé avant tout remplacement.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function markdownToHtml(source: string): string {
  if (!source) return '';
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listOpen = false;
  const closeList = () => { if (listOpen) { html.push('</ul>'); listOpen = false; } };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) {
      closeList();
      const level = heading[1].length + 2;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) {
      if (!listOpen) { html.push('<ul>'); listOpen = true; }
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join('\n');
}
