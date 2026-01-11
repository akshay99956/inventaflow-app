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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
  unit_price: number;
  quantity: number;
};

const BillCreate = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<BillItem[]>([{
    product_id: null,
    description: "",
    quantity: 1,
    unit_price: 0
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        .select("id, name, unit_price, quantity")
        .order("name");
      if (!error && data) {
        setProducts(data);
      }
    };
    fetchProducts();
  }, []);

  const addItem = () => {
    setItems([...items, {
      product_id: null,
      description: "",
      quantity: 1,
      unit_price: 0
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        product_id: productId,
        description: product.name,
        quantity: 1,
        unit_price: product.unit_price
      };
      setItems(newItems);
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
    const tax = subtotal * 0.1;
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
      console.error("Error creating bill:", error);
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

          {/* Bill Items - Improved mobile UI */}
          <Card>
            <CardHeader className="py-2 px-3 md:pb-4 md:px-6 bg-primary/10">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs md:h-9 md:text-sm">
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 md:p-6 space-y-2 md:space-y-3">
              {items.map((item, index) => (
                <div key={index} className="border rounded-lg p-2 md:p-4 bg-muted/30 space-y-2">
                  {/* Product Selection */}
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <label className="text-[10px] md:text-xs text-muted-foreground mb-1 block">Select Product</label>
                      <Select
                        value={item.product_id || ""}
                        onValueChange={(value) => handleProductSelect(index, value)}
                      >
                        <SelectTrigger className="h-8 md:h-10 text-xs md:text-sm">
                          <SelectValue placeholder="Choose product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id} className="text-xs md:text-sm">
                              {product.name} - ₹{product.unit_price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 mt-4 text-destructive hover:text-destructive" 
                      onClick={() => removeItem(index)} 
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Description - Now visible */}
                  <div>
                    <label className="text-[10px] md:text-xs text-muted-foreground mb-1 block">Description</label>
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      className="h-8 md:h-10 text-xs md:text-sm bg-background"
                    />
                  </div>

                  {/* Qty, Price, Amount in row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] md:text-xs text-muted-foreground mb-1 block">Qty</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        className="h-8 md:h-10 text-xs md:text-sm text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] md:text-xs text-muted-foreground mb-1 block">Price (₹)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        className="h-8 md:h-10 text-xs md:text-sm text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] md:text-xs text-muted-foreground mb-1 block">Amount</label>
                      <div className="h-8 md:h-10 flex items-center justify-center font-semibold text-xs md:text-sm bg-accent/50 rounded-md">
                        ₹{(item.quantity * item.unit_price).toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Totals - Compact */}
              <div className="border-t pt-3 mt-3 space-y-1">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm md:text-lg font-bold pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">₹{total.toFixed(2)}</span>
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