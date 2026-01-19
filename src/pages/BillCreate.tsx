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
import { Plus, Trash2, ArrowLeft, Package, Search, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/contexts/SettingsContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const billSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  customer_email: z.string().email("Invalid email").optional().or(z.literal("")),
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
};

const BillCreate = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { settings } = useSettings();
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      customer_name: "",
      customer_email: "",
      bill_date: new Date().toISOString().split("T")[0],
      notes: ""
    }
  });

  // Fetch products for selection
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, purchase_price, unit_price, quantity")
        .order("name");
      if (!error && data) {
        setProducts(data);
      }
    };
    fetchProducts();
  }, []);

  // Quick add product - directly adds to list
  const quickAddProduct = (product: Product) => {
    // Check if product already in items
    const existingIndex = items.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Increase quantity if already exists
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      setItems(newItems);
      toast.success(`${product.name} quantity increased`);
    } else {
      // Add new item (remove empty items first)
      const filteredItems = items.filter(item => item.product_id !== null || item.description !== "");
      setItems([...filteredItems, {
        product_id: product.id,
        description: product.name,
        quantity: 1,
        unit_price: product.purchase_price
      }]);
      toast.success(`${product.name} added`);
    }
    setSearchOpen(false);
    setProductSearch("");
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      // Reset to empty item if last one
      setItems([{ product_id: null, description: "", quantity: 1, unit_price: 0 }]);
    }
  };

  const updateItem = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
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
        .filter(item => item.description && item.quantity > 0 && item.unit_price > 0)
        .map(item => ({
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

        // Update product quantities (add stock for purchases/bills)
        for (const item of itemsToInsert) {
          if (item.product_id) {
            const product = products.find(p => p.id === item.product_id);
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

  return (
    <div className="p-3 md:p-8 space-y-3 md:space-y-6 pb-24 md:pb-8">
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
          {/* Customer & Date - Compact on mobile */}
          <Card>
            <CardHeader className="py-2 px-3 md:pb-4 md:px-6 bg-accent/30">
              <CardTitle className="text-sm md:text-lg">Supplier Info</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField control={form.control} name="customer_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Supplier Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter name" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="bill_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Bill Date *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="customer_email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs md:text-sm">Email (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="email@example.com" className="h-9 text-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Bill Items - Simplified Quick Add System */}
          <Card>
            <CardHeader className="py-2 px-3 md:pb-4 md:px-6 bg-primary/10">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items ({items.filter(i => i.product_id).length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2 md:p-6 space-y-3">
              {/* Quick Add Product Search */}
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-10 md:h-12 text-sm md:text-base border-dashed border-2 border-primary/30 hover:border-primary"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Search & add product...</span>
                    </div>
                    <Plus className="h-4 w-4 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-50 bg-background" align="start" sideOffset={4}>
                  <Command>
                    <CommandInput 
                      placeholder="Type product name..." 
                      value={productSearch}
                      onValueChange={setProductSearch}
                      className="h-10"
                    />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No products found</CommandEmpty>
                      <CommandGroup heading="Products">
                        {products
                          .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                          .slice(0, 20)
                          .map((product) => {
                            const inCart = items.find(i => i.product_id === product.id);
                            return (
                              <CommandItem
                                key={product.id}
                                value={product.name}
                                onSelect={() => quickAddProduct(product)}
                                className="flex justify-between items-center py-3 cursor-pointer"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{product.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Cost: {settings.currency_symbol}{product.purchase_price}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {inCart && (
                                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                      ×{inCart.quantity}
                                    </span>
                                  )}
                                  <Plus className="h-4 w-4 text-primary" />
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Added Items List */}
              {items.filter(i => i.product_id).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No items added yet. Search above to add products.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.filter(i => i.product_id).map((item, index) => {
                    const actualIndex = items.findIndex(i => i === item);
                    return (
                      <div key={actualIndex} className="flex items-center gap-2 p-2 md:p-3 bg-muted/30 rounded-lg border">
                        {/* Product Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {settings.currency_symbol}{item.unit_price} each
                          </p>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              if (item.quantity > 1) {
                                updateItem(actualIndex, "quantity", item.quantity - 1);
                              }
                            }}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(actualIndex, "quantity", parseInt(e.target.value) || 1)}
                            className="w-12 h-8 text-center text-sm"
                            min={1}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateItem(actualIndex, "quantity", item.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                        
                        {/* Amount */}
                        <div className="text-right min-w-[60px]">
                          <p className="font-semibold text-sm md:text-base">
                            {settings.currency_symbol}{(item.quantity * item.unit_price).toFixed(0)}
                          </p>
                        </div>
                        
                        {/* Delete */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeItem(actualIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Totals - Compact */}
              <div className="border-t pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{settings.currency_symbol}{subtotal.toFixed(2)}</span>
                </div>
                
                {/* Tax Toggle and Rate */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="tax-toggle-bill"
                      checked={taxEnabled}
                      onCheckedChange={setTaxEnabled}
                    />
                    <Label htmlFor="tax-toggle-bill" className="text-xs md:text-sm text-muted-foreground">
                      {settings.tax_name}
                    </Label>
                  </div>
                  {taxEnabled && (
                    <div className="flex items-center gap-1 md:gap-2">
                      <Input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-12 md:w-16 h-7 md:h-8 text-center text-xs md:text-sm"
                        min={0}
                        max={100}
                        step={0.1}
                      />
                      <span className="text-xs md:text-sm text-muted-foreground">%</span>
                      <span className="font-medium text-xs md:text-sm">{settings.currency_symbol}{tax.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between text-sm md:text-lg font-bold pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">{settings.currency_symbol}{total.toFixed(2)}</span>
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
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea 
                      {...field}
                      placeholder="Additional notes (optional)" 
                      className="min-h-[60px] md:min-h-[80px] text-xs md:text-sm" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Action Buttons - Fixed on mobile */}
          <div className="fixed bottom-16 left-0 right-0 p-3 bg-background border-t md:relative md:bottom-auto md:border-0 md:p-0 md:bg-transparent">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/bills")} 
                className="flex-1 md:flex-none h-10 text-sm"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="flex-1 md:flex-none h-10 text-sm bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? "Creating..." : "Create Bill"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default BillCreate;