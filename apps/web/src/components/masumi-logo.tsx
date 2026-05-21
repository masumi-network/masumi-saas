import Image from "next/image";
import React from "react";

import kanjiBlack from "@/assets/Kanji.svg";
import kanjiWhite from "@/assets/Masumi kanji white.svg";
import masumiWhite from "@/assets/Masumi white.svg";
import masumiBlack from "@/assets/masumi-logo-black.svg";
import { cn } from "@/lib/utils";

type MasumiLogoProps = {
  /** Always show kanji (e.g. mobile sidebar drawer). Default: hidden below `sm`. */
  showKanji?: boolean;
};

const MasumiLogo = React.memo(({ showKanji = false }: MasumiLogoProps) => {
  const kanjiVisibility = showKanji ? "block" : "hidden sm:block";

  return (
    <div className="flex items-end justify-center gap-4">
      <Image
        src={masumiBlack}
        alt="Masumi Logo"
        width={100}
        height={32}
        priority
        className="dark:hidden"
      />
      <Image
        src={masumiWhite}
        alt="Masumi Logo"
        width={100}
        height={32}
        priority
        className="hidden dark:block"
      />
      <Image
        src={kanjiBlack}
        alt=""
        aria-hidden
        priority
        className={cn(kanjiVisibility, "dark:hidden")}
      />
      <Image
        src={kanjiWhite}
        alt=""
        aria-hidden
        priority
        className={cn(showKanji ? "hidden dark:block" : "hidden sm:dark:block")}
      />
    </div>
  );
});

MasumiLogo.displayName = "MasumiLogo";

export default MasumiLogo;
