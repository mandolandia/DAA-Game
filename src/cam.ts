import * as THREE from "three";

/**
 * Cámara 3ra persona con yaw manual (swipe) + seguimiento suave.
 * Sin pitch control: pitch fijo, estilo PS2.
 */
export class FollowCamera {
  yaw = 0; // rotación alrededor del player (Y)
  private pitch = -0.28; // inclinación fija, leve hacia abajo
  private distance = 5.2;
  private height = 1.9;
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  update(dt: number, playerPos: THREE.Vector3, lookDX: number) {
    this.yaw += lookDX;

    // Posición deseada detrás del player
    const ox = -Math.sin(this.yaw) * this.distance * Math.cos(this.pitch);
    const oz = -Math.cos(this.yaw) * this.distance * Math.cos(this.pitch);
    const oy = this.height + Math.sin(-this.pitch) * this.distance;

    this.target.set(
      playerPos.x + ox,
      playerPos.y + oy,
      playerPos.z + oz
    );

    // Smooth follow
    const k = 1 - Math.pow(0.0015, dt);
    this.pos.lerp(this.target, k);
    this.camera.position.copy(this.pos);

    // Mirar un pelín por encima del player
    this.look.set(playerPos.x, playerPos.y + 1.2, playerPos.z);
    this.camera.lookAt(this.look);
  }

  /** Vector unitario "forward" según yaw actual (en el plano XZ). */
  forwardXZ(out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    return out;
  }

  rightXZ(out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out;
  }
}
