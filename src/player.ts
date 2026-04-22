import * as THREE from "three";
import { ps2Lambert } from "./ps2";
import type { InputState } from "./controls";
import type { FollowCamera } from "./cam";

const WALK_SPEED = 3.2;
const RUN_SPEED = 5.6;
const ACCEL = 18;
const DECEL = 22;
const RADIUS = 0.38;

/**
 * Agente 0814 — low-poly a base de primitivas.
 * Colisiones 2D (XZ) contra una lista de Box3 (walls).
 */
export class Player {
  group = new THREE.Group();
  pos = new THREE.Vector3(0, 0, 0);
  vel = new THREE.Vector3();
  private facing = 0;

  private body: THREE.Object3D;
  private leftLeg: THREE.Object3D;
  private rightLeg: THREE.Object3D;
  private leftArm: THREE.Object3D;
  private rightArm: THREE.Object3D;
  private stride = 0;

  constructor() {
    this.body = this.build();
    this.group.add(this.body);

    // Referencias a piernas/brazos para animación
    this.leftLeg = this.body.getObjectByName("legL")!;
    this.rightLeg = this.body.getObjectByName("legR")!;
    this.leftArm = this.body.getObjectByName("armL")!;
    this.rightArm = this.body.getObjectByName("armR")!;
  }

  private build(): THREE.Group {
    const g = new THREE.Group();

    // Colores institucionales
    const suit = ps2Lambert({ color: 0x2a2a36 }); // traje gris azulado
    const shirt = ps2Lambert({ color: 0xeae3c9 }); // camisa clara
    const skin = ps2Lambert({ color: 0xcfa57a });
    const hair = ps2Lambert({ color: 0x2b1a10 });
    const tie = ps2Lambert({ color: 0x5a1d26 });
    const shoe = ps2Lambert({ color: 0x12100c });
    const badge = ps2Lambert({ color: 0xe7c66a, emissive: 0x3a2a06 });

    // Torso (caja)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), suit);
    torso.position.y = 1.15;
    g.add(torso);

    // Camisa (cuadrado adelante)
    const shirtMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.02), shirt);
    shirtMesh.position.set(0, 1.18, 0.15);
    g.add(shirtMesh);

    // Corbata
    const tieMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.02), tie);
    tieMesh.position.set(0, 1.1, 0.16);
    g.add(tieMesh);

    // Pin de bolsillo (cambia con pins recogidos — lo expongo)
    const badgeMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 12),
      badge
    );
    badgeMesh.position.set(0.15, 1.22, 0.155);
    badgeMesh.name = "badge";
    g.add(badgeMesh);

    // Cabeza
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
    head.position.y = 1.65;
    g.add(head);

    // Pelo
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), hair);
    hairMesh.position.y = 1.78;
    g.add(hairMesh);

    // Ojos (puntos)
    const eyeMat = ps2Lambert({ color: 0x141414 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), eyeMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.08, 1.66, 0.151);
    eyeR.position.set(0.08, 1.66, 0.151);
    g.add(eyeL, eyeR);

    // Brazos (pivotados en el hombro)
    const makeArm = (x: number, name: string) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.45, 0);
      pivot.name = name;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), suit);
      arm.position.y = -0.3;
      pivot.add(arm);
      g.add(pivot);
      return pivot;
    };
    makeArm(-0.32, "armL");
    makeArm(0.32, "armR");

    // Piernas (pivotadas en la cadera)
    const makeLeg = (x: number, name: string) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.78, 0);
      pivot.name = name;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), suit);
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

    // Tarjeta colgante (lanyard)
    const lanyard = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.02),
      ps2Lambert({ color: 0xf0e5c5 })
    );
    lanyard.position.set(0, 1.32, 0.16);
    g.add(lanyard);

    g.position.copy(this.pos);
    return g;
  }

  get mesh(): THREE.Group {
    return this.group;
  }

  /** Resalta el badge dorado según cantidad de pins */
  setBadgeGlow(count: number) {
    const badge = this.body.getObjectByName("badge") as THREE.Mesh | undefined;
    if (!badge) return;
    const mat = badge.material as THREE.MeshLambertMaterial;
    const glow = Math.min(1, count / 10);
    (mat.emissive as THREE.Color).setRGB(
      0.25 + glow * 0.6,
      0.18 + glow * 0.45,
      0.04 + glow * 0.1
    );
  }

  update(
    dt: number,
    input: InputState,
    walls: THREE.Box3[],
    cam: FollowCamera
  ) {
    // Dirección de input en world-space relativa a la cámara
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
      // Facing suavizado
      this.facing = smoothAngle(this.facing, Math.atan2(nx, nz), dt, 12);
      // Acelerar hacia el vector
      this.vel.x = approach(this.vel.x, nx * targetSpeed, ACCEL * dt);
      this.vel.z = approach(this.vel.z, nz * targetSpeed, ACCEL * dt);
    } else {
      // Desacelerar
      this.vel.x = approach(this.vel.x, 0, DECEL * dt);
      this.vel.z = approach(this.vel.z, 0, DECEL * dt);
    }

    // Aplicar velocidad con colisiones por eje (slide)
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

    // Animación de caminar
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
