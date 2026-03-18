"use client";

import { Bell } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface NotificationLabels {
  title: string;
  empty: string;
  markAll: string;
  new: string;
}

interface NotificationsMenuProps {
  locale: "en" | "th";
  initialItems: NotificationItem[];
  labels: NotificationLabels;
}

function formatTime(dateString: string, locale: "en" | "th") {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function NotificationsMenu({ locale, initialItems, labels }: NotificationsMenuProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [pending, startTransition] = useTransition();

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  function markOneAsRead(notificationId: string) {
    setItems((current) => current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));

    startTransition(async () => {
      const result = await markNotificationReadAction(notificationId);

      if (!result.ok) {
        toast.error(result.message ?? "Unable to update notification");
      }
    });
  }

  function markAllAsRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));

    startTransition(async () => {
      const result = await markAllNotificationsReadAction();

      if (!result.ok) {
        toast.error(result.message ?? "Unable to update notifications");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-audit-action="open-notifications" data-audit-type="notification">
          <Bell className="h-4 w-4" />
          {labels.title}
          {unreadCount > 0 ? <Badge variant="warning">{unreadCount}</Badge> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">{labels.title}</DropdownMenuLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending || unreadCount === 0}
            onClick={markAllAsRead}
            data-audit-action="mark-all-notifications-read"
            data-audit-type="notification"
          >
            {labels.markAll}
          </Button>
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <ScrollArea className="h-80">
            <div className="space-y-1 p-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-md border p-3 text-left transition hover:bg-muted"
                  onClick={() => markOneAsRead(item.id)}
                  data-audit-action="read-notification"
                  data-audit-type="notification"
                  data-audit-id={item.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    {!item.read ? <Badge variant="success">{labels.new}</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{formatTime(item.created_at, locale)}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
