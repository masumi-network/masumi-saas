"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

import kanjiBlack from "@/assets/Kanji.svg";
import kanjiWhite from "@/assets/Masumi kanji white.svg";
import masumiWhite from "@/assets/Masumi white.svg";
import masumiBlack from "@/assets/masumi-logo-black.svg";

const MasumiLogo = React.memo(() => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <div className="flex items-end justify-center gap-4">
      <Image
        src={isDark ? masumiWhite : masumiBlack}
        alt="Masumi Logo"
        width={100}
        height={32}
        priority
      />
      <Image src={isDark ? kanjiWhite : kanjiBlack} alt="Kanji" priority />
    </div>
  );
});

MasumiLogo.displayName = "MasumiLogo";

export default MasumiLogo;
