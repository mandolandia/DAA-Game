import type { CaseFile } from "./pins";

export type RawNPCSpawn = {
  id: string;
  skin: string;
  position: [number, number];
  radius: number;
  bark: string;
};

export type RawPlayerStyle = {
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

export type RawPlayer = {
  id: string;
  name: string;
  skin: string;
  style: RawPlayerStyle;
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

export type Prop =
  | { id: string; type: "box"; cx: number; cz: number; w: number; d: number; h: number; color: string; collider?: boolean }
  | { id: string; type: "decor"; x: number; y: number; z: number; w: number; h: number; d: number; color: string }
  | { id: string; type: "chair"; x: number; z: number }
  | { id: string; type: "table"; x: number; z: number }
  | { id: string; type: "portrait"; x: number; y: number; z: number }
  | { id: string; type: "plant"; x: number; z: number }
  | { id: string; type: "sign"; x: number; y: number; z: number; title: string; sub?: string }
  | { id: string; type: "statue"; x: number; z: number }
  | { id: string; type: "fountain"; x: number; z: number };

export type ContentBundle = {
  cases: CaseFile[];
  npcs: RawNPCSpawn[];
  players: RawPlayer[];
  texts: Texts;
  props: Prop[];
};

export async function loadContent(): Promise<ContentBundle> {
  const [cases, npcs, players, texts, props] = await Promise.all([
    fetchJSON<CaseFile[]>("/content/cases.json"),
    fetchJSON<RawNPCSpawn[]>("/content/npcs.json"),
    fetchJSON<RawPlayer[]>("/content/players.json"),
    fetchJSON<Texts>("/content/texts.json"),
    fetchJSON<Prop[]>("/content/props.json"),
  ]);
  return { cases, npcs, players, texts, props };
}

async function fetchJSON<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
  return r.json();
}

/** Convierte "#abcdef" a 0xabcdef. */
export function parseColor(s: string): number {
  return parseInt(s.replace("#", ""), 16);
}
