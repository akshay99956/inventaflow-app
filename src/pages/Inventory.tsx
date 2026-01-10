import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Printer, Share2, AlertTriangle, Package, IndianRupee, TrendingDown, Boxes, Download, TrendingUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SwipeableCard } from "@/components/SwipeableCard";
import { useIsMobile } from "@/hooks/use-mobile";
const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  sku: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  quantity: z.number().min(0, "Quantity must be positive"),
  purchase_price: z.number().min(0, "Purchase price must be positive"),
  unit_price: z.number().min(0, "Sale price must be positive"),
  category: z.string().max(100).optional(),
  low_stock_threshold: z.number().min(0, "Threshold must be positive")
});
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
};
type PrintColumn = 'name' | 'sku' | 'quantity' | 'purchase_price' | 'unit_price' | 'profit' | 'total_value';
const printColumnLabels: Record<PrintColumn, string> = {
  name: 'Name',
  sku: 'SKU',
  quantity: 'Quantity',
  purchase_price: 'Purchase Price',
  unit_price: 'Sale Price',
  profit: 'Profit',
  total_value: 'Total Value'
};
const Inventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedPrintColumns, setSelectedPrintColumns] = useState<PrintColumn[]>(['name', 'quantity', 'unit_price']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    quantity: 0,
    purchase_price: 0,
    unit_price: 0,
    category: "",
    low_stock_threshold: 10
  });
  const fetchProducts = async () => {
    const {
      data,
      error
    } = await supabase.from("products").select("*").order("created_at", {
      ascending: false
    });
    if (error) {
      toast.error("Error fetching products");
    } else {
      setProducts(data || []);
      setFilteredProducts(data || []);
    }
  };
  useEffect(() => {
    let filtered = products;
    if (searchTerm) {
      filtered = filtered.filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) || product.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (categoryFilter) {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }
    setFilteredProducts(filtered);
  }, [searchTerm, categoryFilter, products]);
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const lowStockProducts = products.filter(p => p.quantity <= p.low_stock_threshold);
  useEffect(() => {
    fetchProducts();
    const channel = supabase.channel("products-changes").on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "products"
    }, () => {
      fetchProducts();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = productSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) return;
    if (editingProduct) {
      const {
        error
      } = await supabase.from("products").update({
        ...formData
      }).eq("id", editingProduct.id);
      if (error) {
        toast.error("Error updating product");
      } else {
        toast.success("Product updated successfully");
      }
    } else {
      const {
        error
      } = await supabase.from("products").insert([{
        ...formData,
        user_id: user.id
      }]);
      if (error) {
        toast.error("Error creating product");
      } else {
        toast.success("Product created successfully");
      }
    }
    setIsDialogOpen(false);
    resetForm();
    fetchProducts();
  };
  const handleDelete = async (id: string) => {
    const {
      error
    } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Error deleting product");
    } else {
      toast.success("Product deleted successfully");
      fetchProducts();
    }
  };
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      quantity: product.quantity,
      purchase_price: product.purchase_price || 0,
      unit_price: product.unit_price,
      category: product.category || "",
      low_stock_threshold: product.low_stock_threshold
    });
    setIsDialogOpen(true);
  };
  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      description: "",
      quantity: 0,
      purchase_price: 0,
      unit_price: 0,
      category: "",
      low_stock_threshold: 10
    });
    setEditingProduct(null);
  };
  const handlePrint = () => {
    window.print();
  };
  const handleWhatsAppShare = () => {
    const totalValue = filteredProducts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
    const totalProfit = filteredProducts.reduce((sum, p) => sum + (p.unit_price - p.purchase_price) * p.quantity, 0);
    let message = `📦 Inventory Stock Report\n\nTotal Products: ${filteredProducts.length}`;
    if (selectedPrintColumns.includes('total_value')) message += `\nTotal Stock Value: ₹${totalValue.toFixed(2)}`;
    if (selectedPrintColumns.includes('profit')) message += `\nTotal Profit Margin: ₹${totalProfit.toFixed(2)}`;
    message += `\n\n`;
    message += filteredProducts.map(p => {
      let line = `• ${p.name}`;
      const details: string[] = [];
      if (selectedPrintColumns.includes('quantity')) details.push(`Qty: ${p.quantity}`);
      if (selectedPrintColumns.includes('purchase_price')) details.push(`Purchase: ₹${p.purchase_price.toFixed(2)}`);
      if (selectedPrintColumns.includes('unit_price')) details.push(`Sale: ₹${p.unit_price.toFixed(2)}`);
      if (selectedPrintColumns.includes('profit')) {
        const margin = p.unit_price - p.purchase_price;
        const marginPct = p.purchase_price > 0 ? (margin / p.purchase_price * 100).toFixed(1) : '0';
        details.push(`Profit: ₹${margin.toFixed(2)} (${marginPct}%)`);
      }
      if (details.length > 0) line += `\n  ${details.join(' | ')}`;
      return line;
    }).join('\n');
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  const togglePrintColumn = (col: PrintColumn) => {
    setSelectedPrintColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };
  const totalInventoryValue = filteredProducts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
  const totalProfitMargin = filteredProducts.reduce((sum, p) => sum + (p.unit_price - p.purchase_price) * p.quantity, 0);
  const isLowStock = (product: Product) => product.quantity <= product.low_stock_threshold;
  const getProfitMargin = (product: Product) => product.unit_price - product.purchase_price;
  const getProfitPercentage = (product: Product) => {
    if (product.purchase_price === 0) return 0;
    return (product.unit_price - product.purchase_price) / product.purchase_price * 100;
  };
  const handleCSVExport = () => {
    const headers = ['Name', 'SKU', 'Category', 'Quantity', 'Purchase Price', 'Sale Price', 'Profit Margin', 'Profit %', 'Total Value', 'Total Profit'];
    const rows = filteredProducts.map(p => [p.name, p.sku || '', p.category || '', p.quantity, p.purchase_price.toFixed(2), p.unit_price.toFixed(2), getProfitMargin(p).toFixed(2), getProfitPercentage(p).toFixed(2) + '%', (p.quantity * p.unit_price).toFixed(2), (getProfitMargin(p) * p.quantity).toFixed(2)]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Inventory exported to CSV');
  };
  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h === 'name' || h === 'product name');
        const skuIdx = headers.findIndex(h => h === 'sku');
        const categoryIdx = headers.findIndex(h => h === 'category');
        const quantityIdx = headers.findIndex(h => h === 'quantity' || h === 'qty');
        const purchasePriceIdx = headers.findIndex(h => h.includes('purchase') || h.includes('cost'));
        const salePriceIdx = headers.findIndex(h => h.includes('sale') || h.includes('unit') || h === 'price');
        if (nameIdx === -1) {
          toast.error("CSV must have a 'Name' column");
          return;
        }
        const productsToImport = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
          const name = values[nameIdx];
          if (!name) continue;
          productsToImport.push({
            user_id: user.id,
            name,
            sku: skuIdx >= 0 ? values[skuIdx] || null : null,
            category: categoryIdx >= 0 ? values[categoryIdx] || null : null,
            quantity: quantityIdx >= 0 ? parseInt(values[quantityIdx]) || 0 : 0,
            purchase_price: purchasePriceIdx >= 0 ? parseFloat(values[purchasePriceIdx]) || 0 : 0,
            unit_price: salePriceIdx >= 0 ? parseFloat(values[salePriceIdx]) || 0 : 0,
            low_stock_threshold: 10
          });
        }
        if (productsToImport.length === 0) {
          toast.error("No valid products found in CSV");
          return;
        }
        const {
          error
        } = await supabase.from("products").insert(productsToImport);
        if (error) {
          toast.error("Error importing products: " + error.message);
        } else {
          toast.success(`Successfully imported ${productsToImport.length} products`);
          fetchProducts();
        }
      } catch (error) {
        toast.error("Error parsing CSV file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  return <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gradient">Inventory</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your products and stock</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} onChange={handleCSVImport} accept=".csv" className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="border-info hover:bg-info/10 flex-1 sm:flex-none">
            <Upload className="h-4 w-4 sm:mr-2 text-info" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCSVExport} className="border-success hover:bg-success/10 flex-1 sm:flex-none">
            <Download className="h-4 w-4 sm:mr-2 text-success" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsPrintDialogOpen(true)} className="border-secondary hover:bg-secondary/10 flex-1 sm:flex-none">
            <Printer className="h-4 w-4 sm:mr-2 text-secondary" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} size="sm" className="bg-gradient-primary shadow-colorful hover:shadow-glow-md flex-1 sm:flex-none">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Product</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-2 border-primary/20">
              <DialogHeader>
                <DialogTitle className="text-gradient">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogDescription className="sr-only">
                  {editingProduct ? "Edit product details" : "Add a new product to inventory"}
                </DialogDescription>
              </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({
                  ...formData,
                  name: e.target.value
                })} required className="border-primary/20 focus:border-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={formData.sku} onChange={e => setFormData({
                  ...formData,
                  sku: e.target.value
                })} className="border-primary/20 focus:border-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" value={formData.category} onChange={e => setFormData({
                  ...formData,
                  category: e.target.value
                })} className="border-primary/20 focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input id="quantity" type="number" value={formData.quantity} onChange={e => setFormData({
                    ...formData,
                    quantity: Number(e.target.value)
                  })} required className="border-primary/20 focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price *</Label>
                  <Input id="purchase_price" type="number" step="0.01" value={formData.purchase_price} onChange={e => setFormData({
                    ...formData,
                    purchase_price: Number(e.target.value)
                  })} required className="border-warning/20 focus:border-warning" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Sale Price *</Label>
                  <Input id="unit_price" type="number" step="0.01" value={formData.unit_price} onChange={e => setFormData({
                    ...formData,
                    unit_price: Number(e.target.value)
                  })} required className="border-primary/20 focus:border-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                <Input id="low_stock_threshold" type="number" value={formData.low_stock_threshold} onChange={e => setFormData({
                  ...formData,
                  low_stock_threshold: Number(e.target.value)
                })} className="border-warning/20 focus:border-warning" />
                <p className="text-xs text-muted-foreground">Alert when quantity falls below this number</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={formData.description} onChange={e => setFormData({
                  ...formData,
                  description: e.target.value
                })} className="border-primary/20 focus:border-primary" />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary shadow-colorful hover:shadow-glow-md bg-success">
                {editingProduct ? "Update Product" : "Add Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="border-2 border-primary/20 shadow-colorful hover:shadow-glow-sm transition-shadow">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Products</p>
                <p className="text-xl md:text-2xl font-bold text-gradient">{products.length}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-success/20 shadow-colorful hover:shadow-glow-sm transition-shadow">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Stock Value</p>
                <p className="text-lg md:text-2xl font-bold text-success">₹{totalInventoryValue.toLocaleString('en-IN', {
                  maximumFractionDigits: 0
                })}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-success to-success/60 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="h-5 w-5 md:h-6 md:w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-secondary/20 shadow-colorful hover:shadow-glow-sm transition-shadow">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Units</p>
                <p className="text-xl md:text-2xl font-bold text-secondary">{products.reduce((sum, p) => sum + p.quantity, 0)}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-secondary flex items-center justify-center flex-shrink-0">
                <Boxes className="h-5 w-5 md:h-6 md:w-6 text-secondary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-info/20 shadow-colorful hover:shadow-glow-sm transition-shadow">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Profit</p>
                <p className="text-lg md:text-2xl font-bold text-info">₹{totalProfitMargin.toLocaleString('en-IN', {
                  maximumFractionDigits: 0
                })}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-info to-info/60 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-info-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`col-span-2 lg:col-span-1 border-2 shadow-colorful hover:shadow-glow-sm transition-shadow ${lowStockProducts.length > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-warning/20'}`}>
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className={`text-xl md:text-2xl font-bold ${lowStockProducts.length > 0 ? 'text-destructive' : 'text-warning'}`}>
                  {lowStockProducts.length}
                </p>
              </div>
              <div className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center flex-shrink-0 ${lowStockProducts.length > 0 ? 'bg-gradient-to-br from-destructive to-destructive/60' : 'bg-gradient-warm'}`}>
                <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-destructive-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockProducts.length > 0 && <Alert className="border-2 border-destructive/40 bg-gradient-to-r from-destructive/10 to-warning/10">
          <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
          <AlertTitle className="text-destructive font-bold text-sm md:text-base">Low Stock Alert</AlertTitle>
          <AlertDescription className="text-destructive/80 text-xs md:text-sm">
            {lowStockProducts.length} product{lowStockProducts.length > 1 ? "s" : ""} running low: 
            <span className="font-semibold"> {lowStockProducts.slice(0, 3).map(p => p.name).join(", ")}{lowStockProducts.length > 3 ? ` +${lowStockProducts.length - 3} more` : ''}</span>
          </AlertDescription>
        </Alert>}

      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:mb-8">
            <DialogTitle className="text-2xl">Inventory Stock Report</DialogTitle>
            <DialogDescription className="sr-only">
              View and print inventory stock report or share via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div id="inventory-print-area" className="space-y-6">
            {/* Column Selection - Hidden on Print */}
            <div className="print:hidden p-4 bg-muted/30 rounded-lg">
              <Label className="text-sm font-medium mb-3 block">Select columns to include:</Label>
              <div className="flex flex-wrap gap-4">
                {(Object.keys(printColumnLabels) as PrintColumn[]).map(col => <div key={col} className="flex items-center space-x-2">
                    <Checkbox id={`col-${col}`} checked={selectedPrintColumns.includes(col)} onCheckedChange={() => togglePrintColumn(col)} />
                    <Label htmlFor={`col-${col}`} className="text-sm cursor-pointer">
                      {printColumnLabels[col]}
                    </Label>
                  </div>)}
              </div>
            </div>

            <div className="flex justify-between items-start print:mb-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">INVENTORY REPORT</h2>
                <p className="text-muted-foreground mt-2">
                  Generated on {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleWhatsAppShare} variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectedPrintColumns.includes('name') && <TableHead>Name</TableHead>}
                    {selectedPrintColumns.includes('sku') && <TableHead>SKU</TableHead>}
                    {selectedPrintColumns.includes('quantity') && <TableHead className="text-right">Qty</TableHead>}
                    {selectedPrintColumns.includes('purchase_price') && <TableHead className="text-right">Purchase</TableHead>}
                    {selectedPrintColumns.includes('unit_price') && <TableHead className="text-right">Sale</TableHead>}
                    {selectedPrintColumns.includes('profit') && <TableHead className="text-right">Profit</TableHead>}
                    {selectedPrintColumns.includes('total_value') && <TableHead className="text-right">Total Value</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => <TableRow key={product.id}>
                      {selectedPrintColumns.includes('name') && <TableCell className="font-medium">{product.name}</TableCell>}
                      {selectedPrintColumns.includes('sku') && <TableCell>{product.sku || "-"}</TableCell>}
                      {selectedPrintColumns.includes('quantity') && <TableCell className="text-right">{product.quantity}</TableCell>}
                      {selectedPrintColumns.includes('purchase_price') && <TableCell className="text-right">₹{product.purchase_price.toFixed(2)}</TableCell>}
                      {selectedPrintColumns.includes('unit_price') && <TableCell className="text-right">₹{product.unit_price.toFixed(2)}</TableCell>}
                      {selectedPrintColumns.includes('profit') && <TableCell className="text-right text-info">
                          ₹{getProfitMargin(product).toFixed(2)} ({getProfitPercentage(product).toFixed(1)}%)
                        </TableCell>}
                      {selectedPrintColumns.includes('total_value') && <TableCell className="text-right font-semibold">
                          ₹{(product.quantity * product.unit_price).toFixed(2)}
                        </TableCell>}
                    </TableRow>)}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Products:</span>
                  <span className="text-foreground font-medium">{filteredProducts.length}</span>
                </div>
                {selectedPrintColumns.includes('total_value') && <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Inventory Value:</span>
                    <span className="text-foreground font-medium">₹{totalInventoryValue.toFixed(2)}</span>
                  </div>}
                {selectedPrintColumns.includes('profit') && <div className="flex justify-between text-lg font-bold pt-2 border-t text-info">
                    <span>Total Profit Margin:</span>
                    <span>₹{totalProfitMargin.toFixed(2)}</span>
                  </div>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search and Filter Section */}
      <Card className="border-2 border-accent/20 shadow-colorful">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <CardTitle className="text-gradient">Products</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total Stock Value: <span className="font-bold text-success">₹{totalInventoryValue.toLocaleString('en-IN', {
                    maximumFractionDigits: 0
                  })}</span>
                  {lowStockProducts.length > 0 && <Badge className="ml-2 bg-gradient-to-r from-destructive to-warning text-destructive-foreground">
                      {lowStockProducts.length} Low Stock
                    </Badge>}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Input placeholder="Search products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 border-primary/20 focus:border-primary" />
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="flex h-10 w-full sm:w-48 rounded-md border border-secondary/30 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2">
                <option value="">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat || ""}>
                    {cat}
                  </option>)}
              </select>
            </div>
          </div>
        </CardHeader>

        {/* Mobile Card View - Compact */}
        {isMobile ? <CardContent className="p-2 space-y-2">
            {filteredProducts.map(product => <Card key={product.id} className={`border-0 shadow-sm overflow-hidden ${isLowStock(product) ? "bg-destructive/5" : ""}`}>
                <div className={`h-0.5 ${isLowStock(product) ? "bg-destructive" : "gradient-primary"}`} />
                <CardContent className="p-3">
                  {/* Main Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{product.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {product.sku && <span>SKU: {product.sku}</span>}
                        {product.category && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-secondary/30 text-secondary">
                            {product.category}
                          </Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-base font-bold ${isLowStock(product) ? "text-destructive" : "text-primary"}`}>
                          {product.quantity}
                        </p>
                        <p className="text-[10px] text-muted-foreground">in stock</p>
                      </div>
                      {isLowStock(product) && <Badge className="text-[10px] px-1.5 bg-destructive/80">Low</Badge>}
                    </div>
                  </div>
                  
                  {/* Price & Actions Row */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">₹{product.purchase_price.toFixed(0)}</span>
                      <span className="text-success font-medium">→ ₹{product.unit_price.toFixed(0)}</span>
                      <span className={`font-medium ${getProfitPercentage(product) >= 0 ? 'text-info' : 'text-destructive'}`}>
                        +{getProfitPercentage(product).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(product)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
            {filteredProducts.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">No products found</p>}
          </CardContent> : (/* Desktop Table View */
      <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/15 hover:to-accent/15">
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">SKU</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="text-right font-bold">Quantity</TableHead>
                  <TableHead className="text-right font-bold">Purchase</TableHead>
                  <TableHead className="text-right font-bold">Sale</TableHead>
                  <TableHead className="text-right font-bold">Profit</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product, index) => <TableRow key={product.id} className={`transition-colors ${isLowStock(product) ? "bg-gradient-to-r from-destructive/10 to-warning/10 hover:from-destructive/20 hover:to-warning/20" : index % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className={isLowStock(product) ? "text-destructive font-semibold" : ""}>{product.name}</span>
                        {isLowStock(product) && <Badge className="text-xs bg-gradient-to-r from-destructive to-warning text-destructive-foreground animate-pulse">
                            Low Stock
                          </Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{product.sku || "-"}</TableCell>
                    <TableCell>
                      {product.category ? <Badge variant="outline" className="border-secondary/30 text-secondary">
                          {product.category}
                        </Badge> : "-"}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${isLowStock(product) ? "text-destructive" : "text-primary"}`}>
                      {product.quantity}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">₹{product.purchase_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium text-success">₹{product.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-medium text-info">₹{getProfitMargin(product).toFixed(2)}</span>
                        <span className={`text-xs ${getProfitPercentage(product) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {getProfitPercentage(product).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} className="hover:bg-primary/10 hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>)}
      </Card>
    </div>;
};
export default Inventory;