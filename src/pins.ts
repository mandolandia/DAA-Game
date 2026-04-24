import * as THREE from "three";
import { ps2Lambert } from "./ps2";

export type CaseFile = {
  id: number;
  title: string;
  flavor: string;
  position: [number, number, number];
  room: string;
};

type CaseInstance = {
  spot: CaseFile;
  group: THREE.Group;
  collected: boolean;
  bobT: number;
};

const PICK_RANGE = 1.4;

export class CaseManager {
  cases: CaseInstance[] = [];
  collected = 0;
  total = 0;
  private nearestId: number | null = null;

  constructor(private scene: THREE.Scene, spots: CaseFile[]) {
    this.total = spots.length;
    for (const s of spots) {
      const g = makeFolderMesh();
      g.position.set(s.position[0], s.position[1], s.position[2]);
      scene.add(g);
      this.cases.push({ spot: s, group: g, collected: false, bobT: Math.random() * Math.PI * 2 });
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    interactPressed: boolean
  ): CaseFile | null {
    let nearestDist = Infinity;
    let nearest: CaseInstance | null = null;

    for (const p of this.cases) {
      if (p.collected) continue;
      p.bobT += dt * 2.2;
      p.group.rotation.y += dt * 1.4;
      const baseY = p.spot.position[1];
      p.group.position.y = baseY + Math.sin(p.bobT) * 0.07;

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

  nearbyPrompt(): string {
    return this.nearestId ? "RECOGER EXPEDIENTE" : "";
  }

  remaining(): number {
    return this.total - this.collected;
  }
}

function makeFolderMesh(): THREE.Group {
  const g = new THREE.Group();
  // Cuerpo de la carpeta (manila)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.34, 0.04),
    ps2Lambert({ color: 0xe8c870, emissive: 0x4a3000 })
  );
  g.add(body);
  // Pestaña superior izquierda
  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.055, 0.046),
    ps2Lambert({ color: 0xd4a030, emissive: 0x3a2000 })
  );
  tab.position.set(-0.065, 0.197, 0);
  g.add(tab);
  // Líneas de páginas internas
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.013, 0.046),
      ps2Lambert({ color: 0xb89830 })
    );
    stripe.position.set(0.01, 0.06 - i * 0.075, 0);
    g.add(stripe);
  }
  // Halo suave
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 10),
    new THREE.MeshBasicMaterial({
      color: 0xf5d270,
      transparent: true,
      opacity: 0.14,
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
