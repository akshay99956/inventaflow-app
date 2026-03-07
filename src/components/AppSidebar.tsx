import { useEffect, useState } from "react";
import { Home, Package, FileText, TrendingUp, Receipt, LogOut, Settings, Users, PieChart, ShoppingCart, UserCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
const menuItems = [{
  title: "Dashboard",
  url: "/dashboard",
  icon: Home
}, {
  title: "Sales",
  url: "/invoices",
  icon: ShoppingCart
}, {
  title: "Inventory",
  url: "/inventory",
  icon: Package
}, {
  title: "Clients",
  url: "/clients",
  icon: Users
}, {
  title: "Purchases",
  url: "/bills",
  icon: Receipt
}, {
  title: "Balance Sheet",
  url: "/balance-sheet",
  icon: TrendingUp
}, {
  title: "Reports",
  url: "/profit-analytics",
  icon: PieChart
}, {
  title: "Profile",
  url: "/profile",
  icon: UserCircle
}, {
  title: "Settings",
  url: "/settings",
  icon: Settings
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("company_profile")
        .select("company_name, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setCompanyName(data.company_name);
        if (data.logo_url) {
          const urlParts = data.logo_url.split("/company-logos/");
          if (urlParts.length > 1) {
            const filePath = urlParts[1].split("?")[0];
            const { data: signedUrlData } = await supabase.storage
              .from("company-logos")
              .createSignedUrl(filePath, 3600);
            if (signedUrlData?.signedUrl) {
              setLogoUrl(signedUrlData.signedUrl);
            }
          }
        }
      }
    };
    fetchCompany();
  }, []);

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
  return <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 mb-2">
          <h2 className={`font-bold text-lg text-sidebar-foreground ${isCollapsed ? "hidden" : ""}`}>DJ CHARNYA</h2>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "hidden" : ""}>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent font-medium">
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="hover:bg-sidebar-accent">
                  <LogOut className="h-4 w-4" />
                  {!isCollapsed && <span>Logout</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>;
}