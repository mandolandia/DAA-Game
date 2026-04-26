import * as THREE from "three";
import type { InputState } from "./controls";
import type { FollowCamera } from "./cam";
import type { RawPlayer } from "./content";
import { buildSkinnedCharacter } from "./charSkin";

const WALK_SPEED = 3.2;
const RUN_SPEED = 5.6;
const ACCEL = 18;
const DECEL = 22;
const RADIUS = 0.38;

export type PlayerStyle = {
  id: string;
  name: string;
  skin: string; // skin slot id (e.g. "player-tattoo")
};

export function styleFromRaw(raw: RawPlayer): PlayerStyle {
  return {
    id: raw.id,
    name: raw.name,
    skin: raw.skin,
  };
}

export function pickRandomPlayerStyle(raws: RawPlayer[]): PlayerStyle {
  return styleFromRaw(raws[Math.floor(Math.random() * raws.length)]);
}

export class Player {
  group = new THREE.Group();
  pos = new THREE.Vector3(0, 0, 0);
  vel = new THREE.Vector3();
  style: PlayerStyle;
  private facing = 0;

  private body: THREE.Group;
  private leftLeg: THREE.Object3D;
  private rightLeg: THREE.Object3D;
  private leftArm: THREE.Object3D;
  private rightArm: THREE.Object3D;
  private stride = 0;

  constructor(style: PlayerStyle) {
    this.style = style;
    this.body = buildSkinnedCharacter(`/content/skins/${style.skin}.png`);
    this.group.add(this.body);

    this.leftLeg = this.body.getObjectByName("legL")!;
    this.rightLeg = this.body.getObjectByName("legR")!;
    this.leftArm = this.body.getObjectByName("armL")!;
    this.rightArm = this.body.getObjectByName("armR")!;
  }

  get mesh(): THREE.Group {
    return this.group;
  }

  /** Stub: con texturas el "glow del corazón" se manejaría como overlay; por ahora sin efecto. */
  setBadgeGlow(_count: number) {
    // intentionally empty — phase 4 dropped the procedural badge
  }

  update(
    dt: number,
    input: InputState,
    walls: THREE.Box3[],
    cam: FollowCamera
  ) {
    const fwd = cam.forwardXZ(_v1);
    const right = cam.rightXZ(_v2);
    const dir = _v3.set(0, 0, 0);
    dir.addScaledVector(fwd, input.my);
    dir.addScaledVector(right, input.mx);

    const mag = Math.hypot(dir.x, dir.z);
    const targetSpeed = (input.run ? RUN_SPEED : WALK_SPEED) * Math.min(1, mag);

    if (mag > 0.01) {
      const nx = dir.x / mag;
      const nz = dir.z / mag;
      this.facing = smoothAngle(this.facing, Math.atan2(nx, nz), dt, 12);
      this.vel.x = approach(this.vel.x, nx * targetSpeed, ACCEL * dt);
      this.vel.z = approach(this.vel.z, nz * targetSpeed, ACCEL * dt);
    } else {
      this.vel.x = approach(this.vel.x, 0, DECEL * dt);
      this.vel.z = approach(this.vel.z, 0, DECEL * dt);
    }

    const nextX = this.pos.x + this.vel.x * dt;
    if (!collides(nextX, this.pos.z, walls)) {
      this.pos.x = nextX;
    } else {
      this.vel.x = 0;
    }
    const nextZ = this.pos.z + this.vel.z * dt;
    if (!collides(this.pos.x, nextZ, walls)) {
      this.pos.z = nextZ;
    } else {
      this.vel.z = 0;
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const strideSpeed = input.run ? 12 : 7;
    if (speed > 0.05) {
      this.stride += dt * strideSpeed;
    } else {
      this.stride *= 0.9;
    }
    const swing = Math.sin(this.stride) * 0.5 * Math.min(1, speed / WALK_SPEED);
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.7;
    this.rightArm.rotation.x = swing * 0.7;
  }
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

function collides(x: number, z: number, walls: THREE.Box3[]): boolean {
  for (const b of walls) {
    if (
      x + RADIUS > b.min.x &&
      x - RADIUS < b.max.x &&
      z + RADIUS > b.min.z &&
      z - RADIUS < b.max.z
    ) {
      return true;
    }
  }
  return false;
}

function approach(from: number, to: number, by: number): number {
  if (from < to) return Math.min(from + by, to);
  if (from > to) return Math.max(from - by, to);
  return to;
}

function smoothAngle(from: number, to: number, dt: number, k: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * (1 - Math.exp(-k * dt));
}
