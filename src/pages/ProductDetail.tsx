import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Package, IndianRupee, TrendingUp, Pencil, MapPin, Factory, Calendar, AlertTriangle, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  quantity: number;
  purchase_price: number;
  unit_price: number;
  category: string | null;
  low_stock_threshold: number;
  supplier_name: string | null;
  storage_location: string | null;
  manufacturing_date: string | null;
  expiry_date: string | null;
  unit: string | null;
  created_at: string;
  updated_at: string;
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const cs = settings.currency_symbol || "₹";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalSold, setTotalSold] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      setLoading(true);
      const [{ data, error }, { data: salesData }] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).single(),
        supabase.from("invoice_items").select("quantity, amount").eq("product_id", id),
      ]);
      if (error || !data) {
        toast.error("Product not found");
        navigate("/inventory");
        return;
      }
      setProduct(data);
      if (salesData) {
        setTotalSold(salesData.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0));
        setTotalRevenue(salesData.reduce((sum, i) => sum + (Number(i.amount) || 0), 0));
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  if (loading || !product) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const profitPerUnit = product.unit_price - product.purchase_price;
  const profitPct = product.purchase_price > 0 ? (profitPerUnit / product.purchase_price) * 100 : 0;
  const isLowStock = product.quantity <= product.low_stock_threshold;
  const stockPct = product.low_stock_threshold > 0 ? Math.min((product.quantity / product.low_stock_threshold) * 100, 100) : 100;
  const totalStockValue = product.quantity * product.unit_price;
  const totalProfitPotential = product.quantity * profitPerUnit;

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")} className="flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{product.name}</h1>
            {isLowStock && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Low Stock
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {product.sku && <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>}
            {product.category && (
              <Badge variant="outline" className="text-[10px] border-secondary/30 text-secondary">{product.category}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { title: "In Stock", value: product.quantity.toString(), icon: Package, color: isLowStock ? "text-destructive" : "text-primary", sub: `Threshold: ${product.low_stock_threshold}` },
          { title: "Sale Price", value: `${cs}${product.unit_price.toFixed(2)}`, icon: IndianRupee, color: "text-success", sub: `Buy: ${cs}${product.purchase_price.toFixed(2)}` },
          { title: "Profit/Unit", value: `${cs}${profitPerUnit.toFixed(2)}`, icon: TrendingUp, color: profitPerUnit >= 0 ? "text-info" : "text-destructive", sub: `${profitPct.toFixed(1)}% margin` },
          { title: "Stock Value", value: `${cs}${totalStockValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: BarChart3, color: "text-warning", sub: `Profit: ${cs}${totalProfitPotential.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
        ].map((item) => (
          <Card key={item.title} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "var(--gradient-primary)" }} />
            <CardContent className="p-3 md:p-4 pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{item.title}</span>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className={`text-lg md:text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stock Level + Sales Performance */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base">Stock Level</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Stock</span>
                <span className="font-bold">{product.quantity} units</span>
              </div>
              <Progress value={stockPct} className={`h-3 ${isLowStock ? "[&>div]:bg-destructive" : ""}`} />
              <p className="text-xs text-muted-foreground">
                {isLowStock ? `⚠️ Below threshold (${product.low_stock_threshold})` : `✓ Above threshold (${product.low_stock_threshold})`}
              </p>
            </div>
            {product.description && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base">Sales Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
              <span className="text-sm text-muted-foreground">Total Units Sold</span>
              <span className="text-lg font-bold text-primary">{totalSold}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <span className="text-lg font-bold text-success">{cs}{totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
              <span className="text-sm text-muted-foreground">Total Profit Earned</span>
              <span className="text-lg font-bold text-info">{cs}{(totalSold * profitPerUnit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Details */}
      <Card>
        <CardHeader className="p-3 md:p-6 pb-2">
          <CardTitle className="text-sm md:text-base">Product Details</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Supplier", value: product.supplier_name, icon: Factory },
              { label: "Storage Location", value: product.storage_location, icon: MapPin },
              { label: "Manufacturing Date", value: product.manufacturing_date ? format(new Date(product.manufacturing_date), "dd MMM yyyy") : null, icon: Calendar },
              { label: "Expiry Date", value: product.expiry_date ? format(new Date(product.expiry_date), "dd MMM yyyy") : null, icon: Calendar },
              { label: "Created", value: format(new Date(product.created_at), "dd MMM yyyy"), icon: Calendar },
              { label: "Last Updated", value: format(new Date(product.updated_at), "dd MMM yyyy"), icon: Calendar },
            ].filter((d) => d.value).map((detail) => (
              <div key={detail.label} className="flex items-center gap-3 p-2.5 rounded-lg border">
                <detail.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{detail.label}</p>
                  <p className="text-sm font-medium">{detail.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductDetail;
