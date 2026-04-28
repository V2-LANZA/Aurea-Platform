"use client";

import { memo } from "react";
import dynamic from "next/dynamic";

const Particles = dynamic(() => import("@/components/ui/particles/Particles"), { ssr: false });

const AUTH_PARTICLE_COLORS = ["#FFFFFF", "#F7D84B", "#FFE89A", "#E7D8FF", "#CDB7FF"] as const;

const AuthParticlesBackground = memo(function AuthParticlesBackground() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,54,120,0.24),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(245,213,71,0.14),transparent_32%),linear-gradient(180deg,rgba(11,8,21,0.8),rgba(13,10,24,0.9))]" />
      <Particles
        className="opacity-100"
        particleColors={[...AUTH_PARTICLE_COLORS]}
        particleCount={240}
        particleSpread={11}
        speed={0.07}
        particleBaseSize={140}
        moveParticlesOnHover={true}
        particleHoverFactor={0.7}
        alphaParticles={true}
        sizeRandomness={1.5}
        cameraDistance={18}
        disableRotation={false}
        pixelRatio={1.1}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,15,0.18),rgba(12,10,21,0.34))]" />
    </div>
  );
});

export default AuthParticlesBackground;
