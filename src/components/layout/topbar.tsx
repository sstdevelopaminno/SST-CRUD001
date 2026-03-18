import { Bell } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppLocale } from "@/lib/i18n/config";

interface TopbarProps {
  locale: AppLocale;
  name: string;
  email: string;
}

export function Topbar({ locale, name, email }: TopbarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:px-6">
      <div>
        <p className="text-sm text-muted-foreground">SST Enterprise Platform</p>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <LanguageSwitcher locale={locale} />
        <Button variant="outline" size="sm" className="gap-2" data-audit-action="open-notifications" data-audit-type="notification">
          <Bell className="h-4 w-4" />
          Notifications
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-10 w-10 rounded-full p-0">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Profile</DropdownMenuItem>
            <DropdownMenuItem disabled>Security</DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="destructive" className="w-full" data-audit-action="logout" data-audit-type="auth">
                Sign out
              </Button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
