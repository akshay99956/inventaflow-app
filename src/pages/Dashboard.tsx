import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FileText, IndianRupee, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

type LowStockProduct = {
  id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    pendingInvoices: 0,
    totalRevenue: 0,
    totalStockValue: 0,
  });
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: products } = await supabase.from("products").select("*");
      const { data: invoices } = await supabase.from("invoices").select("*");
      
      const totalProducts = products?.length || 0;
      const pendingInvoices = invoices?.filter((inv) => inv.status !== "paid").length || 0;
      const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
      const totalStockValue = products?.reduce((sum, product) => sum + (product.quantity * product.unit_price), 0) || 0;

      const lowStock = products?.filter(p => p.quantity <= p.low_stock_threshold) || [];
      setLowStockProducts(lowStock);

      setStats({ totalProducts, pendingInvoices, totalRevenue, totalStockValue });

      const { data: outstanding } = await supabase
        .from("invoices")
        .select("*")
        .neq("status", "paid")
        .order("due_date", { ascending: true })
        .limit(5);

      setOutstandingInvoices(outstanding || []);
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Business overview</p>
      </div>

      {lowStockProducts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Stock</AlertTitle>
          <AlertDescription>
            {lowStockProducts.length} product{lowStockProducts.length > 1 ? "s need" : " needs"} restocking
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{stats.totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {outstandingInvoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">No outstanding invoices</p>
            ) : (
              outstandingInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{invoice.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {format(new Date(invoice.due_date), "MMM dd")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{Number(invoice.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <Badge variant={invoice.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
