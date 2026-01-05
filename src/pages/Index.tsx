import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, Package, FileText, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 md:h-16 items-center justify-between px-4">
          <h1 className="text-xl md:text-2xl font-bold text-primary">BizManager</h1>
          <div className="flex gap-2 md:space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-sm">
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="text-sm">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-12 md:py-20 text-center">
          <h2 className="mb-4 md:mb-6 text-3xl md:text-5xl font-bold text-foreground leading-tight">
            Complete Business Management Solution
          </h2>
          <p className="mb-6 md:mb-8 text-base md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your inventory, invoices, and finances in one powerful platform
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="w-full sm:w-auto">
            Start Managing Now
          </Button>
        </section>

        <section className="bg-secondary/20 py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid gap-6 md:gap-8 grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col items-center text-center space-y-2 md:space-y-4 p-4">
                <div className="rounded-full bg-primary p-3 md:p-4">
                  <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary-foreground" />
                </div>
                <h3 className="text-sm md:text-xl font-semibold">Dashboard Analytics</h3>
                <p className="text-xs md:text-base text-muted-foreground">
                  Real-time insights into your business performance
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-2 md:space-y-4 p-4">
                <div className="rounded-full bg-primary p-3 md:p-4">
                  <Package className="h-6 w-6 md:h-8 md:w-8 text-primary-foreground" />
                </div>
                <h3 className="text-sm md:text-xl font-semibold">Inventory Control</h3>
                <p className="text-xs md:text-base text-muted-foreground">
                  Track products, stock levels, and manage categories
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-2 md:space-y-4 p-4">
                <div className="rounded-full bg-primary p-3 md:p-4">
                  <FileText className="h-6 w-6 md:h-8 md:w-8 text-primary-foreground" />
                </div>
                <h3 className="text-sm md:text-xl font-semibold">Invoice Management</h3>
                <p className="text-xs md:text-base text-muted-foreground">
                  Create and track customer invoices effortlessly
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-2 md:space-y-4 p-4">
                <div className="rounded-full bg-primary p-3 md:p-4">
                  <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-primary-foreground" />
                </div>
                <h3 className="text-sm md:text-xl font-semibold">Balance Sheet</h3>
                <p className="text-xs md:text-base text-muted-foreground">
                  Monitor income, expenses, and financial health
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 md:py-20 text-center">
          <h2 className="mb-4 md:mb-6 text-2xl md:text-3xl font-bold text-foreground">Ready to Transform Your Business?</h2>
          <Button size="lg" onClick={() => navigate("/auth")} className="w-full sm:w-auto">
            Get Started Free
          </Button>
        </section>
      </main>

      <footer className="border-t py-6 md:py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 BizManager. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;