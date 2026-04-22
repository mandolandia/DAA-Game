import * as THREE from "three";
import { ps2Lambert } from "./ps2";

export type PinSpot = {
  id: number;
  title: string;
  flavor: string;
  position: [number, number, number];
  room: string;
};

type PinInstance = {
  spot: PinSpot;
  group: THREE.Group;
  collected: boolean;
  bobT: number;
};

const PICK_RANGE = 1.4;

export class PinManager {
  pins: PinInstance[] = [];
  collected = 0;
  total = 0;
  private nearestId: number | null = null;

  constructor(private scene: THREE.Scene, spots: PinSpot[]) {
    this.total = spots.length;
    for (const s of spots) {
      const g = makePinMesh();
      g.position.set(s.position[0], s.position[1], s.position[2]);
      scene.add(g);
      this.pins.push({ spot: s, group: g, collected: false, bobT: Math.random() * Math.PI * 2 });
    }
  }

  /**
   * Update + devuelve el PinSpot recogido (o null).
   */
  update(
    dt: number,
    playerPos: THREE.Vector3,
    interactPressed: boolean
  ): PinSpot | null {
    let nearestDist = Infinity;
    let nearest: PinInstance | null = null;

    for (const p of this.pins) {
      if (p.collected) continue;
      // Bob + spin
      p.bobT += dt * 2.5;
      p.group.rotation.y += dt * 1.8;
      const baseY = p.spot.position[1];
      p.group.position.y = baseY + Math.sin(p.bobT) * 0.08;

      const dx = p.group.position.x - playerPos.x;
      const dz = p.group.position.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }

    this.nearestId = nearest && nearestDist < PICK_RANGE ? nearest.spot.id : null;

    if (this.nearestId && interactPressed && nearest) {
      nearest.collected = true;
      this.collected += 1;
      this.scene.remove(nearest.group);
      disposeGroup(nearest.group);
      this.nearestId = null;
      return nearest.spot;
    }
    return null;
  }

  /** Prompt para el HUD cuando hay pin cerca. */
  nearbyPrompt(): string {
    return this.nearestId ? "RECOGER PIN" : "";
  }

  /** Lista de pins pendientes para debug/iteración. */
  remaining(): number {
    return this.total - this.collected;
  }
}

function makePinMesh(): THREE.Group {
  const g = new THREE.Group();
  // Cuerpo dorado (disco)
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12),
    ps2Lambert({ color: 0xe7c66a, emissive: 0x5a3a0a })
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // Relieve al centro
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8),
    ps2Lambert({ color: 0xf0d688, emissive: 0x6a4a10 })
  );
  core.rotation.x = Math.PI / 2;
  g.add(core);
  // Halo (plano emisivo detrás)
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 10),
    new THREE.MeshBasicMaterial({
      color: 0xf5d270,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  halo.rotation.y = Math.PI;
  g.add(halo);
  return g;
}

function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}
