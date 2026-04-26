/**
 * Mini-viewport 3D para el editor: refleja el contenido actual.
 * Renderizado simple sin texturas; solo formas y colores que comuniquen
 * dónde están las cosas.
 */

import * as THREE from "three";
import type { EditorState } from "./state";

export class Preview3D {
  private root: HTMLElement;
  private state: EditorState;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private dynamicGroup = new THREE.Group();
  private orbit = { yaw: 0.6, pitch: 0.85, dist: 36, target: new THREE.Vector3(0, 0, -2) };
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private rafId = 0;
  private active = false;

  constructor(root: HTMLElement, state: EditorState) {
    this.root = root;
    this.state = state;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene.background = new THREE.Color(0x1a1f2a);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xfff4d0, 0x2a2820, 0.7));
    const dir = new THREE.DirectionalLight(0xfff0c8, 0.6);
    dir.position.set(10, 25, 8);
    this.scene.add(dir);
    this.scene.add(this.dynamicGroup);

    this.root.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.bind();

    state.subscribe(() => {
      if (this.active) this.rebuild();
    });
  }

  setActive(on: boolean) {
    this.active = on;
    if (on) {
      this.resize();
      this.rebuild();
      this.loop();
    } else {
      cancelAnimationFrame(this.rafId);
    }
  }

  private resize() {
    const r = this.root.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }

  private bind() {
    const dom = this.renderer.domElement;
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.root);

    dom.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.orbit.yaw -= dx * 0.005;
      this.orbit.pitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, this.orbit.pitch - dy * 0.005));
    });
    dom.addEventListener("pointerup", () => (this.dragging = false));
    dom.addEventListener("pointercancel", () => (this.dragging = false));
    dom.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      this.orbit.dist = Math.max(8, Math.min(80, this.orbit.dist * factor));
    }, { passive: false });
  }

  private rebuild() {
    if (!this.state.content) return;
    while (this.dynamicGroup.children.length) {
      const o = this.dynamicGroup.children.pop()!;
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
    }

    const c = this.state.content;
    const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
    const wallMat = mat(0xc9b98f);

    // Floors
    for (const z of c.layout.zones) {
      const w = z.x2 - z.x1;
      const d = z.z2 - z.z1;
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat(parseInt(z.color.slice(1), 16)));
      m.position.set((z.x1 + z.x2) / 2, 0, (z.z1 + z.z2) / 2);
      this.dynamicGroup.add(m);
    }

    // Walls
    const WH = 3.0;
    const WT = 0.3;
    for (const wl of c.layout.walls) {
      const dx = wl.x2 - wl.x1;
      const dz = wl.z2 - wl.z1;
      const w = Math.abs(dx);
      const d = Math.abs(dz);
      const isVert = d > w;
      const sx = isVert ? WT : w;
      const sz = isVert ? d : WT;
      const geo = new THREE.BoxGeometry(sx, WH, sz);
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set((wl.x1 + wl.x2) / 2, WH / 2, (wl.z1 + wl.z2) / 2);
      this.dynamicGroup.add(m);
    }

    // Spawn marker (verde)
    const spawnGeo = new THREE.ConeGeometry(0.4, 1.2, 8);
    const spawn = new THREE.Mesh(spawnGeo, mat(0x3ade6a));
    spawn.position.set(c.layout.spawn.x, 0.6, c.layout.spawn.z);
    this.dynamicGroup.add(spawn);

    // NPCs (cilindros con base de radio)
    for (const n of c.npcs) {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.6, 0.4),
        mat(0xf0ece0)
      );
      body.position.set(n.position[0], 0.9, n.position[1]);
      this.dynamicGroup.add(body);

      // Anillo de radio
      const ringGeo = new THREE.RingGeometry(n.radius - 0.05, n.radius, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.4 })
      );
      ring.position.set(n.position[0], 0.02, n.position[1]);
      this.dynamicGroup.add(ring);
    }

    // Props
    for (const p of c.props) {
      let mesh: THREE.Mesh | null = null;
      if (p.type === "box") {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(p.w, p.h, p.d),
          mat(parseInt(p.color.slice(1), 16))
        );
        mesh.position.set(p.cx, p.h / 2, p.cz);
      } else if (p.type === "decor") {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(p.w, p.h, p.d),
          mat(parseInt(p.color.slice(1), 16))
        );
        mesh.position.set(p.x, p.y, p.z);
      } else if (p.type === "chair") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), mat(0x1a1a16));
        mesh.position.set(p.x, 0.45, p.z);
      } else if (p.type === "table") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), mat(0xd0c090));
        mesh.position.set(p.x, 0.9, p.z);
      } else if (p.type === "portrait") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.1), mat(0x3a1a1f));
        mesh.position.set(p.x, p.y, p.z);
      } else if (p.type === "plant") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), mat(0x2a5c3a));
        mesh.position.set(p.x, 0.7, p.z);
      } else if (p.type === "sign") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.1), mat(0xa88b4a));
        mesh.position.set(p.x, p.y, p.z);
      } else if (p.type === "statue") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), mat(0xa8a294));
        mesh.position.set(p.x, 1.1, p.z);
      } else if (p.type === "fountain") {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 12), mat(0x6a5f50));
        mesh.position.set(p.x, 0.25, p.z);
      }
      if (mesh) this.dynamicGroup.add(mesh);
    }

    // Cases (carpetas doradas — mini)
    for (const cs of c.cases) {
      const geo = new THREE.BoxGeometry(0.3, 0.22, 0.07);
      const folder = new THREE.Mesh(geo, mat(0xc4a43c));
      folder.position.set(cs.position[0], cs.position[1], cs.position[2]);
      this.dynamicGroup.add(folder);
    }
  }

  private loop = () => {
    if (!this.active) return;
    this.rafId = requestAnimationFrame(this.loop);

    const cosp = Math.cos(this.orbit.pitch);
    const sinp = Math.sin(this.orbit.pitch);
    const cosy = Math.cos(this.orbit.yaw);
    const siny = Math.sin(this.orbit.yaw);
    this.camera.position.set(
      this.orbit.target.x + this.orbit.dist * cosp * siny,
      this.orbit.target.y + this.orbit.dist * sinp,
      this.orbit.target.z + this.orbit.dist * cosp * cosy
    );
    this.camera.lookAt(this.orbit.target);
    this.renderer.render(this.scene, this.camera);
  };
}
