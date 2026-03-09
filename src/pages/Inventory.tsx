import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Pencil, Trash2, Printer, Share2, AlertTriangle, Package, IndianRupee, TrendingDown, Boxes, Download, TrendingUp, Upload, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { parseProductCSV } from "@/lib/csvUtils";
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
  low_stock_threshold: z.number().min(0, "Threshold must be positive"),
  supplier_name: z.string().max(200).optional(),
  storage_location: z.string().max(200).optional(),
  manufacturing_date: z.string().optional(),
  expiry_date: z.string().optional()
});
const UNITS = ['pc', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'set', 'pair', 'dozen', 'meter', 'ft'] as const;

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
  const navigate = useNavigate();
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
    low_stock_threshold: 10,
    supplier_name: "",
    storage_location: "",
    manufacturing_date: "",
    expiry_date: "",
    unit: "pc"
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
      filtered = filtered.filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) || product.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (categoryFilter) {
      filtered = filtered.filter((product) => product.category === categoryFilter);
    }
    setFilteredProducts(filtered);
  }, [searchTerm, categoryFilter, products]);
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  const lowStockProducts = products.filter((p) => p.quantity <= p.low_stock_threshold);
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
  // Check if product name already exists
  const isProductNameDuplicate = (name: string) => {
    const normalizedName = name.trim().toLowerCase();
    return products.some((p) =>
    p.name.trim().toLowerCase() === normalizedName && (
    !editingProduct || p.id !== editingProduct.id)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = productSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    // Check for duplicate product name
    if (isProductNameDuplicate(formData.name)) {
      toast.error(`Product "${formData.name}" already exists!`);
      return;
    }

    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) return;
    const submitData = {
      ...formData,
      supplier_name: formData.supplier_name || null,
      storage_location: formData.storage_location || null,
      manufacturing_date: formData.manufacturing_date || null,
      expiry_date: formData.expiry_date || null
    };
    if (editingProduct) {
      const {
        error
      } = await supabase.from("products").update(submitData).eq("id", editingProduct.id);
      if (error) {
        toast.error("Error updating product");
      } else {
        toast.success("Product updated successfully");
      }
    } else {
      const {
        error
      } = await supabase.from("products").insert([{
        ...submitData,
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
      low_stock_threshold: product.low_stock_threshold,
      supplier_name: product.supplier_name || "",
      storage_location: product.storage_location || "",
      manufacturing_date: product.manufacturing_date || "",
      expiry_date: product.expiry_date || "",
      unit: product.unit || "pc"
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
      low_stock_threshold: 10,
      supplier_name: "",
      storage_location: "",
      manufacturing_date: "",
      expiry_date: "",
      unit: "pc"
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
    message += filteredProducts.map((p) => {
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
    setSelectedPrintColumns((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
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
    const rows = filteredProducts.map((p) => [p.name, p.sku || '', p.category || '', p.quantity, p.purchase_price.toFixed(2), p.unit_price.toFixed(2), getProfitMargin(p).toFixed(2), getProfitPercentage(p).toFixed(2) + '%', (p.quantity * p.unit_price).toFixed(2), (getProfitMargin(p) * p.quantity).toFixed(2)]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
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

    // File size limit (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 5MB");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    try {
      // Use papaparse for proper CSV parsing with sanitization
      const result = await parseProductCSV(file, 1000);

      // Show any parsing errors/warnings
      if (result.errors.length > 0) {
        result.errors.slice(0, 3).forEach((err) => toast.error(err));
        if (result.errors.length > 3) {
          toast.error(`And ${result.errors.length - 3} more errors...`);
        }
      }

      if (result.data.length === 0) {
        if (result.errors.length === 0) {
          toast.error("No valid products found in CSV. Ensure there is a 'Name' column.");
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Add user_id to each product
      const productsToImport = result.data.map((product) => ({
        ...product,
        user_id: user.id
      }));

      const { error } = await supabase.from("products").insert(productsToImport);
      if (error) {
        toast.error("Error importing products. Please check your data and try again.");
      } else {
        toast.success(`Successfully imported ${productsToImport.length} products`);
        fetchProducts();
      }
    } catch (error) {
      toast.error("Error processing CSV file. Please ensure it's a valid CSV format.");
    }

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
              <Button onClick={resetForm} size="sm" className="bg-gradient-primary shadow-colorful hover:shadow-glow-md flex-1 sm:flex-none bg-success">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Product</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-lg border-2 border-primary/20 max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-gradient">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogDescription className="sr-only">
                  {editingProduct ? "Edit product details" : "Add a new product to inventory"}
                </DialogDescription>
              </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    name: e.target.value
                  })}
                  required
                  className={cn(
                    "border-primary/20 focus:border-primary",
                    formData.name && isProductNameDuplicate(formData.name) && "border-destructive focus:border-destructive"
                  )} />

                {formData.name && isProductNameDuplicate(formData.name) &&
                <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Product "{formData.name}" already exists
                  </p>
                }
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={formData.sku} onChange={(e) => setFormData({
                  ...formData,
                  sku: e.target.value
                })} className="border-primary/20 focus:border-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between border-primary/20 focus:border-primary">

                      {formData.category || "Select or type category..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[90%] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search or add category..."
                        onValueChange={(value) => setFormData({ ...formData, category: value })} />

                      <CommandList>
                        <CommandEmpty>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {}}>

                            Use "{formData.category}" as new category
                          </Button>
                        </CommandEmpty>
                        <CommandGroup heading="Existing Categories">
                          {[...new Set(products.map((p) => p.category).filter(Boolean))].map((category) =>
                          <CommandItem
                            key={category}
                            value={category || ""}
                            onSelect={(value) => {
                              setFormData({ ...formData, category: value });
                            }}>

                              <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.category === category ? "opacity-100" : "opacity-0"
                              )} />

                              {category}
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit of Measurement</Label>
                <select
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity ({formData.unit}) *</Label>
                  <Input id="quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({
                    ...formData,
                    quantity: Number(e.target.value)
                  })} required className="border-primary/20 focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price *</Label>
                  <Input id="purchase_price" type="number" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData({
                    ...formData,
                    purchase_price: Number(e.target.value)
                  })} required className="border-warning/20 focus:border-warning" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Sale Price *</Label>
                  <Input id="unit_price" type="number" step="0.01" value={formData.unit_price} onChange={(e) => setFormData({
                    ...formData,
                    unit_price: Number(e.target.value)
                  })} required className="border-primary/20 focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profit_display">Profit / Unit</Label>
                  <div className={cn(
                    "flex items-center h-10 rounded-md border px-3 text-sm font-semibold",
                    (formData.unit_price - formData.purchase_price) >= 0
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}>
                    ₹{(formData.unit_price - formData.purchase_price).toFixed(2)}
                    {formData.purchase_price > 0 && (
                      <span className="ml-1 text-xs opacity-70">
                        ({((formData.unit_price - formData.purchase_price) / formData.purchase_price * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Supplier & Storage */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier_name">Supplier Name</Label>
                  <Input id="supplier_name" value={formData.supplier_name} onChange={(e) => setFormData({
                    ...formData,
                    supplier_name: e.target.value
                  })} placeholder="Supplier" className="border-primary/20 focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_location">Storage Location</Label>
                  <Input id="storage_location" value={formData.storage_location} onChange={(e) => setFormData({
                    ...formData,
                    storage_location: e.target.value
                  })} placeholder="Warehouse, Shop..." className="border-primary/20 focus:border-primary" />
                </div>
              </div>
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturing_date">Mfg Date</Label>
                  <Input id="manufacturing_date" type="date" value={formData.manufacturing_date} onChange={(e) => setFormData({
                    ...formData,
                    manufacturing_date: e.target.value
                  })} className="border-primary/20 focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Expiry Date</Label>
                  <Input id="expiry_date" type="date" value={formData.expiry_date} onChange={(e) => setFormData({
                    ...formData,
                    expiry_date: e.target.value
                  })} className="border-warning/20 focus:border-warning" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                <Input id="low_stock_threshold" type="number" value={formData.low_stock_threshold} onChange={(e) => setFormData({
                  ...formData,
                  low_stock_threshold: Number(e.target.value)
                })} className="border-warning/20 focus:border-warning" />
                <p className="text-xs text-muted-foreground">Alert when quantity falls below this number</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={formData.description} onChange={(e) => setFormData({
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
      {/* Summary Cards - Inline like Sales page */}
      <div className="grid grid-cols-5 gap-2 md:gap-4 shadow-md rounded-sm opacity-80 bg-muted">
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-primary" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Products</p>
              <p className="text-sm md:text-2xl font-bold">{products.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-secondary" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Stock Value</p>
              <p className="text-sm md:text-2xl font-bold text-success">₹{totalInventoryValue >= 1000 ? `${(totalInventoryValue / 1000).toFixed(0)}k` : totalInventoryValue}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-cool" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Units</p>
              <p className="text-sm md:text-2xl font-bold text-secondary">{products.reduce((sum, p) => sum + p.quantity, 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-warm" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Profit</p>
              <p className="text-sm md:text-2xl font-bold text-info">₹{totalProfitMargin >= 1000 ? `${(totalProfitMargin / 1000).toFixed(0)}k` : totalProfitMargin}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm overflow-hidden ${lowStockProducts.length > 0 ? 'bg-destructive/5' : ''}`}>
          <div className={`h-1 ${lowStockProducts.length > 0 ? 'bg-destructive' : 'gradient-rainbow'}`} />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Low Stock</p>
              <p className={`text-sm md:text-2xl font-bold ${lowStockProducts.length > 0 ? 'text-destructive' : 'text-warning'}`}>{lowStockProducts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>


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
                {(Object.keys(printColumnLabels) as PrintColumn[]).map((col) => <div key={col} className="flex items-center space-x-2">
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
                  {filteredProducts.map((product) => <TableRow key={product.id}>
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
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 pb-4 px-[16px] py-[5px]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <CardTitle className="text-gradient font-bold text-sm">Products</CardTitle>
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
            <div className="flex flex-col sm:flex-row gap-3 w-full px-0 py-0">
              <Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 border-primary/20 focus:border-primary" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="flex h-10 w-full sm:w-48 rounded-md border border-secondary/30 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2">
                <option value="">All Categories</option>
                {categories.map((cat) => <option key={cat} value={cat || ""}>
                    {cat}
                  </option>)}
              </select>
            </div>
          </div>
        </CardHeader>

        {/* Mobile Card View - Compact */}
        {isMobile ? <CardContent className="p-2 space-y-2">
            {filteredProducts.map((product) => <Card key={product.id} className={`border-0 shadow-sm overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${isLowStock(product) ? "bg-destructive/5" : ""}`} onClick={() => navigate(`/inventory/${product.id}`)}>
                <div className={`h-0.5 ${isLowStock(product) ? "bg-destructive" : "gradient-primary"}`} />
                <CardContent className="p-3 px-[9px] py-0">
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
                          {product.quantity} <span className="text-xs font-normal text-muted-foreground">{product.unit || 'pc'}</span>
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
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleEdit(product); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}>
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
                {filteredProducts.map((product, index) => <TableRow key={product.id} className={`transition-colors cursor-pointer ${isLowStock(product) ? "bg-gradient-to-r from-destructive/10 to-warning/10 hover:from-destructive/20 hover:to-warning/20" : index % 2 === 0 ? "bg-card hover:bg-muted/30" : "bg-muted/20 hover:bg-muted/40"}`} onClick={() => navigate(`/inventory/${product.id}`)}>
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
                      {product.quantity} <span className="text-xs font-normal text-muted-foreground">{product.unit || 'pc'}</span>
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
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(product); }} className="hover:bg-primary/10 hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} className="hover:bg-destructive/10 hover:text-destructive">
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