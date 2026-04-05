import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, ArrowLeft, Package, Search, PlusCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toastWithSound as toast } from "@/lib/toastWithSound";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/contexts/SettingsContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const billSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  customer_email: z.string().email("Invalid email").optional().or(z.literal("")),
  customer_phone: z.string().optional().or(z.literal("")),
  bill_date: z.string().min(1, "Bill date is required"),
  notes: z.string().optional()
});

type BillFormData = z.infer<typeof billSchema>;
type BillItem = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

type Product = {
  id: string;
  name: string;
  purchase_price: number;
  unit_price: number;
  quantity: number;
  category: string | null;
};

const UNITS = ["kg", "ltr", "pc", "box", "pack", "set", "pair", "g", "ml", "dozen"];

const BillCreate = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { settings } = useSettings();
  const cs = settings.currency_symbol || "₹";
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<BillItem[]>([{
    product_id: null,
    description: "",
    quantity: 1,
    unit_price: 0
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(settings.tax_enabled);
  const [taxRate, setTaxRate] = useState(settings.default_tax_rate);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  // Quick Add Product
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", purchase_price: "", unit_price: "", category: "", unit: "pc" });
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      bill_date: new Date().toISOString().split("T")[0],
      notes: ""
    }
  });

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, purchase_price, unit_price, quantity, category")
        .order("name");
      if (!error && data) {
        setProducts(data);
      }
    };
    fetchProducts();
  }, []);

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[])
  ).sort();

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()));
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleQuickAddProduct = async () => {
    if (!newProduct.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setIsAddingProduct(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name: newProduct.name.trim(),
          purchase_price: parseFloat(newProduct.purchase_price) || 0,
          unit_price: parseFloat(newProduct.unit_price) || 0,
          category: newProduct.category.trim() || null,
          unit: newProduct.unit || "pc",
          quantity: 0,
        })
        .select("id, name, unit_price, purchase_price, quantity, category")
        .single();

      if (error) throw error;

      toast.success(`${data.name} added!`);
      setProducts((prev) => [...prev, data as Product].sort((a, b) => a.name.localeCompare(b.name)));
      quickAddProduct(data as Product);
      setNewProduct({ name: "", purchase_price: "", unit_price: "", category: "", unit: "pc" });
      setShowQuickAdd(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add product");
    } finally {
      setIsAddingProduct(false);
    }
  };

  const quickAddProduct = (product: Product) => {
    const existingIndex = items.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      setItems(newItems);
      toast.success(`${product.name} quantity increased`);
    } else {
      const filteredItems = items.filter((item) => item.product_id !== null || item.description !== "");
      setItems([...filteredItems, {
        product_id: product.id,
        description: product.name,
        quantity: 1,
        unit_price: product.purchase_price
      }]);
      toast.success(`${product.name} added`);
    }
  };

  const getItemQty = (productId: string) => {
    return items.find((i) => i.product_id === productId)?.quantity || 0;
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      setItems([{ product_id: null, description: "", quantity: 1, unit_price: 0 }]);
    }
  };

  const updateItem = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const tax = taxEnabled ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const onSubmit = async (data: BillFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create a bill");
        return;
      }

      const { subtotal, tax, total } = calculateTotals();
      const billNumber = `BILL-${Date.now()}`;

      const { data: bill, error: billError } = await supabase.from("bills").insert({
        bill_number: billNumber,
        user_id: user.id,
        customer_name: data.customer_name,
        customer_email: data.customer_email || null,
        bill_date: data.bill_date,
        notes: data.notes || null,
        status: "active",
        subtotal,
        tax,
        total
      }).select().single();

      if (billError) throw billError;

      const itemsToInsert = items
        .filter((item) => item.description && item.quantity > 0 && item.unit_price > 0)
        .map((item) => ({
          bill_id: bill.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from("bill_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;

        for (const item of itemsToInsert) {
          if (item.product_id) {
            const product = products.find((p) => p.id === item.product_id);
            if (product) {
              await supabase.from("products").update({
                quantity: product.quantity + item.quantity
              }).eq("id", item.product_id);
            }
          }
        }
      }

      toast.success("Bill created successfully");
      navigate("/bills");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error creating bill:", error);
      }
      toast.error("Failed to create bill");
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, tax, total } = calculateTotals();
  const itemCount = items.filter((i) => i.product_id).length;

  return (
    <div className="p-3 md:p-8 space-y-3 md:space-y-6 pb-40 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/bills")} className="h-8 w-8 md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground">Create Bill</h1>
            <p className="text-xs md:text-base text-muted-foreground">Add new purchase</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/bills")} className="hidden md:flex">
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 md:space-y-6">
          {/* Customer & Date */}
          <Card>
            <CardHeader className="py-2 px-3 md:pb-4 md:px-6 bg-accent/30">
              <CardTitle className="text-sm md:text-lg">Supplier Info</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-3">
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <FormField control={form.control} name="customer_name" render={({ field }) =>
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Supplier *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Name" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                } />
                <FormField control={form.control} name="bill_date" render={({ field }) =>
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Date *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                } />
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <FormField control={form.control} name="customer_email" render={({ field }) =>
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Optional" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                } />
                <FormField control={form.control} name="customer_phone" render={({ field }) =>
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Phone</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" placeholder="Optional" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                } />
              </div>
            </CardContent>
          </Card>

          {/* Items - Mobile-first POS-style picker */}
          <Card>
            <CardHeader className="py-2 px-3 md:pb-4 md:px-6 bg-primary/10">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items ({itemCount})
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-dashed border-primary/40 text-primary"
                  onClick={() => setShowQuickAdd(true)}
                >
                  <PlusCircle className="h-3 w-3 mr-1" />
                  New Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 md:p-6 space-y-3">
              {/* Product Search + Add */}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between h-10 text-sm border-dashed border-2 border-primary/30 hover:border-primary"
                onClick={() => setShowProductPicker(true)}
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Search & add products...</span>
                </div>
                <Plus className="h-4 w-4 text-primary" />
              </Button>

              {/* Added Items */}
              {itemCount === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No items added yet. Tap above to add products.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.filter((i) => i.product_id).map((item, _) => {
                    const actualIndex = items.findIndex((i) => i === item);
                    return (
                      <div key={actualIndex} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {cs}{item.unit_price}/unit
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => { if (item.quantity > 1) updateItem(actualIndex, "quantity", item.quantity - 1); }}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateItem(actualIndex, "quantity", item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="font-semibold text-sm w-14 text-right">
                          {cs}{(item.quantity * item.unit_price).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </p>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => removeItem(actualIndex)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{cs}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Switch id="tax-toggle-bill" checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                    <Label htmlFor="tax-toggle-bill" className="text-xs md:text-sm text-muted-foreground">
                      {settings.tax_name}
                    </Label>
                  </div>
                  {taxEnabled && (
                    <div className="flex items-center gap-1">
                      <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-12 h-7 text-center text-xs" min={0} max={100} step={0.1} />
                      <span className="text-xs text-muted-foreground">%</span>
                      <span className="font-medium text-xs">{cs}{tax.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-sm md:text-lg font-bold pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">{cs}{total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="py-2 px-3 md:pb-4 md:px-6 bg-muted/50">
              <CardTitle className="text-sm md:text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <FormField control={form.control} name="notes" render={({ field }) =>
                <FormItem>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes (optional)"
                      className="min-h-[60px] md:min-h-[80px] text-xs md:text-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              } />
            </CardContent>
          </Card>

          {/* Fixed bottom action bar */}
          <div className="fixed bottom-16 left-0 right-0 p-3 bg-background/95 backdrop-blur border-t md:relative md:bottom-auto md:border-0 md:p-0 md:bg-transparent z-40">
            <div className="flex gap-2 items-center max-w-4xl mx-auto">
              {itemCount > 0 && (
                <div className="flex-1 min-w-0 md:hidden">
                  <p className="text-xs text-muted-foreground">{itemCount} items</p>
                  <p className="text-sm font-bold text-primary">{cs}{total.toFixed(2)}</p>
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => navigate("/bills")}
                className="h-10 text-sm md:flex-none">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}
                className="flex-1 md:flex-none h-10 text-sm bg-primary hover:bg-primary/90">
                {isSubmitting ? "Creating..." : "Create Bill"}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      {/* Product Picker Dialog - POS grid style */}
      <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-3 pb-2">
            <DialogTitle className="text-sm">Select Products</DialogTitle>
          </DialogHeader>
          <div className="px-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10 h-9"
                autoFocus
              />
            </div>
            {categories.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <Button type="button" variant={selectedCategory === "" ? "default" : "outline"} size="sm"
                  className="h-6 text-[10px] whitespace-nowrap flex-shrink-0"
                  onClick={() => setSelectedCategory("")}>
                  All
                </Button>
                {categories.map((cat) => (
                  <Button key={cat} type="button" variant={selectedCategory === cat ? "default" : "outline"} size="sm"
                    className="h-6 text-[10px] whitespace-nowrap flex-shrink-0"
                    onClick={() => setSelectedCategory(cat)}>
                    {cat}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {filteredProducts.map((product) => {
                const inCart = getItemQty(product.id);
                return (
                  <Card key={product.id}
                    className={`cursor-pointer transition-all active:scale-95 ${inCart > 0 ? "ring-2 ring-primary" : ""}`}
                    onClick={() => { quickAddProduct(product); }}>
                    <CardContent className="p-2.5">
                      <p className="font-semibold text-xs truncate">{product.name}</p>
                      {product.category && (
                        <p className="text-[10px] text-muted-foreground truncate">{product.category}</p>
                      )}
                      <p className="text-sm font-bold text-primary mt-0.5">
                        {cs}{product.purchase_price.toLocaleString("en-IN")}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground">Stock: {product.quantity}</span>
                        {inCart > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">×{inCart}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredProducts.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-6 text-sm">No products found</p>
              )}
            </div>
          </div>
          <div className="border-t p-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{itemCount} items • {cs}{total.toFixed(2)}</p>
            <Button type="button" size="sm" onClick={() => setShowProductPicker(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Product Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <PlusCircle className="h-4 w-4 text-primary" />
              Quick Add Product
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Product Name *</Label>
              <Input placeholder="e.g. Rice Flour" value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Purchase Price</Label>
                <Input type="number" placeholder="0" value={newProduct.purchase_price}
                  onChange={(e) => setNewProduct((p) => ({ ...p, purchase_price: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Sell Price</Label>
                <Input type="number" placeholder="0" value={newProduct.unit_price}
                  onChange={(e) => setNewProduct((p) => ({ ...p, unit_price: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Category</Label>
                <Input placeholder="e.g. Grocery" value={newProduct.category}
                  onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Select value={newProduct.unit} onValueChange={(v) => setNewProduct((p) => ({ ...p, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowQuickAdd(false)}>Cancel</Button>
            <Button type="button" onClick={handleQuickAddProduct}
              disabled={isAddingProduct || !newProduct.name.trim()}
              className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" />
              {isAddingProduct ? "Adding..." : "Add & Select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillCreate;
