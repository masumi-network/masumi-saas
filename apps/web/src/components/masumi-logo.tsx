import Image from "next/image";
import React from "react";

import kanjiBlack from "@/assets/Kanji.svg";
import kanjiWhite from "@/assets/Masumi kanji white.svg";
import masumiWhite from "@/assets/Masumi white.svg";
import masumiBlack from "@/assets/masumi-logo-black.svg";

const MasumiLogo = React.memo(() => {
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
      <Image src={kanjiBlack} alt="Kanji" priority className="dark:hidden" />
      <Image
        src={kanjiWhite}
        alt="Kanji"
        priority
        className="hidden dark:block"
      />
    </div>
  );
});

MasumiLogo.displayName = "MasumiLogo";

export default MasumiLogo;
