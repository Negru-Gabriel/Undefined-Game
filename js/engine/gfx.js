import * as THREE from 'three';
import { state } from './state.js';

// ---------------------------------------------------------------------------
// GFX: Three.js renderer + custom GLSL postprocessing stack.
//  * background "reality" shader (fog / grid / noise / particles)
//  * optional injected 3D scene (Chapter 4 — the Machine)
//  * post chain: bright-pass bloom, chromatic aberration, CRT curvature +
//    scanlines, vignette, screen-tearing, corruption / distortion glitch.
// ---------------------------------------------------------------------------

const VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
`;

// shared noise helpers
const NOISE = /* glsl */`
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
`;

const BG_FRAG = NOISE + /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform float uCorruption; // 0..1
  uniform vec3  uTintA;
  uniform vec3  uTintB;
  uniform float uFog;
  uniform float uGrid;
  uniform vec2  uMouse;

  void main(){
    vec2 uv = vUv;
    vec2 p = (uv-0.5)*vec2(uRes.x/uRes.y,1.0);

    // drifting volumetric fog
    float f = fbm(p*2.2 + vec2(uTime*0.04, uTime*0.02));
    f += 0.5*fbm(p*4.5 - vec2(uTime*0.03, 0.0));
    f *= uFog;

    // deep base gradient
    vec3 col = mix(uTintA, uTintB, smoothstep(0.0,1.0,uv.y + 0.15*sin(uTime*0.2)));
    col += f*0.18*mix(uTintB,vec3(0.6,0.8,1.0),0.5);

    // perspective grid (the "system" floor)
    if(uGrid > 0.01){
      vec2 g = p*8.0;
      g.y += uTime*0.6;
      vec2 grid = abs(fract(g)-0.5)/fwidth(g);
      float line = 1.0 - min(min(grid.x,grid.y),1.0);
      float depth = smoothstep(0.0,0.6,uv.y);
      col += line*uGrid*depth*vec3(0.1,0.7,0.9)*0.6;
    }

    // floating "particles"
    float parts=0.0;
    for(int i=0;i<6;i++){
      float fi=float(i);
      vec2 sp=vec2(hash(vec2(fi,1.0)), fract(hash(vec2(fi,7.0))+uTime*(0.02+0.01*fi)));
      float d=length((uv-sp)*vec2(uRes.x/uRes.y,1.0));
      parts += smoothstep(0.012,0.0,d)*0.6;
    }
    col += parts*vec3(0.5,0.8,1.0);

    // mouse halo (dynamic lighting)
    float ml = smoothstep(0.35,0.0,length((uv-uMouse)*vec2(uRes.x/uRes.y,1.0)));
    col += ml*0.10*vec3(0.4,0.7,1.0);

    // corruption: hot magenta veins
    float c = uCorruption;
    float veins = smoothstep(0.75,0.95, fbm(p*6.0 + uTime*0.3));
    col = mix(col, vec3(0.9,0.1,0.5), veins*c*0.7);
    col += c*0.05*hash(uv*uTime);

    gl_FragColor = vec4(col,1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */`
  precision highp float; varying vec2 vUv;
  uniform sampler2D tDiffuse; uniform float uThreshold;
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.299,0.587,0.114));
    gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold+0.3, l), 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  precision highp float; varying vec2 vUv;
  uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes;
  void main(){
    vec2 px = uDir / uRes;
    vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227;
    sum += texture2D(tDiffuse, vUv + px*1.384).rgb * 0.316;
    sum += texture2D(tDiffuse, vUv - px*1.384).rgb * 0.316;
    sum += texture2D(tDiffuse, vUv + px*3.230).rgb * 0.070;
    sum += texture2D(tDiffuse, vUv - px*3.230).rgb * 0.070;
    gl_FragColor = vec4(sum,1.0);
  }
`;

const FINAL_FRAG = NOISE + /* glsl */`
  precision highp float; varying vec2 vUv;
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uTime;
  uniform vec2  uRes;
  uniform float uCorruption; // 0..1
  uniform float uCRT;        // crt strength 0..1
  uniform float uGlitch;     // transient glitch burst 0..1
  uniform float uTear;       // screen tearing 0..1
  uniform float uAberration;
  uniform float uFlash;

  vec2 curve(vec2 uv){
    uv = uv*2.0-1.0;
    vec2 off = abs(uv.yx)/vec2(5.0,4.0);
    uv = uv + uv*off*off*uCRT;
    return uv*0.5+0.5;
  }

  void main(){
    vec2 uv = mix(vUv, curve(vUv), uCRT);

    // screen tearing: horizontal slip per scanline band
    float band = floor(uv.y*48.0);
    float slip = (hash(vec2(band, floor(uTime*12.0)))-0.5);
    uv.x += slip * uTear * 0.08;

    // transient glitch block displacement
    float g = uGlitch;
    if(g>0.001){
      float by = floor(uv.y*20.0);
      float r = hash(vec2(by, floor(uTime*20.0)));
      if(r>0.7) uv.x += (hash(vec2(by,uTime))-0.5)*0.25*g;
    }

    // chromatic aberration grows with corruption + glitch
    float ab = uAberration + uCorruption*0.004 + uGlitch*0.01;
    vec2 dir = (uv-0.5);
    vec3 col;
    col.r = texture2D(tScene, uv + dir*ab).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - dir*ab).b;

    // additive bloom
    col += texture2D(tBloom, uv).rgb * (1.0 + uCorruption*0.6);

    // scanlines + crt mask
    float scan = sin(uv.y*uRes.y*1.6)*0.5+0.5;
    col *= mix(1.0, 0.82+0.18*scan, uCRT);
    float mask = mix(1.0, 0.9 + 0.1*sin(uv.x*uRes.x*3.0), uCRT*0.6);
    col *= mask;

    // rolling brightness bar
    float roll = smoothstep(0.0,0.1, fract(uv.y - uTime*0.15)) ;
    col *= mix(1.0, 0.92+0.08*roll, uCRT*0.5);

    // vignette
    vec2 vg = uv*(1.0-uv.yx);
    float vig = pow(vg.x*vg.y*16.0, 0.25);
    col *= mix(1.0, vig, 0.7);

    // film grain (rises with corruption)
    float grain = (hash(uv*uTime*vec2(13.0,7.0))-0.5);
    col += grain*(0.03 + uCorruption*0.08);

    // out-of-bounds = black (after curvature)
    if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) col = vec3(0.0);

    col = mix(col, vec3(1.0), uFlash);
    gl_FragColor = vec4(col,1.0);
  }
`;

function makeQuad(material) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, material);
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, mesh };
}

export class GFX {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.clock = new THREE.Clock();

    this.size = new THREE.Vector2();
    this.glitch = 0; this.tear = 0; this.flash = 0;
    this.scene3d = null; this.cam3d = null;

    // uniforms
    this.bgU = {
      uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uCorruption: { value: 0 },
      uTintA: { value: new THREE.Color(0x05060a) }, uTintB: { value: new THREE.Color(0x0a1422) },
      uFog: { value: 1.0 }, uGrid: { value: 0.0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    };
    this.bg = makeQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BG_FRAG, uniforms: this.bgU, depthTest: false }));

    this.brightU = { tDiffuse: { value: null }, uThreshold: { value: 0.6 } };
    this.bright = makeQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BRIGHT_FRAG, uniforms: this.brightU }));

    this.blurU = { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2() } };
    this.blur = makeQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR_FRAG, uniforms: this.blurU }));

    this.finalU = {
      tScene: { value: null }, tBloom: { value: null }, uTime: { value: 0 },
      uRes: { value: new THREE.Vector2() }, uCorruption: { value: 0 }, uCRT: { value: 0.5 },
      uGlitch: { value: 0 }, uTear: { value: 0 }, uAberration: { value: 0.0015 }, uFlash: { value: 0 },
    };
    this.final = makeQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FINAL_FRAG, uniforms: this.finalU }));

    this._makeTargets();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.bgU.uMouse.value.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    });
    this.resize();
  }

  _makeTargets() {
    const w = Math.max(2, Math.floor(window.innerWidth * 0.75));
    const h = Math.max(2, Math.floor(window.innerHeight * 0.75));
    const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    this.rtScene = new THREE.WebGLRenderTarget(w, h, opt);
    this.rtBright = new THREE.WebGLRenderTarget(w >> 1, h >> 1, opt);
    this.rtA = new THREE.WebGLRenderTarget(w >> 1, h >> 1, opt);
    this.rtB = new THREE.WebGLRenderTarget(w >> 1, h >> 1, opt);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.size.set(w, h);
    this.bgU.uRes.value.set(w, h);
    this.finalU.uRes.value.set(w, h);
    this.blurU.uRes.value.set(w >> 1, h >> 1);
    this._makeTargets();
    if (this.cam3d && this.cam3d.isPerspectiveCamera) { this.cam3d.aspect = w / h; this.cam3d.updateProjectionMatrix(); }
  }

  setScene3D(scene, cam) { this.scene3d = scene; this.cam3d = cam; }
  clearScene3D() { this.scene3d = null; this.cam3d = null; }

  setMood({ tintA, tintB, fog, grid, crt, aberration } = {}) {
    if (tintA !== undefined) this.bgU.uTintA.value.set(tintA);
    if (tintB !== undefined) this.bgU.uTintB.value.set(tintB);
    if (fog !== undefined) this.bgU.uFog.value = fog;
    if (grid !== undefined) this.bgU.uGrid.value = grid;
    if (crt !== undefined) this.finalU.uCRT.value = crt;
    if (aberration !== undefined) this.finalU.uAberration.value = aberration;
  }

  burstGlitch(amount = 1, dur = 350) {
    this.glitch = Math.max(this.glitch, amount);
    clearTimeout(this._gt);
    this._gt = setTimeout(() => { this.glitch = 0; }, dur);
  }
  setTear(v) { this.tear = v; }
  flashScreen(a = 1, dur = 120) { this.flash = a; clearTimeout(this._ft); this._ft = setTimeout(() => { this.flash = 0; }, dur); }

  render() {
    const t = this.clock.getElapsedTime();
    const corr = state.corruption / 100;
    this.bgU.uTime.value = t; this.bgU.uCorruption.value = corr;
    this.finalU.uTime.value = t; this.finalU.uCorruption.value = corr;

    // smooth transient values
    this.finalU.uGlitch.value += (this.glitch - this.finalU.uGlitch.value) * 0.4;
    this.finalU.uTear.value += (this.tear - this.finalU.uTear.value) * 0.2;
    this.finalU.uFlash.value += (this.flash - this.finalU.uFlash.value) * 0.5;

    const r = this.renderer;
    // 1. scene
    r.setRenderTarget(this.rtScene);
    r.clear();
    if (this.scene3d && this.cam3d) r.render(this.scene3d, this.cam3d);
    else r.render(this.bg.scene, this.cam);

    // 2. bright pass
    this.brightU.tDiffuse.value = this.rtScene.texture;
    r.setRenderTarget(this.rtBright);
    r.render(this.bright.scene, this.cam);

    // 3. separable blur (2 iterations)
    let src = this.rtBright;
    for (let i = 0; i < 2; i++) {
      this.blurU.tDiffuse.value = src.texture; this.blurU.uDir.value.set(1, 0);
      r.setRenderTarget(this.rtA); r.render(this.blur.scene, this.cam);
      this.blurU.tDiffuse.value = this.rtA.texture; this.blurU.uDir.value.set(0, 1);
      r.setRenderTarget(this.rtB); r.render(this.blur.scene, this.cam);
      src = this.rtB;
    }

    // 4. final composite to screen
    this.finalU.tScene.value = this.rtScene.texture;
    this.finalU.tBloom.value = this.rtB.texture;
    r.setRenderTarget(null);
    r.render(this.final.scene, this.cam);
  }
}
