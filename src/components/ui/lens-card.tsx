"use client";

import React, { useRef, useState } from "react";

type LensCardProps = {
  topContent: React.ReactNode;
  behindContent: React.ReactNode;
  radius?: number;
  className?: string;
};

export function LensCard({
  topContent,
  behindContent,
  radius = 160,
  className = "",
}: LensCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHoveringControl, setIsHoveringControl] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    // Check if cursor is directly over an interactive element (button, input, link, etc.)
    const target = e.target as HTMLElement;
    const isControl = target.closest("button, input, a, select, textarea, [role='button']") !== null;
    setIsHoveringControl(isControl);

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty("--mouse-x", `${x}px`);
    cardRef.current.style.setProperty("--mouse-y", `${y}px`);
    cardRef.current.style.setProperty("--lens-radius", `${radius}px`);
  };

  const handleMouseLeave = () => {
    setIsHoveringControl(false);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-control-hover={isHoveringControl ? "true" : "false"}
      className={`group lens-mask-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 dark:border-[#383734] dark:bg-[#2c2b28] ${
        isHoveringControl ? "!cursor-default" : ""
      } ${className}`}
    >
      {/* Crisp Circular Lens Ring Follower (Suspended when hovering controls) */}
      <div
        className={`lens-cursor-ring ${
          isHoveringControl ? "!opacity-0 pointer-events-none" : ""
        }`}
      />

      {/* TOP LAYER (Normal UI View with 100% clickable controls) */}
      <div className="lens-top-layer relative z-30 pointer-events-auto">
        {topContent}
      </div>

      {/* BEHIND LAYER (Revealed by Aperture, suspended over controls) */}
      <div
        className={`lens-behind-layer bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-5 text-white dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 ${
          isHoveringControl ? "!opacity-0 pointer-events-none" : ""
        }`}
      >
        {behindContent}
      </div>
    </div>
  );
}
