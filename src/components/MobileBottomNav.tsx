import { useLocation, useNavigate } from "react-router-dom";
import { Home, ShoppingCart, Package, Users } from "lucide-react";
import { cn } from "@/lib/utils";
const primaryNavItems = [{
  path: "/dashboard",
  label: "Dashboard",
  icon: Home
}, {
  path: "/invoices",
  label: "Sales",
  icon: ShoppingCart
}, {
  path: "/inventory",
  label: "Inventory",
  icon: Package
}, {
  path: "/clients",
  label: "Clients",
  icon: Users
}];
export const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

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
  };
  return <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-[51px]">
        {primaryNavItems.map(item => {
        const isActive = isActiveRoute(item.path);
        const Icon = item.icon;
        return <button key={item.path} onClick={() => handleNavClick(item.path)} className={cn("flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all active:scale-95", isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <div className={cn("p-1.5 rounded-lg transition-colors", isActive && "bg-primary/10")}>
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              </div>
              <span className={cn("text-[10px] font-medium", isActive && "text-primary")}>
                {item.label}
              </span>
            </button>;
      })}
      </div>
    </nav>;
};