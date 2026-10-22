import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrowserCompatibility } from "@/contexts/BrowserCompatibilityContext";
import { getBrowserName, getBrowserUpdateGuidance } from "@/lib/browserCompatibility";

export const BrowserCompatibilityWarning = () => {
  const { checks, warningVisible, dismiss } = useBrowserCompatibility();
  const { pathname } = useLocation();
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  if (!warningVisible) return null;
  const essentialMissing = checks.some(check => check.essential && !check.supported);
  const isPublicPage = pathname === "/" || pathname === "/auth";
  return (
    <aside aria-label="Browser compatibility warning" role="status" className="relative z-20 w-full border-b border-warning/30 bg-warning/10 px-4 py-3 text-foreground">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{essentialMissing ? "Your browser needs attention" : "Some browser features are unavailable"}</p>
          <p className="text-xs text-muted-foreground">{essentialMissing ? "Some app features may not work correctly." : "You can keep using the app, but some optional features may not work."}</p>
          {isPublicPage ? (
            <Button variant="link" size="sm" className="h-auto gap-1 px-0 py-1" aria-expanded={guidanceOpen} aria-controls="browser-warning-guidance" onClick={() => setGuidanceOpen(open => !open)}>
              Update guidance <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="link" size="sm" className="h-auto gap-1 px-0 py-1" asChild>
              <Link to="/settings?tab=browser#browser-update-guidance">Update guidance <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          )}
          {isPublicPage && guidanceOpen && <p id="browser-warning-guidance" className="text-sm">{getBrowserUpdateGuidance(getBrowserName())} If already updated, check browser permissions or try another browser.</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Dismiss browser warning" title="Dismiss browser warning" onClick={dismiss}><X className="h-4 w-4" /></Button>
      </div>
    </aside>
  );
};