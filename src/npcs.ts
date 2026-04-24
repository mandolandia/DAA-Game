import * as THREE from "three";
import { ps2Lambert } from "./ps2";

const NPC_RADIUS = 0.36;
const NPC_SPEED = 1.3;

type NPCStyle = {
  skin: number;
  hair: number;
  tie: number;
  pants: number;
  glasses: boolean;
  mustache: boolean;
  beard: boolean;
};

const SKIN_TONES = [0xdfba8a, 0xcfa57a, 0xb0825a, 0x8a5d3a, 0xe5c6a0];
const HAIR_TONES = [0x141310, 0x2a1a10, 0x5a3a20, 0x3a2810];
const TIE_TONES = [0x8b2d2d, 0x1a3a5a, 0x2a5c3a, 0x4a2a5c, 0x5a4a1a];
const PANTS_TONES = [0x1a2a4a, 0x4a3a1a, 0x2a2a30, 0x1a1a1a, 0x3a3a42];

function randomStyle(): NPCStyle {
  const r = Math.random;
  return {
    skin: SKIN_TONES[Math.floor(r() * SKIN_TONES.length)],
    hair: HAIR_TONES[Math.floor(r() * HAIR_TONES.length)],
    tie: TIE_TONES[Math.floor(r() * TIE_TONES.length)],
    pants: PANTS_TONES[Math.floor(r() * PANTS_TONES.length)],
    glasses: r() < 0.35,
    mustache: r() < 0.25,
    beard: r() < 0.15,
  };
}

type NPC = {
  group: THREE.Group;
  pos: THREE.Vector3;
  facing: number;
  targetX: number;
  targetZ: number;
  retargetTimer: number;
  pauseTimer: number;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  stride: number;
  homeX: number;
  homeZ: number;
  homeRadius: number;
};

export type NPCSpawn = {
  x: number;
  z: number;
  radius: number;
};

export class NPCManager {
  npcs: NPC[] = [];

  constructor(scene: THREE.Scene, spawns: NPCSpawn[]) {
    for (const sp of spawns) {
      this.spawn(scene, sp);
    }
  }

  private spawn(scene: THREE.Scene, sp: NPCSpawn) {
    const style = randomStyle();
    const group = buildNPC(style);
    const pos = new THREE.Vector3(sp.x, 0, sp.z);
    group.position.copy(pos);
    scene.add(group);
    this.npcs.push({
      group,
      pos,
      facing: Math.random() * Math.PI * 2,
      targetX: sp.x,
      targetZ: sp.z,
      retargetTimer: Math.random() * 2,
      pauseTimer: 0,
      leftLeg: group.getObjectByName("legL")!,
      rightLeg: group.getObjectByName("legR")!,
      leftArm: group.getObjectByName("armL")!,
      rightArm: group.getObjectByName("armR")!,
      stride: 0,
      homeX: sp.x,
      homeZ: sp.z,
      homeRadius: sp.radius,
    });
  }

  update(dt: number, walls: THREE.Box3[]) {
    for (const n of this.npcs) {
      // Pausa ocasional (parados mirando algo)
      if (n.pauseTimer > 0) {
        n.pauseTimer -= dt;
        n.group.position.copy(n.pos);
        n.group.rotation.y = n.facing;
        n.stride *= 0.85;
        const swing = Math.sin(n.stride) * 0.1;
        n.leftLeg.rotation.x = swing;
        n.rightLeg.rotation.x = -swing;
        n.leftArm.rotation.x = -swing * 0.5;
        n.rightArm.rotation.x = swing * 0.5;
        continue;
      }

      // Retarget si llegó o si se cansó de buscar
      n.retargetTimer -= dt;
      const dxT = n.targetX - n.pos.x;
      const dzT = n.targetZ - n.pos.z;
      const distToTarget = Math.hypot(dxT, dzT);
      if (distToTarget < 0.35 || n.retargetTimer <= 0) {
        // 30% de chance: pausa y luego retarget
        if (Math.random() < 0.3) {
          n.pauseTimer = 1.5 + Math.random() * 2.5;
        }
        const a = Math.random() * Math.PI * 2;
        const r = 0.5 + Math.random() * n.homeRadius;
        n.targetX = n.homeX + Math.cos(a) * r;
        n.targetZ = n.homeZ + Math.sin(a) * r;
        n.retargetTimer = 4 + Math.random() * 4;
      }

      const mx = n.targetX - n.pos.x;
      const mz = n.targetZ - n.pos.z;
      const mag = Math.hypot(mx, mz);
      let vx = 0;
      let vz = 0;
      if (mag > 0.01) {
        const nx = mx / mag;
        const nz = mz / mag;
        vx = nx * NPC_SPEED;
        vz = nz * NPC_SPEED;
        n.facing = smoothAngle(n.facing, Math.atan2(nx, nz), dt, 6);
      }

      const nextX = n.pos.x + vx * dt;
      if (!collides(nextX, n.pos.z, walls)) {
        n.pos.x = nextX;
      } else {
        n.retargetTimer = 0;
      }
      const nextZ = n.pos.z + vz * dt;
      if (!collides(n.pos.x, nextZ, walls)) {
        n.pos.z = nextZ;
      } else {
        n.retargetTimer = 0;
      }

      n.group.position.copy(n.pos);
      n.group.rotation.y = n.facing;

      const speed = Math.hypot(vx, vz);
      if (speed > 0.05) {
        n.stride += dt * 6;
      } else {
        n.stride *= 0.9;
      }
      const swing = Math.sin(n.stride) * 0.4 * Math.min(1, speed / NPC_SPEED);
      n.leftLeg.rotation.x = swing;
      n.rightLeg.rotation.x = -swing;
      n.leftArm.rotation.x = -swing * 0.7;
      n.rightArm.rotation.x = swing * 0.7;
    }
  }
}

function buildNPC(s: NPCStyle): THREE.Group {
  const g = new THREE.Group();
  const skin = ps2Lambert({ color: s.skin });
  const hair = ps2Lambert({ color: s.hair });
  const shirt = ps2Lambert({ color: 0xf0ece0 });
  const pants = ps2Lambert({ color: s.pants });
  const tie = ps2Lambert({ color: s.tie });
  const shoe = ps2Lambert({ color: 0x0c0b08 });
  const badge = ps2Lambert({ color: 0xe7c66a, emissive: 0x4a3a06 });

  // Torso (camisa blanca)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), shirt);
  torso.position.y = 1.15;
  g.add(torso);

  // Cuello / collar
  const collarL = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.08, 0.04),
    shirt
  );
  collarL.position.set(-0.08, 1.44, 0.145);
  collarL.rotation.z = 0.2;
  const collarR = collarL.clone();
  collarR.position.set(0.08, 1.44, 0.145);
  collarR.rotation.z = -0.2;
  g.add(collarL, collarR);

  // Corbata
  const tieKnot = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.06, 0.02),
    tie
  );
  tieKnot.position.set(0, 1.42, 0.16);
  const tieBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.34, 0.02),
    tie
  );
  tieBody.position.set(0, 1.22, 0.16);
  g.add(tieKnot, tieBody);

  // Tarjeta / badge amarillo en el pecho
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, 0.015),
    badge
  );
  card.position.set(0.14, 1.2, 0.155);
  g.add(card);

  // Cabeza
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
  head.position.y = 1.65;
  g.add(head);

  // Pelo
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), hair);
  hairMesh.position.y = 1.78;
  g.add(hairMesh);
  // Patillas (laterales bajos)
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.32), hair);
  sideL.position.set(-0.15, 1.68, 0);
  const sideR = sideL.clone();
  sideR.position.set(0.15, 1.68, 0);
  g.add(sideL, sideR);

  // Ojos
  const eyeMat = ps2Lambert({ color: 0x141414 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.08, 1.66, 0.151);
  eyeR.position.set(0.08, 1.66, 0.151);
  g.add(eyeL, eyeR);

  if (s.glasses) {
    const frameMat = ps2Lambert({ color: 0x1a1a1a });
    const frameL = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.07, 0.02),
      frameMat
    );
    frameL.position.set(-0.08, 1.66, 0.16);
    const frameR = frameL.clone();
    frameR.position.set(0.08, 1.66, 0.16);
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.02, 0.02),
      frameMat
    );
    bridge.position.set(0, 1.66, 0.16);
    g.add(frameL, frameR, bridge);
  }

  if (s.mustache) {
    const stache = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.035, 0.02),
      hair
    );
    stache.position.set(0, 1.56, 0.155);
    g.add(stache);
  }

  if (s.beard) {
    const beard = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.12, 0.08),
      hair
    );
    beard.position.set(0, 1.5, 0.12);
    g.add(beard);
  }

  // Brazos (camisa blanca, pivotados en el hombro)
  const makeArm = (x: number, name: string) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.45, 0);
    pivot.name = name;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), shirt);
    arm.position.y = -0.25;
    pivot.add(arm);
    // Mano piel
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.08, 0.15),
      skin
    );
    hand.position.set(0, -0.54, 0);
    pivot.add(hand);
    g.add(pivot);
    return pivot;
  };
  makeArm(-0.32, "armL");
  makeArm(0.32, "armR");

  // Piernas (pantalón)
  const makeLeg = (x: number, name: string) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.78, 0);
    pivot.name = name;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), pants);
    leg.position.y = -0.35;
    pivot.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.3), shoe);
    foot.position.set(0, -0.72, 0.05);
    pivot.add(foot);
    g.add(pivot);
    return pivot;
  };
  makeLeg(-0.12, "legL");
  makeLeg(0.12, "legR");

  return g;
}

function collides(x: number, z: number, walls: THREE.Box3[]): boolean {
  for (const b of walls) {
    if (
      x + NPC_RADIUS > b.min.x &&
      x - NPC_RADIUS < b.max.x &&
      z + NPC_RADIUS > b.min.z &&
      z - NPC_RADIUS < b.max.z
    ) {
      return true;
    }
  }
  return false;
}

function smoothAngle(from: number, to: number, dt: number, k: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * (1 - Math.exp(-k * dt));
}
