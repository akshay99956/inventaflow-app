import { useState } from "react";
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
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const billSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  customer_email: z.string().email("Invalid email").optional().or(z.literal("")),
  bill_date: z.string().min(1, "Bill date is required"),
  notes: z.string().optional(),
});

type BillFormData = z.infer<typeof billSchema>;

type BillItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

const BillCreate = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [items, setItems] = useState<BillItem[]>([
    { description: "", quantity: 1, unit_price: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      customer_name: "",
      customer_email: "",
      bill_date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
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

      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert({
          bill_number: billNumber,
          user_id: user.id,
          customer_name: data.customer_name,
          customer_email: data.customer_email || null,
          bill_date: data.bill_date,
          notes: data.notes || null,
          subtotal,
          tax,
          total,
        })
        .select()
        .single();

      if (billError) throw billError;

      const itemsToInsert = items
        .filter(item => item.description && item.quantity > 0 && item.unit_price > 0)
        .map(item => ({
          bill_id: bill.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("bill_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
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
    <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/bills")}
            className="md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create Bill</h1>
            <p className="text-sm md:text-base text-muted-foreground">Create a new customer bill</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate("/bills")}
          className="hidden md:flex"
        >
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Customer Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter customer name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customer_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Customer Email (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="customer@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bill Details */}
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl">Bill Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="bill_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Bill Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes" className="min-h-[80px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bill Items */}
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg md:text-xl">Bill Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Add Item</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="space-y-3 p-3 md:p-4 border rounded-lg bg-muted/20">
                  {/* Mobile Layout */}
                  {isMobile ? (
                    <>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Qty</label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Price</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Amount</label>
                          <div className="h-10 flex items-center justify-end font-medium text-sm">
                            ₹{(item.quantity * item.unit_price).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Desktop Layout */
                    <div className="flex gap-4 items-start">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          placeholder="Price"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="w-32 flex items-center justify-end">
                        <span className="text-sm font-medium">
                          ₹{(item.quantity * item.unit_price).toFixed(2)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (10%):</span>
                  <span className="font-medium">₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate("/bills")}
              className="order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="order-1 sm:order-2 gradient-primary"
            >
              {isSubmitting ? "Creating..." : "Create Bill"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default BillCreate;