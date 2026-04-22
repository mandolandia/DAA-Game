export type InputState = {
  mx: number; // -1..1
  my: number; // -1..1 (+ = adelante)
  run: boolean;
  /** true sólo el frame en que se presionó A */
  interactPressed: boolean;
  /** Delta de giro horizontal de cámara por swipe (radianes) */
  lookDX: number;
};

/**
 * Controles touch:
 *  - mitad izquierda o joystick: mover
 *  - botón A: interactuar (edge-triggered)
 *  - botón B: correr (sostener)
 *  - swipe en mitad derecha (fuera de botones): rotar cámara
 *  - teclado WASD / shift / E para desktop testing
 */
export class TouchControls {
  private state: InputState = {
    mx: 0,
    my: 0,
    run: false,
    interactPressed: false,
    lookDX: 0,
  };

  // stick
  private stickEl: HTMLElement;
  private nubEl: HTMLElement;
  private stickActive = false;
  private stickPointerId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private readonly stickRadius = 50;

  // camera swipe
  private lookPointerId: number | null = null;
  private lookLastX = 0;
  private accumLookDX = 0;

  // buttons
  private btnA: HTMLElement;
  private btnB: HTMLElement;
  private aPressedEdge = false;

  // keyboard
  private keys = new Set<string>();

  constructor() {
    this.stickEl = document.getElementById("stick")!;
    this.nubEl = document.getElementById("nub")!;
    this.btnA = document.getElementById("btnA")!;
    this.btnB = document.getElementById("btnB")!;
    this.bind();
  }

  private bind() {
    // Stick via pointer events
    const onStickDown = (e: PointerEvent) => {
      if (this.stickPointerId !== null) return;
      const r = this.stickEl.getBoundingClientRect();
      this.stickOrigin.x = r.left + r.width / 2;
      this.stickOrigin.y = r.top + r.height / 2;
      this.stickPointerId = e.pointerId;
      this.stickActive = true;
      this.updateStick(e.clientX, e.clientY);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const onStickMove = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.updateStick(e.clientX, e.clientY);
    };
    const onStickUp = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.stickActive = false;
      this.state.mx = 0;
      this.state.my = 0;
      this.nubEl.style.transform = "translate(0px, 0px)";
    };
    this.stickEl.addEventListener("pointerdown", onStickDown);
    this.stickEl.addEventListener("pointermove", onStickMove);
    this.stickEl.addEventListener("pointerup", onStickUp);
    this.stickEl.addEventListener("pointercancel", onStickUp);
    this.stickEl.addEventListener("pointerleave", onStickUp);

    // Buttons
    const setBtn = (el: HTMLElement, onDown: () => void, onUp: () => void) => {
      el.addEventListener("pointerdown", (e) => {
        onDown();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      el.addEventListener("pointerleave", onUp);
    };
    setBtn(
      this.btnA,
      () => {
        this.aPressedEdge = true;
      },
      () => {}
    );
    setBtn(
      this.btnB,
      () => {
        this.state.run = true;
      },
      () => {
        this.state.run = false;
      }
    );

    // Camera swipe: sobre el canvas, lado derecho y arriba de los botones
    const canvas = document.getElementById("game")!;
    canvas.addEventListener("pointerdown", (e) => {
      if (this.lookPointerId !== null) return;
      // Solo mitad derecha y en zona alta para no chocar con el stick/botones.
      if (e.clientX < window.innerWidth * 0.45) return;
      if (e.clientY > window.innerHeight - 180) return;
      this.lookPointerId = e.pointerId;
      this.lookLastX = e.clientX;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.lookPointerId) return;
      const dx = e.clientX - this.lookLastX;
      this.lookLastX = e.clientX;
      // Convertir píxeles a radianes (negativo = swipe derecho rota cámara a la derecha)
      this.accumLookDX += -dx * 0.005;
    });
    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
    };
    canvas.addEventListener("pointerup", endLook);
    canvas.addEventListener("pointercancel", endLook);

    // Keyboard (desktop testing)
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === "e") this.aPressedEdge = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    // Evitar scroll en iOS
    document.addEventListener(
      "touchmove",
      (e) => {
        if ((e.target as HTMLElement).closest("#ui, canvas#game")) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  private updateStick(clientX: number, clientY: number) {
    let dx = clientX - this.stickOrigin.x;
    let dy = clientY - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > this.stickRadius) {
      dx = (dx / len) * this.stickRadius;
      dy = (dy / len) * this.stickRadius;
    }
    this.state.mx = dx / this.stickRadius;
    this.state.my = -dy / this.stickRadius; // pantalla Y invertida
    this.nubEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** Leer estado de este frame y consumir eventos edge-triggered. */
  poll(): InputState {
    // Keyboard overrides
    const k = this.keys;
    let kmx = 0;
    let kmy = 0;
    if (k.has("w") || k.has("arrowup")) kmy += 1;
    if (k.has("s") || k.has("arrowdown")) kmy -= 1;
    if (k.has("a") || k.has("arrowleft")) kmx -= 1;
    if (k.has("d") || k.has("arrowright")) kmx += 1;
    const krun = k.has("shift");

    const mx = this.stickActive ? this.state.mx : kmx;
    const my = this.stickActive ? this.state.my : kmy;
    const run = this.state.run || krun;

    // Clamp magnitude
    const mag = Math.hypot(mx, my);
    const nmx = mag > 1 ? mx / mag : mx;
    const nmy = mag > 1 ? my / mag : my;

    const lookDX = this.accumLookDX;
    this.accumLookDX = 0;

    const interactPressed = this.aPressedEdge;
    this.aPressedEdge = false;

    return {
      mx: nmx,
      my: nmy,
      run,
      interactPressed,
      lookDX,
    };
  }
}
