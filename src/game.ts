import * as THREE from "three";
import { buildWorld, type BuiltWorld } from "./world";
import { Player } from "./player";
import { FollowCamera } from "./cam";
import { TouchControls } from "./controls";
import { PinManager } from "./pins";
import { UI } from "./ui";
import { Audio } from "./audio";

export class Game {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private cam3p: FollowCamera;
  private player: Player;
  private controls: TouchControls;
  private pins: PinManager;
  private ui: UI;
  private audio = new Audio();
  private world: BuiltWorld;
  private clock = new THREE.Clock();
  private running = false;
  private elapsed = 0;
  private finished = false;
  /** Resolución de render (canvas real). Pantalla hace upscale con CSS. */
  private readonly downscale = 3;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.setupScene();

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
    this.cam3p = new FollowCamera(this.camera);
    this.player = new Player();
    // Posición inicial: Recepción, mirando hacia el norte (hacia el pasillo)
    this.player.pos.set(0, 0, 12);
    this.scene.add(this.player.mesh);

    this.world = buildWorld(this.scene);
    this.pins = new PinManager(this.scene, this.world.pinSpots);

    this.ui = new UI({
      onStart: () => this.onStart(),
      onRestart: () => this.onRestart(),
    });

    this.controls = new TouchControls();

    this.onResize();
    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("orientationchange", () =>
      setTimeout(() => this.onResize(), 120)
    );

    this.ui.setCounter(0, this.pins.total);
  }

  private setupScene() {
    // Niebla verde-beige institucional
    const fogColor = new THREE.Color(0x8a9a8a);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.Fog(fogColor, 10, 38);

    const hemi = new THREE.HemisphereLight(0xfff4d0, 0x2a2820, 0.55);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfff0c8, 0.65);
    dir.position.set(10, 25, 8);
    this.scene.add(dir);

    // Ambient leve azulado para el patio
    const amb = new THREE.AmbientLight(0x404860, 0.15);
    this.scene.add(amb);
  }

  private onResize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const rw = Math.max(160, Math.floor(W / this.downscale));
    const rh = Math.max(120, Math.floor(H / this.downscale));
    this.renderer.setSize(rw, rh, false);
    this.canvas.style.width = W + "px";
    this.canvas.style.height = H + "px";
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }

  start() {
    // Render un frame estático ya para que se vea el fondo detrás del intro
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }

  private onStart() {
    if (this.running) return;
    // Audio puede fallar en navegadores restrictivos — no bloquear el arranque.
    try {
      this.audio.resume();
      this.audio.startMuzak();
      this.audio.click();
    } catch (err) {
      console.warn("Audio init falló:", err);
    }
    this.ui.hideIntro();
    this.clock.start();
    this.running = true;
  }

  private onRestart() {
    window.location.reload();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.running && !this.finished) {
      this.elapsed += dt;
      const input = this.controls.poll();

      this.player.update(dt, input, this.world.walls, this.cam3p);
      this.cam3p.update(dt, this.player.pos, input.lookDX, this.world.walls);

      const collected = this.pins.update(dt, this.player.pos, input.interactPressed);
      if (collected) {
        this.audio.tintineo();
        this.ui.showPlacard(collected, this.pins.collected, this.pins.total);
        this.ui.setCounter(this.pins.collected, this.pins.total);
        this.player.setBadgeGlow(this.pins.collected);

        if (this.pins.collected >= this.pins.total) {
          this.finished = true;
          // Pequeño delay para oír el último tintineo
          setTimeout(() => {
            this.audio.campana();
            this.ui.showOutro(this.elapsed, this.computeRank(this.elapsed));
          }, 900);
        }
      }
      this.ui.setPrompt(this.pins.nearbyPrompt());

      // Ubicación actual por zonas
      const zoneName = this.currentZone();
      this.ui.setLocation(zoneName);

      // Pasos
      const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
      this.audio.stepTick(dt, speed, input.run);

      this.ui.updatePlacard(dt);
    } else {
      // Cámara sigue animando sutilmente para el fondo
      this.cam3p.update(
        dt,
        this.player.pos,
        0.02 * dt * 60,
        this.world.walls
      );
    }

    this.renderer.render(this.scene, this.camera);
  };

  private currentZone(): string {
    const { x, z } = this.player.pos;
    for (const zn of this.world.zones) {
      if (x >= zn.x1 && x <= zn.x2 && z >= zn.z1 && z <= zn.z2) {
        return zn.name;
      }
    }
    return "";
  }

  private computeRank(seconds: number): string {
    if (seconds < 300) return "AGENTE DEL MES";
    if (seconds < 600) return "AGENTE MERITORIO";
    if (seconds < 1200) return "AGENTE DILIGENTE";
    return "AGENTE EN SERVICIO";
  }
}
