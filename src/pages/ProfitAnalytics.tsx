import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, IndianRupee, Package, Download, Percent, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";

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

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: productsData } = await supabase
      .from("products")
      .select("*");
    
    const { data: itemsData } = await supabase
      .from("invoice_items")
      .select(`
        *,
        invoices!inner(issue_date, status),
        products(name, purchase_price)
      `)
      .gte("invoices.issue_date", dateFrom)
      .lte("invoices.issue_date", dateTo)
      .neq("invoices.status", "cancelled");
    
    setProducts(productsData || []);
    setInvoiceItems(itemsData || []);
    setLoading(false);
  };

  // Calculate profit metrics
  const calculateProfitMetrics = () => {
    let totalRevenue = 0;
    let totalCost = 0;
    const productProfits: Record<string, { name: string; revenue: number; cost: number; quantity: number }> = {};
    const monthlyProfits: Record<string, { month: string; revenue: number; cost: number; profit: number }> = {};

    invoiceItems.forEach(item => {
      const purchasePrice = item.products?.purchase_price || 0;
      const revenue = item.amount;
      const cost = purchasePrice * item.quantity;
      
      totalRevenue += revenue;
      totalCost += cost;

      // Track by product
      const productName = item.products?.name || "Unknown";
      if (!productProfits[productName]) {
        productProfits[productName] = { name: productName, revenue: 0, cost: 0, quantity: 0 };
      }
      productProfits[productName].revenue += revenue;
      productProfits[productName].cost += cost;
      productProfits[productName].quantity += item.quantity;

      // Track by month
      if (item.invoices?.issue_date) {
        const month = format(new Date(item.invoices.issue_date), "MMM yyyy");
        if (!monthlyProfits[month]) {
          monthlyProfits[month] = { month, revenue: 0, cost: 0, profit: 0 };
        }
        monthlyProfits[month].revenue += revenue;
        monthlyProfits[month].cost += cost;
        monthlyProfits[month].profit += (revenue - cost);
      }
    });

    const totalProfit = totalRevenue - totalCost;
    const profitMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Sort and process product profits
    const topProfitableProducts = Object.values(productProfits)
      .map(p => ({
        ...p,
        profit: p.revenue - p.cost,
        margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Sort monthly data
    const monthlyData = Object.values(monthlyProfits)
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

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
  const inventoryProfitPotential = products.reduce((sum, p) => 
    sum + ((p.unit_price - p.purchase_price) * p.quantity), 0
  );

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
    cost: { label: "Cost", color: "hsl(var(--chart-3))" },
    profit: { label: "Profit", color: "hsl(var(--chart-2))" },
  } satisfies ChartConfig;

  const handleCSVExport = () => {
    const headers = ['Product', 'Quantity Sold', 'Revenue', 'Cost', 'Profit', 'Margin %'];
    const rows = metrics.topProfitableProducts.map(p => [
      p.name,
      p.quantity,
      p.revenue.toFixed(2),
      p.cost.toFixed(2),
      p.profit.toFixed(2),
      p.margin.toFixed(2) + '%'
    ]);

    const csvContent = [
      `Profit Analytics Report (${dateFrom} to ${dateTo})`,
      '',
      `Total Revenue: ₹${metrics.totalRevenue.toFixed(2)}`,
      `Total Cost: ₹${metrics.totalCost.toFixed(2)}`,
      `Total Profit: ₹${metrics.totalProfit.toFixed(2)}`,
      `Profit Margin: ${metrics.profitMarginPercent.toFixed(2)}%`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profit_analytics_${dateFrom}_to_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Profit analytics exported to CSV');
  };

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Profit Analytics</h1>
          <p className="text-muted-foreground">Analyze your business profitability</p>
        </div>
        <Button onClick={handleCSVExport} variant="outline" className="border-success hover:bg-success/10">
          <Download className="mr-2 h-4 w-4 text-success" /> Export Report
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44 border-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-44 border-primary/20"
              />
            </div>
            <Button onClick={fetchData} className="bg-gradient-primary">
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-2 border-primary/20 shadow-colorful">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-primary">₹{metrics.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-warning/20 shadow-colorful">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold text-warning">₹{metrics.totalCost.toFixed(2)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-warm flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-warning-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-success/20 shadow-colorful">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                <p className={`text-2xl font-bold ${metrics.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ₹{metrics.totalProfit.toFixed(2)}
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${metrics.totalProfit >= 0 ? 'bg-gradient-to-br from-success to-success/60' : 'bg-gradient-to-br from-destructive to-destructive/60'}`}>
                <TrendingUp className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-info/20 shadow-colorful">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profit Margin</p>
                <p className="text-2xl font-bold text-info">{metrics.profitMarginPercent.toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-cool flex items-center justify-center">
                <Percent className="h-6 w-6 text-info-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-secondary/20 shadow-colorful">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inventory Potential</p>
                <p className="text-2xl font-bold text-secondary">₹{inventoryProfitPotential.toFixed(2)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-secondary flex items-center justify-center">
                <Package className="h-6 w-6 text-secondary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-2 border-accent/20 shadow-colorful">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Monthly Profit Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={metrics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-2 border-accent/20 shadow-colorful">
          <CardHeader className="bg-gradient-to-r from-success/5 to-info/5">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Revenue vs Cost vs Profit
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={metrics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Profitable Products Table */}
      <Card className="border-2 border-accent/20 shadow-colorful">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-success/5">
          <CardTitle className="text-gradient">Top Profitable Products</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
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
              {metrics.topProfitableProducts.map((product, index) => (
                <TableRow key={product.name} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
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
                    <Badge variant={product.margin >= 20 ? "default" : product.margin >= 10 ? "secondary" : "destructive"} 
                           className={product.margin >= 20 ? "bg-success" : ""}>
                      {product.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {metrics.topProfitableProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No sales data found for the selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitAnalytics;
