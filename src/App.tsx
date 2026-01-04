import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Invoices from "./pages/Invoices";
import InvoiceCreate from "./pages/InvoiceCreate";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseOrderCreate from "./pages/PurchaseOrderCreate";
import BalanceSheet from "./pages/BalanceSheet";
import Settings from "./pages/Settings";
import Clients from "./pages/Clients";
import ProfitAnalytics from "./pages/ProfitAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 pb-16 md:pb-0">
        <header className="h-14 border-b flex items-center px-4 bg-background sticky top-0 z-10">
          <SidebarTrigger className="hidden md:flex" />
          <span className="md:hidden font-semibold text-lg">InventaFlow</span>
        </header>
        {children}
      </main>
      <MobileBottomNav />
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Inventory />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Invoices />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/new"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <InvoiceCreate />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PurchaseOrders />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders/new"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PurchaseOrderCreate />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/balance-sheet"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <BalanceSheet />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Clients />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profit-analytics"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProfitAnalytics />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Settings />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
