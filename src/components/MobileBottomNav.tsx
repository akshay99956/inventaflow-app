import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, Menu, Receipt, FileText, TrendingUp, PieChart, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const primaryNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/invoices", label: "Sales", icon: ShoppingCart },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/clients", label: "Clients", icon: Users },
];

const moreMenuItems = [
  { path: "/bills", label: "Purchases", icon: Receipt },
  { path: "/invoices", label: "All Invoices", icon: FileText },
  { path: "/balance-sheet", label: "Balance Sheet", icon: TrendingUp },
  { path: "/profit-analytics", label: "Reports", icon: PieChart },
  { path: "/settings", label: "Settings", icon: Settings },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Hide bottom nav on landing and auth pages
  const hiddenPaths = ["/", "/auth"];
  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }

  const isActiveRoute = (path: string) => {
    if (path === "/dashboard") return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMoreOpen(false);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom shadow-lg">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryNavItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all active:scale-95",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isActive && "bg-primary/10"
                )}>
                  <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive && "text-primary"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
          
          {/* More Button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all active:scale-95",
              isMoreOpen 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              isMoreOpen && "bg-primary/10"
            )}>
              <Menu className={cn("h-5 w-5", isMoreOpen && "text-primary")} />
            </div>
            <span className={cn(
              "text-[10px] font-medium",
              isMoreOpen && "text-primary"
            )}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">More Options</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-4 pb-6">
            {moreMenuItems.map((item) => {
              const isActive = isActiveRoute(item.path);
              const Icon = item.icon;
              
              return (
                <button
                  key={item.path + item.label}
                  onClick={() => handleNavClick(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl transition-all active:scale-95",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className={cn("h-6 w-6 mb-2", isActive && "text-primary")} />
                  <span className="text-xs font-medium text-center">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
