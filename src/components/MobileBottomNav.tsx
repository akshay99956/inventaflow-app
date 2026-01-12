import { useLocation, useNavigate } from "react-router-dom";
import { Home, ShoppingCart, Package, Users, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

const allNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: Home, settingKey: "show_dashboard" as const },
  { path: "/invoices", label: "Sales", icon: ShoppingCart, settingKey: "show_sales" as const },
  { path: "/bills", label: "Purchases", icon: Receipt, settingKey: "show_sales" as const },
  { path: "/inventory", label: "Inventory", icon: Package, settingKey: "show_inventory" as const },
  { path: "/clients", label: "Clients", icon: Users, settingKey: "show_clients" as const },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, loading } = useSettings();

  // Hide bottom nav on landing and auth pages
  const hiddenPaths = ["/", "/auth"];
  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }

  // Filter items based on settings
  const visibleNavItems = allNavItems.filter(item => {
    if (loading) return true; // Show all while loading
    return settings[item.settingKey];
  });

  // Ensure at least 2 items are visible
  const navItems = visibleNavItems.length >= 2 
    ? visibleNavItems 
    : allNavItems.slice(0, 2);

  const isActiveRoute = (path: string) => {
    if (path === "/dashboard") return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = isActiveRoute(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn("p-1.5 rounded-lg transition-colors", isActive && "bg-primary/10")}>
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              </div>
              <span className={cn("text-[10px] font-medium", isActive && "text-primary")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
