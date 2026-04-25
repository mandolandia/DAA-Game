import { Game } from "./game";
import { loadContent } from "./content";

installErrorOverlay();

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas #game no encontrado");

loadContent()
  .then((content) => {
    const game = new Game(canvas, content);
    game.start();
  })
  .catch((err) => {
    console.error(err);
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:#5a1d26;color:#f4e7c4;font:12px monospace;padding:24px;white-space:pre-wrap;";
    overlay.textContent = `[D.A.A. · ERROR]\nNo se pudo cargar el contenido del juego:\n${err}`;
    document.body.appendChild(overlay);
  });

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
