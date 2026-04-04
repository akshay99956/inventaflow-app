import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, ArrowRight, Search, Package, Check, Send, Share2 } from "lucide-react";
import { toastWithSound as toast } from "@/lib/toastWithSound";
import { useSettings } from "@/contexts/SettingsContext";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_name: string;
  supplier_email: string | null;
  po_date: string;
  expected_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  notes: string | null;
};

type POItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  product_id: string | null;
};

type Product = {
  id: string;
  name: string;
  purchase_price: number;
  unit_price: number;
};

type NewPOItem = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

const PurchaseOrders = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const cs = settings.currency_symbol || "₹";

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Create form
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [poDate, setPODate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<NewPOItem[]>([
    { product_id: null, description: "", quantity: 1, unit_price: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("purchase_orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders((data as PurchaseOrder[]) || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, purchase_price, unit_price")
      .order("name");
    setProducts(data || []);
  };

  const viewPO = async (po: PurchaseOrder) => {
    setSelectedPO(po);
    const { data } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("po_id", po.id);
    setPOItems((data as POItem[]) || []);
    setIsDetailOpen(true);
  };

  const addItem = () => {
    setItems([...items, { product_id: null, description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof NewPOItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      product_id: productId,
      description: product.name,
      unit_price: product.purchase_price,
    };
    setItems(updated);
  };

  const itemsSubtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const itemsTax = settings.tax_enabled ? itemsSubtotal * (settings.default_tax_rate / 100) : 0;
  const itemsTotal = itemsSubtotal + itemsTax;

  const handleCreatePO = async () => {
    if (!supplierName.trim()) {
      toast.error("Enter supplier name");
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      toast.error("All items need a description");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate PO number
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
          supplier_email: supplierEmail.trim() || null,
          po_date: poDate,
          expected_date: expectedDate || null,
          subtotal: itemsSubtotal,
          tax: itemsTax,
          total: itemsTotal,
          status: "pending",
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      const poItemsData = items.map((i) => ({
        po_id: po.id,
        product_id: i.product_id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: i.quantity * i.unit_price,
      }));

      await supabase.from("purchase_order_items").insert(poItemsData);

      toast.success(`${poNumber} created!`);

      // Auto-share via WhatsApp if phone provided
      if (supplierPhone.trim()) {
        const msg = buildPOWhatsAppMessage(poNumber, supplierName.trim(), items, itemsSubtotal, itemsTax, itemsTotal, expectedDate);
        const phone = supplierPhone.trim().replace(/\D/g, "");
        const fullPhone = phone.startsWith("91") ? phone : `91${phone}`;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      }

      setIsCreateOpen(false);
      resetForm();
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to create PO");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSupplierName("");
    setSupplierPhone("");
    setSupplierEmail("");
    setPODate(new Date().toISOString().split("T")[0]);
    setExpectedDate("");
    setNotes("");
    setItems([{ product_id: null, description: "", quantity: 1, unit_price: 0 }]);
  };

  const buildPOWhatsAppMessage = (
    poNo: string, name: string, poItemsList: NewPOItem[] | POItem[],
    sub: number, tax: number, tot: number, expDate?: string | null
  ) => {
    let msg = `📋 *Purchase Order: ${poNo}*\n`;
    msg += `🏭 Supplier: ${name}\n`;
    msg += `📅 Date: ${new Date().toLocaleDateString("en-IN")}\n`;
    if (expDate) msg += `📦 Expected: ${format(new Date(expDate), "dd MMM yyyy")}\n`;
    msg += `\n*Items:*\n`;
    poItemsList.forEach((item, i) => {
      const qty = item.quantity;
      const price = item.unit_price;
      msg += `${i + 1}. ${item.description}\n   ${qty} × ${cs}${Number(price).toLocaleString("en-IN")} = ${cs}${(qty * Number(price)).toLocaleString("en-IN")}\n`;
    });
    msg += `\n─────────────\n`;
    msg += `Subtotal: ${cs}${sub.toLocaleString("en-IN")}\n`;
    if (tax > 0) msg += `Tax: ${cs}${tax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}\n`;
    msg += `*Total: ${cs}${tot.toLocaleString("en-IN", { maximumFractionDigits: 2 })}*\n`;
    msg += `\nPlease confirm this order. 🙏`;
    return msg;
  };

  const handleSharePOWhatsApp = () => {
    if (!selectedPO || poItems.length === 0) return;
    const msg = buildPOWhatsAppMessage(
      selectedPO.po_number, selectedPO.supplier_name, poItems,
      Number(selectedPO.subtotal), Number(selectedPO.tax), Number(selectedPO.total),
      selectedPO.expected_date
    );
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleConvertToBill = async () => {
    if (!selectedPO) return;
    setIsConverting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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

      // Create bill
      const { data: bill, error: billErr } = await supabase
        .from("bills")
        .insert({
          user_id: user.id,
          bill_number: billNumber,
          customer_name: selectedPO.supplier_name,
          customer_email: selectedPO.supplier_email,
          bill_date: new Date().toISOString().split("T")[0],
          subtotal: selectedPO.subtotal,
          tax: selectedPO.tax,
          total: selectedPO.total,
          status: "active",
          notes: `Converted from ${selectedPO.po_number}`,
        })
        .select()
        .single();

      if (billErr) throw billErr;

      // Copy items to bill
      const billItems = poItems.map((i) => ({
        bill_id: bill.id,
        product_id: i.product_id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: i.amount,
      }));

      await supabase.from("bill_items").insert(billItems);

      // Update PO status
      await supabase
        .from("purchase_orders")
        .update({ status: "converted" })
        .eq("id", selectedPO.id);

      // Update product stock (increase since goods received)
      for (const item of poItems) {
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
          }
        }
      }

      toast.success(`Converted to Bill ${billNumber} & stock updated!`);
      setIsDetailOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert");
    } finally {
      setIsConverting(false);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "secondary";
      case "converted": return "default";
      case "cancelled": return "destructive";
      default: return "outline" as const;
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.supplier_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      o.po_number.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Create PO → Convert to Bill</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gradient-primary text-primary-foreground" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New PO
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search POs..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* PO List */}
      <div className="space-y-2">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No purchase orders yet</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((po) => (
            <Card
              key={po.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
              onClick={() => viewPO(po)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{po.po_number}</p>
                    <Badge variant={statusColor(po.status) as any} className="text-[10px]">
                      {po.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{po.supplier_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(po.po_date), "dd MMM yyyy")}
                  </p>
                </div>
                <p className="font-bold text-sm">
                  {cs}{Number(po.total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* PO Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPO?.po_number} — {selectedPO?.supplier_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span>{selectedPO && format(new Date(selectedPO.po_date), "dd MMM yyyy")}</span>
            </div>
            {selectedPO?.expected_date && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected</span>
                <span>{format(new Date(selectedPO.expected_date), "dd MMM yyyy")}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusColor(selectedPO?.status || "") as any}>
                {selectedPO?.status}
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted p-2 flex text-[10px] font-semibold text-muted-foreground">
                <span className="flex-1">Item</span>
                <span className="w-10 text-center">Qty</span>
                <span className="w-16 text-right">Price</span>
                <span className="w-16 text-right">Total</span>
              </div>
              {poItems.map((item) => (
                <div key={item.id} className="p-2 flex text-xs border-t items-center">
                  <span className="flex-1 truncate">{item.description}</span>
                  <span className="w-10 text-center">{item.quantity}</span>
                  <span className="w-16 text-right">{cs}{Number(item.unit_price).toLocaleString("en-IN")}</span>
                  <span className="w-16 text-right font-semibold">{cs}{Number(item.amount).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{cs}{Number(selectedPO?.subtotal || 0).toLocaleString("en-IN")}</span>
              </div>
              {Number(selectedPO?.tax || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{cs}{Number(selectedPO?.tax || 0).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span className="text-primary">{cs}{Number(selectedPO?.total || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {selectedPO?.notes && (
              <p className="text-xs text-muted-foreground italic">{selectedPO.notes}</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSharePOWhatsApp}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share WhatsApp
              </Button>
              {selectedPO?.status === "pending" && (
                <Button
                  onClick={handleConvertToBill}
                  disabled={isConverting}
                  className="flex-1 gradient-primary text-primary-foreground"
                  size="sm"
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  {isConverting ? "Converting..." : "Convert to Bill"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create PO Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            <Input
              placeholder="Supplier Name *"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Supplier Phone (WhatsApp)"
                type="tel"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
              />
              <Input
                placeholder="Supplier Email"
                type="email"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">PO Date</label>
                <Input type="date" value={poDate} onChange={(e) => setPODate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Expected Date</label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Items</p>
              {items.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-2 space-y-2">
                  <div className="flex gap-2">
                    <Select onValueChange={(v) => selectProduct(idx, v)}>
                      <SelectTrigger className="flex-1 text-xs h-8">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.name} — {cs}{p.purchase_price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Description"
                    className="text-xs h-8"
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      className="text-xs h-8"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      className="text-xs h-8"
                      value={item.unit_price}
                      onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <p className="text-right text-xs font-semibold text-primary">
                    = {cs}{(item.quantity * item.unit_price).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem} className="w-full">
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            </div>

            <Textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            {/* Totals */}
            <div className="space-y-1 text-sm border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{cs}{itemsSubtotal.toLocaleString("en-IN")}</span>
              </div>
              {settings.tax_enabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{settings.tax_name} ({settings.default_tax_rate}%)</span>
                  <span>{cs}{itemsTax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span className="text-primary">{cs}{itemsTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <Button
              onClick={handleCreatePO}
              disabled={isSubmitting}
              className="w-full gradient-primary text-primary-foreground"
            >
              {isSubmitting ? "Creating..." : supplierPhone.trim() ? "Create & Share via WhatsApp" : "Create Purchase Order"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrders;
