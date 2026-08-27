"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [animKey, setAnimKey] = useState(pathname);

  useEffect(() => {
    setAnimKey(pathname);
    // Smoothly scroll window to top on page transition
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pathname]);

  return (
    <>
      {/* Top glowing progress line across the viewport during page route switch */}
      <div key={`progress-${animKey}`} className="top-route-bar" />

      {/* Silky 120 FPS hardware-accelerated entry animation container */}
      <div key={`page-${animKey}`} className="page-transition flex-1 flex flex-col">
        {children}
      </div>
    </>
  );
}
