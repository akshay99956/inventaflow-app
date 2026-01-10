import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, IndianRupee, Package, Download, Percent, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  purchase_price: number;
  unit_price: number;
};
type InvoiceItem = {
  id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  product_id: string | null;
  invoice_id: string;
  invoices: {
    issue_date: string;
    status: string;
  } | null;
  products: {
    name: string;
    purchase_price: number;
  } | null;
};
const ProfitAnalytics = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);
  const fetchData = async () => {
    setLoading(true);
    const {
      data: productsData
    } = await supabase.from("products").select("*");
    const {
      data: itemsData
    } = await supabase.from("invoice_items").select(`
        *,
        invoices!inner(issue_date, status),
        products(name, purchase_price)
      `).gte("invoices.issue_date", dateFrom).lte("invoices.issue_date", dateTo).neq("invoices.status", "cancelled");
    setProducts(productsData || []);
    setInvoiceItems(itemsData || []);
    setLoading(false);
  };

  // Calculate profit metrics
  const calculateProfitMetrics = () => {
    let totalRevenue = 0;
    let totalCost = 0;
    const productProfits: Record<string, {
      name: string;
      revenue: number;
      cost: number;
      quantity: number;
    }> = {};
    const monthlyProfits: Record<string, {
      month: string;
      revenue: number;
      cost: number;
      profit: number;
    }> = {};
    invoiceItems.forEach(item => {
      const purchasePrice = item.products?.purchase_price || 0;
      const revenue = item.amount;
      const cost = purchasePrice * item.quantity;
      totalRevenue += revenue;
      totalCost += cost;

      // Track by product
      const productName = item.products?.name || "Unknown";
      if (!productProfits[productName]) {
        productProfits[productName] = {
          name: productName,
          revenue: 0,
          cost: 0,
          quantity: 0
        };
      }
      productProfits[productName].revenue += revenue;
      productProfits[productName].cost += cost;
      productProfits[productName].quantity += item.quantity;

      // Track by month
      if (item.invoices?.issue_date) {
        const month = format(new Date(item.invoices.issue_date), "MMM yyyy");
        if (!monthlyProfits[month]) {
          monthlyProfits[month] = {
            month,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }
        monthlyProfits[month].revenue += revenue;
        monthlyProfits[month].cost += cost;
        monthlyProfits[month].profit += revenue - cost;
      }
    });
    const totalProfit = totalRevenue - totalCost;
    const profitMarginPercent = totalRevenue > 0 ? totalProfit / totalRevenue * 100 : 0;

    // Sort and process product profits
    const topProfitableProducts = Object.values(productProfits).map(p => ({
      ...p,
      profit: p.revenue - p.cost,
      margin: p.revenue > 0 ? (p.revenue - p.cost) / p.revenue * 100 : 0
    })).sort((a, b) => b.profit - a.profit).slice(0, 10);

    // Sort monthly data
    const monthlyData = Object.values(monthlyProfits).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      profitMarginPercent,
      topProfitableProducts,
      monthlyData
    };
  };
  const metrics = calculateProfitMetrics();

  // Inventory profit potential
  const inventoryProfitPotential = products.reduce((sum, p) => sum + (p.unit_price - p.purchase_price) * p.quantity, 0);
  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))"
    },
    cost: {
      label: "Cost",
      color: "hsl(var(--chart-3))"
    },
    profit: {
      label: "Profit",
      color: "hsl(var(--chart-2))"
    }
  } satisfies ChartConfig;
  const handleCSVExport = () => {
    const headers = ['Product', 'Quantity Sold', 'Revenue', 'Cost', 'Profit', 'Margin %'];
    const rows = metrics.topProfitableProducts.map(p => [p.name, p.quantity, p.revenue.toFixed(2), p.cost.toFixed(2), p.profit.toFixed(2), p.margin.toFixed(2) + '%']);
    const csvContent = [`Profit Analytics Report (${dateFrom} to ${dateTo})`, '', `Total Revenue: ₹${metrics.totalRevenue.toFixed(2)}`, `Total Cost: ₹${metrics.totalCost.toFixed(2)}`, `Total Profit: ₹${metrics.totalProfit.toFixed(2)}`, `Profit Margin: ${metrics.profitMarginPercent.toFixed(2)}%`, '', headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profit_analytics_${dateFrom}_to_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Profit analytics exported to CSV');
  };
  return <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gradient">Profit Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground">Analyze your business profitability</p>
        </div>
        <Button onClick={handleCSVExport} variant="outline" className="border-success hover:bg-success/10" size={isMobile ? "sm" : "default"}>
          <Download className="h-4 w-4" />
          <span className="ml-2">Export Report</span>
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card className="border-2 border-primary/20 px-0 mx-0 pr-[43px]">
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-end">
            <div className="flex-1 w-full space-y-1">
              <Label htmlFor="dateFrom" className="text-xs md:text-sm">From Date</Label>
              <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border-primary/20" />
            </div>
            <div className="flex-1 w-full space-y-1">
              <Label htmlFor="dateTo" className="text-xs md:text-sm">To Date</Label>
              <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border-primary/20" />
            </div>
            <Button onClick={fetchData} className="bg-gradient-primary w-full sm:w-auto">
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Card className="border-2 border-primary/20 shadow-colorful">
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">Revenue</p>
                <p className="text-lg md:text-2xl font-bold text-primary truncate">₹{metrics.totalRevenue.toFixed(0)}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 ml-2">
                <IndianRupee className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-warning/20 shadow-colorful">
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">Cost</p>
                <p className="text-lg md:text-2xl font-bold text-warning truncate">₹{metrics.totalCost.toFixed(0)}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-warm flex items-center justify-center flex-shrink-0 ml-2">
                <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-warning-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-success/20 shadow-colorful">
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">Profit</p>
                <p className={`text-lg md:text-2xl font-bold truncate ${metrics.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ₹{metrics.totalProfit.toFixed(0)}
                </p>
              </div>
              <div className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center flex-shrink-0 ml-2 ${metrics.totalProfit >= 0 ? 'bg-gradient-to-br from-success to-success/60' : 'bg-gradient-to-br from-destructive to-destructive/60'}`}>
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-info/20 shadow-colorful">
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">Margin</p>
                <p className="text-lg md:text-2xl font-bold text-info">{metrics.profitMarginPercent.toFixed(1)}%</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-cool flex items-center justify-center flex-shrink-0 ml-2">
                <Percent className="h-5 w-5 md:h-6 md:w-6 text-info-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-secondary/20 shadow-colorful col-span-2 md:col-span-1">
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">Inventory Potential</p>
                <p className="text-lg md:text-2xl font-bold text-secondary truncate">₹{inventoryProfitPotential.toFixed(0)}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-secondary flex items-center justify-center flex-shrink-0 ml-2">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-secondary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
        <Card className="border-2 border-accent/20 shadow-colorful">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 px-3 md:px-6 py-2 md:py-4">
            <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Monthly Profit Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 md:pt-6 px-1 md:px-6 pb-2 md:pb-6">
            <ChartContainer config={chartConfig} className="h-[150px] md:h-[300px] w-full">
              <AreaChart data={metrics.monthlyData} margin={isMobile ? { top: 5, right: 5, left: -20, bottom: 5 } : { top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: isMobile ? 8 : 12 }}
                  tickFormatter={(value) => isMobile ? value.slice(0, 3) : value}
                  interval={isMobile ? 0 : "preserveStartEnd"}
                />
                <YAxis 
                  tick={{ fontSize: isMobile ? 8 : 12 }}
                  tickFormatter={(value) => isMobile ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`}
                  width={isMobile ? 35 : 60}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-2 border-accent/20 shadow-colorful">
          <CardHeader className="bg-gradient-to-r from-success/5 to-info/5 px-3 md:px-6 py-2 md:py-4">
            <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" />
              Revenue vs Cost vs Profit
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 md:pt-6 px-1 md:px-6 pb-2 md:pb-6">
            <ChartContainer config={chartConfig} className="h-[150px] md:h-[300px] w-full">
              <BarChart data={metrics.monthlyData} margin={isMobile ? { top: 5, right: 5, left: -20, bottom: 5 } : { top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: isMobile ? 8 : 12 }}
                  tickFormatter={(value) => isMobile ? value.slice(0, 3) : value}
                  interval={isMobile ? 0 : "preserveStartEnd"}
                />
                <YAxis 
                  tick={{ fontSize: isMobile ? 8 : 12 }}
                  tickFormatter={(value) => isMobile ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`}
                  width={isMobile ? 35 : 60}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="cost" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="profit" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Profitable Products */}
      <Card className="border-2 border-accent/20 shadow-colorful">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-success/5 px-3 md:px-6 py-3 md:py-4">
          <CardTitle className="text-gradient text-base md:text-lg">Top Profitable Products</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 md:pt-6 px-0 md:px-6">
          {/* Mobile Card View */}
          {isMobile ? <div className="space-y-3 px-3">
              {metrics.topProfitableProducts.map((product, index) => <Card key={product.name} className="bg-muted/20">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-gradient-primary text-primary-foreground text-xs">#{index + 1}</Badge>
                      <span className="font-medium text-sm truncate">{product.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Qty Sold:</span>
                        <span className="ml-1 font-medium">{product.quantity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Revenue:</span>
                        <span className="ml-1 font-medium text-primary">₹{product.revenue.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Profit:</span>
                        <span className={`ml-1 font-semibold ${product.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                          ₹{product.profit.toFixed(0)}
                        </span>
                      </div>
                      <div>
                        <Badge variant={product.margin >= 20 ? "default" : product.margin >= 10 ? "secondary" : "destructive"} className={`text-xs ${product.margin >= 20 ? "bg-success" : ""}`}>
                          {product.margin.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>)}
              {metrics.topProfitableProducts.length === 0 && <p className="text-center text-muted-foreground py-8">
                  No sales data found for the selected period
                </p>}
            </div> : (/* Desktop Table View */
        <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-primary/10 to-accent/10">
                  <TableHead className="font-bold">Product</TableHead>
                  <TableHead className="text-right font-bold">Qty Sold</TableHead>
                  <TableHead className="text-right font-bold">Revenue</TableHead>
                  <TableHead className="text-right font-bold">Cost</TableHead>
                  <TableHead className="text-right font-bold">Profit</TableHead>
                  <TableHead className="text-right font-bold">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.topProfitableProducts.map((product, index) => <TableRow key={product.name} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gradient-primary text-primary-foreground">#{index + 1}</Badge>
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                    <TableCell className="text-right text-primary">₹{product.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-warning">₹{product.cost.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-semibold ${product.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ₹{product.profit.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={product.margin >= 20 ? "default" : product.margin >= 10 ? "secondary" : "destructive"} className={product.margin >= 20 ? "bg-success" : ""}>
                        {product.margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>)}
                {metrics.topProfitableProducts.length === 0 && <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No sales data found for the selected period
                    </TableCell>
                  </TableRow>}
              </TableBody>
            </Table>)}
        </CardContent>
      </Card>
    </div>;
};
export default ProfitAnalytics;