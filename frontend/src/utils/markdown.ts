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

// Une ligne de tableau ("| a | b |") et la ligne de séparation qui suit
// ("|---|---|", tirets/deux-points seulement) — format GFM minimal.
const TABLE_ROW = /^\|(.+)\|$/;
const TABLE_SEPARATOR = /^\|(\s*:?-+:?\s*\|)+$/;

function splitTableRow(line: string): string[] {
  return line.slice(1, -1).split('|').map((cell) => cell.trim());
}

export function markdownToHtml(source: string): string {
  if (!source) return '';
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listOpen = false;
  const closeList = () => { if (listOpen) { html.push('</ul>'); listOpen = false; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
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
    // Tableau : ligne d'en-tête suivie d'une ligne de séparation, puis
    // autant de lignes de données que possible.
    if (TABLE_ROW.test(line) && lines[i + 1] && TABLE_SEPARATOR.test(lines[i + 1].trim())) {
      closeList();
      const headCells = splitTableRow(line);
      html.push('<table><thead><tr>' + headCells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
      i += 1; // saute la ligne de séparation
      while (lines[i + 1] && TABLE_ROW.test(lines[i + 1].trimEnd())) {
        i += 1;
        const cells = splitTableRow(lines[i].trimEnd());
        html.push('<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      }
      html.push('</tbody></table>');
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join('\n');
}
