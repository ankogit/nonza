const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

const TRAIL = /[.,;:!?)]+$/;

function trimUrl(raw: string): string {
  let u = raw;
  const m = u.match(TRAIL);
  if (m) {
    const tail = m[0];
    const base = u.slice(0, -tail.length);
    if (base.length >= 12 && /[a-z0-9]/i.test(base.slice(-1))) u = base;
  }
  return u;
}

export type TextLinkSegment =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

export function splitTextByUrls(text: string): TextLinkSegment[] {
  if (!text) return [];
  const out: TextLinkSegment[] = [];
  let last = 0;
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    const start = match.index;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    const raw = match[0];
    const href = trimUrl(raw);
    if (href.startsWith("http://") || href.startsWith("https://")) {
      out.push({ type: "link", href, label: href });
    } else {
      out.push({ type: "text", value: raw });
    }
    last = start + raw.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}
