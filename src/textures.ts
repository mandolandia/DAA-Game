import * as THREE from "three";
import { ps2Texture } from "./ps2";

/** Genera una textura low-res de cartel institucional D.A.A. */
export function signTexture(
  title: string,
  subtitle: string = "",
  opts: { bg?: string; fg?: string; accent?: string } = {}
): THREE.Texture {
  const w = 128;
  const h = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const bg = opts.bg ?? "#f1e6c2";
  const fg = opts.fg ?? "#2a2319";
  const accent = opts.accent ?? "#5a1d26";

  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // Marco
  g.strokeStyle = accent;
  g.lineWidth = 2;
  g.strokeRect(3, 3, w - 6, h - 6);

  // Barra superior
  g.fillStyle = accent;
  g.fillRect(6, 6, w - 12, 10);

  g.fillStyle = bg;
  g.font = "bold 8px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("D.A.A.", w / 2, 11);

  // Título
  g.fillStyle = fg;
  g.font = "bold 11px monospace";
  g.textAlign = "center";
  g.fillText(title, w / 2, 30);

  if (subtitle) {
    g.fillStyle = fg;
    g.font = "7px monospace";
    g.fillText(subtitle, w / 2, 46);
  }

  // Sello inferior
  g.fillStyle = accent;
  g.fillRect(6, h - 12, w - 12, 4);

  const tex = new THREE.CanvasTexture(c);
  return ps2Texture(tex);
}

/** Poster/propaganda para pared. */
export function posterTexture(line1: string, line2?: string): THREE.Texture {
  const w = 128;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;

  g.fillStyle = "#e8d9a8";
  g.fillRect(0, 0, w, h);

  // Dos corazones
  g.fillStyle = "#5a1d26";
  drawHeart(g, 40, 48, 14);
  drawHeart(g, 72, 48, 14);

  g.strokeStyle = "#5a1d26";
  g.lineWidth = 2;
  g.strokeRect(4, 4, w - 8, h - 8);

  g.fillStyle = "#2a2319";
  g.font = "bold 12px monospace";
  g.textAlign = "center";
  g.fillText(line1, w / 2, 90);
  if (line2) {
    g.font = "9px monospace";
    g.fillText(line2, w / 2, 104);
  }
  g.font = "bold 8px monospace";
  g.fillText("— D.A.A. —", w / 2, 120);

  const tex = new THREE.CanvasTexture(c);
  return ps2Texture(tex);
}

function drawHeart(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.5);
  g.bezierCurveTo(cx + s, cy - s * 0.3, cx + s * 0.6, cy - s, cx, cy - s * 0.3);
  g.bezierCurveTo(cx - s * 0.6, cy - s, cx - s, cy - s * 0.3, cx, cy + s * 0.5);
  g.fill();
}

/** Textura repetida de moquette/piso institucional. */
export function carpetTexture(tint: [number, number, number]): THREE.Texture {
  const w = 32;
  const h = 32;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const [r, gr, b] = tint;
  g.fillStyle = `rgb(${r},${gr},${b})`;
  g.fillRect(0, 0, w, h);
  // Motas
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(Math.random() * w);
    const y = Math.floor(Math.random() * h);
    const d = Math.floor(Math.random() * 30) - 15;
    g.fillStyle = `rgb(${clamp(r + d)},${clamp(gr + d)},${clamp(b + d)})`;
    g.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return ps2Texture(tex);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, n | 0));
}
