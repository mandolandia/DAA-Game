/**
 * Personaje texturizado con UV map estilo Minecraft (64x64).
 *
 * Layout de la skin (en píxeles del PNG 64×64):
 *
 *   Cabeza  → Top/Bot @ y=0..8 cols 8..24 ;  Right/Front/Left/Back @ y=8..16 cols 0..32
 *   Body    → Top/Bot @ y=16..20 cols 20..36 ; Right/Front/Left/Back @ y=20..32 cols 16..40
 *   Right Arm → cols 40..56, y=16..32
 *   Right Leg → cols 0..16,  y=16..32
 *   Left Arm  → cols 32..48, y=48..64
 *   Left Leg  → cols 16..32, y=48..64
 *
 * Cada cara (top, bottom, right, front, left, back) ocupa un rectángulo en el PNG;
 * setUVForFace() escribe los 4 UVs del face correspondiente del BoxGeometry.
 */

import * as THREE from "three";

const TEX_W = 64;
const TEX_H = 64;

type FaceRegion = { x: number; y: number; w: number; h: number };
type PartRegions = {
  right: FaceRegion;
  left: FaceRegion;
  top: FaceRegion;
  bottom: FaceRegion;
  front: FaceRegion;
  back: FaceRegion;
};

const LAYOUT: Record<string, PartRegions> = {
  head: {
    right:  { x: 0,  y: 8,  w: 8,  h: 8 },
    front:  { x: 8,  y: 8,  w: 8,  h: 8 },
    left:   { x: 16, y: 8,  w: 8,  h: 8 },
    back:   { x: 24, y: 8,  w: 8,  h: 8 },
    top:    { x: 8,  y: 0,  w: 8,  h: 8 },
    bottom: { x: 16, y: 0,  w: 8,  h: 8 },
  },
  body: {
    right:  { x: 16, y: 20, w: 4,  h: 12 },
    front:  { x: 20, y: 20, w: 8,  h: 12 },
    left:   { x: 28, y: 20, w: 4,  h: 12 },
    back:   { x: 32, y: 20, w: 8,  h: 12 },
    top:    { x: 20, y: 16, w: 8,  h: 4 },
    bottom: { x: 28, y: 16, w: 8,  h: 4 },
  },
  rightArm: {
    right:  { x: 40, y: 20, w: 4, h: 12 },
    front:  { x: 44, y: 20, w: 4, h: 12 },
    left:   { x: 48, y: 20, w: 4, h: 12 },
    back:   { x: 52, y: 20, w: 4, h: 12 },
    top:    { x: 44, y: 16, w: 4, h: 4 },
    bottom: { x: 48, y: 16, w: 4, h: 4 },
  },
  rightLeg: {
    right:  { x: 0,  y: 20, w: 4, h: 12 },
    front:  { x: 4,  y: 20, w: 4, h: 12 },
    left:   { x: 8,  y: 20, w: 4, h: 12 },
    back:   { x: 12, y: 20, w: 4, h: 12 },
    top:    { x: 4,  y: 16, w: 4, h: 4 },
    bottom: { x: 8,  y: 16, w: 4, h: 4 },
  },
  leftArm: {
    right:  { x: 32, y: 52, w: 4, h: 12 },
    front:  { x: 36, y: 52, w: 4, h: 12 },
    left:   { x: 40, y: 52, w: 4, h: 12 },
    back:   { x: 44, y: 52, w: 4, h: 12 },
    top:    { x: 36, y: 48, w: 4, h: 4 },
    bottom: { x: 40, y: 48, w: 4, h: 4 },
  },
  leftLeg: {
    right:  { x: 16, y: 52, w: 4, h: 12 },
    front:  { x: 20, y: 52, w: 4, h: 12 },
    left:   { x: 24, y: 52, w: 4, h: 12 },
    back:   { x: 28, y: 52, w: 4, h: 12 },
    top:    { x: 20, y: 48, w: 4, h: 4 },
    bottom: { x: 24, y: 48, w: 4, h: 4 },
  },
};

/** Three.js BoxGeometry face order: 0=+X(right) 1=-X(left) 2=+Y(top) 3=-Y(bottom) 4=+Z(front) 5=-Z(back) */
function setFaceUV(geo: THREE.BoxGeometry, faceIdx: number, region: FaceRegion) {
  const u0 = region.x / TEX_W;
  const u1 = (region.x + region.w) / TEX_W;
  const v0 = 1 - (region.y + region.h) / TEX_H;
  const v1 = 1 - region.y / TEX_H;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const i = faceIdx * 4;
  // Vertex order in BoxGeometry per face: TL, TR, BL, BR
  uv.setXY(i + 0, u0, v1);
  uv.setXY(i + 1, u1, v1);
  uv.setXY(i + 2, u0, v0);
  uv.setXY(i + 3, u1, v0);
  uv.needsUpdate = true;
}

function applyPartUVs(geo: THREE.BoxGeometry, regions: PartRegions) {
  setFaceUV(geo, 0, regions.right);
  setFaceUV(geo, 1, regions.left);
  setFaceUV(geo, 2, regions.top);
  setFaceUV(geo, 3, regions.bottom);
  setFaceUV(geo, 4, regions.front);
  setFaceUV(geo, 5, regions.back);
}

const textureCache = new Map<string, THREE.Texture>();

function loadSkinTexture(url: string): THREE.Texture {
  const cached = textureCache.get(url);
  if (cached) return cached;
  const tex = new THREE.TextureLoader().load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  textureCache.set(url, tex);
  return tex;
}

/**
 * Construye un personaje voxel texturizado con la skin del URL provisto.
 * Devuelve un Group con limbs nombrados (legL, legR, armL, armR) listos
 * para animar (rotation.x).
 */
export function buildSkinnedCharacter(skinUrl: string): THREE.Group {
  const g = new THREE.Group();
  const tex = loadSkinTexture(skinUrl);
  const mat = new THREE.MeshLambertMaterial({ map: tex });

  // Dimensiones (mantengo proporciones cercanas a la rig original)
  const HEAD = { w: 0.4, h: 0.4, d: 0.4 };
  const BODY = { w: 0.5, h: 0.7, d: 0.28 };
  const ARM  = { w: 0.16, h: 0.6, d: 0.16 };
  const LEG  = { w: 0.18, h: 0.7, d: 0.2 };

  // Body
  const bodyGeo = new THREE.BoxGeometry(BODY.w, BODY.h, BODY.d);
  applyPartUVs(bodyGeo, LAYOUT.body);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 1.15;
  g.add(body);

  // Head
  const headGeo = new THREE.BoxGeometry(HEAD.w, HEAD.h, HEAD.d);
  applyPartUVs(headGeo, LAYOUT.head);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 1.7;
  g.add(head);

  // Arms (pivotados en el hombro)
  const makeArm = (x: number, name: string, regions: PartRegions) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.45, 0);
    pivot.name = name;
    const armGeo = new THREE.BoxGeometry(ARM.w, ARM.h, ARM.d);
    applyPartUVs(armGeo, regions);
    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.y = -ARM.h / 2;
    pivot.add(arm);
    g.add(pivot);
  };
  makeArm(-(BODY.w / 2 + ARM.w / 2), "armL", LAYOUT.leftArm);
  makeArm(+(BODY.w / 2 + ARM.w / 2), "armR", LAYOUT.rightArm);

  // Legs (pivotadas en la cadera)
  const makeLeg = (x: number, name: string, regions: PartRegions) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.78, 0);
    pivot.name = name;
    const legGeo = new THREE.BoxGeometry(LEG.w, LEG.h, LEG.d);
    applyPartUVs(legGeo, regions);
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.y = -LEG.h / 2;
    pivot.add(leg);
    g.add(pivot);
  };
  makeLeg(-(LEG.w / 2 + 0.01), "legL", LAYOUT.leftLeg);
  makeLeg(+(LEG.w / 2 + 0.01), "legR", LAYOUT.rightLeg);

  return g;
}

export const SKIN_LAYOUT = LAYOUT;
export const SKIN_TEX_SIZE = { w: TEX_W, h: TEX_H };
