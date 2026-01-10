import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, User, LogOut, Settings, Menu, Receipt, FileText, TrendingUp, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
const moreMenuItems = [{
  path: "/bills",
  label: "Purchases",
  icon: Receipt
}, {
  path: "/invoices",
  label: "Invoices",
  icon: FileText
}, {
  path: "/balance-sheet",
  label: "Balance Sheet",
  icon: TrendingUp
}, {
  path: "/profit-analytics",
  label: "Reports",
  icon: PieChart
}, {
  path: "/settings",
  label: "Settings",
  icon: Settings
}];
export const TopNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Hide on landing and auth pages
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
  const handleLogout = async () => {
    const {
      error
    } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      navigate("/auth");
    }
  };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/inventory?search=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };
  return <>
      <header className="h-14 border-b flex items-center justify-between px-4 bg-background sticky top-0 z-10">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsMoreOpen(true)} className="h-9 w-9 md:hidden bg-secondary">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-bold text-lg text-primary">BizManager</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="h-9 w-9">
            <Search className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* More Menu Sheet - slides from left */}
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col py-2">
            {moreMenuItems.map(item => {
            const isActive = isActiveRoute(item.path);
            const Icon = item.icon;
            return <button key={item.path + item.label} onClick={() => handleNavClick(item.path)} className={cn("flex items-center gap-3 px-4 py-3 text-left transition-all", isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-foreground hover:bg-muted")}>
                  <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>;
          })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Search Sheet */}
      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent side="top" className="h-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>Search</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input placeholder="Search products, clients, invoices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" autoFocus />
            <Button type="submit">Search</Button>
          </form>
        </SheetContent>
      </Sheet>
    </>;
};