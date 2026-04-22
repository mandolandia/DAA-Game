import type { PinSpot } from "./pins";

export class UI {
  private counterEl = document.getElementById("counter")!;
  private promptEl = document.getElementById("prompt")!;
  private promptTextEl = document.getElementById("prompt-text")!;
  private placardEl = document.getElementById("placard")!;
  private plNum = document.getElementById("pl-num")!;
  private plTitle = document.getElementById("pl-title")!;
  private plFlavor = document.getElementById("pl-flavor")!;
  private locEl = document.getElementById("loc")!;
  private introEl = document.getElementById("intro")!;
  private outroEl = document.getElementById("outro")!;
  private outroTime = document.getElementById("outro-time")!;
  private outroRank = document.getElementById("outro-rank")!;
  private startBtn = document.getElementById("startBtn") as HTMLButtonElement;
  private restartBtn = document.getElementById("restartBtn") as HTMLButtonElement;

  private currentLoc = "";
  private placardHideTimer = 0;

  constructor(opts: { onStart: () => void; onRestart: () => void }) {
    this.startBtn.addEventListener("click", opts.onStart);
    this.startBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      opts.onStart();
    });
    this.restartBtn.addEventListener("click", opts.onRestart);
    this.restartBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      opts.onRestart();
    });
  }

  setCounter(c: number, total: number) {
    const p = (n: number) => n.toString().padStart(2, "0");
    this.counterEl.textContent = `${p(c)} / ${p(total)}`;
  }

  setPrompt(text: string) {
    if (text) {
      this.promptTextEl.textContent = text;
      this.promptEl.classList.add("on");
    } else {
      this.promptEl.classList.remove("on");
    }
  }

  showPlacard(spot: PinSpot, collected: number, total: number) {
    this.plNum.textContent = collected.toString().padStart(2, "0");
    this.plTitle.textContent = spot.title.toUpperCase();
    this.plFlavor.textContent = `"${spot.flavor}"`;
    this.placardEl.classList.add("show");
    this.placardHideTimer = 3.5;
  }

  updatePlacard(dt: number) {
    if (this.placardHideTimer > 0) {
      this.placardHideTimer -= dt;
      if (this.placardHideTimer <= 0) {
        this.placardEl.classList.remove("show");
      }
    }
  }

  setLocation(name: string) {
    if (name === this.currentLoc) return;
    this.currentLoc = name;
    if (!name) {
      this.locEl.classList.remove("show");
      return;
    }
    this.locEl.textContent = name;
    this.locEl.classList.add("show");
    clearTimeout((this as any)._locTimer);
    (this as any)._locTimer = setTimeout(() => {
      this.locEl.classList.remove("show");
    }, 2200);
  }

  hideIntro() {
    this.introEl.classList.add("hidden");
  }
  showIntro() {
    this.introEl.classList.remove("hidden");
  }

  showOutro(timeSec: number, rank: string) {
    const mm = Math.floor(timeSec / 60).toString().padStart(2, "0");
    const ss = Math.floor(timeSec % 60).toString().padStart(2, "0");
    this.outroTime.textContent = `Duración del turno: ${mm}:${ss}`;
    this.outroRank.textContent = `Rango asignado: ${rank}`;
    this.outroEl.classList.remove("hidden");
  }
  hideOutro() {
    this.outroEl.classList.add("hidden");
  }
}
