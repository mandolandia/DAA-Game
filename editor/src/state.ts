/**
 * State global del editor: carga inicial desde /content, mutaciones,
 * undo/redo por snapshots, dirty flag.
 *
 * Las tabs de fases siguientes leen y escriben aquí — el bus de eventos
 * notifica cambios para que cada tab se re-renderice.
 */

import { readJSON, writeJSON } from "./api";

export type CaseFile = {
  id: number;
  title: string;
  flavor: string;
  position: [number, number, number];
  room: string;
};

export type NPCSpawn = {
  id: string;
  skin: string;
  position: [number, number];
  radius: number;
  bark: string;
};

export type PlayerVariant = {
  id: string;
  name: string;
  skin: string;
  style: {
    skin: string;
    hair: string;
    hairLong: boolean;
    shirt: string;
    pants: string;
    belt?: string;
    glasses: boolean;
    mustache: boolean;
    tattoos: boolean;
    buttons: boolean;
  };
};

export type Texts = {
  hud: { title: string; btnRun: string; btnA: string };
  prompts: { pickup: string; moveProp: string; talkNPC: string };
  intro: {
    h1: string;
    h2: string;
    paragraphs: string[];
    sign: string;
    startBtn: string;
  };
  outro: {
    h1: string;
    h2: string;
    paragraphs: string[];
    sign: string;
    restartBtn: string;
  };
  ranks: { maxSeconds: number | null; title: string }[];
  placard: { head: string; closeHint: string };
};

export type Wall = { x1: number; z1: number; x2: number; z2: number };
export type Zone = { x1: number; z1: number; x2: number; z2: number; name: string; color: string };
export type Layout = {
  spawn: { x: number; z: number };
  walls: Wall[];
  zones: Zone[];
};

export type EditorContent = {
  cases: CaseFile[];
  npcs: NPCSpawn[];
  players: PlayerVariant[];
  texts: Texts;
  layout: Layout;
};

const MAX_HISTORY = 50;

type Listener = () => void;

export class EditorState {
  content!: EditorContent;
  private history: string[] = [];
  private historyIdx = -1;
  private dirty = false;
  private listeners: Set<Listener> = new Set();

  async load(): Promise<void> {
    const [cases, npcs, players, texts, layout] = await Promise.all([
      readJSON<CaseFile[]>("cases.json"),
      readJSON<NPCSpawn[]>("npcs.json"),
      readJSON<PlayerVariant[]>("players.json"),
      readJSON<Texts>("texts.json"),
      readJSON<Layout>("layout.json"),
    ]);
    this.content = { cases, npcs, players, texts, layout };
    this.history = [JSON.stringify(this.content)];
    this.historyIdx = 0;
    this.dirty = false;
    this.notify();
  }

  /** Llamar después de cualquier mutación que deba quedar en el undo stack. */
  commit() {
    const snap = JSON.stringify(this.content);
    // Truncar redo branch si hicimos undo y editamos
    this.history = this.history.slice(0, this.historyIdx + 1);
    if (this.history[this.history.length - 1] === snap) return; // no cambió
    this.history.push(snap);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.historyIdx = this.history.length - 1;
    this.dirty = true;
    this.notify();
  }

  undo() {
    if (this.historyIdx <= 0) return;
    this.historyIdx -= 1;
    this.content = JSON.parse(this.history[this.historyIdx]);
    this.dirty = true;
    this.notify();
  }

  redo() {
    if (this.historyIdx >= this.history.length - 1) return;
    this.historyIdx += 1;
    this.content = JSON.parse(this.history[this.historyIdx]);
    this.dirty = true;
    this.notify();
  }

  canUndo(): boolean {
    return this.historyIdx > 0;
  }
  canRedo(): boolean {
    return this.historyIdx < this.history.length - 1;
  }
  isDirty(): boolean {
    return this.dirty;
  }

  async save(): Promise<void> {
    await Promise.all([
      writeJSON("cases.json", this.content.cases),
      writeJSON("npcs.json", this.content.npcs),
      writeJSON("players.json", this.content.players),
      writeJSON("texts.json", this.content.texts),
    ]);
    this.dirty = false;
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }
}
