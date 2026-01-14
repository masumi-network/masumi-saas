"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  const handleToggleTheme = () => {
    setTheme((theme) =>
      !theme ? "system" : theme === "light" ? "dark" : "light",
    );
  };

  return (
    <Button
      className="bg-background p-2"
      variant="ghost"
      size="icon"
      onClick={handleToggleTheme}
    >
      <SunIcon className="h-4 w-4 scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
      <MoonIcon className="absolute h-4 w-4 scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
    </Button>
  );
}
