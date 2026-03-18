"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "sst-sw-reloaded";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      void registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) {
          return;
        }

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    });

    const onControllerChange = () => {
      const didReload = sessionStorage.getItem(RELOAD_FLAG);
      if (!didReload) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      sessionStorage.removeItem(RELOAD_FLAG);
    };
  }, []);

  return null;
}
