import type { CaseFile } from "./pins";
import type { Texts } from "./content";

export class UI {
  private counterEl = document.getElementById("counter")!;
  private promptEl = document.getElementById("prompt")!;
  private promptTextEl = document.getElementById("prompt-text")!;
  private promptKeyEl = this.promptEl.querySelector("b")!;
  private placardEl = document.getElementById("placard")!;
  private plNum = document.getElementById("pl-num")!;
  private plTitle = document.getElementById("pl-title")!;
  private plFlavor = document.getElementById("pl-flavor")!;
  private plClose = document.querySelector(".placard .pl-close")!;
  private plHead = document.querySelector(".placard .head")!;
  private locEl = document.getElementById("loc")!;
  private introEl = document.getElementById("intro")!;
  private outroEl = document.getElementById("outro")!;
  private outroTime = document.getElementById("outro-time")!;
  private outroRank = document.getElementById("outro-rank")!;
  private startBtn = document.getElementById("startBtn") as HTMLButtonElement;
  private restartBtn = document.getElementById("restartBtn") as HTMLButtonElement;
  private barkEl: HTMLDivElement;

  private currentLoc = "";
  private placardTotal = 10;
  private texts: Texts;
  private barkTimer = 0;
  private barkPosFn: (() => { x: number; z: number }) | null = null;

  constructor(opts: { onStart: () => void; onRestart: () => void; texts: Texts }) {
    this.texts = opts.texts;
    bindOnce(this.startBtn, opts.onStart);
    bindOnce(this.introEl, opts.onStart);
    bindOnce(this.restartBtn, opts.onRestart);
    bindOnce(this.outroEl, opts.onRestart);
    bindOnce(this.placardEl, () => this.hidePlacard());

    this.barkEl = document.createElement("div");
    this.barkEl.className = "bark";
    document.body.appendChild(this.barkEl);

    this.applyTexts();
  }

  /** Aplica todos los textos del bundle a los elementos del DOM. */
  private applyTexts() {
    const t = this.texts;
    // HUD
    const titleEl = document.querySelector(".hud-top .title");
    if (titleEl) titleEl.textContent = t.hud.title;
    const btnB = document.getElementById("btnB");
    if (btnB) btnB.textContent = t.hud.btnRun;
    const btnA = document.getElementById("btnA");
    if (btnA) btnA.textContent = t.hud.btnA;
    // Placard close hint
    if (this.plClose) this.plClose.textContent = t.placard.closeHint;
    // Prompt key (la "A" en negrita)
    if (this.promptKeyEl) this.promptKeyEl.textContent = t.hud.btnA;

    // Intro
    const introCard = this.introEl.querySelector(".card");
    if (introCard) {
      const h1 = introCard.querySelector("h1");
      const h2 = introCard.querySelector("h2");
      if (h1) h1.textContent = t.intro.h1;
      if (h2) h2.textContent = t.intro.h2;
      // Reemplazar todos los <p> previos
      introCard.querySelectorAll("p").forEach((p) => p.remove());
      const sign = introCard.querySelector(".sign");
      for (const para of t.intro.paragraphs) {
        const p = document.createElement("p");
        p.innerHTML = para;
        introCard.insertBefore(p, sign);
      }
      if (sign) sign.textContent = t.intro.sign;
      this.startBtn.textContent = t.intro.startBtn;
    }

    // Outro
    const outroCard = this.outroEl.querySelector(".card");
    if (outroCard) {
      const h1 = outroCard.querySelector("h1");
      const h2 = outroCard.querySelector("h2");
      if (h1) h1.textContent = t.outro.h1;
      if (h2) h2.textContent = t.outro.h2;
      // Mantener outro-time y outro-rank, reemplazar otros <p>
      outroCard.querySelectorAll("p").forEach((p) => {
        if (p.id !== "outro-time" && p.id !== "outro-rank") p.remove();
      });
      const timeP = document.getElementById("outro-time")!;
      for (const para of t.outro.paragraphs) {
        const p = document.createElement("p");
        p.innerHTML = para;
        outroCard.insertBefore(p, timeP);
      }
      const sign = outroCard.querySelector(".sign");
      if (sign) sign.textContent = t.outro.sign;
      this.restartBtn.textContent = t.outro.restartBtn;
    }
  }

  setCounter(c: number, total: number) {
    this.placardTotal = total;
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

  showPlacard(spot: CaseFile, collected: number) {
    this.plNum.textContent = collected.toString().padStart(2, "0");
    this.plTitle.textContent = spot.title.toUpperCase();
    this.plFlavor.textContent = `"${spot.flavor}"`;
    if (this.plHead) {
      this.plHead.textContent = this.texts.placard.head
        .replace("{n}", collected.toString().padStart(2, "0"))
        .replace("{total}", this.placardTotal.toString().padStart(2, "0"));
    }
    this.placardEl.classList.add("show");
  }

  hidePlacard() {
    this.placardEl.classList.remove("show");
  }

  isPlacardOpen(): boolean {
    return this.placardEl.classList.contains("show");
  }

  /** Muestra un globo de diálogo flotante. La función `getPos` se evalúa cada frame
   * para que el globo siga al NPC si éste se mueve. */
  showBark(text: string, getPos: () => { x: number; z: number }) {
    this.barkEl.textContent = text;
    this.barkEl.classList.add("on");
    this.barkPosFn = getPos;
    this.barkTimer = 3.5;
  }

  /** Llamar cada frame con función de proyección world→pantalla. */
  updateBark(dt: number, project: (x: number, z: number) => { sx: number; sy: number } | null) {
    if (this.barkTimer <= 0) return;
    this.barkTimer -= dt;
    if (this.barkTimer <= 0 || !this.barkPosFn) {
      this.barkEl.classList.remove("on");
      return;
    }
    const pos = this.barkPosFn();
    const p = project(pos.x, pos.z);
    if (!p) {
      this.barkEl.classList.remove("on");
      return;
    }
    this.barkEl.style.left = p.sx + "px";
    this.barkEl.style.top = p.sy + "px";
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

  /** Calcula el rango según ranks definidos en el bundle de textos. */
  computeRank(seconds: number): string {
    for (const r of this.texts.ranks) {
      if (r.maxSeconds === null || seconds < r.maxSeconds) return r.title;
    }
    return this.texts.ranks[this.texts.ranks.length - 1]?.title ?? "—";
  }
}

function bindOnce(el: HTMLElement, cb: () => void) {
  let lastFire = 0;
  const fire = (e: Event) => {
    const now = Date.now();
    if (now - lastFire < 400) return;
    lastFire = now;
    e.preventDefault();
    e.stopPropagation();
    try {
      cb();
    } catch (err) {
      console.error(err);
    }
  };
  el.addEventListener("click", fire);
  el.addEventListener("touchend", fire, { passive: false });
  el.addEventListener("pointerup", fire);
}
