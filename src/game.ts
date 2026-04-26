import * as THREE from "three";
import { buildWorld, type BuiltWorld } from "./world";
import { Player, pickRandomPlayerStyle } from "./player";
import { FollowCamera } from "./cam";
import { TouchControls } from "./controls";
import { CaseManager } from "./pins";
import { NPCManager } from "./npcs";
import { UI } from "./ui";
import { Audio } from "./audio";
import type { ContentBundle } from "./content";

export class Game {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private cam3p: FollowCamera;
  private player: Player;
  private controls: TouchControls;
  private cases: CaseManager;
  private npcs: NPCManager;
  private ui: UI;
  private audio = new Audio();
  private world: BuiltWorld;
  private clock = new THREE.Clock();
  private running = false;
  private elapsed = 0;
  private finished = false;
  private content: ContentBundle;
  private projVec = new THREE.Vector3();
  /** Resolución de render (canvas real). Pantalla hace upscale con CSS. */
  private readonly downscale = 3;

  constructor(private canvas: HTMLCanvasElement, content: ContentBundle) {
    this.content = content;
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
    this.player = new Player(pickRandomPlayerStyle(content.players));
    this.player.pos.set(0, 0, 12);
    this.scene.add(this.player.mesh);

    this.world = buildWorld(this.scene, content.cases, content.props);
    this.cases = new CaseManager(this.scene, this.world.caseFiles);
    this.npcs = new NPCManager(this.scene, content.npcs);

    this.ui = new UI({
      onStart: () => this.onStart(),
      onRestart: () => this.onRestart(),
      texts: content.texts,
    });

    this.controls = new TouchControls();

    this.onResize();
    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("orientationchange", () =>
      setTimeout(() => this.onResize(), 120)
    );

    this.ui.setCounter(0, this.cases.total);
  }

  private setupScene() {
    const fogColor = new THREE.Color(0x8a9a8a);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.Fog(fogColor, 10, 38);

    const hemi = new THREE.HemisphereLight(0xfff4d0, 0x2a2820, 0.55);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfff0c8, 0.65);
    dir.position.set(10, 25, 8);
    this.scene.add(dir);

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
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }

  private onStart() {
    if (this.running) return;
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

  /** Proyecta una posición de mundo (x,1.9,z) a píxeles de pantalla. */
  private projectToScreen(x: number, z: number): { sx: number; sy: number } | null {
    this.projVec.set(x, 1.9, z);
    this.projVec.project(this.camera);
    if (this.projVec.z > 1) return null; // detrás de la cámara
    const sx = (this.projVec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-this.projVec.y * 0.5 + 0.5) * window.innerHeight;
    return { sx, sy };
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.running && !this.finished) {
      this.elapsed += dt;
      const input = this.controls.poll();

      this.player.update(dt, input, this.world.walls, this.cam3p);
      this.cam3p.update(dt, this.player.pos, input.lookDX, this.world.walls);
      this.npcs.update(dt, this.world.walls);

      const canPick = !this.ui.isPlacardOpen();
      const collected = this.cases.update(dt, this.player.pos, canPick && input.interactPressed);
      if (collected) {
        this.audio.tintineo();
        this.ui.showPlacard(collected, this.cases.collected);
        this.ui.setCounter(this.cases.collected, this.cases.total);
        this.player.setBadgeGlow(this.cases.collected);

        if (this.cases.collected >= this.cases.total) {
          this.finished = true;
          setTimeout(() => {
            this.audio.campana();
            this.ui.showOutro(this.elapsed, this.ui.computeRank(this.elapsed));
          }, 900);
        }
      }

      for (const obj of this.world.interactables) obj.update(dt);
      const nearObj = this.world.interactables.find((obj) => {
        if (obj.activated) return false;
        const dx = obj.mesh.position.x - this.player.pos.x;
        const dz = obj.mesh.position.z - this.player.pos.z;
        return Math.hypot(dx, dz) < obj.range;
      }) ?? null;
      if (nearObj && input.interactPressed && !collected && canPick) {
        nearObj.activate();
        try { this.audio.click(); } catch (_) {}
      }

      // NPC bark: si A presionada cerca de un NPC y no se colectó / activó nada
      const nearNPC = this.npcs.nearestInteractable(this.player.pos.x, this.player.pos.z);
      if (
        nearNPC &&
        input.interactPressed &&
        canPick &&
        !collected &&
        !nearObj
      ) {
        this.ui.showBark(nearNPC.bark, () => ({ x: nearNPC.pos.x, z: nearNPC.pos.z }));
        nearNPC.pauseTimer = 4; // se planta a hablar
        try { this.audio.click(); } catch (_) {}
      }

      // Prompt prioridad: pin > interactuable > NPC
      let promptText = this.cases.nearbyPrompt();
      if (!promptText && nearObj) promptText = nearObj.prompt;
      if (!promptText && nearNPC) promptText = this.content.texts.prompts.talkNPC;
      this.ui.setPrompt(promptText);

      const zoneName = this.currentZone();
      this.ui.setLocation(zoneName);

      const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
      this.audio.stepTick(dt, speed, input.run);
    } else {
      this.cam3p.update(
        dt,
        this.player.pos,
        0.02 * dt * 60,
        this.world.walls
      );
    }

    this.ui.updateBark(dt, (x, z) => this.projectToScreen(x, z));

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
}
