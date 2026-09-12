// Convertisseur markdown -> HTML volontairement minimal : les rubriques du
// PCGCN sont rédigées en texte simple avec quelques conventions (titres,
// gras, italique, listes, liens), pas du markdown complet — on évite ainsi
// une dépendance lourde et tout risque d'injection (le texte source est
// échappé avant d'appliquer les remplacements).
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/** Convertit un texte "markdown léger" en HTML (titres #/##/###, listes -, paragraphes). */
function toHtml(source) {
  if (!source) return '';
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let listOpen = false;

  const closeList = () => { if (listOpen) { html.push('</ul>'); listOpen = false; } };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) {
      closeList();
      const level = heading[1].length + 2; // # -> h3, ## -> h4, ### -> h5 (h1/h2 réservés au gabarit d'export)
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

module.exports = { toHtml, escapeHtml };
