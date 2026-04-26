import { EditorState } from "./state";
import { MapEditor } from "./map";
import { Preview3D } from "./preview3d";
import { TextsEditor } from "./texts";

const state = new EditorState();

const tabsEl = document.querySelector(".tabs")!;
const panes = document.querySelectorAll<HTMLElement>(".pane");
const undoBtn = document.getElementById("undoBtn") as HTMLButtonElement;
const redoBtn = document.getElementById("redoBtn") as HTMLButtonElement;
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
const preview3dBtn = document.getElementById("preview3dBtn") as HTMLButtonElement;
const preview3dEl = document.getElementById("preview3d")!;
const preview3dViewport = document.getElementById("preview3dViewport")!;
const statusMsg = document.getElementById("statusMsg")!;
const statusFiles = document.getElementById("statusFiles")!;
const mapPane = document.querySelector<HTMLElement>('section[data-pane="map"]')!;
const textsPane = document.querySelector<HTMLElement>('section[data-pane="texts"]')!;

let mapEditor: MapEditor | null = null;
let textsEditor: TextsEditor | null = null;
let preview3d: Preview3D | null = null;

// Tab switching
tabsEl.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button[data-tab]") as HTMLButtonElement | null;
  if (!btn) return;
  const tab = btn.dataset.tab!;
  for (const t of tabsEl.querySelectorAll("button")) t.classList.toggle("active", t === btn);
  for (const p of panes) p.classList.toggle("active", p.dataset.pane === tab);
  if (tab === "map" && mapEditor) mapEditor.render();
});

// Preview toggle
preview3dBtn.addEventListener("click", () => {
  const willHide = !preview3dEl.classList.contains("hidden");
  preview3dEl.classList.toggle("hidden");
  preview3dBtn.textContent = preview3dEl.classList.contains("hidden")
    ? "Preview 3D ⌧"
    : "Preview 3D ✓";
  if (preview3d) preview3d.setActive(!willHide);
});

// Toolbar
undoBtn.addEventListener("click", () => state.undo());
redoBtn.addEventListener("click", () => state.redo());
saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  statusMsg.textContent = "Guardando…";
  try {
    await state.save();
    statusMsg.textContent = "Guardado.";
  } catch (err) {
    statusMsg.textContent = `Error al guardar: ${err}`;
  }
});

state.subscribe(() => {
  undoBtn.disabled = !state.canUndo();
  redoBtn.disabled = !state.canRedo();
  saveBtn.disabled = !state.isDirty();
});

window.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  const tag = (e.target as HTMLElement | null)?.tagName;
  // No interferir cuando se está escribiendo en un input
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (meta && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    state.undo();
  } else if (meta && (e.key === "Z" || (e.key === "z" && e.shiftKey) || e.key === "y")) {
    e.preventDefault();
    state.redo();
  } else if (meta && e.key === "s") {
    e.preventDefault();
    saveBtn.click();
  }
});

(async () => {
  try {
    await state.load();
    statusMsg.textContent = "Contenido cargado.";
    statusFiles.textContent = `${state.content.cases.length} casos · ${state.content.npcs.length} NPCs · ${state.content.props.length} props · ${state.content.players.length} players`;

    // Reemplazar placeholders por editores reales
    mapPane.innerHTML = "";
    mapEditor = new MapEditor(mapPane, state);
    textsPane.innerHTML = "";
    textsEditor = new TextsEditor(textsPane, state);

    preview3d = new Preview3D(preview3dViewport, state);
  } catch (err) {
    statusMsg.textContent = `Error al cargar: ${err}. Asegurate de correr 'npm run editor'.`;
    console.error(err);
  }
})();

(window as any).editorState = state;
