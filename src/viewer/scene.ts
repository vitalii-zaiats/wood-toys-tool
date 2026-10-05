import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Poly } from "../geometry/poly";
import type { PuzzleModel } from "../model";

export type ViewMode = "built" | "exploded" | "steps";

interface PartGroup { id: number; wrap: THREE.Group; mesh: THREE.Mesh; ex: THREE.Vector3; f: number; vis: boolean }

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function shapeFrom(pts: Poly) {
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  return s;
}

export class PuzzleScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
  private controls: OrbitControls;
  private groups: PartGroup[] = [];
  private model: PuzzleModel | null = null;
  private mode: ViewMode = "built";
  private step = 0;
  private raf = 0;
  private size = 0;

  private woodTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#dcbf92"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const y = Math.random() * h, a = Math.random() * 0.08 + 0.02;
      g.strokeStyle = `rgba(140,95,50,${a})`; g.lineWidth = Math.random() * 2 + 0.5; g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 70 + i) * 4);
      g.stroke();
    }
  });
  private matTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#2f5d4b"; g.fillRect(0, 0, w, h);
    const grid = (n: number) => { for (let i = 0; i <= n; i++) { const p = (i * w) / n; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); } };
    g.strokeStyle = "rgba(230,240,230,0.18)"; g.lineWidth = 1; grid(16);
    g.strokeStyle = "rgba(230,240,230,0.35)"; g.lineWidth = 2; grid(4);
  });
  private faceMat = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.82 });
  private edgeMat = new THREE.MeshStandardMaterial({ color: 0x5b3a20, roughness: 0.9 });
  private hiFace = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.82, emissive: 0x2550c9, emissiveIntensity: 0.18 });
  private engMat = new THREE.LineBasicMaterial({ color: 0x6b4426 });
  private mat: THREE.Mesh;

  // Throws when WebGL is unavailable. Pass live=false to render single frames with snapshot().
  constructor(private canvas: HTMLCanvasElement, live = true) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.camera.position.set(190, 150, 230);

    this.scene.add(new THREE.HemisphereLight(0xf4f1ff, 0x51463a, 2.3));
    const sun = new THREE.DirectionalLight(0xfff3e0, 3);
    sun.position.set(140, 260, 180); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 900 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    this.woodTex.repeat.set(1 / 110, 1 / 110);
    this.matTex.repeat.set(8, 8);
    this.mat = new THREE.Mesh(new THREE.PlaneGeometry(1280, 1280), new THREE.MeshStandardMaterial({ map: this.matTex, roughness: 0.95 }));
    this.mat.rotation.x = -Math.PI / 2; this.mat.receiveShadow = true;
    this.scene.add(this.mat);

    if (live) this.frame();
  }

  // Renders the model once at the given size and returns it as an image URL.
  snapshot(model: PuzzleModel, w: number, h: number): string {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.size = 0;
    this.setModel(model);
    this.fit(0.6); // thumbnails are small, so frame the model tighter than the live view
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL("image/png");
  }

  setModel(model: PuzzleModel) {
    this.clear();
    this.model = model;
    const t = model.t;
    for (const p of model.parts) {
      if (!p.basis) continue;
      const shape = shapeFrom(p.outline);
      p.holes.forEach(h => shape.holes.push(shapeFrom(h)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
      const mesh = new THREE.Mesh(geo, [this.faceMat, this.edgeMat]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      const inner = new THREE.Group(); inner.add(mesh);
      const pos: number[] = [];
      for (const l of p.engrave) for (let i = 0; i < l.length - 1; i++) pos.push(l[i][0], l[i][1], t + 0.03, l[i + 1][0], l[i + 1][1], t + 0.03);
      if (pos.length) {
        const lg = new THREE.BufferGeometry();
        lg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        inner.add(new THREE.LineSegments(lg, this.engMat));
      }
      const A = new THREE.Vector3(...p.basis.ea), B = new THREE.Vector3(...p.basis.eb), C = new THREE.Vector3().crossVectors(A, B);
      inner.matrixAutoUpdate = false;
      inner.matrix.makeBasis(A, B, C).setPosition(...p.basis.o);
      const wrap = new THREE.Group(); wrap.add(inner); this.scene.add(wrap);
      this.groups.push({ id: p.id, wrap, mesh, ex: new THREE.Vector3(...(p.explode ?? [0, 0, 0])), f: 0, vis: true });
    }
    this.mat.position.y = model.bounds.minY - 0.05;
    this.controls.target.set(0, model.bounds.focusY, 0);
    this.controls.minDistance = model.bounds.size * 0.8;
    this.controls.maxDistance = model.bounds.size * 9;
    if (model.bounds.size !== this.size) { this.size = model.bounds.size; this.fit(); }
    this.apply(true);
  }

  setView(mode: ViewMode, step: number) {
    this.mode = mode; this.step = step;
    this.apply(false);
  }

  // loseContext frees the GPU context right away; only for canvases that will not be reused.
  dispose(loseContext = false) {
    cancelAnimationFrame(this.raf);
    this.clear();
    this.controls.dispose();
    for (const o of [this.woodTex, this.matTex, this.faceMat, this.edgeMat, this.hiFace, this.engMat, this.mat.geometry, this.mat.material as THREE.Material]) o.dispose();
    this.renderer.dispose();
    if (loseContext) this.renderer.forceContextLoss();
  }

  private clear() {
    for (const g of this.groups) {
      this.scene.remove(g.wrap);
      g.wrap.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose(); });
    }
    this.groups = [];
  }

  private target(id: number) {
    if (this.mode === "built") return { f: 0, vis: true, fresh: false };
    if (this.mode === "exploded") return { f: 1, vis: true, fresh: false };
    const idx = this.model ? this.model.steps.findIndex(s => s.ids.includes(id)) : -1;
    return { f: 0, vis: idx <= this.step, fresh: idx === this.step };
  }

  private apply(snap: boolean) {
    for (const g of this.groups) {
      const tg = this.target(g.id);
      if (snap) g.f = tg.f;
      else if (tg.fresh && !g.vis) g.f = 1.6; // a part joining the build drops in from above
      g.vis = tg.vis; g.wrap.visible = tg.vis;
      g.mesh.material = [tg.fresh ? this.hiFace : this.faceMat, this.edgeMat];
    }
  }

  private fit(zoom = 1) {
    const d = this.size * 3.4 * zoom * Math.max(1, 0.85 / this.camera.aspect);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, d);
  }

  private frame = () => {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, pr = this.renderer.getPixelRatio();
    if (w && h && (this.canvas.width !== Math.round(w * pr) || this.canvas.height !== Math.round(h * pr))) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      this.fit();
    }
    for (const g of this.groups) { g.f += (this.target(g.id).f - g.f) * 0.12; g.wrap.position.copy(g.ex).multiplyScalar(g.f); }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };
}
