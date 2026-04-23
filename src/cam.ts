import * as THREE from "three";

/**
 * Cámara 3ra persona con yaw manual (swipe) + seguimiento suave +
 * auto-pivot cuando una pared bloquea la vista al personaje.
 *
 * Estrategia anti-oclusión:
 *  1. Si el usuario no está girando con swipe y una pared bloquea la línea
 *     de visión hacia la posición ideal de cámara, rotamos yaw hacia el
 *     ángulo libre más cercano a velocidad limitada (sensación "swing").
 *  2. Como red de seguridad, raycast desde el ojo del agente hacia la
 *     posición ideal: si hay un golpe, acercamos la cámara hasta el punto
 *     de impacto menos un margen.
 */
export class FollowCamera {
  yaw = 0;
  private pitch = -0.28;
  private distance = 5.2;
  private minDistance = 1.6;
  private height = 1.9;
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  update(
    dt: number,
    playerPos: THREE.Vector3,
    lookDX: number,
    walls: THREE.Box3[]
  ) {
    this.yaw += lookDX;

    const eye = _eye.set(playerPos.x, playerPos.y + 1.2, playerPos.z);
    const userTurning = Math.abs(lookDX) > 0.001;

    // 1. Auto-pivot cuando hay pared bloqueando y el usuario no está girando.
    if (!userTurning && this.isYawBlocked(this.yaw, eye, walls)) {
      const bestDelta = this.findClearestYawDelta(eye, walls);
      if (bestDelta !== 0) {
        const ROT_SPEED = 4; // rad/s
        const maxStep = ROT_SPEED * dt;
        const step =
          Math.sign(bestDelta) * Math.min(Math.abs(bestDelta), maxStep);
        this.yaw += step;
      }
    }

    // 2. Calcular posición ideal con yaw final.
    const cosp = Math.cos(this.pitch);
    const ox = -Math.sin(this.yaw) * this.distance * cosp;
    const oz = -Math.cos(this.yaw) * this.distance * cosp;
    const oy = this.height + Math.sin(-this.pitch) * this.distance;
    this.target.set(playerPos.x + ox, playerPos.y + oy, playerPos.z + oz);

    // 3. Pull-in: si todavía hay pared, acercar cámara hasta el hit.
    const dir = _dir.subVectors(this.target, eye);
    const fullDist = dir.length();
    if (fullDist > 0.0001) {
      dir.divideScalar(fullDist);
      const ray = _ray;
      ray.origin.copy(eye);
      ray.direction.copy(dir);
      let nearest = fullDist;
      for (const wall of walls) {
        const hit = ray.intersectBox(wall, _hit);
        if (hit) {
          const d = hit.distanceTo(eye);
          if (d < nearest) nearest = d;
        }
      }
      const finalDist = Math.max(this.minDistance, nearest - 0.35);
      this.target.copy(eye).addScaledVector(dir, finalDist);
    }

    // 4. Seguimiento suave.
    const k = 1 - Math.pow(0.0015, dt);
    this.pos.lerp(this.target, k);
    this.camera.position.copy(this.pos);

    this.look.set(playerPos.x, playerPos.y + 1.2, playerPos.z);
    this.camera.lookAt(this.look);
  }

  /** Vector unitario "forward" según yaw actual (en el plano XZ). */
  forwardXZ(out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    return out;
  }

  rightXZ(out: THREE.Vector3): THREE.Vector3 {
    // El "derecha" de la cámara en world-space.
    // Como la cámara mira hacia +Z del player (yaw=0), su +X local es world -X.
    out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    return out;
  }

  /** ¿Hay pared entre el ojo del player y la cámara ideal para este yaw? */
  private isYawBlocked(
    yaw: number,
    eye: THREE.Vector3,
    walls: THREE.Box3[]
  ): boolean {
    const cosp = Math.cos(this.pitch);
    const ox = -Math.sin(yaw) * this.distance * cosp;
    const oz = -Math.cos(yaw) * this.distance * cosp;
    const oy = this.height + Math.sin(-this.pitch) * this.distance;
    const camPos = _vc.set(eye.x + ox, eye.y - 1.2 + oy, eye.z + oz);
    const dir = _vd.subVectors(camPos, eye);
    const len = dir.length();
    if (len < 0.001) return false;
    dir.divideScalar(len);
    const ray = _ray2;
    ray.origin.copy(eye);
    ray.direction.copy(dir);
    for (const wall of walls) {
      const hit = ray.intersectBox(wall, _vh);
      if (hit) {
        const d = hit.distanceTo(eye);
        if (d < len - 0.05) return true;
      }
    }
    return false;
  }

  /**
   * Busca el delta angular más chico (positivo o negativo) que da una vista
   * sin bloqueo. Devuelve 0 si no encontró ninguno (todo bloqueado alrededor).
   */
  private findClearestYawDelta(
    eye: THREE.Vector3,
    walls: THREE.Box3[]
  ): number {
    const STEP = Math.PI / 12; // 15° por sample
    for (let i = 1; i <= 12; i++) {
      const a = STEP * i;
      const leftClear = !this.isYawBlocked(this.yaw + a, eye, walls);
      const rightClear = !this.isYawBlocked(this.yaw - a, eye, walls);
      if (leftClear && rightClear) {
        return a; // ambos sirven, ir hacia el +
      }
      if (leftClear) return a;
      if (rightClear) return -a;
    }
    return 0;
  }
}

// Scratch vectors (evitar allocs por frame)
const _eye = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _vc = new THREE.Vector3();
const _vd = new THREE.Vector3();
const _vh = new THREE.Vector3();
const _ray = new THREE.Ray();
const _ray2 = new THREE.Ray();
