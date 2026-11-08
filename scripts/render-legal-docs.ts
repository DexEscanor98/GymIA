import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const documents = [
  ['contrato-gimnasios.md', 'contrato-gimnasios.html'],
  ['contrato-plus-personal.md', 'contrato-plus-personal.html'],
  ['terminos-condiciones.md', 'terminos-condiciones.html'],
  ['aviso-privacidad.md', 'aviso-privacidad.html'],
] as const;

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function inline(value: string) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function renderMarkdown(markdown: string) {
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length && listType) {
      output.push(
        `<${listType}>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</${listType}>`,
      );
    }
    list = [];
    listType = null;
  };
  const flushQuote = () => {
    if (quote.length)
      output.push(
        `<blockquote>${quote.map((line) => `<p>${inline(line)}</p>`).join('')}</blockquote>`,
      );
    quote = [];
  };
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }
    if (line === '---') {
      flushParagraph();
      flushList();
      flushQuote();
      output.push('<hr>');
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      quote.push(line.slice(2));
      continue;
    }
    const unordered = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      list.push((unordered || ordered)![1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  flushQuote();
  return output.join('\n');
}

const root = process.cwd();
for (const version of ['v1', 'v1.1', 'v1.2']) {
  for (const [source, destination] of documents) {
    const markdown = await readFile(join(root, 'docs/legal', version, source), 'utf8');
    const title =
      markdown
        .split(/\r?\n/)
        .find((line) => line.startsWith('# '))
        ?.slice(2) ?? 'Documento Gymia';
    const outputPath = join(root, 'public/legal', version, destination);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} · Gymia</title><style>:root{color-scheme:light;--ink:#1c2433;--muted:#647084;--line:#e1e5eb;--accent:#3a604e}*{box-sizing:border-box}body{margin:0;background:#f3f5f7;color:var(--ink);font:16px/1.72 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.legal{max-width:900px;margin:42px auto;padding:clamp(26px,6vw,72px);background:#fff;border:1px solid #e8ebef;border-radius:24px;box-shadow:0 20px 70px #1d27360b}h1{font-size:clamp(30px,5vw,44px);line-height:1.13;letter-spacing:-.04em;margin:0 0 20px}h2{font-size:22px;line-height:1.3;letter-spacing:-.02em;margin:38px 0 12px}h3{font-size:18px;margin:28px 0 8px}p,ul,ol{margin:12px 0;color:#384253}li{margin:7px 0}strong{color:#202938}blockquote{margin:22px 0;padding:16px 20px;border-left:4px solid #9daea2;background:#f4f7f4;border-radius:0 12px 12px 0;color:#4b5d52}blockquote p{margin:5px 0}hr{border:0;border-top:1px solid var(--line);margin:36px 0}.back{display:inline-flex;margin-top:32px;color:var(--accent);font-weight:650;text-decoration:none}@media(max-width:600px){body{background:#fff}.legal{margin:0;border:0;border-radius:0;box-shadow:none;padding:28px 22px}}@media print{body{background:#fff}.legal{margin:0 auto;border:0;box-shadow:none;max-width:none}a.back{display:none}}</style></head><body><main class="legal">${renderMarkdown(markdown)}<a class="back" href="/">Volver a Gymia</a></main></body></html>`,
      'utf8',
    );
  }
}
