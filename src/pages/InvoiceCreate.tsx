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
import { Plus, Trash2, ArrowLeft, Check, ChevronsUpDown, Package, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/contexts/SettingsContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};
type Product = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  sku: string | null;
  quantity: number;
};
const invoiceSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  customer_email: z.string().email("Invalid email").optional().or(z.literal("")),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().optional(),
  status: z.string(),
  notes: z.string().optional()
});
type InvoiceFormData = z.infer<typeof invoiceSchema>;
type InvoiceItem = {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
};
const InvoiceCreate = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { settings } = useSettings();
  const [items, setItems] = useState<InvoiceItem[]>([{
    product_id: "",
    description: "",
    quantity: 1,
    unit_price: 0
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(settings.tax_enabled);
  const [taxRate, setTaxRate] = useState(settings.default_tax_rate);
  const [searchOpen, setSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_name: "",
      customer_email: "",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: "",
      status: "draft",
      notes: ""
    }
  });
  useEffect(() => {
    fetchProducts();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase.
    from("clients").
    select("id, name, email, phone").
    order("name");
    if (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to load clients:", error);
      }
      return;
    }
    setClients(data || []);
  };

  const selectClient = (client: Client) => {
    form.setValue("customer_name", client.name);
    if (client.email) {
      form.setValue("customer_email", client.email);
    }
    setCustomerPopoverOpen(false);
  };
  const fetchProducts = async () => {
    const { data, error } = await supabase.
    from("products").
    select("id, name, description, unit_price, sku, quantity").
    order("name");
    if (error) {
      toast.error("Failed to load products");
      return;
    }
    setProducts(data || []);
  };

  // Quick add product - directly adds to list
  const quickAddProduct = (product: Product) => {
    // Check if product already in items
    const existingIndex = items.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      // Increase quantity if already exists
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      setItems(newItems);
      toast.success(`${product.name} quantity increased`);
    } else {
      // Add new item (remove empty items first)
      const filteredItems = items.filter((item) => item.product_id !== "" || item.description !== "");
      setItems([...filteredItems, {
        product_id: product.id,
        description: product.name,
        quantity: 1,
        unit_price: Number(product.unit_price)
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
      setItems([{ product_id: "", description: "", quantity: 1, unit_price: 0 }]);
    }
  };
  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
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
    return {
      subtotal,
      tax,
      total
    };
  };
  const onSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create an invoice");
        return;
      }
      const {
        subtotal,
        tax,
        total
      } = calculateTotals();

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`;

      // Create invoice
      const {
        data: invoice,
        error: invoiceError
      } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        user_id: user.id,
        customer_name: data.customer_name,
        customer_email: data.customer_email || null,
        issue_date: data.issue_date,
        due_date: data.due_date || null,
        status: data.status,
        notes: data.notes || null,
        subtotal,
        tax,
        total
      }).select().single();
      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsToInsert = items.filter((item) => item.description && item.quantity > 0 && item.unit_price > 0).map((item) => ({
        invoice_id: invoice.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price
      }));
      if (itemsToInsert.length > 0) {
        const {
          error: itemsError
        } = await supabase.from("invoice_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // Decrease product quantities in inventory
        for (const item of itemsToInsert) {
          if (item.product_id) {
            const product = products.find((p) => p.id === item.product_id);
            if (product) {
              const {
                error: updateError
              } = await supabase.from("products").update({
                quantity: Math.max(0, (product as any).quantity - item.quantity)
              }).eq("id", item.product_id);
              if (updateError) {
                if (import.meta.env.DEV) {
                  console.error("Failed to update product quantity:", updateError);
                }
              }
            }
          }
        }
      }
      toast.success("Invoice created successfully");
      navigate("/invoices");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error creating invoice:", error);
      }
      toast.error("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };
  const {
    subtotal,
    tax,
    total
  } = calculateTotals();
  return <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")} className="md:hidden bg-warning">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create Invoice</h1>
            <p className="text-sm md:text-base text-muted-foreground">Create a new customer invoice</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/invoices")} className="hidden md:flex">
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader className="pb-3 md:pb-6 bg-[#e0f1e9]">
              <CardTitle className="text-lg md:text-xl">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="customer_name" render={({
              field
            }) => <FormItem className="flex flex-col">
                    <FormLabel className="text-sm">Customer Name</FormLabel>
                    <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !field.value && "text-muted-foreground"
                      )}>

                            {field.value || "Select or type customer name..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                      placeholder="Search or add customer..."
                      onValueChange={(value) => form.setValue("customer_name", value)} />

                          <CommandList>
                            <CommandEmpty>
                              <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => setCustomerPopoverOpen(false)}>

                                Use "{form.getValues("customer_name")}" as new customer
                              </Button>
                            </CommandEmpty>
                            <CommandGroup heading="Existing Customers">
                              {clients.map((client) =>
                        <CommandItem
                          key={client.id}
                          value={client.name}
                          onSelect={() => selectClient(client)}>

                                  <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              field.value === client.name ? "opacity-100" : "opacity-0"
                            )} />

                                  <div className="flex flex-col">
                                    <span>{client.name}</span>
                                    {client.email && <span className="text-xs text-muted-foreground">{client.email}</span>}
                                  </div>
                                </CommandItem>
                        )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="customer_email" render={({
              field
            }) => <FormItem>
                    <FormLabel className="text-sm">Customer Email (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="customer@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader className="pb-3 md:pb-6 bg-[#e8f2e8]">
              <CardTitle className="text-lg md:text-xl">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="issue_date" render={({
                field
              }) => <FormItem>
                      <FormLabel className="text-sm">Issue Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />
                <FormField control={form.control} name="due_date" render={({
                field
              }) => <FormItem>
                      <FormLabel className="text-sm">Due Date (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />
              </div>
              <FormField control={form.control} name="status" render={({
              field
            }) => <FormItem>
                    <FormLabel className="text-sm">Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="notes" render={({
              field
            }) => <FormItem>
                    <FormLabel className="text-sm">Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes" className="min-h-[80px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
            </CardContent>
          </Card>

          {/* Invoice Items - Simplified Quick Add System */}
          <Card>
            <CardHeader className="py-2 px-3 md:pb-4 md:px-6 bg-primary/10">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items ({items.filter((i) => i.product_id).length})
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
                  className="w-full justify-between h-10 md:h-12 text-sm md:text-base border-dashed border-2 border-primary/30 hover:border-primary">

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
                    className="h-10" />

                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No products found</CommandEmpty>
                      <CommandGroup heading="Products">
                        {products.
                      filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase())).
                      slice(0, 20).
                      map((product) => {
                        const inCart = items.find((i) => i.product_id === product.id);
                        return (
                          <CommandItem
                            key={product.id}
                            value={product.name}
                            onSelect={() => quickAddProduct(product)}
                            className="flex justify-between items-center py-3 cursor-pointer">

                                <div className="flex flex-col">
                                  <span className="font-medium">{product.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Price: {settings.currency_symbol}{Number(product.unit_price).toFixed(0)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {inCart &&
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                      ×{inCart.quantity}
                                    </span>
                              }
                                  <Plus className="h-4 w-4 text-primary" />
                                </div>
                              </CommandItem>);

                      })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Added Items List */}
              {items.filter((i) => i.product_id).length === 0 ?
            <div className="text-center py-6 text-muted-foreground text-sm">
                  No items added yet. Search above to add products.
                </div> :

            <div className="space-y-2">
                  {items.filter((i) => i.product_id).map((item, index) => {
                const actualIndex = items.findIndex((i) => i === item);
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
                        }}>

                            -
                          </Button>
                          <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(actualIndex, "quantity", parseInt(e.target.value) || 1)}
                        className="w-12 h-8 text-center text-sm"
                        min={1} />

                          <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateItem(actualIndex, "quantity", item.quantity + 1)}>

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
                      onClick={() => removeItem(actualIndex)}>

                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>);

              })}
                </div>
            }

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
                    id="tax-toggle"
                    checked={taxEnabled}
                    onCheckedChange={setTaxEnabled} />

                    <Label htmlFor="tax-toggle" className="text-xs md:text-sm text-muted-foreground">
                      {settings.tax_name}
                    </Label>
                  </div>
                  {taxEnabled &&
                <div className="flex items-center gap-1 md:gap-2">
                      <Input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-14 md:w-16 h-8 text-center text-sm px-[7px]"
                    min={0}
                    max={100}
                    step={0.1} />

                      <span className="text-xs md:text-sm text-muted-foreground">%</span>
                      <span className="font-medium text-sm">{settings.currency_symbol}{tax.toFixed(2)}</span>
                    </div>
                }
                </div>
                
                <div className="flex justify-between text-base md:text-lg font-bold bg-primary/10 p-2 rounded">
                  <span>Total:</span>
                  <span>{settings.currency_symbol}{total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/invoices")} className="order-2 sm:order-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="order-1 sm:order-2 gradient-primary">
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </form>
      </Form>
    </div>;
};
export default InvoiceCreate;