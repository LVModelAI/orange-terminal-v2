"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export const ConnectButton = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // run once on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="border border-theme-orange rounded-full flex flex-row items-center pl-2">
      <Image
        src="/images/core.png"
        alt="Core"
        width={50}
        height={50}
        className="w-8 h-8 hidden md:block "
      />
      <appkit-button size="sm" balance={"hide"} />
    </div>
  );
};
