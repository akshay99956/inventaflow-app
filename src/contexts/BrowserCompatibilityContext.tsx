import { createContext, useContext, useState } from "react";
import { BrowserFeatureCheck, getUnsupportedFeatureKey, runBrowserCompatibilityChecks, shouldShowBrowserWarning } from "@/lib/browserCompatibility";

const dismissalStorageKey = "browser-warning-dismissed";
const readDismissal = () => {
  try { return sessionStorage.getItem(dismissalStorageKey); } catch { return null; }
};

const BrowserCompatibilityContext = createContext<{
  checks: BrowserFeatureCheck[];
  warningVisible: boolean;
  refresh: () => void;
  dismiss: () => void;
} | null>(null);

export const BrowserCompatibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [checks, setChecks] = useState(runBrowserCompatibilityChecks);
  const [dismissedKey, setDismissedKey] = useState(readDismissal);
  const dismiss = () => {
    const key = getUnsupportedFeatureKey(checks);
    setDismissedKey(key);
    try { sessionStorage.setItem(dismissalStorageKey, key); } catch { /* In-memory dismissal still works. */ }
  };
  return <BrowserCompatibilityContext.Provider value={{
    checks, warningVisible: shouldShowBrowserWarning(checks, dismissedKey), dismiss,
    refresh: () => setChecks(runBrowserCompatibilityChecks()),
  }}>{children}</BrowserCompatibilityContext.Provider>;
};

export const useBrowserCompatibility = () => {
  const context = useContext(BrowserCompatibilityContext);
  if (!context) throw new Error("BrowserCompatibilityProvider is required");
  return context;
};