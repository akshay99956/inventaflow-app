import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Minus, ShoppingCart, Trash2, ClipboardList, Send, PackageCheck, Package, PlusCircle } from "lucide-react";
import { toastWithSound as toast } from "@/lib/toastWithSound";
import { useSettings } from "@/contexts/SettingsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import DocumentPreview from "@/components/DocumentPreview";

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

type PendingPO = {
  id: string;
  po_number: string;
  supplier_name: string;
  total: number;
  po_date: string;
  status: string;
};

const QuickPurchase = () => {
  const { settings } = useSettings();
  const cs = settings.currency_symbol || "₹";

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([]);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("order");
  const [confirmReceiveId, setConfirmReceiveId] = useState<string | null>(null);
  const [confirmPO, setConfirmPO] = useState<PendingPO | null>(null);
  const [previewData, setPreviewData] = useState<{
    docNumber: string;
    partyName: string;
    partyPhone?: string;
    date: string;
    items: { name: string; qty: number; unitPrice: number; amount: number }[];
    subtotal: number;
    tax: number;
    total: number;
  } | null>(null);

  // Quick Add Product state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", purchase_price: "", unit_price: "", category: "", unit: "pc" });
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const UNITS = ["kg", "ltr", "pc", "box", "pack", "set", "pair", "g", "ml", "dozen"];

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
      addToCart(data as Product);
      setNewProduct({ name: "", purchase_price: "", unit_price: "", category: "", unit: "pc" });
      setShowQuickAdd(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add product");
    } finally {
      setIsAddingProduct(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchPendingPOs();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, unit_price, purchase_price, quantity, category")
      .order("name");
    setProducts(data || []);
  };

  const fetchPendingPOs = async () => {
    const { data } = await supabase
      .from("purchase_orders")
      .select("id, po_number, supplier_name, total, po_date, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingPOs((data as PendingPO[]) || []);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[])
  ).sort();

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== productId) return c;
          return { ...c, qty: Math.max(0, c.qty + delta) };
        })
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.qty * c.product.purchase_price, 0);
  const taxAmount = settings.tax_enabled ? subtotal * (settings.default_tax_rate / 100) : 0;
  const total = subtotal + taxAmount;
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const getCartQty = (productId: string) => {
    return cart.find((c) => c.product.id === productId)?.qty || 0;
  };

  const handleCreatePO = async () => {
    if (cart.length === 0) {
      toast.error("Add items to order first");
      return;
    }
    if (!supplierName.trim()) {
      toast.error("Enter supplier name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: lastPO } = await supabase
        .from("purchase_orders")
        .select("po_number")
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (lastPO && lastPO.length > 0) {
        const last = parseInt(lastPO[0].po_number.replace(/\D/g, "")) || 0;
        nextNum = last + 1;
      }
      const poNumber = `PO-${String(nextNum).padStart(4, "0")}`;

      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert({
          user_id: user.id,
          po_number: poNumber,
          supplier_name: supplierName.trim(),
          po_date: new Date().toISOString().split("T")[0],
          subtotal,
          tax: taxAmount,
          total,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      const poItems = cart.map((c) => ({
        po_id: po.id,
        product_id: c.product.id,
        description: c.product.name,
        quantity: c.qty,
        unit_price: c.product.purchase_price,
        amount: c.qty * c.product.purchase_price,
      }));

      await supabase.from("purchase_order_items").insert(poItems);

      toast.success(`${poNumber} created!`);

      // Show preview dialog
      setPreviewData({
        docNumber: poNumber,
        partyName: supplierName.trim(),
        partyPhone: supplierPhone.trim() || undefined,
        date: new Date().toISOString().split("T")[0],
        items: cart.map((c) => ({
          name: c.product.name,
          qty: c.qty,
          unitPrice: c.product.purchase_price,
          amount: c.qty * c.product.purchase_price,
        })),
        subtotal,
        tax: taxAmount,
        total,
      });

      setCart([]);
      setSupplierName("");
      setSupplierPhone("");
      setShowCart(false);
      fetchPendingPOs();
    } catch (err: any) {
      toast.error(err.message || "Failed to create PO");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoReceive = async (poId: string, billId: string, stockChanges: { productId: string; qty: number }[]) => {
    try {
      // Reverse stock increases
      for (const change of stockChanges) {
        const { data: product } = await supabase
          .from("products")
          .select("quantity")
          .eq("id", change.productId)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ quantity: Math.max(0, product.quantity - change.qty) })
            .eq("id", change.productId);
        }
      }

      // Delete bill items then bill
      await supabase.from("bill_items").delete().eq("bill_id", billId);
      await supabase.from("bills").delete().eq("id", billId);

      // Restore PO to pending
      await supabase
        .from("purchase_orders")
        .update({ status: "pending" })
        .eq("id", poId);

      toast.deleted("Receive undone — stock restored, bill deleted, PO back to pending");
      fetchPendingPOs();
      fetchProducts();
    } catch (err: any) {
      toast.error("Undo failed: " + (err.message || "Unknown error"));
    }
  };

  const handleReceive = async (poId: string) => {
    setReceivingId(poId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get PO items
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("product_id, quantity")
        .eq("po_id", poId);

      if (!items || items.length === 0) throw new Error("No items found");

      // Get PO details for bill creation
      const { data: po } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", poId)
        .single();

      if (!po) throw new Error("PO not found");

      // Generate bill number
      const { data: lastBill } = await supabase
        .from("bills")
        .select("bill_number")
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (lastBill && lastBill.length > 0) {
        const last = parseInt(lastBill[0].bill_number.replace(/\D/g, "")) || 0;
        nextNum = last + 1;
      }
      const billNumber = `${settings.bill_prefix}${String(nextNum).padStart(4, "0")}`;

      // Create bill from PO
      const { data: bill, error: billErr } = await supabase
        .from("bills")
        .insert({
          user_id: user.id,
          bill_number: billNumber,
          customer_name: po.supplier_name,
          customer_email: po.supplier_email,
          bill_date: new Date().toISOString().split("T")[0],
          subtotal: po.subtotal,
          tax: po.tax,
          total: po.total,
          status: "active",
          notes: `Received from ${po.po_number}`,
        })
        .select()
        .single();

      if (billErr) throw billErr;

      // Get full PO items for bill
      const { data: fullItems } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("po_id", poId);

      if (fullItems) {
        const billItems = fullItems.map((i: any) => ({
          bill_id: bill.id,
          product_id: i.product_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          amount: i.amount,
        }));
        await supabase.from("bill_items").insert(billItems);
      }

      // Increase stock for each product & track changes for undo
      const stockChanges: { productId: string; qty: number }[] = [];
      for (const item of items) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from("products")
            .select("quantity")
            .eq("id", item.product_id)
            .single();

          if (product) {
            await supabase
              .from("products")
              .update({ quantity: product.quantity + item.quantity })
              .eq("id", item.product_id);
            stockChanges.push({ productId: item.product_id, qty: item.quantity });
          }
        }
      }

      // Mark PO as converted
      await supabase
        .from("purchase_orders")
        .update({ status: "converted" })
        .eq("id", poId);

      toast.success(`Received! Stock updated & Bill ${billNumber} created`, {
        duration: 15000,
        action: {
          label: "Undo",
          onClick: () => handleUndoReceive(poId, bill.id, stockChanges),
        },
      });
      fetchPendingPOs();
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to receive");
    } finally {
      setReceivingId(null);
    }
  };

  const buildWhatsAppMessage = (
    poNo: string, name: string, cartItems: CartItem[],
    sub: number, tax: number, tot: number
  ) => {
    let msg = `📋 *Purchase Order: ${poNo}*\n`;
    msg += `🏭 ${name}\n`;
    msg += `📅 ${new Date().toLocaleDateString("en-IN")}\n\n`;
    msg += `*Items:*\n`;
    cartItems.forEach((c, i) => {
      msg += `${i + 1}. ${c.product.name}\n   ${c.qty} × ${cs}${c.product.purchase_price.toLocaleString("en-IN")} = ${cs}${(c.qty * c.product.purchase_price).toLocaleString("en-IN")}\n`;
    });
    msg += `\n─────────────\n`;
    msg += `Subtotal: ${cs}${sub.toLocaleString("en-IN")}\n`;
    if (tax > 0) msg += `Tax: ${cs}${tax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}\n`;
    msg += `*Total: ${cs}${tot.toLocaleString("en-IN", { maximumFractionDigits: 2 })}*\n`;
    msg += `\nPlease confirm this order. 🙏`;
    return msg;
  };

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">Quick Purchase</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Order → Receive → Stock Up</p>
        </div>
        {activeTab === "order" && (
          <Button
            onClick={() => setShowCart(true)}
            className="relative gradient-cool text-primary-foreground"
            size="sm"
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Order
            {cartCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
                {cartCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="order" className="text-xs">
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            New Order
          </TabsTrigger>
          <TabsTrigger value="receive" className="text-xs">
            <PackageCheck className="h-3.5 w-3.5 mr-1" />
            Receive ({pendingPOs.length})
          </TabsTrigger>
        </TabsList>

        {/* Order Tab - Product Grid */}
        <TabsContent value="order" className="space-y-3 mt-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 flex-shrink-0 border-dashed border-2 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => setShowQuickAdd(true)}
              title="Quick add new product"
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>

          {/* Category Filters */}
          {categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <Button
                variant={selectedCategory === "" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs whitespace-nowrap flex-shrink-0"
                onClick={() => setSelectedCategory("")}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs whitespace-nowrap flex-shrink-0"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            {filteredProducts.map((product) => {
              const inCart = getCartQty(product.id);
              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all active:scale-95 ${
                    inCart > 0 ? "ring-2 ring-secondary" : ""
                  }`}
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm truncate">{product.name}</p>
                    {product.category && (
                      <p className="text-[10px] text-muted-foreground truncate">{product.category}</p>
                    )}
                    <p className="text-base font-bold text-secondary mt-1">
                      {cs}{product.purchase_price.toLocaleString("en-IN")}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
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
        </TabsContent>

        {/* Receive Tab - Pending POs */}
        <TabsContent value="receive" className="space-y-2 mt-0">
          {pendingPOs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pending orders to receive</p>
              </CardContent>
            </Card>
          ) : (
            pendingPOs.map((po) => (
              <Card key={po.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{po.po_number}</p>
                      <Badge variant="secondary" className="text-[10px]">pending</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{po.supplier_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(po.po_date), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="font-bold text-sm">
                      {cs}{Number(po.total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                    <Button
                      size="sm"
                      className="gradient-secondary text-secondary-foreground"
                      onClick={() => { setConfirmReceiveId(po.id); setConfirmPO(po); }}
                      disabled={receivingId === po.id}
                    >
                      <PackageCheck className="h-4 w-4 mr-1" />
                      {receivingId === po.id ? "..." : "Receive"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Receive Confirmation Dialog */}
      <AlertDialog open={!!confirmReceiveId} onOpenChange={(open) => { if (!open) { setConfirmReceiveId(null); setConfirmPO(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Receive Goods</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPO && (
                <>
                  Are you sure you want to receive <strong>{confirmPO.po_number}</strong> from <strong>{confirmPO.supplier_name}</strong> for <strong>{cs}{Number(confirmPO.total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong>?
                  <br /><br />
                  This will update your inventory stock levels and create a purchase bill. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="gradient-secondary text-secondary-foreground"
              onClick={() => {
                if (confirmReceiveId) {
                  handleReceive(confirmReceiveId);
                  setConfirmReceiveId(null);
                  setConfirmPO(null);
                }
              }}
            >
              <PackageCheck className="h-4 w-4 mr-1" />
              Yes, Receive Goods
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Purchase Order ({cartCount} items)
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No items added</p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 p-2 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cs}{item.product.purchase_price.toLocaleString("en-IN")} × {item.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-bold w-16 text-right">
                    {cs}{(item.qty * item.product.purchase_price).toLocaleString("en-IN")}
                  </p>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t p-4 space-y-3">
              <Input
                placeholder="Supplier Name *"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Supplier Phone (WhatsApp)"
                  type="tel"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="flex-1"
                />
                {supplierPhone.trim() && (
                  <div className="flex items-center text-[10px] text-success font-medium gap-1">
                    <Send className="h-3 w-3" />
                    Auto-share
                  </div>
                )}
              </div>
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
                  <span className="text-secondary">{cs}{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Button
                onClick={handleCreatePO}
                disabled={isSubmitting}
                className="w-full gradient-cool text-primary-foreground"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : supplierPhone.trim() ? "Create & Share via WhatsApp" : "Create Purchase Order"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PO Preview after creation */}
      {previewData && (
        <DocumentPreview
          open={!!previewData}
          onOpenChange={(open) => { if (!open) setPreviewData(null); }}
          type="purchase_order"
          docNumber={previewData.docNumber}
          partyName={previewData.partyName}
          partyPhone={previewData.partyPhone}
          date={previewData.date}
          items={previewData.items}
          subtotal={previewData.subtotal}
          tax={previewData.tax}
          total={previewData.total}
        />
      )}
    </div>
  );
};

export default QuickPurchase;
