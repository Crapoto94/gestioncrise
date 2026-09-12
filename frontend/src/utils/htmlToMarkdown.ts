// Conversion inverse de markdownToHtml (utils/markdown.ts) — sérialise le
// HTML produit par l'éditeur WYSIWYG (contentEditable) vers le même
// "markdown léger" stocké côté serveur. Ne couvre que le sous-ensemble
// supporté (titres, gras, italique, liste, lien) — cohérent avec ce que le
// rendu sait afficher.
function inline(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) { out += child.textContent || ''; return; }
    const el = child as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'strong' || tag === 'b') out += `**${inline(el).trim()}**`;
    else if (tag === 'em' || tag === 'i') out += `*${inline(el).trim()}*`;
    else if (tag === 'a') out += `[${inline(el).trim()}](${el.getAttribute('href') || ''})`;
    else if (tag === 'br') out += '\n';
    else out += inline(el);
  });
  return out;
}

export function htmlToMarkdown(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  const lines: string[] = [];

  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      if (t) lines.push(t);
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'h1' || tag === 'h3') lines.push(`# ${inline(el).trim()}`);
    else if (tag === 'h2' || tag === 'h4') lines.push(`## ${inline(el).trim()}`);
    else if (tag === 'h5' || tag === 'h6') lines.push(`### ${inline(el).trim()}`);
    else if (tag === 'ul' || tag === 'ol') {
      Array.from(el.children).forEach((li) => {
        const text = inline(li as HTMLElement).trim();
        if (text) lines.push(`- ${text}`);
      });
    } else if (tag === 'blockquote') {
      const text = inline(el).trim();
      if (text) lines.push(text);
    } else if (tag === 'p' || tag === 'div') {
      const text = inline(el).trim();
      if (text) lines.push(text);
    } else if (tag === 'br') {
      // saut de ligne isolé : ignoré, un paragraphe vide suffit à séparer
    } else {
      const text = inline(el).trim();
      if (text) lines.push(text);
    }
  });

  return lines.join('\n\n');
}
