import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, User, LogOut, Settings, Menu, Receipt, FileText, TrendingUp, PieChart, Package, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type Notification = {
  id: string;
  type: "low_stock" | "overdue_invoice" | "overdue_bill";
  title: string;
  message: string;
};

export const TopNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const newNotifications: Notification[] = [];

    // Check low stock products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, quantity, low_stock_threshold");
    
    if (products) {
      const lowStockItems = products.filter(p => p.quantity <= p.low_stock_threshold);
      lowStockItems.slice(0, 5).forEach(p => {
        newNotifications.push({
          id: `low_stock_${p.id}`,
          type: "low_stock",
          title: "Low Stock",
          message: `${p.name} has only ${p.quantity} units left`,
        });
      });
    }

    // Check overdue invoices
    const today = new Date().toISOString().split("T")[0];
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, due_date")
      .lt("due_date", today)
      .neq("status", "paid")
      .neq("status", "cancelled")
      .limit(5);

    if (overdueInvoices) {
      overdueInvoices.forEach(inv => {
        newNotifications.push({
          id: `overdue_inv_${inv.id}`,
          type: "overdue_invoice",
          title: "Overdue Invoice",
          message: `${inv.invoice_number} from ${inv.customer_name} is overdue`,
        });
      });
    }

    // Check overdue bills
    const { data: overdueBills } = await supabase
      .from("bills")
      .select("id, bill_number, customer_name, bill_date")
      .neq("status", "paid")
      .neq("status", "cancelled")
      .limit(5);

    if (overdueBills) {
      overdueBills.forEach(bill => {
        newNotifications.push({
          id: `overdue_bill_${bill.id}`,
          type: "overdue_bill",
          title: "Pending Bill",
          message: `${bill.bill_number} from ${bill.customer_name} is pending`,
        });
      });
    }

    setNotifications(newNotifications);
  };

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
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
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
          <span className="font-bold text-lg text-primary">DC</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="h-9 w-9">
            <Search className="h-5 w-5" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-3 border-b">
                <h4 className="font-semibold">Notifications</h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        if (notif.type === "low_stock") navigate("/inventory");
                        else if (notif.type === "overdue_invoice") navigate("/invoices");
                        else navigate("/bills");
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {notif.type === "low_stock" ? (
                          <Package className="h-4 w-4 text-warning mt-0.5" />
                        ) : notif.type === "overdue_invoice" ? (
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                        ) : (
                          <Clock className="h-4 w-4 text-info mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

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