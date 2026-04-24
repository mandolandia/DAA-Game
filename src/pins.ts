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
  const W = 0.30, H = 0.21, D = 0.07;
  const CT = 0.012; // cover thickness
  const tW = 0.09, tH = 0.042; // tab size
  const manila     = 0xc4a43c;
  const manilaLight = 0xd4b44a;
  const manilaEdge  = 0xa88c28;
  const paper1 = 0xf0e8c4;
  const paper2 = 0xe0d8aa;

  // Tapa trasera (completa)
  const backCover = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, CT),
    ps2Lambert({ color: manila })
  );
  backCover.position.z = -D / 2 + CT / 2;
  g.add(backCover);

  // Pestaña arriba-izquierda en tapa trasera
  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(tW, tH, CT),
    ps2Lambert({ color: manilaLight })
  );
  tab.position.set(-W / 2 + tW / 2, H / 2 + tH / 2, -D / 2 + CT / 2);
  g.add(tab);

  // Páginas internas (3, apiladas, decrecientes en profundidad)
  const pageDefs = [
    { d: D - CT * 2, c: paper1 },
    { d: (D - CT * 2) * 0.65, c: paper2 },
    { d: (D - CT * 2) * 0.35, c: paper1 },
  ];
  for (const { d, c } of pageDefs) {
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.018, H * 0.97, d),
      ps2Lambert({ color: c })
    );
    page.position.z = -D / 2 + CT + d / 2;
    g.add(page);
  }

  // Tapa delantera — cuerpo principal (todo excepto el hueco del tab)
  const frontMain = new THREE.Mesh(
    new THREE.BoxGeometry(W, H - tH, CT),
    ps2Lambert({ color: manila })
  );
  frontMain.position.set(0, -tH / 2, D / 2 - CT / 2);
  g.add(frontMain);

  // Tapa delantera — franja superior derecha (donde no está el tab)
  const frontTopRight = new THREE.Mesh(
    new THREE.BoxGeometry(W - tW, tH, CT),
    ps2Lambert({ color: manila })
  );
  frontTopRight.position.set(tW / 2, H / 2 - tH / 2, D / 2 - CT / 2);
  g.add(frontTopRight);

  // Lomo derecho
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(CT, H, D),
    ps2Lambert({ color: manilaEdge })
  );
  spine.position.set(W / 2 + CT / 2, 0, 0);
  g.add(spine);

  // Doblez inferior
  const fold = new THREE.Mesh(
    new THREE.BoxGeometry(W + CT * 2, CT, D),
    ps2Lambert({ color: manilaEdge })
  );
  fold.position.set(0, -H / 2 - CT / 2, 0);
  g.add(fold);

  // Halo suave
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 10),
    new THREE.MeshBasicMaterial({
      color: 0xf0d060,
      transparent: true,
      opacity: 0.13,
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
