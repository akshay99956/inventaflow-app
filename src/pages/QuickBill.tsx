import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, ShoppingCart, Trash2, Receipt, X, Send } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/contexts/SettingsContext";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Product = {
  id: string;
  name: string;
  unit_price: number;
  purchase_price: number;
  quantity: number;
  category: string | null;
};

type CartItem = {
  product: Product;
  qty: number;
};

const QuickBill = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const cs = settings.currency_symbol || "₹";

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, unit_price, purchase_price, quantity, category")
        .order("name");
      setProducts(data || []);
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.quantity) {
          toast.error("Not enough stock");
          return prev;
        }
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      if (product.quantity < 1) {
        toast.error("Out of stock");
        return prev;
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== productId) return c;
          const newQty = c.qty + delta;
          if (newQty > c.product.quantity) {
            toast.error("Not enough stock");
            return c;
          }
          return { ...c, qty: newQty };
        })
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.qty * c.product.unit_price, 0);
  const taxAmount = settings.tax_enabled ? subtotal * (settings.default_tax_rate / 100) : 0;
  const total = subtotal + taxAmount;
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const handleGenerateBill = async () => {
    if (cart.length === 0) {
      toast.error("Add items to cart first");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Enter customer name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate bill number
      const { data: lastBill } = await supabase
        .from("bills")
        .select("bill_number")
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (lastBill && lastBill.length > 0) {
        const lastNum = parseInt(lastBill[0].bill_number.replace(/\D/g, "")) || 0;
        nextNumber = lastNum + 1;
      }
      const billNumber = `${settings.bill_prefix}${String(nextNumber).padStart(4, "0")}`;

      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert({
          user_id: user.id,
          bill_number: billNumber,
          customer_name: customerName.trim(),
          bill_date: new Date().toISOString().split("T")[0],
          subtotal,
          tax: taxAmount,
          total,
          status: "active",
        })
        .select()
        .single();

      if (billError) throw billError;

      // Insert bill items
      const billItems = cart.map((c) => ({
        bill_id: bill.id,
        product_id: c.product.id,
        description: c.product.name,
        quantity: c.qty,
        unit_price: c.product.unit_price,
        amount: c.qty * c.product.unit_price,
      }));

      const { error: itemsError } = await supabase.from("bill_items").insert(billItems);
      if (itemsError) throw itemsError;

      // Update product stock
      for (const c of cart) {
        await supabase
          .from("products")
          .update({ quantity: c.product.quantity - c.qty })
          .eq("id", c.product.id);
      }

      toast.success(`Bill ${billNumber} created!`);
      setCart([]);
      setCustomerName("");
      setShowCart(false);

      // Refresh products
      const { data: refreshed } = await supabase
        .from("products")
        .select("id, name, unit_price, purchase_price, quantity, category")
        .order("name");
      setProducts(refreshed || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to create bill");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCartQty = (productId: string) => {
    return cart.find((c) => c.product.id === productId)?.qty || 0;
  };

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">Quick Bill</h1>
          <p className="text-xs md:text-sm text-muted-foreground">POS-style fast billing</p>
        </div>
        <Button
          onClick={() => setShowCart(true)}
          className="relative gradient-primary text-primary-foreground"
          size="sm"
        >
          <ShoppingCart className="h-4 w-4 mr-1" />
          Cart
          {cartCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
              {cartCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
        {filteredProducts.map((product) => {
          const inCart = getCartQty(product.id);
          return (
            <Card
              key={product.id}
              className={`cursor-pointer transition-all active:scale-95 ${
                inCart > 0 ? "ring-2 ring-primary" : ""
              } ${product.quantity < 1 ? "opacity-50" : ""}`}
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-3">
                <p className="font-semibold text-sm truncate">{product.name}</p>
                {product.category && (
                  <p className="text-[10px] text-muted-foreground truncate">{product.category}</p>
                )}
                <p className="text-base font-bold text-primary mt-1">
                  {cs}{product.unit_price.toLocaleString("en-IN")}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] ${product.quantity < 5 ? "text-destructive" : "text-muted-foreground"}`}>
                    Stock: {product.quantity}
                  </span>
                  {inCart > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      ×{inCart}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredProducts.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">No products found</p>
        )}
      </div>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart ({cartCount} items)
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Cart is empty</p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 p-2 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cs}{item.product.unit_price.toLocaleString("en-IN")} × {item.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(item.product.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(item.product.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-bold w-16 text-right">
                    {cs}{(item.qty * item.product.unit_price).toLocaleString("en-IN")}
                  </p>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t p-4 space-y-3">
              <Input
                placeholder="Customer Name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{cs}{subtotal.toLocaleString("en-IN")}</span>
                </div>
                {settings.tax_enabled && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{settings.tax_name} ({settings.default_tax_rate}%)</span>
                    <span>{cs}{taxAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">{cs}{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Button
                onClick={handleGenerateBill}
                disabled={isSubmitting}
                className="w-full gradient-primary text-primary-foreground"
              >
                <Receipt className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : "Generate Bill"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickBill;
