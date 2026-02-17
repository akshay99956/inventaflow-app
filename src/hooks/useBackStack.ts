import { useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Hook that provides native-like back stack behavior:
 * 1. Closes any open overlays (sheets, dialogs, drawers) on back press
 * 2. Confirms before exiting the app (going to landing page)
 * 3. Navigates back through history normally otherwise
 */
export function useBackStack() {
  const location = useLocation();
  const navigate = useNavigate();

  const handlePopState = useCallback(
    (e: PopStateEvent) => {
      // Check if any overlay is open (radix dialogs, sheets, drawers)
      const openOverlay = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][data-vaul-drawer]'
      );

      if (openOverlay) {
        // Prevent navigation — close the overlay instead
        e.preventDefault();
        // Push state back so we don't lose our place
        window.history.pushState(null, "", window.location.href);

        // Find and click the close button or press Escape
        const closeBtn = openOverlay.querySelector(
          '[data-dismiss], [aria-label="Close"], button[class*="close"]'
        ) as HTMLButtonElement | null;

        if (closeBtn) {
          closeBtn.click();
        } else {
          // Dispatch Escape key to close Radix overlays
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              bubbles: true,
            })
          );
        }
        return;
      }

      // If on dashboard (main app screen), confirm exit
      if (location.pathname === "/dashboard") {
        e.preventDefault();
        window.history.pushState(null, "", window.location.href);
        toast("Press back again to exit", {
          id: "exit-confirm",
          duration: 2000,
        });
      }
    },
    [location.pathname]
  );

  useEffect(() => {
    // Push an initial state so we can intercept the first back press
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [handlePopState]);
}
