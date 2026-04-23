import { Game } from "./game";

// Mostrar errores en pantalla (clave en mobile donde no hay consola visible).
installErrorOverlay();

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas #game no encontrado");

const game = new Game(canvas);
game.start();

// Evitar scroll / gestures raros en iOS
document.addEventListener(
  "gesturestart",
  (e) => e.preventDefault(),
  { passive: false }
);
document.addEventListener(
  "dblclick",
  (e) => e.preventDefault(),
  { passive: false }
);

function installErrorOverlay() {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:9999;background:#5a1d26;color:#f4e7c4;font:11px/1.35 monospace;padding:8px;white-space:pre-wrap;display:none;max-height:50vh;overflow:auto;pointer-events:auto;";
  document.body.appendChild(el);
  const show = (msg: string) => {
    el.textContent = `[D.A.A. · ERROR]\n${msg}\n(tocar para cerrar)`;
    el.style.display = "block";
  };
  el.addEventListener("click", () => (el.style.display = "none"));
  window.addEventListener("error", (e) => {
    show(`${e.message}\n${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    show(`Unhandled: ${e.reason}`);
  });
}
