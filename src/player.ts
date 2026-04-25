import * as THREE from "three";
import { ps2Lambert } from "./ps2";
import type { InputState } from "./controls";
import type { FollowCamera } from "./cam";
import type { RawPlayer } from "./content";
import { parseColor } from "./content";

const WALK_SPEED = 3.2;
const RUN_SPEED = 5.6;
const ACCEL = 18;
const DECEL = 22;
const RADIUS = 0.38;

export type PlayerStyle = {
  id: string;
  name: string;
  skin: number;
  hair: number;
  hairLong: boolean;
  shirt: number;
  pants: number;
  belt?: number;
  glasses: boolean;
  mustache: boolean;
  tattoos: boolean;
  buttons: boolean;
};

export function styleFromRaw(raw: RawPlayer): PlayerStyle {
  return {
    id: raw.id,
    name: raw.name,
    skin: parseColor(raw.style.skin),
    hair: parseColor(raw.style.hair),
    hairLong: raw.style.hairLong,
    shirt: parseColor(raw.style.shirt),
    pants: parseColor(raw.style.pants),
    belt: raw.style.belt ? parseColor(raw.style.belt) : undefined,
    glasses: raw.style.glasses,
    mustache: raw.style.mustache,
    tattoos: raw.style.tattoos,
    buttons: raw.style.buttons,
  };
}

export function pickRandomPlayerStyle(raws: RawPlayer[]): PlayerStyle {
  return styleFromRaw(raws[Math.floor(Math.random() * raws.length)]);
}

/**
 * Agente 0814 — low-poly a base de primitivas, parametrizado por estilo.
 */
export class Player {
  group = new THREE.Group();
  pos = new THREE.Vector3(0, 0, 0);
  vel = new THREE.Vector3();
  style: PlayerStyle;
  private facing = 0;

  private body: THREE.Object3D;
  private leftLeg: THREE.Object3D;
  private rightLeg: THREE.Object3D;
  private leftArm: THREE.Object3D;
  private rightArm: THREE.Object3D;
  private stride = 0;

  constructor(style: PlayerStyle) {
    this.style = style;
    this.body = this.build();
    this.group.add(this.body);

    this.leftLeg = this.body.getObjectByName("legL")!;
    this.rightLeg = this.body.getObjectByName("legR")!;
    this.leftArm = this.body.getObjectByName("armL")!;
    this.rightArm = this.body.getObjectByName("armR")!;
  }

  private build(): THREE.Group {
    const g = new THREE.Group();
    const s = this.style;

    const skin = ps2Lambert({ color: s.skin });
    const hair = ps2Lambert({ color: s.hair });
    const shirt = ps2Lambert({ color: s.shirt });
    const pants = ps2Lambert({ color: s.pants });
    const shoe = ps2Lambert({ color: 0x0c0b08 });
    const badge = ps2Lambert({ color: 0xe7c66a, emissive: 0x5a3a06 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), shirt);
    torso.position.y = 1.15;
    g.add(torso);

    // Cinturón (si corresponde)
    if (s.belt !== undefined) {
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.06, 0.29),
        ps2Lambert({ color: s.belt })
      );
      belt.position.y = 0.83;
      g.add(belt);
    }

    // Botones (3, verticales) — variante diplomática
    if (s.buttons) {
      for (let i = 0; i < 3; i++) {
        const btn = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.04, 0.02),
          badge
        );
        btn.position.set(0, 1.05 - i * 0.08, 0.15);
        g.add(btn);
      }
    }

    // Corazón dorado en el pecho (chunky pixel heart, 3 piezas)
    const heart = new THREE.Group();
    const heartMatGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
    const lobeL = new THREE.Mesh(heartMatGeo, badge);
    const lobeR = new THREE.Mesh(heartMatGeo, badge);
    lobeL.position.set(-0.03, 0.025, 0);
    lobeR.position.set(0.03, 0.025, 0);
    const point = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.075, 0.02),
      badge
    );
    point.position.set(0, -0.018, 0);
    point.rotation.z = Math.PI / 4; // diamante
    heart.add(lobeL, lobeR, point);
    heart.position.set(0.13, 1.22, 0.155);
    heart.name = "badge";
    g.add(heart);

    // Cabeza
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
    head.position.y = 1.65;
    g.add(head);

    // Pelo — corto (top) o largo (hasta los hombros)
    if (s.hairLong) {
      const hairTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.33, 0.12, 0.33),
        hair
      );
      hairTop.position.y = 1.78;
      g.add(hairTop);
      const hairBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.33, 0.36, 0.12),
        hair
      );
      hairBack.position.set(0, 1.58, -0.1);
      g.add(hairBack);
      const hairSideL = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.36, 0.3),
        hair
      );
      hairSideL.position.set(-0.16, 1.58, -0.02);
      const hairSideR = hairSideL.clone();
      hairSideR.position.set(0.16, 1.58, -0.02);
      g.add(hairSideL, hairSideR);
    } else {
      const hairMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.1, 0.32),
        hair
      );
      hairMesh.position.y = 1.78;
      g.add(hairMesh);
    }

    // Ojos
    const eyeMat = ps2Lambert({ color: 0x141414 });
    const eyeL = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.01),
      eyeMat
    );
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.08, 1.66, 0.151);
    eyeR.position.set(0.08, 1.66, 0.151);
    g.add(eyeL, eyeR);

    // Lentes
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

    // Bigote
    if (s.mustache) {
      const stache = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.035, 0.02),
        hair
      );
      stache.position.set(0, 1.56, 0.155);
      g.add(stache);
    }

    // Brazos (pivotados en el hombro)
    const makeArm = (x: number, name: string, side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.45, 0);
      pivot.name = name;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt);
      arm.position.y = -0.3;
      pivot.add(arm);
      // Tatuajes (patrón en los antebrazos) — variante tattoo
      if (s.tattoos) {
        for (let i = 0; i < 3; i++) {
          const ink = new THREE.Mesh(
            new THREE.BoxGeometry(0.145, 0.04, 0.145),
            ps2Lambert({ color: 0x2a1a10 })
          );
          ink.position.set(0, -0.15 - i * 0.08, 0);
          pivot.add(ink);
        }
      }
      // Mano (pixel skin)
      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.08, 0.15),
        skin
      );
      hand.position.set(0, -0.62, 0);
      pivot.add(hand);
      void side;
      g.add(pivot);
      return pivot;
    };
    makeArm(-0.32, "armL", -1);
    makeArm(0.32, "armR", 1);

    // Piernas (pivotadas en la cadera)
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

    g.position.copy(this.pos);
    return g;
  }

  get mesh(): THREE.Group {
    return this.group;
  }

  /** Intensifica el brillo del corazón según cantidad de expedientes */
  setBadgeGlow(count: number) {
    const badge = this.body.getObjectByName("badge") as THREE.Group | undefined;
    if (!badge) return;
    const glow = Math.min(1, count / 10);
    badge.traverse((obj) => {
      const m = obj as THREE.Mesh;
      const mat = m.material as THREE.MeshLambertMaterial | undefined;
      if (mat && (mat as any).emissive) {
        (mat.emissive as THREE.Color).setRGB(
          0.35 + glow * 0.55,
          0.22 + glow * 0.4,
          0.04 + glow * 0.08
        );
      }
    });
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
