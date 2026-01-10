import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FileText, TrendingUp, IndianRupee, Download, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    totalRevenue: 0,
    totalStockValue: 0
  });
  const [revenueData, setRevenueData] = useState<{
    month: string;
    revenue: number;
  }[]>([]);
  const [topProducts, setTopProducts] = useState<{
    name: string;
    revenue: number;
  }[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);
  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch basic stats
      const {
        data: products
      } = await supabase.from("products").select("*", {
        count: "exact"
      });
      const {
        data: invoices
      } = await supabase.from("invoices").select("*");
      const totalProducts = products?.length || 0;
      const totalInvoices = invoices?.length || 0;
      const pendingInvoices = invoices?.filter(inv => inv.status !== "paid").length || 0;
      const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
      const totalStockValue = products?.reduce((sum, product) => sum + product.quantity * product.unit_price, 0) || 0;
      setStats({
        totalProducts,
        totalInvoices,
        pendingInvoices,
        totalRevenue,
        totalStockValue
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
        const sortedRevenue = Object.entries(revenueByMonth).map(([month, revenue]) => ({
          month,
          revenue: revenue as number
        })).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()).slice(-6); // Last 6 months

        setRevenueData(sortedRevenue);
      }

      // Fetch top products by revenue
      const {
        data: invoiceItems
      } = await supabase.from("invoice_items").select("product_id, amount, products(name)");
      if (invoiceItems) {
        const productRevenue = invoiceItems.reduce((acc: any, item) => {
          const productName = (item.products as any)?.name || "Unknown";
          if (!acc[productName]) {
            acc[productName] = 0;
          }
          acc[productName] += Number(item.amount) || 0;
          return acc;
        }, {});
        const sortedProducts = Object.entries(productRevenue).map(([name, revenue]) => ({
          name,
          revenue: revenue as number
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 5); // Top 5 products

        setTopProducts(sortedProducts);
      }

      // Fetch outstanding invoices
      const {
        data: outstanding
      } = await supabase.from("invoices").select("*").neq("status", "paid").order("due_date", {
        ascending: true
      }).limit(5);
      setOutstandingInvoices(outstanding || []);
    };
    fetchDashboardData();
  }, []);
  const revenueChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))"
    }
  } satisfies ChartConfig;
  const productsChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-2))"
    }
  } satisfies ChartConfig;
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [headers.join(","), ...data.map(row => headers.map(header => `"${row[header] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;"
    });
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
      const invoiceData = outstandingInvoices.map(inv => ({
        customer_name: inv.customer_name,
        invoice_number: inv.invoice_number,
        due_date: format(new Date(inv.due_date), "MMM dd, yyyy"),
        total: Number(inv.total).toFixed(2),
        status: inv.status
      }));
      exportToCSV(invoiceData, `outstanding-invoices-${date}`);
    }
  };
  const handlePrint = () => {
    window.print();
  };
  return <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Welcome back! Here's your business overview.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Printer className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Print Report</span>
            <span className="sm:hidden">Print</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4 bg-primary-foreground">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2 bg-[#efe7f3]">
            <CardTitle className="text-xs md:text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">In inventory</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2 bg-[#f1e4e4]">
            <CardTitle className="text-xs md:text-sm font-medium">Stock Value</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">₹{stats.totalStockValue.toLocaleString('en-IN', {
              maximumFractionDigits: 0
            })}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">Inventory value</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2 bg-[#d6e9f0]">
            <CardTitle className="text-xs md:text-sm font-medium">Pending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.pendingInvoices}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2 bg-[#d9eacd]">
            <CardTitle className="text-xs md:text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">₹{stats.totalRevenue.toLocaleString('en-IN', {
              maximumFractionDigits: 0
            })}</div>
            <p className="text-xs text-muted-foreground hidden sm:block">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 bg-[#e6e5e5]">
            <CardTitle className="text-sm md:text-lg">Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent className="p-1 md:p-6 pt-0">
            <ChartContainer config={revenueChartConfig} className="h-[150px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{
                top: 5,
                right: 10,
                left: 0,
                bottom: 5
              }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{
                  fontSize: 9
                }} interval="preserveStartEnd" />
                  <YAxis tick={{
                  fontSize: 9
                }} width={40} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{
                  fill: "hsl(var(--chart-1))",
                  r: 3
                }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 bg-[#e6e5e5]">
            <CardTitle className="text-sm md:text-lg">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="p-1 md:p-6 pt-0">
            <ChartContainer config={productsChartConfig} className="h-[150px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{
                top: 5,
                right: 10,
                left: 0,
                bottom: 5
              }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{
                  fontSize: 9
                }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={50} tick={{
                  fontSize: 8
                }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6 px-[15px] my-0 bg-[#ededed]">
          <CardTitle className="text-base md:text-lg">Outstanding Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="space-y-3">
            {outstandingInvoices.length === 0 ? <p className="text-muted-foreground text-center py-4 text-sm">No outstanding invoices</p> : outstandingInvoices.map(invoice => <div key={invoice.id} className="flex items-center justify-between p-3 md:p-4 border rounded-lg gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm md:text-base truncate">{invoice.customer_name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      #{invoice.invoice_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due: {format(new Date(invoice.due_date), "MMM dd")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm md:text-lg font-bold">₹{Number(invoice.total).toLocaleString('en-IN', {
                  maximumFractionDigits: 0
                })}</p>
                    <Badge variant={invoice.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                      {invoice.status}
                    </Badge>
                  </div>
                </div>)}
          </div>
        </CardContent>
      </Card>
    </div>;
};
export default Dashboard;