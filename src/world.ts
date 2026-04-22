import * as THREE from "three";
import { ps2Lambert, ps2Basic } from "./ps2";
import { signTexture, posterTexture, carpetTexture } from "./textures";
import type { PinSpot } from "./pins";

export type BuiltWorld = {
  walls: THREE.Box3[];
  pinSpots: PinSpot[];
  /** Zonas etiquetadas (x1, z1, x2, z2, name) para mostrar "ubicación actual" */
  zones: { x1: number; z1: number; x2: number; z2: number; name: string }[];
};

const WALL_HEIGHT = 3.2;
const WALL_THICKNESS = 0.3;

export function buildWorld(scene: THREE.Scene): BuiltWorld {
  const walls: THREE.Box3[] = [];
  const zones: BuiltWorld["zones"] = [];

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
  const pinSpots: PinSpot[] = [];

  // ===== RECEPCIÓN =====
  // Mostrador
  addBox(scene, walls, -2, 9, 4, 10.4, 1.1, 0xb09068);
  addBox(scene, walls, -2, 9, 4, 9.2, 1.25, 0x8a6d44); // encimera
  // Timbre (cubito dorado)
  addDecor(scene, 1, 1.35, 9.6, 0.15, 0.1, 0.15, 0xe7c66a);
  // Cartel "RECEPCIÓN"
  addSign(scene, 0, 2.3, 13.7, "RECEPCIÓN", "PABELLÓN 14");
  // Sillón y mesita
  addBox(scene, walls, 6, 11, 9, 12.5, 0.5, 0x5a1d26);
  addBox(scene, walls, 6, 12.5, 9, 13, 1.0, 0x5a1d26); // respaldo
  addBox(scene, walls, -9, 11, -6, 12.5, 0.5, 0x5a1d26);
  addBox(scene, walls, -9, 12.5, -6, 13, 1.0, 0x5a1d26);
  // Planta de plástico (triángulo)
  addPlant(scene, -12, 12);
  addPlant(scene, 12, 12);
  // Bandeja oficial (entrega final — por ahora solo decor)
  addDecor(scene, -1, 1.3, 9.6, 0.6, 0.05, 0.3, 0xa88b4a);
  // PIN 01 — detrás del mostrador
  pinSpots.push({
    id: 1,
    title: "Pin de Recepción",
    flavor: "Hallado en zona de recepción. Probable distracción durante el saludo institucional.",
    position: [0, 1.5, 10.2],
    room: "RECEPCIÓN",
  });

  // ===== PASILLO DE RETRATOS =====
  // Retratos en las paredes
  for (let i = 0; i < 4; i++) {
    const z = 4 - i * 4;
    addPortrait(scene, -2.85, 1.8, z);
    addPortrait(scene, 2.85, 1.8, z);
  }
  // Banco largo al centro
  addBox(scene, walls, -0.6, -2, 0.6, 2, 0.5, 0x3a2416);
  // Estatua del Fundador
  addStatue(scene, 0, -6);
  // PIN 02 — bajo el banco
  pinSpots.push({
    id: 2,
    title: "Pin del Pasillo",
    flavor: "Olvidado bajo el banco del Pasillo. Sin reclamante registrado.",
    position: [0, 0.55, 0],
    room: "PASILLO DE RETRATOS",
  });
  // PIN 03 — sobre el marco del Fundador
  pinSpots.push({
    id: 3,
    title: "Pin del Fundador",
    flavor: "Condecoración extraviada en ceremonia de 1974. Reportada por tercera vez.",
    position: [0, 2.3, -6.2],
    room: "PASILLO DE RETRATOS",
  });

  // ===== SALA DE ESPERA =====
  // Tablero numérico "AHORA ATENDIENDO: 037"
  addSign(scene, 8.5, 2.4, 5.85, "AHORA", "037");
  // Filas de sillas
  for (let row = 0; row < 3; row++) {
    const z = 4 - row * 2;
    for (let c = 0; c < 4; c++) {
      const x = 4.5 + c * 2;
      addChair(scene, walls, x, z);
    }
  }
  // PIN 04 — sobre una silla
  pinSpots.push({
    id: 4,
    title: "Pin de la Espera",
    flavor: "Olvidado por un solicitante que no regresó. Caso archivado.",
    position: [6.5, 0.9, 2],
    room: "SALA DE ESPERA",
  });

  // ===== ARCHIVO DE CARTAS =====
  // Archivadores pegados a paredes
  for (let i = 0; i < 4; i++) {
    const z = 4 - i * 2;
    addBox(scene, walls, -13.6, z - 0.4, -12, z + 0.4, 2.0, 0x3a5c4a); // verde institucional
    addBox(scene, walls, -13.6, z - 0.4, -12, z + 0.4, 2.05, 0x2a4a3a); // tapa
  }
  addBox(scene, walls, -5, 5, -4, 5.8, 2.0, 0x3a5c4a);
  // Mesa de trabajo
  addBox(scene, walls, -10, 0, -7, 2, 0.9, 0x6a4a30);
  // Lámpara verde (cubito)
  addDecor(scene, -8.5, 1.2, 1, 0.3, 0.3, 0.3, 0x2a5c4a);
  // Escalera móvil (prop decorativo)
  addBox(scene, walls, -11, 0, -10.5, 0.5, 2.2, 0xa88b4a);
  // PIN 05 — encima de un archivador
  pinSpots.push({
    id: 5,
    title: "Pin del Archivo",
    flavor: "Entre correspondencia del año 1989. Sobre del remitente deteriorado.",
    position: [-12.8, 2.3, 2],
    room: "ARCHIVO DE CARTAS",
  });

  // ===== CAFETERÍA =====
  // 2 mesas con 4 sillas cada una
  addTable(scene, walls, -11, -4);
  addTable(scene, walls, -8, -7);
  // Vending machine
  addBox(scene, walls, -13.5, -9.5, -12.5, -8.5, 2.2, 0x8a1d26);
  addDecor(scene, -13, 2.1, -9, 0.8, 0.1, 0.4, 0xf0e5c5); // tope
  // Máquina de café
  addBox(scene, walls, -6.5, -3, -6, -2.5, 1.0, 0xc9b98f);
  // PIN 06 — encima de vending
  pinSpots.push({
    id: 6,
    title: "Pin del Snack",
    flavor: "Premio de promoción vencida. Sabor: no documentado.",
    position: [-13, 2.5, -9],
    room: "CAFETERÍA",
  });

  // ===== SALA DE MÁQUINAS EMOCIONALES =====
  // Escáner de compatibilidad
  addBox(scene, walls, 5, -4, 6.5, -2.5, 1.4, 0x3a4a6a);
  addDecor(scene, 5.75, 1.6, -3.25, 0.8, 0.15, 0.8, 0xa0c0e0); // panel de luz
  // Buzón rojo
  addBox(scene, walls, 13, -4, 13.6, -3.4, 1.2, 0x8a1d26);
  addDecor(scene, 13.3, 1.25, -3.7, 0.4, 0.02, 0.02, 0x141414); // ranura
  // Fotocopiadora
  addBox(scene, walls, 10, -8, 11.5, -6.5, 1.3, 0xd9d0b4);
  // Terminal CRT
  addBox(scene, walls, 6, -8, 7.5, -7, 1.0, 0x2a2a36);
  addDecor(scene, 6.75, 1.2, -7.5, 0.6, 0.45, 0.05, 0x3ade6a); // pantalla verde
  // Teléfono de baquelita (mesita aparte)
  addBox(scene, walls, 12, -7, 13, -6, 0.8, 0x1a1a16);
  // PIN 07 — en la bandeja del escáner
  pinSpots.push({
    id: 7,
    title: "Pin del Escáner",
    flavor: "Impreso automáticamente tras resultado perfecto (100%), luego invalidado.",
    position: [5.75, 1.7, -3.25],
    room: "SALA DE MÁQUINAS EMOCIONALES",
  });
  // PIN 08 — sobre la fotocopiadora
  pinSpots.push({
    id: 8,
    title: "Pin de la Fotocopiadora",
    flavor: "Hallado en la salida de papel. Copia n.º 37 de 37.",
    position: [10.75, 1.45, -7.25],
    room: "SALA DE MÁQUINAS EMOCIONALES",
  });

  // ===== AUDITORIO =====
  // Escenario
  addBox(scene, walls, -4, -17, 4, -15.5, 0.6, 0x5a1d26);
  // Cortina atrás (alta)
  addDecor(scene, 0, 1.8, -17.3, 8, 2.2, 0.2, 0x3c1e22);
  // Micrófono
  addDecor(scene, 0, 1.0, -16.2, 0.08, 0.8, 0.08, 0x141414);
  addDecor(scene, 0, 1.5, -16.2, 0.2, 0.1, 0.2, 0x2a2a2a);
  // Butacas (3 filas)
  for (let row = 0; row < 3; row++) {
    const z = -11.5 - row * 1.2;
    for (let c = 0; c < 7; c++) {
      const x = -3 + c * 1;
      addBox(scene, walls, x - 0.35, z - 0.3, x + 0.35, z + 0.3, 0.5, 0x3c1e22);
      addBox(scene, walls, x - 0.35, z + 0.3, x + 0.35, z + 0.5, 1.0, 0x3c1e22); // respaldo
    }
  }
  // PIN 09 — bajo el micrófono
  pinSpots.push({
    id: 9,
    title: "Pin del Reencuentro",
    flavor: "Perdido durante discurso de clausura de la 46ª Ceremonia.",
    position: [0, 0.85, -16.2],
    room: "AUDITORIO",
  });

  // ===== PATIO INTERIOR =====
  // Fuente
  addFountain(scene, 10, -14);
  // Banco
  addBox(scene, walls, 12.5, -12, 13.5, -11, 0.5, 0x3a2416);
  addBox(scene, walls, 12.5, -12, 13.5, -11.2, 1.0, 0x3a2416);
  // PIN 10 — fondo de la fuente
  pinSpots.push({
    id: 10,
    title: "Pin de la Fuente",
    flavor: "Tirado como moneda de deseo. Motivo: clasificado.",
    position: [10, 0.3, -14],
    room: "PATIO INTERIOR",
  });

  // --- SUELO EXTERIOR (niebla) ---
  addFloor(scene, -60, -60, 60, 60, 0x2a2a26, "ground", -0.05);

  return { walls, pinSpots, zones };
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
