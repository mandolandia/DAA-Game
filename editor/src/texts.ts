/**
 * Tab "Textos": edita todos los strings visibles del juego.
 *  - HUD, prompts, placard
 *  - Intro / outro (con párrafos como array)
 *  - Rangos (lista con threshold + título)
 *  - Casos (10, título + flavor inline)
 *  - Players (3, nombre)
 */

import type { EditorState } from "./state";

export class TextsEditor {
  private root: HTMLElement;
  private state: EditorState;

  constructor(root: HTMLElement, state: EditorState) {
    this.root = root;
    this.state = state;
    this.render();
    state.subscribe(() => this.render());
  }

  private render() {
    if (!this.state.content) return;
    const t = this.state.content.texts;

    this.root.innerHTML = `
      <div class="texts-grid">
        ${this.section(
          "HUD",
          `
          ${this.input("HUD title", "hud.title", t.hud.title)}
          <div class="row">
            ${this.input("Botón correr", "hud.btnRun", t.hud.btnRun)}
            ${this.input("Botón A", "hud.btnA", t.hud.btnA)}
          </div>
        `
        )}

        ${this.section(
          "Prompts",
          `
          ${this.input("Recoger expediente", "prompts.pickup", t.prompts.pickup)}
          ${this.input("Mover prop", "prompts.moveProp", t.prompts.moveProp)}
          ${this.input("Hablar con NPC", "prompts.talkNPC", t.prompts.talkNPC)}
        `
        )}

        ${this.section(
          "Placard (al recoger expediente)",
          `
          ${this.input("Header (usar {n} y {total})", "placard.head", t.placard.head)}
          ${this.input("Hint de cerrar", "placard.closeHint", t.placard.closeHint)}
        `
        )}

        ${this.section(
          "Intro (overlay inicial)",
          `
          ${this.input("H1", "intro.h1", t.intro.h1)}
          ${this.input("H2", "intro.h2", t.intro.h2)}
          ${this.paragraphs("Párrafos", "intro.paragraphs", t.intro.paragraphs)}
          ${this.input("Firma", "intro.sign", t.intro.sign)}
          ${this.input("Botón iniciar", "intro.startBtn", t.intro.startBtn)}
        `
        )}

        ${this.section(
          "Outro (overlay final)",
          `
          ${this.input("H1", "outro.h1", t.outro.h1)}
          ${this.input("H2", "outro.h2", t.outro.h2)}
          ${this.paragraphs("Párrafos", "outro.paragraphs", t.outro.paragraphs)}
          ${this.input("Firma", "outro.sign", t.outro.sign)}
          ${this.input("Botón reiniciar", "outro.restartBtn", t.outro.restartBtn)}
        `
        )}

        ${this.section("Rangos", this.ranksUI())}

        ${this.section("Casos (título + mensaje)", this.casesUI())}

        ${this.section("Players (nombres)", this.playersUI())}
      </div>
    `;

    this.bindAll();
  }

  // === helpers ===

  private section(title: string, body: string): string {
    return `
      <section class="t-sec">
        <h3>${escapeHtml(title)}</h3>
        ${body}
      </section>
    `;
  }

  private input(label: string, path: string, value: string, kind: "text" | "textarea" = "text"): string {
    if (kind === "textarea") {
      return `<label>${escapeHtml(label)}<textarea data-path="${path}" rows="3">${escapeHtml(value)}</textarea></label>`;
    }
    return `<label>${escapeHtml(label)}<input data-path="${path}" value="${escapeAttr(value)}" /></label>`;
  }

  private paragraphs(label: string, path: string, list: string[]): string {
    const items = list
      .map(
        (p, i) => `
          <div class="para-row">
            <textarea data-array="${path}" data-index="${i}" rows="3">${escapeHtml(p)}</textarea>
            <button class="ghost danger small" data-array-del="${path}" data-index="${i}">×</button>
          </div>
        `
      )
      .join("");
    return `
      <div class="paragraphs">
        <div class="paragraphs-head">
          <span class="lbl">${escapeHtml(label)}</span>
          <button class="ghost small" data-array-add="${path}">+ Párrafo</button>
        </div>
        ${items}
      </div>
    `;
  }

  private ranksUI(): string {
    const items = this.state.content.texts.ranks
      .map(
        (r, i) => `
          <div class="rank-row">
            <input type="number" data-rank-secs="${i}" value="${r.maxSeconds ?? ""}" placeholder="∞" />
            <input type="text" data-rank-title="${i}" value="${escapeAttr(r.title)}" />
            <button class="ghost danger small" data-rank-del="${i}">×</button>
          </div>
        `
      )
      .join("");
    return `
      <div class="ranks">
        <div class="ranks-head">
          <span class="col">Hasta segundos (vacío = sin límite)</span>
          <span class="col">Título</span>
        </div>
        ${items}
        <button class="ghost small" data-rank-add="">+ Rango</button>
      </div>
    `;
  }

  private casesUI(): string {
    return this.state.content.cases
      .map(
        (c, i) => `
          <div class="case-row">
            <div class="case-id">#${c.id} <span class="case-room">${escapeHtml(c.room)}</span></div>
            <input data-case-title="${i}" value="${escapeAttr(c.title)}" />
            <textarea data-case-flavor="${i}" rows="3">${escapeHtml(c.flavor)}</textarea>
          </div>
        `
      )
      .join("");
  }

  private playersUI(): string {
    return this.state.content.players
      .map(
        (p, i) => `
          <div class="player-row">
            <span class="player-id">${escapeHtml(p.id)}</span>
            <input data-player-name="${i}" value="${escapeAttr(p.name)}" />
          </div>
        `
      )
      .join("");
  }

  private bindAll() {
    // Inputs/textareas con data-path = ruta dot-notada en texts
    this.root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-path]").forEach((el) => {
      const path = el.dataset.path!;
      el.addEventListener("input", () => setByPath(this.state.content.texts, path, el.value));
      el.addEventListener("change", () => {
        setByPath(this.state.content.texts, path, el.value);
        this.state.commit();
      });
    });

    // Arrays (paragraphs)
    this.root.querySelectorAll<HTMLTextAreaElement>("textarea[data-array]").forEach((el) => {
      const path = el.dataset.array!;
      const idx = parseInt(el.dataset.index!, 10);
      el.addEventListener("input", () => {
        const arr = getByPath<string[]>(this.state.content.texts, path);
        arr[idx] = el.value;
      });
      el.addEventListener("change", () => {
        const arr = getByPath<string[]>(this.state.content.texts, path);
        arr[idx] = el.value;
        this.state.commit();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-array-add]").forEach((b) => {
      b.addEventListener("click", () => {
        const path = b.dataset.arrayAdd!;
        const arr = getByPath<string[]>(this.state.content.texts, path);
        arr.push("");
        this.state.commit();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-array-del]").forEach((b) => {
      b.addEventListener("click", () => {
        const path = b.dataset.arrayDel!;
        const idx = parseInt(b.dataset.index!, 10);
        const arr = getByPath<string[]>(this.state.content.texts, path);
        arr.splice(idx, 1);
        this.state.commit();
      });
    });

    // Ranks
    this.root.querySelectorAll<HTMLInputElement>("[data-rank-secs]").forEach((el) => {
      const i = parseInt(el.dataset.rankSecs!, 10);
      el.addEventListener("change", () => {
        const v = el.value.trim();
        this.state.content.texts.ranks[i].maxSeconds = v === "" ? null : parseInt(v, 10);
        this.state.commit();
      });
    });
    this.root.querySelectorAll<HTMLInputElement>("[data-rank-title]").forEach((el) => {
      const i = parseInt(el.dataset.rankTitle!, 10);
      el.addEventListener("input", () => {
        this.state.content.texts.ranks[i].title = el.value;
      });
      el.addEventListener("change", () => {
        this.state.content.texts.ranks[i].title = el.value;
        this.state.commit();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-rank-del]").forEach((b) => {
      const i = parseInt(b.dataset.rankDel!, 10);
      b.addEventListener("click", () => {
        this.state.content.texts.ranks.splice(i, 1);
        this.state.commit();
      });
    });
    const addRank = this.root.querySelector<HTMLButtonElement>("[data-rank-add]");
    if (addRank) {
      addRank.addEventListener("click", () => {
        this.state.content.texts.ranks.push({ maxSeconds: null, title: "AGENTE" });
        this.state.commit();
      });
    }

    // Cases
    this.root.querySelectorAll<HTMLInputElement>("[data-case-title]").forEach((el) => {
      const i = parseInt(el.dataset.caseTitle!, 10);
      el.addEventListener("input", () => (this.state.content.cases[i].title = el.value));
      el.addEventListener("change", () => {
        this.state.content.cases[i].title = el.value;
        this.state.commit();
      });
    });
    this.root.querySelectorAll<HTMLTextAreaElement>("[data-case-flavor]").forEach((el) => {
      const i = parseInt(el.dataset.caseFlavor!, 10);
      el.addEventListener("input", () => (this.state.content.cases[i].flavor = el.value));
      el.addEventListener("change", () => {
        this.state.content.cases[i].flavor = el.value;
        this.state.commit();
      });
    });

    // Players
    this.root.querySelectorAll<HTMLInputElement>("[data-player-name]").forEach((el) => {
      const i = parseInt(el.dataset.playerName!, 10);
      el.addEventListener("input", () => (this.state.content.players[i].name = el.value));
      el.addEventListener("change", () => {
        this.state.content.players[i].name = el.value;
        this.state.commit();
      });
    });
  }
}

function getByPath<T>(obj: any, path: string): T {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}
function setByPath(obj: any, path: string, value: any) {
  const parts = path.split(".");
  const last = parts.pop()!;
  const parent = parts.reduce((o, k) => o[k], obj);
  parent[last] = value;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
