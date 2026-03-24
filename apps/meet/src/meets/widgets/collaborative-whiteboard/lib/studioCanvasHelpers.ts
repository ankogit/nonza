export function rgbToHsl(hexNoHash: string): [number, number, number] {
  const a = parseInt(hexNoHash, 16);
  const t = ((a >> 16) & 255) / 255;
  const s = ((a >> 8) & 255) / 255;
  const r = (a & 255) / 255;
  const o = Math.max(t, s, r);
  const n = Math.min(t, s, r);
  const i = (o + n) / 2;
  let c = 0;
  let sat = 0;
  if (o === n) {
    c = 0;
    sat = 0;
  } else {
    const u = o - n;
    sat = i > 0.5 ? u / (2 - o - n) : u / (o + n);
    switch (o) {
      case t:
        c = (s - r) / u + (s < r ? 6 : 0);
        break;
      case s:
        c = (r - t) / u + 2;
        break;
      default:
        c = (t - s) / u + 4;
    }
    c /= 6;
  }
  return [
    Math.floor(360 * c),
    Math.floor(100 * sat),
    Math.floor(100 * i),
  ];
}

export function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseHexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function floodFillAt(
  ctx: CanvasRenderingContext2D,
  docX: number,
  docY: number,
  fillHex: string,
  fillAlpha: number,
  dpr: number,
  tolerance = 48,
): void {
  const cw = Math.floor(ctx.canvas.width / dpr);
  const ch = Math.floor(ctx.canvas.height / dpr);
  const sx = Math.max(0, Math.min(cw - 1, Math.floor(docX)));
  const sy = Math.max(0, Math.min(ch - 1, Math.floor(docY)));
  const px = Math.floor(sx * dpr);
  const py = Math.floor(sy * dpr);
  const imgW = ctx.canvas.width;
  const imgH = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, imgW, imgH);
  const d = imageData.data;
  const start = (py * imgW + px) * 4;
  const tr = d[start];
  const tg = d[start + 1];
  const tb = d[start + 2];
  const ta = d[start + 3];
  const [fr, fg, fb] = parseHexRgb(fillHex);
  const fa = Math.round(Math.min(1, Math.max(0, fillAlpha)) * 255);
  if (
    Math.abs(fr - tr) <= tolerance &&
    Math.abs(fg - tg) <= tolerance &&
    Math.abs(fb - tb) <= tolerance &&
    Math.abs(fa - ta) <= tolerance
  ) {
    return;
  }
  const match = (i: number) =>
    Math.abs(d[i] - tr) <= tolerance &&
    Math.abs(d[i + 1] - tg) <= tolerance &&
    Math.abs(d[i + 2] - tb) <= tolerance &&
    Math.abs(d[i + 3] - ta) <= tolerance;
  const stack: number[] = [start];
  const seen = new Uint8Array(imgW * imgH);
  seen[py * imgW + px] = 1;
  while (stack.length > 0) {
    const cur = stack.pop()!;
    d[cur] = fr;
    d[cur + 1] = fg;
    d[cur + 2] = fb;
    d[cur + 3] = fa;
    const pi = cur / 4;
    const x = pi % imgW;
    const y = (pi / imgW) | 0;
    const nbs: number[] = [];
    if (x > 0) nbs.push(cur - 4);
    if (x < imgW - 1) nbs.push(cur + 4);
    if (y > 0) nbs.push(cur - imgW * 4);
    if (y < imgH - 1) nbs.push(cur + imgW * 4);
    for (const ni of nbs) {
      const npi = ni / 4;
      const nx = npi % imgW;
      const ny = (npi / imgW) | 0;
      const si = ny * imgW + nx;
      if (seen[si]) continue;
      if (!match(ni)) continue;
      seen[si] = 1;
      stack.push(ni);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
