"use client";

import Image from "next/image";

type LogoProps = {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
};

export function WellnessTwinLogo({
  size = 36,
  className = "",
  showText = false,
  textClassName = "",
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* 100% Transparent Standalone Emblem with Light/Dark Adaptive Contrast */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: Math.round(size * 0.72) }}
      >
        <Image
          src="/wellness-twin-logo-transparent.png"
          alt="AI Wellness Twin Emblem"
          width={292}
          height={210}
          className="h-full w-full object-contain invert dark:invert-0 transition-all duration-200"
          priority
        />
      </div>

      {showText && (
        <div>
          <p className={`text-sm font-bold text-slate-900 dark:text-white ${textClassName}`}>
            Wellness Twin
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#9a9893]">
            AI Companion
          </p>
        </div>
      )}
    </div>
  );
}
