import * as THREE from "three";
import { ps2Lambert, ps2Basic } from "./ps2";
import { signTexture, posterTexture, carpetTexture } from "./textures";
import type { CaseFile } from "./pins";
import type { Prop } from "./content";
import { parseColor } from "./content";

export type Interactable = {
  mesh: THREE.Mesh;
  wallBox: THREE.Box3;
  prompt: string;
  range: number;
  activated: boolean;
  activate(): void;
  update(dt: number): void;
};

export type BuiltWorld = {
  walls: THREE.Box3[];
  caseFiles: CaseFile[];
  /** Zonas etiquetadas (x1, z1, x2, z2, name) para mostrar "ubicación actual" */
  zones: { x1: number; z1: number; x2: number; z2: number; name: string }[];
  interactables: Interactable[];
};

const WALL_HEIGHT = 3.2;
const WALL_THICKNESS = 0.3;

export function buildWorld(scene: THREE.Scene, cases: CaseFile[], props: Prop[] = []): BuiltWorld {
  const walls: THREE.Box3[] = [];
  const zones: BuiltWorld["zones"] = [];
  const interactables: Interactable[] = [];

  // --- PISOS POR SALA (colores distintos = personalidad por zona) ---
  // Recepción (terciopelo bordó + moquette)
  addFloor(scene, -14, 6, 14, 14, 0x6a2a2f, "carpet");
  zones.push({ x1: -14, z1: 6, x2: 14, z2: 14, name: "RECEPCIÓN" });

  // Pasillo de Retratos
  addFloor(scene, -3, -10, 3, 6, 0x5c4a2a, "wood");
  zones.push({ x1: -3, z1: -10, x2: 3, z2: 6, name: "PASILLO DE RETRATOS" });

  // Sala de Espera
  addFloor(scene, 3, -2, 14, 6, 0x3a4a3c, "carpet");
  zones.push({ x1: 3, z1: -2, x2: 14, z2: 6, name: "SALA DE ESPERA" });

  // Archivo de Cartas
  addFloor(scene, -14, -2, -3, 6, 0x3a4a52, "tile");
  zones.push({ x1: -14, z1: -2, x2: -3, z2: 6, name: "ARCHIVO DE CARTAS" });

  // Sala de Máquinas Emocionales
  addFloor(scene, 3, -10, 14, -2, 0x4a4a52, "tile");
  zones.push({ x1: 3, z1: -10, x2: 14, z2: -2, name: "SALA DE MÁQUINAS EMOCIONALES" });

  // Cafetería
  addFloor(scene, -14, -10, -6, -2, 0x8a7a3a, "tile");
  zones.push({ x1: -14, z1: -10, x2: -6, z2: -2, name: "CAFETERÍA" });

  // Conexión cafetería-auditorio (mini hall)
  addFloor(scene, -6, -10, -3, -2, 0x5c4a2a, "wood");

  // Auditorio
  addFloor(scene, -6, -18, 6, -10, 0x3c1e22, "carpet");
  zones.push({ x1: -6, z1: -18, x2: 6, z2: -10, name: "AUDITORIO DE REENCUENTROS" });

  // Patio Interior (outdoor — piedra)
  addFloor(scene, 6, -18, 14, -10, 0x6a6460, "stone");
  zones.push({ x1: 6, z1: -18, x2: 14, z2: -10, name: "PATIO INTERIOR" });

  // --- TECHO (solo sobre interiores, no patio) ---
  addCeiling(scene, -14, -18, 14, 14, 0xdcd2a8); // sobre todo
  // Recortar el techo del patio: agregamos un "hueco" poniendo cielo oscuro
  addSkyPatch(scene, 6, -18, 14, -10);

  // --- MUROS EXTERIORES (perímetro con puertas) ---
  const outer = 0xc9b98f;
  // Sur (con abertura central para entrada)
  addWall(scene, walls, -14, 14, -2, 14, outer);
  addWall(scene, walls, 2, 14, 14, 14, outer);
  // Norte (hasta z=-18)
  addWall(scene, walls, -14, -18, 14, -18, outer);
  // Oeste
  addWall(scene, walls, -14, -18, -14, 14, outer);
  // Este (hasta patio; patio tiene reja baja)
  addWall(scene, walls, 14, -10, 14, 14, outer);
  addWall(scene, walls, 14, -18, 14, -10, outer); // pared norte del patio
  // Reja/muro del patio al este ya está con el addWall anterior; no abrir

  // --- MUROS INTERIORES ---
  // Separador Recepción / corredores (z=6), con puertas
  // Puertas: hacia Archivo (x=-7..-5), hacia Pasillo (x=-1..1 — abierto), hacia Espera (x=5..7)
  addWall(scene, walls, -14, 6, -7, 6, outer);
  addWall(scene, walls, -5, 6, -3, 6, outer);
  addWall(scene, walls, 3, 6, 5, 6, outer);
  addWall(scene, walls, 7, 6, 14, 6, outer);

  // Separador entre Pasillo y Espera (x=3), con puerta
  addWall(scene, walls, 3, -2, 3, 2, outer);
  addWall(scene, walls, 3, 4, 3, 6, outer);
  // Separador entre Pasillo y Archivo (x=-3), con puerta
  addWall(scene, walls, -3, -2, -3, 2, outer);
  addWall(scene, walls, -3, 4, -3, 6, outer);
  // Separador entre Espera y Máquinas (z=-2), con puerta
  addWall(scene, walls, 3, -2, 5, -2, outer);
  addWall(scene, walls, 7, -2, 14, -2, outer);
  // Separador entre Archivo y Cafetería (z=-2), con puerta
  addWall(scene, walls, -14, -2, -11, -2, outer);
  addWall(scene, walls, -9, -2, -3, -2, outer);
  // Separador entre Pasillo y Máquinas / Cafetería (x=3 y x=-3) tramos hacia el norte
  addWall(scene, walls, 3, -10, 3, -2, outer);
  addWall(scene, walls, -3, -10, -3, -2, outer);
  // Límite norte del Pasillo (z=-10) — abre al auditorio
  addWall(scene, walls, -3, -10, -2, -10, outer);
  addWall(scene, walls, 2, -10, 3, -10, outer);
  // Este de Máquinas hacia patio (x=14 ya está), separador entre Máquinas y Patio (z=-10)
  addWall(scene, walls, 3, -10, 7, -10, outer);
  addWall(scene, walls, 9, -10, 14, -10, outer); // puerta x=7..9
  // Pared Cafetería-Auditorio (z=-10) con acceso
  addWall(scene, walls, -14, -10, -6, -10, outer);
  // Pared oeste del auditorio
  addWall(scene, walls, -6, -18, -6, -10, outer);
  // Pared este del auditorio / oeste del patio
  addWall(scene, walls, 6, -18, 6, -10, outer);

  // --- LUCES DE TECHO (puntuales sutiles) ---
  addCeilingLight(scene, 0, 10);   // Recepción
  addCeilingLight(scene, 0, 0);    // Pasillo centro
  addCeilingLight(scene, 8, 2);    // Sala de Espera
  addCeilingLight(scene, -8, 2);   // Archivo
  addCeilingLight(scene, 8, -6);   // Máquinas
  addCeilingLight(scene, -10, -6); // Cafetería
  addCeilingLight(scene, 0, -14);  // Auditorio
  // Patio: farol exterior
  addPatioLight(scene, 10, -14);

  // --- PROPS POR SALA ---
  const caseFiles: CaseFile[] = cases;
  applyProps(scene, walls, props);
  // Archivero bloqueador — interactuable (A para moverlo y despejar el pasillo)
  {
    const bw = 1, bd = 0.8, bh = 2.0;
    const scx = -4.5, scz = 5.4; // centro inicial (bloquea la puerta)
    const ecz = 2.4;             // destino: más al norte dentro del archivo
    const geo = new THREE.BoxGeometry(bw, bh, bd);
    const mat = ps2Lambert({ color: 0x3a5c4a });
    const archMesh = new THREE.Mesh(geo, mat);
    archMesh.position.set(scx, bh / 2, scz);
    scene.add(archMesh);
    const archBox = new THREE.Box3(
      new THREE.Vector3(scx - bw / 2, 0, scz - bd / 2),
      new THREE.Vector3(scx + bw / 2, bh, scz + bd / 2)
    );
    walls.push(archBox);
    let moveT = 0;
    const MOVE_DUR = 0.7;
    const archivero: Interactable = {
      mesh: archMesh,
      wallBox: archBox,
      prompt: "MOVER ARCHIVERO",
      range: 1.8,
      activated: false,
      activate() {
        if (this.activated) return;
        this.activated = true;
        // Despejar colisión de inmediato para que el jugador pase
        archBox.min.set(scx - bw / 2, 0, ecz - bd / 2);
        archBox.max.set(scx + bw / 2, bh, ecz + bd / 2);
      },
      update(dt: number) {
        if (!this.activated || moveT >= 1) return;
        moveT = Math.min(moveT + dt / MOVE_DUR, 1);
        const t = moveT * moveT * (3 - 2 * moveT); // smooth-step
        archMesh.position.z = scz + (ecz - scz) * t;
      },
    };
    interactables.push(archivero);
  }

  // --- SUELO EXTERIOR (niebla) ---
  addFloor(scene, -60, -60, 60, 60, 0x2a2a26, "ground", -0.05);

  return { walls, caseFiles, zones, interactables };
}

// ============================================================
// HELPERS
// ============================================================

function addFloor(
  scene: THREE.Scene,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  color: number,
  _kind: string,
  y: number = 0
) {
  const w = x2 - x1;
  const d = z2 - z1;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const tex = carpetTexture(hexToRGB(color));
  tex.repeat.set(Math.max(1, w / 2), Math.max(1, d / 2));
  const mat = ps2Lambert({ map: tex });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  scene.add(m);
}

function addCeiling(
  scene: THREE.Scene,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  color: number
) {
  const w = x2 - x1;
  const d = z2 - z1;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(Math.PI / 2);
  const mat = ps2Lambert({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x1 + x2) / 2, WALL_HEIGHT, (z1 + z2) / 2);
  scene.add(m);
}

function addSkyPatch(
  scene: THREE.Scene,
  x1: number,
  z1: number,
  x2: number,
  z2: number
) {
  const w = x2 - x1;
  const d = z2 - z1;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(Math.PI / 2);
  const mat = ps2Basic({ color: 0x1a1f2a });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x1 + x2) / 2, WALL_HEIGHT + 0.1, (z1 + z2) / 2);
  scene.add(m);
}

function addWall(
  scene: THREE.Scene,
  walls: THREE.Box3[],
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  color: number
) {
  const w = Math.abs(x2 - x1);
  const d = Math.abs(z2 - z1);
  const isVertical = d > w;
  const thickness = WALL_THICKNESS;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const sx = isVertical ? thickness : w;
  const sz = isVertical ? d : thickness;

  const geo = new THREE.BoxGeometry(sx, WALL_HEIGHT, sz);
  const mat = ps2Lambert({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, WALL_HEIGHT / 2, cz);
  scene.add(m);

  const b = new THREE.Box3(
    new THREE.Vector3(cx - sx / 2, 0, cz - sz / 2),
    new THREE.Vector3(cx + sx / 2, WALL_HEIGHT, cz + sz / 2)
  );
  walls.push(b);
}

function addBox(
  scene: THREE.Scene,
  walls: THREE.Box3[],
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  height: number,
  color: number
) {
  const w = x2 - x1;
  const d = z2 - z1;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const geo = new THREE.BoxGeometry(w, height, d);
  const mat = ps2Lambert({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, height / 2, cz);
  scene.add(m);
  const b = new THREE.Box3(
    new THREE.Vector3(cx - w / 2, 0, cz - d / 2),
    new THREE.Vector3(cx + w / 2, height, cz + d / 2)
  );
  walls.push(b);
}

function addDecor(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = ps2Lambert({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  scene.add(m);
}

function addCeilingLight(scene: THREE.Scene, x: number, z: number) {
  const light = new THREE.PointLight(0xfff1c4, 0.8, 9, 1.6);
  light.position.set(x, WALL_HEIGHT - 0.4, z);
  scene.add(light);
  // Plafón visible
  const mat = ps2Basic({ color: 0xfff8d8 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), mat);
  m.position.set(x, WALL_HEIGHT - 0.2, z);
  scene.add(m);
}

function addPatioLight(scene: THREE.Scene, x: number, z: number) {
  const light = new THREE.PointLight(0xc0d0f0, 0.6, 12, 1.2);
  light.position.set(x, 3.5, z);
  scene.add(light);
}

function addSign(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  title: string,
  sub?: string
) {
  const tex = signTexture(title, sub);
  const geo = new THREE.PlaneGeometry(1.6, 0.8);
  const mat = ps2Basic({ map: tex, transparent: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = z < 0 ? 0 : Math.PI; // orientación básica
  scene.add(m);
}

function addPortrait(scene: THREE.Scene, x: number, y: number, z: number) {
  // Marco bordó
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.1, 0.08),
    ps2Lambert({ color: 0x3a1a1f })
  );
  // Retrato (color aleatorio de piel/fondo)
  const paint = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.98, 0.05),
    ps2Lambert({ color: 0xa0816b })
  );
  paint.position.z = 0.03;
  const wrap = new THREE.Group();
  wrap.add(frame, paint);
  wrap.position.set(x, y, z);
  // Orientar hacia el centro (x=0)
  wrap.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(wrap);
}

function addPlant(scene: THREE.Scene, x: number, z: number) {
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 0.4, 8),
    ps2Lambert({ color: 0x4a2a1f })
  );
  pot.position.set(x, 0.2, z);
  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.2, 5),
    ps2Lambert({ color: 0x2a5c3a })
  );
  leaf.position.set(x, 1.05, z);
  scene.add(pot, leaf);
}

function addChair(
  scene: THREE.Scene,
  walls: THREE.Box3[],
  x: number,
  z: number
) {
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.08, 0.7),
    ps2Lambert({ color: 0x1a1a16 })
  );
  seat.position.set(x, 0.5, z);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 0.08),
    ps2Lambert({ color: 0x1a1a16 })
  );
  back.position.set(x, 0.95, z + 0.35);
  scene.add(seat, back);
  // Colisión suave
  walls.push(
    new THREE.Box3(
      new THREE.Vector3(x - 0.35, 0, z - 0.35),
      new THREE.Vector3(x + 0.35, 1.0, z + 0.4)
    )
  );
}

function addTable(
  scene: THREE.Scene,
  walls: THREE.Box3[],
  x: number,
  z: number
) {
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.1, 1.5),
    ps2Lambert({ color: 0xd0c090 })
  );
  top.position.set(x, 0.9, z);
  scene.add(top);
  walls.push(
    new THREE.Box3(
      new THREE.Vector3(x - 0.75, 0, z - 0.75),
      new THREE.Vector3(x + 0.75, 1.0, z + 0.75)
    )
  );
}

function addStatue(scene: THREE.Scene, x: number, z: number) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.6, 1),
    ps2Lambert({ color: 0x3a3630 })
  );
  base.position.set(x, 0.3, z);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.1, 0.4),
    ps2Lambert({ color: 0xa8a294 })
  );
  body.position.set(x, 1.15, z);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    ps2Lambert({ color: 0xa8a294 })
  );
  head.position.set(x, 1.9, z);
  scene.add(base, body, head);
}

function addFountain(scene: THREE.Scene, x: number, z: number) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 0.5, 12),
    ps2Lambert({ color: 0x6a5f50 })
  );
  base.position.set(x, 0.25, z);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.1, 12),
    ps2Basic({ color: 0x3a5c6a })
  );
  water.position.set(x, 0.5, z);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 1.2, 8),
    ps2Lambert({ color: 0x8a8070 })
  );
  pillar.position.set(x, 1.1, z);
  scene.add(base, water, pillar);
}

function hexToRGB(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

/** Despacha cada prop del JSON al builder correspondiente. */
function applyProps(scene: THREE.Scene, walls: THREE.Box3[], props: Prop[]) {
  for (const p of props) {
    switch (p.type) {
      case "box": {
        const x1 = p.cx - p.w / 2, z1 = p.cz - p.d / 2;
        const x2 = p.cx + p.w / 2, z2 = p.cz + p.d / 2;
        const collide = p.collider !== false;
        if (collide) addBox(scene, walls, x1, z1, x2, z2, p.h, parseColor(p.color));
        else addDecor(scene, p.cx, p.h / 2, p.cz, p.w, p.h, p.d, parseColor(p.color));
        break;
      }
      case "decor":
        addDecor(scene, p.x, p.y, p.z, p.w, p.h, p.d, parseColor(p.color));
        break;
      case "chair":
        addChair(scene, walls, p.x, p.z);
        break;
      case "table":
        addTable(scene, walls, p.x, p.z);
        break;
      case "portrait":
        addPortrait(scene, p.x, p.y, p.z);
        break;
      case "plant":
        addPlant(scene, p.x, p.z);
        break;
      case "sign":
        addSign(scene, p.x, p.y, p.z, p.title, p.sub || undefined);
        break;
      case "statue":
        addStatue(scene, p.x, p.z);
        break;
      case "fountain":
        addFountain(scene, p.x, p.z);
        break;
    }
  }
}
