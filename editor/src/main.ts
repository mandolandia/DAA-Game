import { EditorState } from "./state";

const state = new EditorState();

const tabsEl = document.querySelector(".tabs")!;
const panes = document.querySelectorAll<HTMLElement>(".pane");
const undoBtn = document.getElementById("undoBtn") as HTMLButtonElement;
const redoBtn = document.getElementById("redoBtn") as HTMLButtonElement;
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
const preview3dBtn = document.getElementById("preview3dBtn") as HTMLButtonElement;
const preview3dEl = document.getElementById("preview3d")!;
const statusMsg = document.getElementById("statusMsg")!;
const statusFiles = document.getElementById("statusFiles")!;

// Tab switching
tabsEl.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button[data-tab]") as HTMLButtonElement | null;
  if (!btn) return;
  const tab = btn.dataset.tab!;
  for (const t of tabsEl.querySelectorAll("button")) t.classList.toggle("active", t === btn);
  for (const p of panes) p.classList.toggle("active", p.dataset.pane === tab);
});

// Preview toggle
preview3dBtn.addEventListener("click", () => {
  preview3dEl.classList.toggle("hidden");
  preview3dBtn.textContent = preview3dEl.classList.contains("hidden")
    ? "Preview 3D ⌧"
    : "Preview 3D ✓";
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

// Re-render botones según el state
state.subscribe(() => {
  undoBtn.disabled = !state.canUndo();
  redoBtn.disabled = !state.canRedo();
  saveBtn.disabled = !state.isDirty();
});

// Atajos de teclado
window.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
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

// Carga inicial
(async () => {
  try {
    await state.load();
    statusMsg.textContent = "Contenido cargado.";
    statusFiles.textContent = `${state.content.cases.length} casos · ${state.content.npcs.length} NPCs · ${state.content.players.length} players`;
  } catch (err) {
    statusMsg.textContent = `Error al cargar: ${err}. Asegurate de correr 'npm run editor' (no 'npm run preview').`;
    console.error(err);
  }
})();

// Exponer state globalmente para que las tabs futuras lo usen
(window as any).editorState = state;
