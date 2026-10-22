export interface BrowserFeatureCheck {
  name: string;
  supported: boolean;
  essential: boolean;
  description: string;
}

export const runBrowserCompatibilityChecks = (): BrowserFeatureCheck[] => {
  const storageAvailable = (storageName: "localStorage" | "sessionStorage") => {
    try {
      const storage = window[storageName];
      const key = "__browser_compat_check__";
      storage.setItem(key, "1");
      storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  };
  const cssSupports = typeof CSS !== "undefined" && typeof CSS.supports === "function";
  const audio = typeof window !== "undefined"
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;
  return [
    { name: "Local storage", supported: typeof window !== "undefined" && storageAvailable("localStorage"), essential: true, description: "Saves preferences and settings on this device." },
    { name: "Secure encryption", supported: typeof window !== "undefined" && Boolean(window.crypto?.subtle), essential: true, description: "Protects sensitive verification features." },
    { name: "CSS Grid layout", supported: cssSupports && CSS.supports("display", "grid"), essential: true, description: "Keeps screens and forms arranged correctly." },
    { name: "ResizeObserver", supported: typeof window !== "undefined" && "ResizeObserver" in window, essential: true, description: "Helps charts and responsive views adjust to screen size." },
    { name: "Session storage", supported: typeof window !== "undefined" && storageAvailable("sessionStorage"), essential: false, description: "Keeps temporary information during your visit." },
    { name: "Notification sounds", supported: Boolean(audio), essential: false, description: "Allows optional sounds for app notifications." },
    { name: "Clipboard sharing", supported: typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText), essential: false, description: "Allows copying invoice and purchase details." },
    { name: "Quick sharing", supported: typeof navigator !== "undefined" && typeof navigator.share === "function", essential: false, description: "Opens your device's share menu when available." },
    { name: "Modern screen sizing", supported: cssSupports && CSS.supports("height", "100dvh"), essential: false, description: "Improves screen sizing on mobile browsers." },
    { name: "IntersectionObserver", supported: typeof window !== "undefined" && "IntersectionObserver" in window, essential: false, description: "Supports efficient loading and visibility checks." },
  ];
};

export const getBrowserName = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Edg\/|EdgiOS\/|EdgA\//i.test(ua)) return "Microsoft Edge";
  if (/Firefox\/|FxiOS\//i.test(ua)) return "Mozilla Firefox";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome\/|CriOS\//i.test(ua)) return "Google Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Unknown browser";
};

export const getBrowserUpdateGuidance = (browserName: string) => {
  const mobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile && browserName !== "Safari") return "Update your browser from your device's app store, then reopen this page.";
  if (browserName === "Google Chrome") return "Open Chrome's menu, choose Help, then About Google Chrome to install updates.";
  if (browserName === "Microsoft Edge") return "Open Edge's menu, choose Help and feedback, then About Microsoft Edge to install updates.";
  if (browserName === "Mozilla Firefox") return "Open Firefox's menu, choose Help, then About Firefox to check for updates.";
  if (browserName === "Safari") return mobile
    ? "Install the latest iOS or iPadOS update in Settings > General > Software Update."
    : "Install the latest Safari updates through your device's Software Update settings.";
  return "Use your browser's Help or About menu to install the latest version, then reopen this page.";
};

export const getUnsupportedFeatureKey = (checks: BrowserFeatureCheck[]) =>
  checks.filter(check => !check.supported).map(check => check.name).sort().join("|");

export const shouldShowBrowserWarning = (checks: BrowserFeatureCheck[], dismissedKey: string | null) => {
  const key = getUnsupportedFeatureKey(checks);
  return key.length > 0 && key !== dismissedKey;
};