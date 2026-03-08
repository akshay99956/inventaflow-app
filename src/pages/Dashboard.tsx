import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FileText, TrendingUp, IndianRupee, Download, Printer, MoreVertical, Share2, RefreshCw, AlertTriangle, Clock, ShoppingCart, ArrowUpRight, ArrowDownRight, Users, Receipt, CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, isAfter, isBefore, isEqual, parseISO } from "date-fns";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";
import { CompanyBranding } from "@/components/CompanyBranding";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cs = settings.currency_symbol || "₹";

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    totalRevenue: 0,
    totalStockValue: 0
  });
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number }[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);

  // New state for additional widgets
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [totalBillsAmount, setTotalBillsAmount] = useState(0);
  const [pendingBillsCount, setPendingBillsCount] = useState(0);
  const [totalClientsCount, setTotalClientsCount] = useState(0);
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [expenseVsRevenue, setExpenseVsRevenue] = useState<{ month: string; revenue: number; expense: number }[]>([]);

  const fetchAllData = async () => {
    const [
      { data: products },
      { data: invoices },
      { data: invoiceItems },
      { data: outstanding },
      { data: bills },
      { data: clients },
      { data: purchaseOrders }
    ] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("invoices").select("*"),
      supabase.from("invoice_items").select("product_id, amount, products(name)"),
      supabase.from("invoices").select("*").neq("status", "paid").order("due_date", { ascending: true }).limit(5),
      supabase.from("bills").select("*"),
      supabase.from("clients").select("id"),
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(5)
    ]);

    // Basic stats
    const totalProducts = products?.length || 0;
    const totalInvoices = invoices?.length || 0;
    const pendingInvoices = invoices?.filter((inv) => inv.status !== "paid").length || 0;
    const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
    const totalStockValue = products?.reduce((sum, p) => sum + p.quantity * p.unit_price, 0) || 0;
    setStats({ totalProducts, totalInvoices, pendingInvoices, totalRevenue, totalStockValue });

    // Revenue trends
    if (invoices && invoices.length > 0) {
      const revenueByMonth = invoices.reduce((acc: any, inv) => {
        const month = format(new Date(inv.issue_date), "MMM yyyy");
        acc[month] = (acc[month] || 0) + (Number(inv.total) || 0);
        return acc;
      }, {});
      setRevenueData(
        Object.entries(revenueByMonth)
          .map(([month, revenue]) => ({ month, revenue: revenue as number }))
          .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
          .slice(-6)
      );
    }

    // Top products
    if (invoiceItems) {
      const productRevenue = invoiceItems.reduce((acc: any, item) => {
        const name = (item.products as any)?.name || "Unknown";
        acc[name] = (acc[name] || 0) + (Number(item.amount) || 0);
        return acc;
      }, {});
      setTopProducts(
        Object.entries(productRevenue)
          .map(([name, revenue]) => ({ name, revenue: revenue as number }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      );
    }

    setOutstandingInvoices(outstanding || []);

    // Low stock products
    if (products) {
      const lowStock = products
        .filter((p) => p.quantity <= p.low_stock_threshold && p.quantity > 0)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5);
      const outOfStock = products.filter((p) => p.quantity === 0).slice(0, 3);
      setLowStockProducts([...outOfStock, ...lowStock].slice(0, 6));
    }

    // Bills summary
    if (bills) {
      setTotalBillsAmount(bills.reduce((sum, b) => sum + (Number(b.total) || 0), 0));
      setPendingBillsCount(bills.filter((b) => b.status === "pending").length);
      setRecentBills(bills.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));
    }

    // Clients count
    setTotalClientsCount(clients?.length || 0);

    // Recent POs
    setRecentPOs(purchaseOrders || []);

    // Expense vs Revenue (monthly comparison)
    if (invoices && bills) {
      const months: Record<string, { revenue: number; expense: number }> = {};
      invoices.forEach((inv) => {
        const m = format(new Date(inv.issue_date), "MMM");
        if (!months[m]) months[m] = { revenue: 0, expense: 0 };
        months[m].revenue += Number(inv.total) || 0;
      });
      bills.forEach((b) => {
        const m = format(new Date(b.bill_date), "MMM");
        if (!months[m]) months[m] = { revenue: 0, expense: 0 };
        months[m].expense += Number(b.total) || 0;
      });
      setExpenseVsRevenue(
        Object.entries(months)
          .map(([month, data]) => ({ month, ...data }))
          .slice(-6)
      );
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
    toast.success("Dashboard refreshed");
  };

  const handleShareWhatsApp = () => {
    let message = `📊 *Business Summary*\n`;
    message += `📅 ${format(new Date(), "dd MMM yyyy")}\n\n`;
    message += `📦 Products: ${stats.totalProducts}\n`;
    message += `💰 Stock Value: ${cs}${stats.totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n`;
    message += `📄 Pending Invoices: ${stats.pendingInvoices}\n`;
    message += `✅ Total Revenue: ${cs}${stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n`;
    if (outstandingInvoices.length > 0) {
      message += `\n⚠️ *Outstanding Invoices:*\n`;
      outstandingInvoices.forEach((inv) => {
        message += `• ${inv.customer_name} - ${cs}${Number(inv.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (Due: ${format(new Date(inv.due_date), "dd MMM")})\n`;
      });
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [headers.join(","), ...data.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${filename}.csv downloaded successfully`);
  };

  const handleExportCSV = () => {
    const date = new Date().toISOString().split("T")[0];
    if (revenueData.length > 0) exportToCSV(revenueData, `revenue-trends-${date}`);
    if (topProducts.length > 0) exportToCSV(topProducts, `top-products-${date}`);
    if (outstandingInvoices.length > 0) {
      exportToCSV(outstandingInvoices.map((inv) => ({
        customer_name: inv.customer_name,
        invoice_number: inv.invoice_number,
        due_date: format(new Date(inv.due_date), "MMM dd, yyyy"),
        total: Number(inv.total).toFixed(2),
        status: inv.status
      })), `outstanding-invoices-${date}`);
    }
  };

  const fmtCurrency = (val: number) => `${cs}${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const profit = stats.totalRevenue - totalBillsAmount;

  const revenueChartConfig = { revenue: { label: "Revenue", color: "hsl(var(--chart-1))" } } satisfies ChartConfig;
  const productsChartConfig = { revenue: { label: "Revenue", color: "hsl(var(--chart-2))" } } satisfies ChartConfig;
  const comparisonChartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
    expense: { label: "Expense", color: "hsl(var(--chart-4))" }
  } satisfies ChartConfig;
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Welcome back! Here's your business overview.</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="print:hidden flex-shrink-0">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            <Button onClick={handleRefresh} variant="ghost" size="sm" className="w-full justify-start" disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button onClick={handleShareWhatsApp} variant="ghost" size="sm" className="w-full justify-start">
              <Share2 className="h-4 w-4 mr-2" />Share Summary
            </Button>
            <Button onClick={handleExportCSV} variant="ghost" size="sm" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
            <Button onClick={() => window.print()} variant="ghost" size="sm" className="w-full justify-start">
              <Printer className="h-4 w-4 mr-2" />Print Report
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Row 1: Key Stats (6 cards) ── */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { title: "Products", value: stats.totalProducts.toString(), icon: Package, color: "text-primary", sub: "In inventory" },
          { title: "Stock Value", value: fmtCurrency(stats.totalStockValue), icon: IndianRupee, color: "text-destructive", sub: "Inventory worth" },
          { title: "Revenue", value: fmtCurrency(stats.totalRevenue), icon: TrendingUp, color: "text-success", sub: "All time" },
          { title: "Expenses", value: fmtCurrency(totalBillsAmount), icon: Receipt, color: "text-warning", sub: "Total bills" },
          { title: "Profit", value: fmtCurrency(profit), icon: profit >= 0 ? ArrowUpRight : ArrowDownRight, color: profit >= 0 ? "text-success" : "text-destructive", sub: profit >= 0 ? "Net positive" : "Net loss" },
          { title: "Clients", value: totalClientsCount.toString(), icon: Users, color: "text-secondary", sub: "Total clients" },
        ].map((item) => (
          <Card key={item.title} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `var(--gradient-primary)` }} />
            <CardContent className="p-3 md:p-4 pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{item.title}</span>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className={`text-lg md:text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Row 2: Charts ── */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Revenue Trends */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base">Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent className="p-1 md:p-6 pt-0">
            <ChartContainer config={revenueChartConfig} className="h-[150px] md:h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} width={40} tickFormatter={(v) => `${cs}${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-1))", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue vs Expenses */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-1 md:p-6 pt-0">
            <ChartContainer config={comparisonChartConfig} className="h-[150px] md:h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseVsRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} width={40} tickFormatter={(v) => `${cs}${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Top Products + Low Stock ── */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="p-1 md:p-6 pt-0">
            <ChartContainer config={productsChartConfig} className="h-[150px] md:h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `${cs}${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={50} tick={{ fontSize: 8 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Low Stock Alerts
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/inventory')}>
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {lowStockProducts.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">All products are well-stocked ✓</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product) => {
                  const pct = product.low_stock_threshold > 0
                    ? Math.min((product.quantity / product.low_stock_threshold) * 100, 100)
                    : 0;
                  const isOut = product.quantity === 0;
                  return (
                    <div key={product.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[60%]">{product.name}</span>
                        <Badge variant={isOut ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {isOut ? "Out of Stock" : `${product.quantity} left`}
                        </Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Outstanding Invoices + Recent Bills ── */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Outstanding Invoices */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm md:text-base">Outstanding Invoices</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{stats.pendingInvoices} pending</Badge>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {outstandingInvoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">No outstanding invoices ✓</p>
            ) : (
              <div className="space-y-2">
                {outstandingInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-2.5 md:p-3 border rounded-lg gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{invoice.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{invoice.invoice_number} • Due: {format(new Date(invoice.due_date), "dd MMM")}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">{fmtCurrency(Number(invoice.total))}</p>
                      <Badge variant={invoice.status === "overdue" ? "destructive" : "secondary"} className="text-[10px]">
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bills / Expenses */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm md:text-base">Recent Bills</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{pendingBillsCount} pending</Badge>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {recentBills.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">No bills yet</p>
            ) : (
              <div className="space-y-2">
                {recentBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-2.5 md:p-3 border rounded-lg gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{bill.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{bill.bill_number} • {format(new Date(bill.bill_date), "dd MMM")}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">{fmtCurrency(Number(bill.total))}</p>
                      <Badge variant={bill.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                        {bill.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 5: Recent Purchase Orders + Quick Actions ── */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Recent Purchase Orders */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Recent Purchase Orders
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/purchase-orders')}>
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {recentPOs.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">No purchase orders yet</p>
            ) : (
              <div className="space-y-2">
                {recentPOs.map((po) => (
                  <div key={po.id} className="flex items-center justify-between p-2.5 md:p-3 border rounded-lg gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{po.supplier_name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{po.po_number} • {format(new Date(po.po_date), "dd MMM")}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">{fmtCurrency(Number(po.total))}</p>
                      <Badge
                        variant={po.status === "received" ? "default" : po.status === "pending" ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {po.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "New Invoice", icon: FileText, path: "/invoices/new", color: "bg-primary/10 text-primary hover:bg-primary/20" },
                { label: "New Bill", icon: Receipt, path: "/bills/new", color: "bg-warning/10 text-warning hover:bg-warning/20" },
                { label: "Quick Bill", icon: TrendingUp, path: "/quick-bill", color: "bg-success/10 text-success hover:bg-success/20" },
                { label: "Quick Purchase", icon: ShoppingCart, path: "/quick-purchase", color: "bg-secondary/10 text-secondary hover:bg-secondary/20" },
                { label: "Inventory", icon: Package, path: "/inventory", color: "bg-accent/10 text-accent hover:bg-accent/20" },
                { label: "Clients", icon: Users, path: "/clients", color: "bg-info/10 text-info hover:bg-info/20" },
              ].map((action) => (
                <Button
                  key={action.label}
                  variant="ghost"
                  className={`h-auto py-4 flex flex-col items-center gap-2 rounded-xl transition-colors ${action.color}`}
                  onClick={() => navigate(action.path)}
                >
                  <action.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bill-style Print Area */}
      <div id="dashboard-print-area" className="hidden print:block">
        <div className="max-w-[80mm] mx-auto font-mono text-[11px] leading-tight">
          <CompanyBranding />
          <div className="text-center border-b border-dashed border-foreground pb-2 mb-2">
            <p className="font-bold text-sm">BUSINESS SUMMARY</p>
            <p className="text-[10px]">{format(new Date(), "dd MMM yyyy, hh:mm a")}</p>
          </div>
          <div className="border-b border-dashed border-foreground pb-2 mb-2 space-y-1">
            <div className="flex justify-between"><span>Total Products</span><span className="font-bold">{stats.totalProducts}</span></div>
            <div className="flex justify-between"><span>Stock Value</span><span className="font-bold">{fmtCurrency(stats.totalStockValue)}</span></div>
            <div className="flex justify-between"><span>Pending Invoices</span><span className="font-bold">{stats.pendingInvoices}</span></div>
            <div className="flex justify-between"><span>Total Revenue</span><span className="font-bold">{fmtCurrency(stats.totalRevenue)}</span></div>
            <div className="flex justify-between"><span>Total Expenses</span><span className="font-bold">{fmtCurrency(totalBillsAmount)}</span></div>
            <div className="flex justify-between"><span>Net Profit</span><span className="font-bold">{fmtCurrency(profit)}</span></div>
          </div>
          {outstandingInvoices.length > 0 && (
            <div className="border-b border-dashed border-foreground pb-2 mb-2">
              <p className="font-bold mb-1">OUTSTANDING INVOICES</p>
              {outstandingInvoices.map((inv) => (
                <div key={inv.id} className="flex justify-between text-[10px]">
                  <span className="truncate max-w-[45%]">{inv.customer_name}</span>
                  <span>{format(new Date(inv.due_date), "dd/MM")}</span>
                  <span className="font-bold">{fmtCurrency(Number(inv.total))}</span>
                </div>
              ))}
            </div>
          )}
          {revenueData.length > 0 && (
            <div className="border-b border-dashed border-foreground pb-2 mb-2">
              <p className="font-bold mb-1">MONTHLY REVENUE</p>
              {revenueData.map((item) => (
                <div key={item.month} className="flex justify-between text-[10px]">
                  <span>{item.month}</span>
                  <span className="font-bold">{fmtCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-center text-[9px] pt-2">
            <p>--- Thank You ---</p>
            <p className="mt-1">Generated by Fully Business</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
