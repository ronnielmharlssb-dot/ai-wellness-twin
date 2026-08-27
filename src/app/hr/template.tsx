"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function HRTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [animKey, setAnimKey] = useState(pathname);

  useEffect(() => {
    setAnimKey(pathname);
  }, [pathname]);

  return (
    <div key={`hr-${animKey}`} className="page-transition min-w-0">
      {children}
    </div>
  );
}
