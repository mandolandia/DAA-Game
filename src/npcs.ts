import * as THREE from "three";
import type { RawNPCSpawn } from "./content";
import { buildSkinnedCharacter } from "./charSkin";

const NPC_RADIUS = 0.36;
const NPC_SPEED = 1.3;
export const NPC_INTERACT_RANGE = 1.6;

export type NPC = {
  id: string;
  bark: string;
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

export class NPCManager {
  npcs: NPC[] = [];

  constructor(scene: THREE.Scene, spawns: RawNPCSpawn[]) {
    for (const sp of spawns) {
      this.spawn(scene, sp);
    }
  }

  private spawn(scene: THREE.Scene, sp: RawNPCSpawn) {
    const group = buildSkinnedCharacter(`/content/skins/${sp.skin}.png`);
    const pos = new THREE.Vector3(sp.position[0], 0, sp.position[1]);
    group.position.copy(pos);
    scene.add(group);
    this.npcs.push({
      id: sp.id,
      bark: sp.bark,
      group,
      pos,
      facing: Math.random() * Math.PI * 2,
      targetX: sp.position[0],
      targetZ: sp.position[1],
      retargetTimer: Math.random() * 2,
      pauseTimer: 0,
      leftLeg: group.getObjectByName("legL")!,
      rightLeg: group.getObjectByName("legR")!,
      leftArm: group.getObjectByName("armL")!,
      rightArm: group.getObjectByName("armR")!,
      stride: 0,
      homeX: sp.position[0],
      homeZ: sp.position[1],
      homeRadius: sp.radius,
    });
  }

  /** Devuelve el NPC más cercano dentro del rango de interacción, o null. */
  nearestInteractable(playerX: number, playerZ: number): NPC | null {
    let best: NPC | null = null;
    let bestDist = NPC_INTERACT_RANGE;
    for (const n of this.npcs) {
      const dx = n.pos.x - playerX;
      const dz = n.pos.z - playerZ;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  update(dt: number, walls: THREE.Box3[]) {
    for (const n of this.npcs) {
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

      n.retargetTimer -= dt;
      const dxT = n.targetX - n.pos.x;
      const dzT = n.targetZ - n.pos.z;
      const distToTarget = Math.hypot(dxT, dzT);
      if (distToTarget < 0.35 || n.retargetTimer <= 0) {
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
      if (!collides(nextX, n.pos.z, walls)) n.pos.x = nextX;
      else n.retargetTimer = 0;
      const nextZ = n.pos.z + vz * dt;
      if (!collides(n.pos.x, nextZ, walls)) n.pos.z = nextZ;
      else n.retargetTimer = 0;

      n.group.position.copy(n.pos);
      n.group.rotation.y = n.facing;

      const speed = Math.hypot(vx, vz);
      if (speed > 0.05) n.stride += dt * 6;
      else n.stride *= 0.9;
      const swing = Math.sin(n.stride) * 0.4 * Math.min(1, speed / NPC_SPEED);
      n.leftLeg.rotation.x = swing;
      n.rightLeg.rotation.x = -swing;
      n.leftArm.rotation.x = -swing * 0.7;
      n.rightArm.rotation.x = swing * 0.7;
    }
  }
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
