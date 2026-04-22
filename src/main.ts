import { Game } from "./game";

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
