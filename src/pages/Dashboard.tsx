import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FileText, TrendingUp, DollarSign, Download, Printer, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { toast } from "sonner";

type LowStockProduct = {
  id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    totalRevenue: 0,
    totalStockValue: 0,
  });
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number }[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch basic stats
      const { data: products } = await supabase.from("products").select("*", { count: "exact" });
      const { data: invoices } = await supabase.from("invoices").select("*");
      
      const totalProducts = products?.length || 0;
      const totalInvoices = invoices?.length || 0;
      const pendingInvoices = invoices?.filter((inv) => inv.status !== "paid").length || 0;
      const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
      const totalStockValue = products?.reduce((sum, product) => sum + (product.quantity * product.unit_price), 0) || 0;

      // Find low stock products
      const lowStock = products?.filter(p => p.quantity <= p.low_stock_threshold) || [];
      setLowStockProducts(lowStock);

      setStats({
        totalProducts,
        totalInvoices,
        pendingInvoices,
        totalRevenue,
        totalStockValue,
      });

      // Calculate revenue trends by month
      if (invoices && invoices.length > 0) {
        const revenueByMonth = invoices.reduce((acc: any, inv) => {
          const month = format(new Date(inv.issue_date), "MMM yyyy");
          if (!acc[month]) {
            acc[month] = 0;
          }
          acc[month] += Number(inv.total) || 0;
          return acc;
        }, {});

        const sortedRevenue = Object.entries(revenueByMonth)
          .map(([month, revenue]) => ({ month, revenue: revenue as number }))
          .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
          .slice(-6); // Last 6 months

        setRevenueData(sortedRevenue);
      }

      // Fetch top products by revenue
      const { data: invoiceItems } = await supabase
        .from("invoice_items")
        .select("product_id, amount, products(name)");

      if (invoiceItems) {
        const productRevenue = invoiceItems.reduce((acc: any, item) => {
          const productName = (item.products as any)?.name || "Unknown";
          if (!acc[productName]) {
            acc[productName] = 0;
          }
          acc[productName] += Number(item.amount) || 0;
          return acc;
        }, {});

        const sortedProducts = Object.entries(productRevenue)
          .map(([name, revenue]) => ({ name, revenue: revenue as number }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5); // Top 5 products

        setTopProducts(sortedProducts);
      }

      // Fetch outstanding invoices
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

  const revenueChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  const productsChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) => headers.map((header) => `"${row[header] ?? ""}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${filename}.csv downloaded successfully`);
  };

  const handleExportCSV = () => {
    const date = new Date().toISOString().split("T")[0];
    
    if (revenueData.length > 0) {
      exportToCSV(revenueData, `revenue-trends-${date}`);
    }
    
    if (topProducts.length > 0) {
      exportToCSV(topProducts, `top-products-${date}`);
    }
    
    if (outstandingInvoices.length > 0) {
      const invoiceData = outstandingInvoices.map((inv) => ({
        customer_name: inv.customer_name,
        invoice_number: inv.invoice_number,
        due_date: format(new Date(inv.due_date), "MMM dd, yyyy"),
        total: Number(inv.total).toFixed(2),
        status: inv.status,
      }));
      exportToCSV(invoiceData, `outstanding-invoices-${date}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your business overview.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Stock Alert</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              {lowStockProducts.length} product{lowStockProducts.length > 1 ? "s are" : " is"} running low on stock:
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(p => (
                <Badge key={p.id} variant="outline" className="bg-destructive/20">
                  {p.name} ({p.quantity} left)
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">In inventory</p>
          </CardContent>
        </Card>

        <Card className={lowStockProducts.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${lowStockProducts.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockProducts.length > 0 ? "text-destructive" : ""}`}>
              {lowStockProducts.length}
            </div>
            <p className="text-xs text-muted-foreground">Need restocking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalStockValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Inventory value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[300px]">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-1))" }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={productsChartConfig} className="h-[300px]">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {outstandingInvoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No outstanding invoices</p>
            ) : (
              outstandingInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{invoice.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Invoice #{invoice.invoice_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Due: {format(new Date(invoice.due_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${Number(invoice.total).toFixed(2)}</p>
                    <Badge variant={invoice.status === "overdue" ? "destructive" : "secondary"}>
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
