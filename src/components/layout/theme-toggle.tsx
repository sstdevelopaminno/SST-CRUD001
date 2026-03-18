"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setTheme("light")} data-audit-action="theme-light" data-audit-type="theme">
        <Sun className="mr-1 h-4 w-4" /> Light
      </Button>
      <Button variant="outline" size="sm" onClick={() => setTheme("dark")} data-audit-action="theme-dark" data-audit-type="theme">
        <Moon className="mr-1 h-4 w-4" /> Dark
      </Button>
    </div>
  );
}
