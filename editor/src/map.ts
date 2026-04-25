/**
 * Tab "Mapa": canvas 2D top-down con drag de casos y NPCs.
 *
 * Eje X mundo → eje X pantalla (positivo = derecha)
 * Eje Z mundo → eje Y pantalla (positivo = abajo)
 */

import type { EditorState, CaseFile, NPCSpawn } from "./state";

type Selection =
  | { type: "case"; index: number }
  | { type: "npc"; index: number }
  | null;

type View = {
  scale: number; // pixels per world-unit
  offsetX: number; // pan offset in screen pixels
  offsetY: number;
};

const NPC_SKINS = ["npc-1", "npc-2", "npc-3", "npc-4"];
const SKIN_COLORS: Record<string, string> = {
  "npc-1": "#dfba8a",
  "npc-2": "#cfa57a",
  "npc-3": "#b0825a",
  "npc-4": "#8a5d3a",
};

export class MapEditor {
  private root: HTMLElement;
  private state: EditorState;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private inspector!: HTMLElement;
  private selection: Selection = null;
  private view: View = { scale: 18, offsetX: 0, offsetY: 0 };
  private dragging:
    | { kind: "pan"; startX: number; startY: number; startOffX: number; startOffY: number }
    | {
        kind: "entity";
        sel: Exclude<Selection, null>;
        offsetX: number;
        offsetY: number;
        startX: number;
        startZ: number;
        moved: boolean;
      }
    | null = null;
  private hoverSel: Selection = null;

  constructor(root: HTMLElement, state: EditorState) {
    this.root = root;
    this.state = state;
    this.build();
    state.subscribe(() => this.render());
  }

  private build() {
    this.root.innerHTML = `
      <div class="map-toolbar">
        <button id="addNPCBtn" class="ghost">+ NPC</button>
        <button id="duplicateBtn" class="ghost" disabled>Duplicar</button>
        <button id="deleteBtn" class="ghost danger" disabled>Borrar</button>
        <span class="spacer"></span>
        <button id="centerBtn" class="ghost">Centrar vista</button>
        <span id="coords" class="coords">—</span>
      </div>
      <div class="map-body">
        <canvas id="mapCanvas"></canvas>
        <aside class="inspector" id="inspector">
          <div class="empty">Click un elemento para editarlo. <br/><br/>Tip: <b>delete</b> / <b>backspace</b> borra lo seleccionado.</div>
        </aside>
      </div>
    `;
    this.canvas = this.root.querySelector<HTMLCanvasElement>("#mapCanvas")!;
    this.ctx = this.canvas.getContext("2d")!;
    this.inspector = this.root.querySelector<HTMLElement>("#inspector")!;

    // Sync inicial: medir el padre y dimensionar canvas + centrar vista
    // antes de cualquier render, así los hit-tests caen donde toca.
    this.syncCanvasSize(true);
    this.bind();
    this.render();
  }

  private syncCanvasSize(centerAfter: boolean) {
    const parent = this.canvas.parentElement!;
    const r = parent.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const w = Math.floor(r.width);
    const h = Math.floor(r.height);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      if (centerAfter) this.centerView();
    }
  }

  private bind() {
    let firstResize = this.canvas.width === 0;
    const ro = new ResizeObserver(() => {
      this.syncCanvasSize(firstResize);
      firstResize = false;
      this.render();
    });
    ro.observe(this.canvas.parentElement!);

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const r = this.canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const wx = (cx - this.view.offsetX) / this.view.scale;
      const wz = (cy - this.view.offsetY) / this.view.scale;
      this.view.scale = Math.max(6, Math.min(80, this.view.scale * factor));
      this.view.offsetX = cx - wx * this.view.scale;
      this.view.offsetY = cy - wz * this.view.scale;
      this.render();
    }, { passive: false });

    const toCanvasCoords = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      // Convertir CSS-pixels a buffer-pixels en caso de mismatch
      const sx = (e.clientX - r.left) * (this.canvas.width / r.width);
      const sy = (e.clientY - r.top) * (this.canvas.height / r.height);
      return { cx: sx, cy: sy };
    };

    this.canvas.addEventListener("pointerdown", (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const { cx, cy } = toCanvasCoords(e);

      if (e.button === 2 || e.button === 1) {
        this.dragging = {
          kind: "pan",
          startX: cx,
          startY: cy,
          startOffX: this.view.offsetX,
          startOffY: this.view.offsetY,
        };
        return;
      }

      const sel = this.hitTest(cx, cy);
      this.selection = sel;
      this.renderInspector();
      if (sel) {
        const ent = this.entityPos(sel);
        const sx = ent.x * this.view.scale + this.view.offsetX;
        const sy = ent.z * this.view.scale + this.view.offsetY;
        this.dragging = {
          kind: "entity",
          sel,
          offsetX: cx - sx,
          offsetY: cy - sy,
          startX: ent.x,
          startZ: ent.z,
          moved: false,
        };
      } else {
        this.dragging = {
          kind: "pan",
          startX: cx,
          startY: cy,
          startOffX: this.view.offsetX,
          startOffY: this.view.offsetY,
        };
      }
      this.render();
    });

    this.canvas.addEventListener("pointermove", (e) => {
      const { cx, cy } = toCanvasCoords(e);

      const wx = (cx - this.view.offsetX) / this.view.scale;
      const wz = (cy - this.view.offsetY) / this.view.scale;
      const coords = this.root.querySelector<HTMLElement>("#coords");
      if (coords) coords.textContent = `x: ${wx.toFixed(2)}  z: ${wz.toFixed(2)}`;

      if (this.dragging?.kind === "pan") {
        this.view.offsetX = this.dragging.startOffX + (cx - this.dragging.startX);
        this.view.offsetY = this.dragging.startOffY + (cy - this.dragging.startY);
        this.render();
        return;
      }

      if (this.dragging?.kind === "entity") {
        const tx = (cx - this.dragging.offsetX - this.view.offsetX) / this.view.scale;
        const tz = (cy - this.dragging.offsetY - this.view.offsetY) / this.view.scale;
        const nx = snap(tx);
        const nz = snap(tz);
        if (nx !== this.dragging.startX || nz !== this.dragging.startZ) {
          this.dragging.moved = true;
        }
        this.setEntityPos(this.dragging.sel, nx, nz);
        this.renderInspector();
        this.render();
        return;
      }

      // hover
      const h = this.hitTest(cx, cy);
      if (selEq(h, this.hoverSel)) return;
      this.hoverSel = h;
      this.canvas.style.cursor = h ? "grab" : "default";
      this.render();
    });

    const endDrag = () => {
      if (this.dragging?.kind === "entity" && this.dragging.moved) {
        this.state.commit(); // un undo step por drag (solo si hubo movimiento real)
      }
      this.dragging = null;
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.root.querySelector("#addNPCBtn")!.addEventListener("click", () => this.addNPC());
    this.root.querySelector("#duplicateBtn")!.addEventListener("click", () => this.duplicate());
    this.root.querySelector("#deleteBtn")!.addEventListener("click", () => this.deleteSel());
    this.root.querySelector("#centerBtn")!.addEventListener("click", () => {
      this.centerView();
      this.render();
    });

    // Atajos: Delete / Backspace borra el seleccionado (si no estamos en un input)
    window.addEventListener("keydown", (e) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!this.selection) return;
      // Solo cuando la tab Mapa está activa
      const mapPane = document.querySelector('section[data-pane="map"]');
      if (!mapPane?.classList.contains("active")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        this.deleteSel();
      } else if (e.key === "Escape") {
        this.selection = null;
        this.renderInspector();
        this.render();
      }
    });
  }

  private centerView() {
    const w = this.canvas.width || 800;
    const h = this.canvas.height || 600;
    this.view.scale = Math.min(w / 32, h / 38);
    this.view.offsetX = w / 2;
    this.view.offsetY = h / 2 + this.view.scale * 2;
  }

  private hitTest(cx: number, cy: number): Selection {
    const c = this.state.content;
    // Cases first (encima visualmente)
    for (let i = 0; i < c.cases.length; i++) {
      const cs = c.cases[i];
      const sx = cs.position[0] * this.view.scale + this.view.offsetX;
      const sy = cs.position[2] * this.view.scale + this.view.offsetY;
      if (Math.hypot(cx - sx, cy - sy) < 14) return { type: "case", index: i };
    }
    for (let i = 0; i < c.npcs.length; i++) {
      const n = c.npcs[i];
      const sx = n.position[0] * this.view.scale + this.view.offsetX;
      const sy = n.position[1] * this.view.scale + this.view.offsetY;
      if (Math.hypot(cx - sx, cy - sy) < 14) return { type: "npc", index: i };
    }
    return null;
  }

  private entityPos(sel: Exclude<Selection, null>): { x: number; z: number } {
    if (sel.type === "case") {
      const c = this.state.content.cases[sel.index];
      return { x: c.position[0], z: c.position[2] };
    }
    const n = this.state.content.npcs[sel.index];
    return { x: n.position[0], z: n.position[1] };
  }

  private setEntityPos(sel: Exclude<Selection, null>, x: number, z: number) {
    if (sel.type === "case") {
      const c = this.state.content.cases[sel.index];
      c.position = [x, c.position[1], z];
    } else {
      const n = this.state.content.npcs[sel.index];
      n.position = [x, z];
    }
  }

  private addNPC() {
    const id = `npc-${Date.now().toString(36)}`;
    this.state.content.npcs.push({
      id,
      skin: "npc-1",
      position: [0, 0],
      radius: 2,
      bark: "Buenas noches.",
    });
    this.selection = { type: "npc", index: this.state.content.npcs.length - 1 };
    this.state.commit();
    this.renderInspector();
    this.render();
  }

  private duplicate() {
    if (!this.selection) return;
    if (this.selection.type === "npc") {
      const orig = this.state.content.npcs[this.selection.index];
      const clone: NPCSpawn = JSON.parse(JSON.stringify(orig));
      clone.id = `${orig.id}-copy`;
      clone.position = [orig.position[0] + 1, orig.position[1] + 1];
      this.state.content.npcs.push(clone);
      this.selection = { type: "npc", index: this.state.content.npcs.length - 1 };
    } else {
      const orig = this.state.content.cases[this.selection.index];
      const clone: CaseFile = JSON.parse(JSON.stringify(orig));
      clone.id = Math.max(...this.state.content.cases.map((c) => c.id)) + 1;
      clone.position = [orig.position[0] + 0.5, orig.position[1], orig.position[2] + 0.5];
      this.state.content.cases.push(clone);
      this.selection = { type: "case", index: this.state.content.cases.length - 1 };
    }
    this.state.commit();
    this.renderInspector();
    this.render();
  }

  private deleteSel() {
    if (!this.selection) return;
    if (this.selection.type === "npc") {
      this.state.content.npcs.splice(this.selection.index, 1);
    } else {
      this.state.content.cases.splice(this.selection.index, 1);
    }
    this.selection = null;
    this.state.commit();
    this.renderInspector();
    this.render();
  }

  /** Re-renderiza el canvas. */
  render() {
    if (!this.state.content) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Fondo
    ctx.fillStyle = "#0c0c0a";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(244,231,196,0.06)";
    ctx.lineWidth = 1;
    const step = this.view.scale;
    const startX = this.view.offsetX % step;
    const startY = this.view.offsetY % step;
    ctx.beginPath();
    for (let x = startX; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = startY; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Eje 0,0
    ctx.strokeStyle = "rgba(244,231,196,0.18)";
    ctx.beginPath();
    ctx.moveTo(this.view.offsetX, 0);
    ctx.lineTo(this.view.offsetX, h);
    ctx.moveTo(0, this.view.offsetY);
    ctx.lineTo(w, this.view.offsetY);
    ctx.stroke();

    // Zonas
    for (const z of this.state.content.layout.zones) {
      const x1 = z.x1 * this.view.scale + this.view.offsetX;
      const y1 = z.z1 * this.view.scale + this.view.offsetY;
      const x2 = z.x2 * this.view.scale + this.view.offsetX;
      const y2 = z.z2 * this.view.scale + this.view.offsetY;
      ctx.fillStyle = z.color + "40";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = "rgba(244,231,196,0.45)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textBaseline = "top";
      ctx.fillText(z.name, x1 + 6, y1 + 6);
    }

    // Walls
    ctx.strokeStyle = "#c9b98f";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const wl of this.state.content.layout.walls) {
      ctx.moveTo(wl.x1 * this.view.scale + this.view.offsetX, wl.z1 * this.view.scale + this.view.offsetY);
      ctx.lineTo(wl.x2 * this.view.scale + this.view.offsetX, wl.z2 * this.view.scale + this.view.offsetY);
    }
    ctx.stroke();

    // Spawn
    const sp = this.state.content.layout.spawn;
    const spx = sp.x * this.view.scale + this.view.offsetX;
    const spy = sp.z * this.view.scale + this.view.offsetY;
    ctx.fillStyle = "#3ade6a";
    ctx.beginPath();
    ctx.arc(spx, spy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3ade6a";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText("SPAWN", spx + 8, spy - 4);

    // NPCs (con radio de wander)
    for (let i = 0; i < this.state.content.npcs.length; i++) {
      const n = this.state.content.npcs[i];
      const nx = n.position[0] * this.view.scale + this.view.offsetX;
      const ny = n.position[1] * this.view.scale + this.view.offsetY;
      const isSel = this.selection?.type === "npc" && this.selection.index === i;
      const isHover = this.hoverSel?.type === "npc" && this.hoverSel.index === i;

      // wander radius
      ctx.strokeStyle = isSel ? "rgba(231,198,106,0.7)" : "rgba(244,231,196,0.18)";
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(nx, ny, n.radius * this.view.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // body
      const skinColor = SKIN_COLORS[n.skin] ?? "#dfba8a";
      ctx.fillStyle = skinColor;
      ctx.strokeStyle = isSel ? "#e7c66a" : isHover ? "#fff" : "#000";
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(nx, ny, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // id label
      ctx.fillStyle = "rgba(244,231,196,0.8)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText(n.id, nx + 11, ny + 3);
    }

    // Cases
    for (let i = 0; i < this.state.content.cases.length; i++) {
      const c = this.state.content.cases[i];
      const cx = c.position[0] * this.view.scale + this.view.offsetX;
      const cy = c.position[2] * this.view.scale + this.view.offsetY;
      const isSel = this.selection?.type === "case" && this.selection.index === i;
      const isHover = this.hoverSel?.type === "case" && this.hoverSel.index === i;

      ctx.fillStyle = "#e7c66a";
      ctx.strokeStyle = isSel ? "#fff" : isHover ? "#fff" : "#5a3a06";
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(244,231,196,0.7)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText(`#${c.id}`, cx + 9, cy + 3);
    }

    const dupBtn = this.root.querySelector<HTMLButtonElement>("#duplicateBtn");
    const delBtn = this.root.querySelector<HTMLButtonElement>("#deleteBtn");
    if (dupBtn) dupBtn.disabled = !this.selection;
    if (delBtn) delBtn.disabled = !this.selection;
  }

  private renderInspector() {
    if (!this.selection) {
      this.inspector.innerHTML = `<div class="empty">Click un elemento para editarlo.</div>`;
      return;
    }

    if (this.selection.type === "case") {
      const c = this.state.content.cases[this.selection.index];
      this.inspector.innerHTML = `
        <h3>Caso #${c.id}</h3>
        <label>Título<input data-field="title" value="${escapeAttr(c.title)}" /></label>
        <label>Mensaje<textarea data-field="flavor" rows="6">${escapeHtml(c.flavor)}</textarea></label>
        <label>Sala<input data-field="room" value="${escapeAttr(c.room)}" /></label>
        <div class="row">
          <label>X<input data-field="px" type="number" step="0.1" value="${c.position[0]}" /></label>
          <label>Y<input data-field="py" type="number" step="0.1" value="${c.position[1]}" /></label>
          <label>Z<input data-field="pz" type="number" step="0.1" value="${c.position[2]}" /></label>
        </div>
      `;
      this.bindInspector((field, value) => {
        if (field === "title") c.title = value as string;
        else if (field === "flavor") c.flavor = value as string;
        else if (field === "room") c.room = value as string;
        else if (field === "px") c.position[0] = parseFloat(value as string) || 0;
        else if (field === "py") c.position[1] = parseFloat(value as string) || 0;
        else if (field === "pz") c.position[2] = parseFloat(value as string) || 0;
      });
    } else {
      const n = this.state.content.npcs[this.selection.index];
      const skinOpts = NPC_SKINS.map(
        (s) => `<option value="${s}"${s === n.skin ? " selected" : ""}>${s}</option>`
      ).join("");
      this.inspector.innerHTML = `
        <h3>NPC ${escapeHtml(n.id)}</h3>
        <label>ID<input data-field="id" value="${escapeAttr(n.id)}" /></label>
        <label>Skin<select data-field="skin">${skinOpts}</select></label>
        <label>Bark<textarea data-field="bark" rows="3">${escapeHtml(n.bark)}</textarea></label>
        <div class="row">
          <label>X<input data-field="px" type="number" step="0.1" value="${n.position[0]}" /></label>
          <label>Z<input data-field="pz" type="number" step="0.1" value="${n.position[1]}" /></label>
        </div>
        <label>Radio de vagabundeo<input data-field="radius" type="number" step="0.1" min="0.5" value="${n.radius}" /></label>
      `;
      this.bindInspector((field, value) => {
        if (field === "id") n.id = value as string;
        else if (field === "skin") n.skin = value as string;
        else if (field === "bark") n.bark = value as string;
        else if (field === "px") n.position[0] = parseFloat(value as string) || 0;
        else if (field === "pz") n.position[1] = parseFloat(value as string) || 0;
        else if (field === "radius") n.radius = Math.max(0.5, parseFloat(value as string) || 0);
      });
    }
  }

  private bindInspector(apply: (field: string, value: string) => void) {
    const inputs = this.inspector.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-field]");
    inputs.forEach((el) => {
      el.addEventListener("input", () => {
        apply(el.dataset.field!, el.value);
        this.render();
      });
      el.addEventListener("change", () => {
        // commit on blur / change (un undo por edición de campo)
        apply(el.dataset.field!, el.value);
        this.state.commit();
        this.render();
      });
    });
  }

  /** Lista todas las posiciones para que el preview3d las use. */
  getSelection(): Selection {
    return this.selection;
  }
}

function snap(v: number): number {
  return Math.round(v * 10) / 10;
}

function selEq(a: Selection, b: Selection): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.index === b.index;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// Suprimir warnings de import no usado (CaseFile usado solo por inferencia)
export type { CaseFile, NPCSpawn };
