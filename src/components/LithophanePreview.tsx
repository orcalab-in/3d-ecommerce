"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { TriangleBuffer } from "@/lib/stl";

export type PreviewMode = "unlit" | "backlit";

interface Props {
  solid: TriangleBuffer | null;
  panelCanvas: HTMLCanvasElement | null;
  mode: PreviewMode;
  panelWidthMm: number;
  panelHeightMm: number;
}

export default function LithophanePreview({ solid, panelCanvas, mode, panelWidthMm, panelHeightMm }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mesh: THREE.Mesh;
    unlitMaterial: THREE.MeshStandardMaterial;
    backlitMaterial: THREE.MeshBasicMaterial;
    texture: THREE.CanvasTexture | null;
    frameId: number;
  } | null>(null);

  // Mount: set up renderer/scene once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#3a2a1d");

    const camera = new THREE.PerspectiveCamera(32, 1, 1, 2000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Low ambient + a strongly side-raking key light: a thickness-only relief is very
    // shallow (0.8-3.2mm), so flat front lighting washes it out almost entirely. Grazing
    // light from the side is what makes the carved detail actually readable in "unlit" mode.
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const key = new THREE.DirectionalLight(0xfff2de, 1.6);
    key.position.set(260, 60, 40);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.22);
    fill.position.set(-120, -30, 120);
    scene.add(fill);

    const unlitMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3ead9,
      roughness: 0.85,
      metalness: 0.02,
    });
    // Neutral white -- the STL carries no color data, only thickness. Tint here would
    // wrongly imply the print comes out colored; actual warmth depends on your LED/filament.
    const backlitMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const geometry = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geometry, unlitMaterial);
    scene.add(mesh);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let frameId = 0;
    let t = 0;
    const animate = () => {
      t += 0.004;
      const dist = Math.max(panelWidthMm, panelHeightMm) * 1.7;
      camera.position.set(Math.sin(t) * dist * 0.18, -dist * 0.08, dist * 0.92);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    stateRef.current = { renderer, scene, camera, mesh, unlitMaterial, backlitMaterial, texture: null, frameId };

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      geometry.dispose();
      unlitMaterial.dispose();
      backlitMaterial.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update geometry when the solid changes.
  useEffect(() => {
    const s = stateRef.current;
    if (!s || !solid) return;
    const positions = solid.toFloat32Positions();
    const uvs = new Float32Array((positions.length / 3) * 2);
    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      uvs[i * 2] = x / panelWidthMm + 0.5;
      uvs[i * 2 + 1] = y / panelHeightMm + 0.5;
    }
    // toFloat32Positions() is a non-indexed triangle soup (each triangle owns its own 3
    // vertices), so computeVertexNormals() alone would give hard, per-facet normals --
    // visibly blocky relief shading. mergeVertices() collapses coincident vertices into
    // an indexed geometry first, so normals get averaged across shared vertices instead.
    const raw = new THREE.BufferGeometry();
    raw.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    raw.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    const merged = mergeVertices(raw);
    merged.computeVertexNormals();
    merged.center();
    raw.dispose();
    s.mesh.geometry.dispose();
    s.mesh.geometry = merged;
  }, [solid, panelWidthMm, panelHeightMm]);

  // Update texture when the panel canvas changes.
  useEffect(() => {
    const s = stateRef.current;
    if (!s || !panelCanvas) return;
    s.texture?.dispose();
    const texture = new THREE.CanvasTexture(panelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    s.texture = texture;
    s.backlitMaterial.map = texture;
    s.backlitMaterial.needsUpdate = true;
  }, [panelCanvas]);

  // Swap material on mode change.
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    s.mesh.material = mode === "backlit" ? s.backlitMaterial : s.unlitMaterial;
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-none [&>canvas]:h-full [&>canvas]:w-full"
    />
  );
}
