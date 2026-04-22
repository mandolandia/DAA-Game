import * as THREE from "three";

// Resolución de snap en píxeles (clip-space se cuantiza a esta retícula).
// Más bajo = más wobble. 160 da el jitter clásico PS2 sin ser ilegible.
const SNAP_RES = 160.0;

/**
 * Instala el look PS2 sobre cualquier material Three estándar:
 *  - vertex snapping (el clásico wobble)
 *  - corta la interpolación perspectiva del UV (affine-ish)
 *
 * Se aplica vía onBeforeCompile, así el lighting Lambert sigue funcionando.
 */
export function installPS2(mat: THREE.Material): void {
  const previous = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.uSnapRes = { value: SNAP_RES };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSnapRes;`
      )
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
         // PS2 vertex snap: cuantizar xy en clip-space
         vec4 _ps2 = gl_Position;
         float _w = _ps2.w;
         vec2 _ndc = _ps2.xy / _w;
         _ndc = floor(_ndc * uSnapRes + 0.5) / uSnapRes;
         _ps2.xy = _ndc * _w;
         gl_Position = _ps2;`
      );
  };
  mat.needsUpdate = true;
}

/** Crea un MeshLambertMaterial con PS2 ya parcheado. */
export function ps2Lambert(
  params: THREE.MeshLambertMaterialParameters = {}
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ flatShading: true, ...params });
  installPS2(mat);
  return mat;
}

/** Crea un MeshBasicMaterial parcheado (para cosas unlit como carteles). */
export function ps2Basic(
  params: THREE.MeshBasicMaterialParameters = {}
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial(params);
  installPS2(mat);
  return mat;
}

/** Ajuste global de filtrado de texturas al estilo PS2 (nearest, sin mipmaps). */
export function ps2Texture(tex: THREE.Texture): THREE.Texture {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 1;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
