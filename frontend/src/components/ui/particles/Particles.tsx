"use client";

import { useEffect, useRef } from "react";
import { Geometry, Mesh, Program, Renderer } from "ogl";
import styles from "./Particles.module.css";

type ParticlesProps = {
  className?: string;
  particleColors?: string[];
  particleCount?: number;
  particleSpread?: number;
  speed?: number;
  particleBaseSize?: number;
  sizeRandomness?: number;
  cameraDistance?: number;
  moveParticlesOnHover?: boolean;
  particleHoverFactor?: number;
  alphaParticles?: boolean;
  disableRotation?: boolean;
  pixelRatio?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : normalized.padStart(6, "0").slice(0, 6);

  const value = Number.parseInt(safeHex, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export default function Particles({
  className,
  particleColors = ["#FFFFFF", "#F7D84B", "#FFE89A", "#E7D8FF", "#CDB7FF"],
  particleCount = 140,
  particleSpread = 10,
  speed = 0.075,
  particleBaseSize = 82,
  sizeRandomness = 1,
  cameraDistance = 16,
  moveParticlesOnHover = true,
  particleHoverFactor = 0.6,
  alphaParticles = true,
  disableRotation = false,
  pixelRatio = 1,
}: ParticlesProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frameId = 0;
    let destroyed = false;
    let renderer: Renderer | null = null;
    let cleanupPointer = () => {};
    let cleanupResize = () => {};

    try {
      renderer = new Renderer({
        alpha: true,
        antialias: true,
        dpr: clamp(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1, pixelRatio),
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.className = styles.canvas;
    root.appendChild(canvas);

    const count = Math.max(24, particleCount);
    const random = createSeededRandom(97);
    const positions = new Float32Array(count * 2);
    const sizes = new Float32Array(count);
    const colorData = new Float32Array(count * 3);
    const depthData = new Float32Array(count);

    const spread = clamp(particleSpread, 4, 14) / 10;
    const palette = particleColors.length > 0 ? particleColors : ["#F7D84B", "#CDB7FF", "#FFFFFF"];

    for (let index = 0; index < count; index += 1) {
      const x = (random() * 2 - 1) * spread;
      const y = (random() * 2 - 1) * spread;
      const size = 0.48 + random() * (0.82 + clamp(sizeRandomness, 0.6, 2) * 0.52);
      const color = hexToRgb(palette[index % palette.length]);

      positions[index * 2] = x;
      positions[index * 2 + 1] = y;
      sizes[index] = size;
      depthData[index] = 0.2 + random() * 0.8;
      colorData[index * 3] = color[0];
      colorData[index * 3 + 1] = color[1];
      colorData[index * 3 + 2] = color[2];
    }

    const geometry = new Geometry(gl, {
      position: { size: 2, data: positions },
      size: { size: 1, data: sizes },
      color: { size: 3, data: colorData },
      depth: { size: 1, data: depthData },
    });

    const program = new Program(gl, {
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertex: `
        attribute vec2 position;
        attribute float size;
        attribute vec3 color;
        attribute float depth;

        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uHoverFactor;
        uniform float uRotation;
        uniform vec2 uResolution;
        uniform float uBaseSize;
        uniform float uAlpha;
        uniform float uCameraDistance;

        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 pos = position;
          float wave = uTime * (0.06 + depth * 0.03);
          pos.x += sin(wave + position.y * 3.7) * (0.015 + depth * 0.01);
          pos.y += cos(wave * 1.2 + position.x * 4.6) * (0.018 + depth * 0.012);

          vec2 hoverDelta = uMouse - pos;
          float hoverDistance = length(hoverDelta);
          if (hoverDistance > 0.0001) {
            float influence = smoothstep(0.65, 0.0, hoverDistance) * uHoverFactor;
            pos -= normalize(hoverDelta) * influence * (0.025 + depth * 0.02);
          }

          float rotation = uRotation * depth;
          float rotationCos = cos(rotation);
          float rotationSin = sin(rotation);
          pos = vec2(
            pos.x * rotationCos - pos.y * rotationSin,
            pos.x * rotationSin + pos.y * rotationCos
          );

          gl_Position = vec4(pos, 0.0, 1.0);
          float perspective = 18.0 / max(8.0, uCameraDistance);
          gl_PointSize = max(8.0, uBaseSize * perspective * (0.115 + size * 0.155) * (uResolution.y / 920.0));

          vColor = color;
          vAlpha = uAlpha * (0.3 + size * 0.18 + depth * 0.09);
        }
      `,
      fragment: `
        precision highp float;

        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 point = gl_PointCoord - 0.5;
          float dist = length(point);
          float halo = smoothstep(0.58, 0.1, dist);
          float softness = smoothstep(0.42, 0.0, dist);
          float core = smoothstep(0.16, 0.0, dist);
          vec3 glowColor = mix(vColor, vec3(1.0), 0.18);
          float alpha = (halo * 0.42 + softness * 0.78 + core * 0.56) * vAlpha;
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: [-2, -2] as [number, number] },
        uHoverFactor: { value: moveParticlesOnHover ? particleHoverFactor : 0 },
        uRotation: { value: 0 },
        uResolution: { value: [1, 1] as [number, number] },
        uBaseSize: { value: particleBaseSize },
        uCameraDistance: { value: cameraDistance },
        uAlpha: { value: alphaParticles ? 1 : 0.7 },
      },
    });

    const mesh = new Mesh(gl, {
      geometry,
      program,
      mode: gl.POINTS,
    });

    const resize = () => {
      if (!renderer || destroyed) return;
      const width = root.clientWidth || window.innerWidth;
      const height = root.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [width, height];
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!moveParticlesOnHover) return;
      const rect = root.getBoundingClientRect();
      const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      program.uniforms.uMouse.value = [normalizedX, normalizedY];
    };

    const onPointerLeave = () => {
      program.uniforms.uMouse.value = [-2, -2];
    };

    const update = (time: number) => {
      if (!renderer || destroyed) return;
      program.uniforms.uTime.value = time * 0.001 * speed * 10;
      program.uniforms.uRotation.value = disableRotation ? 0 : time * 0.00005;
      renderer.render({ scene: mesh });
      frameId = window.requestAnimationFrame(update);
    };

    resize();
    frameId = window.requestAnimationFrame(update);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);

    cleanupResize = () => window.removeEventListener("resize", resize);
    cleanupPointer = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };

    return () => {
      destroyed = true;
      window.cancelAnimationFrame(frameId);
      cleanupResize();
      cleanupPointer();
      if (canvas.parentNode === root) root.removeChild(canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    alphaParticles,
    disableRotation,
    cameraDistance,
    moveParticlesOnHover,
    particleBaseSize,
    particleColors,
    particleCount,
    particleHoverFactor,
    particleSpread,
    pixelRatio,
    sizeRandomness,
    speed,
  ]);

  return <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-hidden="true" />;
}
