/**
 * Tab "Skins": grid de los 7 slots (3 player + 4 NPC).
 * Cada slot muestra el PNG actual + botón upload + mini-preview 3D con la skin aplicada.
 *
 * Layout esperado del PNG (64×64):
 *   ver `_template.png` en /content/skins/ — usalo como referencia.
 */

import * as THREE from "three";
import type { EditorState } from "./state";
import { writeBlob } from "./api";
import { buildSkinnedCharacter } from "../../src/charSkin";

type SlotKind = "player" | "npc";

type Slot = {
  id: string;          // "player-tattoo", "npc-1", etc.
  kind: SlotKind;
  label: string;
};

const SLOTS: Slot[] = [
  { id: "player-tattoo",   kind: "player", label: "Player · Tatuaje" },
  { id: "player-diplomat", kind: "player", label: "Player · Diplomático" },
  { id: "player-veteran",  kind: "player", label: "Player · Veterana" },
  { id: "npc-1",           kind: "npc",    label: "NPC · skin 1" },
  { id: "npc-2",           kind: "npc",    label: "NPC · skin 2" },
  { id: "npc-3",           kind: "npc",    label: "NPC · skin 3" },
  { id: "npc-4",           kind: "npc",    label: "NPC · skin 4" },
];

export class SkinsEditor {
  private root: HTMLElement;
  private state: EditorState;
  private cards: Map<string, SkinCard> = new Map();

  constructor(root: HTMLElement, state: EditorState) {
    this.root = root;
    this.state = state;
    this.render();
  }

  private render() {
    this.root.innerHTML = `
      <div class="skins-header">
        <div>
          <h2>Skins (UV map · 64×64)</h2>
          <p class="hint">
            Subí un PNG de 64×64 con el layout de cuerpo desplegado. Usá
            <a href="/content/skins/_template.png" target="_blank">_template.png</a>
            como referencia (cabeza arriba-izquierda, body en el centro,
            extremidades a los costados). Los cambios se aplican al recargar el juego.
          </p>
        </div>
      </div>
      <div class="skins-grid"></div>
    `;
    const grid = this.root.querySelector<HTMLElement>(".skins-grid")!;
    for (const slot of SLOTS) {
      const card = new SkinCard(slot, this.state);
      grid.appendChild(card.el);
      this.cards.set(slot.id, card);
    }
  }
}

class SkinCard {
  el: HTMLElement;
  private slot: Slot;
  private state: EditorState;
  private imgEl!: HTMLImageElement;
  private statusEl!: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private group: THREE.Group | null = null;
  private mat!: THREE.MeshLambertMaterial;
  private rafId = 0;

  constructor(slot: Slot, state: EditorState) {
    this.slot = slot;
    this.state = state;
    this.el = document.createElement("div");
    this.el.className = "skin-card";
    this.el.innerHTML = `
      <div class="skin-card-head">
        <span class="skin-label">${slot.label}</span>
        <span class="skin-id">${slot.id}.png</span>
      </div>
      <div class="skin-card-body">
        <div class="skin-png">
          <img alt="${slot.id}" />
        </div>
        <div class="skin-3d"></div>
      </div>
      <div class="skin-card-foot">
        <label class="skin-upload">
          <input type="file" accept="image/png" />
          <span class="upload-btn">Subir PNG</span>
        </label>
        <span class="skin-status"></span>
      </div>
    `;

    this.imgEl = this.el.querySelector("img")!;
    this.statusEl = this.el.querySelector(".skin-status")!;
    this.refreshImg();

    this.setup3D();

    const fileInput = this.el.querySelector<HTMLInputElement>('input[type="file"]')!;
    fileInput.addEventListener("change", (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) void this.handleUpload(f);
    });

    void this.state; // referenced for future linking
  }

  private refreshImg() {
    const cacheBust = Date.now();
    this.imgEl.src = `/content/skins/${this.slot.id}.png?t=${cacheBust}`;
  }

  private setup3D() {
    const host = this.el.querySelector<HTMLElement>(".skin-3d")!;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1f2a);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    this.camera.position.set(0, 1.4, 4.2);
    this.camera.lookAt(0, 1.0, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff4d0, 0x2a2820, 0.8));
    const dir = new THREE.DirectionalLight(0xfff0c8, 0.5);
    dir.position.set(2, 5, 3);
    this.scene.add(dir);

    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";

    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      this.renderer.setSize(r.width, r.height, false);
      this.camera.aspect = r.width / r.height;
      this.camera.updateProjectionMatrix();
    });
    ro.observe(host);

    this.buildCharacter();
    this.loop();
  }

  private buildCharacter() {
    if (this.group) this.scene.remove(this.group);
    this.group = buildSkinnedCharacter(`/content/skins/${this.slot.id}.png?t=${Date.now()}`);
    this.scene.add(this.group);
    this.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (m && m.map) this.mat = m;
    });
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.group) {
      this.group.rotation.y += 0.012;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private async handleUpload(file: File) {
    if (!file.type.startsWith("image/png")) {
      this.statusEl.textContent = "✗ debe ser PNG";
      return;
    }
    // Validar que sea 64x64
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    if (img.naturalWidth !== 64 || img.naturalHeight !== 64) {
      this.statusEl.textContent = `✗ debe ser 64×64 (era ${img.naturalWidth}×${img.naturalHeight})`;
      URL.revokeObjectURL(url);
      return;
    }
    URL.revokeObjectURL(url);

    this.statusEl.textContent = "Subiendo…";
    try {
      await writeBlob(`skins/${this.slot.id}.png`, file);
      this.statusEl.textContent = "✓ guardado";
      this.refreshImg();
      void this.buildCharacter();
    } catch (err) {
      this.statusEl.textContent = `✗ error: ${err}`;
    }
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.renderer.dispose();
  }
}
