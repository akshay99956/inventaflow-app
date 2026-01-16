import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Printer, Share2, Receipt, IndianRupee, XCircle, CheckCircle, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CompanyBranding } from "@/components/CompanyBranding";
import { DocumentFilters, FilterState } from "@/components/DocumentFilters";
import { SwipeableCard } from "@/components/SwipeableCard";
import { useIsMobile } from "@/hooks/use-mobile";

type Bill = {
  id: string;
  bill_number: string;
  customer_name: string;
  customer_email: string | null;
  bill_date: string;
  total: number;
  subtotal: number;
  tax: number;
  notes: string | null;
  status?: string;
  client_id: string | null;
};

type BillItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

const billStatusOptions = [
  { value: "active", label: "Active" },
  { value: "cancelled", label: "Cancelled" },
];

const Bills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    clientId: "",
    status: "",
  });
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Error fetching bills");
    } else {
      setBills(data || []);
    }
  };

  useEffect(() => {
    fetchBills();

    const channel = supabase
      .channel("bills-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => {
        fetchBills();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...bills];

    if (filters.dateFrom) {
      result = result.filter(bill => bill.bill_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(bill => bill.bill_date <= filters.dateTo);
    }
    if (filters.clientId) {
      result = result.filter(bill => bill.client_id === filters.clientId);
    }
    if (filters.status) {
      result = result.filter(bill => (bill.status || "active") === filters.status);
    }

    setFilteredBills(result);
  }, [bills, filters]);

  const fetchBillItems = async (billId: string) => {
    const { data, error } = await supabase
      .from("bill_items")
      .select("*")
      .eq("bill_id", billId);
    
    if (error) {
      toast.error("Error fetching bill items");
    } else {
      setBillItems(data || []);
    }
  };

  const handleBillClick = async (bill: Bill) => {
    setSelectedBill(bill);
    await fetchBillItems(bill.id);
    setIsDialogOpen(true);
  };

  const restoreStock = async (billId: string) => {
    const { data: items, error: itemsError } = await supabase
      .from("bill_items")
      .select("product_id, quantity")
      .eq("bill_id", billId);

    if (itemsError) {
      console.error("Failed to fetch bill items for stock restoration:", itemsError);
      return false;
    }

    for (const item of items || []) {
      if (item.product_id) {
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("quantity")
          .eq("id", item.product_id)
          .maybeSingle();

        if (productError || !product) {
          console.error("Failed to fetch product:", productError);
          continue;
        }

        const { error: updateError } = await supabase
          .from("products")
          .update({ quantity: product.quantity + item.quantity })
          .eq("id", item.product_id);

        if (updateError) {
          console.error("Failed to restore product quantity:", updateError);
        }
      }
    }

    return true;
  };

  const handleStatusChange = async (billId: string, newStatus: string, currentStatus: string | undefined) => {
    if (newStatus === "cancelled" && currentStatus !== "cancelled") {
      const restored = await restoreStock(billId);
      if (restored) {
        toast.success("Stock quantities have been restored");
      }
    }

    const { error } = await supabase
      .from("bills")
      .update({ status: newStatus } as any)
      .eq("id", billId);

    if (error) {
      toast.error("Failed to update bill status");
    } else {
      toast.success("Bill status updated");
    }
  };

  const handleDeleteBill = async (billId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (bill && bill.status !== "cancelled") {
      await restoreStock(billId);
    }

    const { error: itemsError } = await supabase
      .from("bill_items")
      .delete()
      .eq("bill_id", billId);

    if (itemsError) {
      toast.error("Failed to delete bill items");
      return;
    }

    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", billId);

    if (error) {
      toast.error("Failed to delete bill");
    } else {
      toast.success("Bill deleted successfully");
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    const statusConfig = {
      active: { 
        className: "bg-success text-success-foreground",
        icon: CheckCircle 
      },
      cancelled: { 
        className: "bg-destructive/10 text-destructive border border-destructive/20",
        icon: XCircle 
      },
    };

    const config = statusConfig[(status || "active") as keyof typeof statusConfig] || statusConfig.active;
    const Icon = config.icon;
    const displayStatus = status || "active";

    return (
      <Badge className={`${config.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </Badge>
    );
  };

  const handlePrint = () => {
    if (!selectedBill) {
      toast.error("No bill selected to print");
      return;
    }
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleWhatsAppShare = () => {
    if (!selectedBill) {
      toast.error("No bill selected to share");
      return;
    }
    
    // Build items list
    const itemsList = billItems.map((item, index) => 
      `${index + 1}. ${item.description} (${item.quantity} x ₹${item.unit_price.toFixed(2)}) = ₹${item.amount.toFixed(2)}`
    ).join('\n');
    
    const message = `*BILL: ${selectedBill.bill_number}*
    
📋 *Customer:* ${selectedBill.customer_name}
${selectedBill.customer_email ? `📧 Email: ${selectedBill.customer_email}` : ''}
📅 *Date:* ${new Date(selectedBill.bill_date).toLocaleDateString('en-IN')}

*Items:*
${itemsList}

━━━━━━━━━━━━━━━
💰 *Subtotal:* ₹${selectedBill.subtotal.toFixed(2)}
📊 *Tax:* ₹${selectedBill.tax.toFixed(2)}
*Total:* ₹${selectedBill.total.toFixed(2)}
━━━━━━━━━━━━━━━
${selectedBill.notes ? `\n📝 Notes: ${selectedBill.notes}` : ''}

Thank you for your business! 🙏`;
    
    const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success("Opening WhatsApp Web to share bill");
  };

  // Calculate summary stats from filtered bills
  const totalBills = filteredBills.length;
  const activeBills = filteredBills.filter(b => (b.status || "active") === "active");
  const totalAmount = activeBills.reduce((sum, b) => sum + b.total, 0);

  const handleCSVExport = () => {
    const headers = ['Bill #', 'Customer', 'Email', 'Date', 'Status', 'Subtotal', 'Tax', 'Total'];
    const rows = filteredBills.map(bill => [
      bill.bill_number,
      bill.customer_name,
      bill.customer_email || '',
      bill.bill_date,
      bill.status || 'active',
      bill.subtotal.toFixed(2),
      bill.tax.toFixed(2),
      bill.total.toFixed(2)
    ]);
    
    const dateRange = filters.dateFrom || filters.dateTo 
      ? `_${filters.dateFrom || 'start'}_to_${filters.dateTo || 'end'}`
      : `_${new Date().toISOString().split('T')[0]}`;
    
    const csvContent = [
      filters.dateFrom || filters.dateTo ? `Date Range: ${filters.dateFrom || 'All'} to ${filters.dateTo || 'All'}` : '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].filter(Boolean).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bills${dateRange}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Bills exported to CSV');
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gradient">Bills</h1>
          <p className="text-sm md:text-base text-muted-foreground">Create and manage customer bills</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline"
            onClick={handleCSVExport}
            className="border-success hover:bg-success/10 flex-1 sm:flex-none"
            size={isMobile ? "sm" : "default"}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Export CSV</span>
          </Button>
          <Button 
            onClick={() => navigate("/bills/new")}
            className="gradient-primary text-primary-foreground shadow-colorful flex-1 sm:flex-none"
            size={isMobile ? "sm" : "default"}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Create Bill</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DocumentFilters
        onFiltersChange={setFilters}
        statusOptions={billStatusOptions}
        showClientFilter={true}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-primary" />
          <CardContent className="pt-3 md:pt-4 px-3 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                <Receipt className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Total Bills</p>
                <p className="text-lg md:text-2xl font-bold">{totalBills}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-secondary" />
          <CardContent className="pt-3 md:pt-4 px-3 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-success" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Active Bills</p>
                <p className="text-lg md:text-2xl font-bold text-success">{activeBills.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-colorful overflow-hidden col-span-2 md:col-span-1">
          <div className="h-1 gradient-warm" />
          <CardContent className="pt-3 md:pt-4 px-3 md:px-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
                <IndianRupee className="h-4 w-4 md:h-5 md:w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Total Amount</p>
                <p className="text-lg md:text-2xl font-bold text-warning">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bills List - Mobile Card View - Compact */}
      {isMobile ? (
        <div className="space-y-2">
          {filteredBills.map((bill) => (
            <Card 
              key={bill.id}
              className={`border-0 shadow-sm overflow-hidden ${bill.status === "cancelled" ? "opacity-60" : ""}`}
            >
              <div className={`h-0.5 ${bill.status === "cancelled" ? "bg-destructive" : "bg-success"}`} />
              <CardContent className="p-3">
                {/* Main Row - Tap to view */}
                <div 
                  className="flex items-center justify-between gap-2"
                  onClick={() => handleBillClick(bill)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{bill.customer_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-primary font-medium">{bill.bill_number}</span>
                      <span>•</span>
                      <span>{new Date(bill.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-base font-bold">₹{bill.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    {getStatusBadge(bill.status)}
                  </div>
                </div>
                
                {/* Compact Action Row */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                  <Select
                    value={bill.status || "active"}
                    onValueChange={(value) => handleStatusChange(bill.id, value, bill.status)}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs border-0 bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active" className="text-xs">Active</SelectItem>
                      <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleBillClick(bill)}
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => handleDeleteBill(bill.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredBills.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                No bills found
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <Card className="border-0 shadow-colorful">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-accent/5">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              All Bills
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Bill #</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill, index) => (
                  <TableRow 
                    key={bill.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      bill.status === "cancelled" ? "opacity-60" : ""
                    } ${index % 2 === 0 ? "bg-card" : "bg-muted/20"}`}
                    onClick={() => handleBillClick(bill)}
                  >
                    <TableCell className="font-medium text-primary">{bill.bill_number}</TableCell>
                    <TableCell>{bill.customer_name}</TableCell>
                    <TableCell>{new Date(bill.bill_date).toLocaleDateString()}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={bill.status || "active"}
                        onValueChange={(value) => handleStatusChange(bill.id, value, bill.status)}
                      >
                        <SelectTrigger className="w-[130px] h-8 border-0 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-semibold text-right">₹{bill.total.toFixed(2)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBillClick(bill)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bill Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader className="print:mb-8">
            <DialogTitle className="text-xl md:text-2xl text-gradient">Bill Details</DialogTitle>
            <DialogDescription className="sr-only">
              View and manage bill details, print or share via WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          {selectedBill && (
            <div id="bill-print-area" className="space-y-4 md:space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 print:mb-6">
                <div>
                  <CompanyBranding />
                  <h2 className="text-2xl md:text-3xl font-bold text-gradient">BILL</h2>
                  <p className="text-lg md:text-xl font-semibold text-muted-foreground mt-2">
                    {selectedBill.bill_number}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button onClick={handlePrint} variant="outline" size="sm" className="border-primary/20 hover:bg-primary/10">
                    <Printer className="h-4 w-4 mr-1 md:mr-2 text-primary" />
                    <span className="hidden sm:inline">Print</span>
                  </Button>
                  <Button onClick={handleWhatsAppShare} variant="outline" size="sm" className="border-success/20 hover:bg-success/10">
                    <Share2 className="h-4 w-4 mr-1 md:mr-2 text-success" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 print:gap-4">
                <div className="p-3 md:p-4 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5">
                  <h3 className="font-semibold text-primary mb-2 text-sm md:text-base">Bill To:</h3>
                  <p className="text-foreground font-medium">{selectedBill.customer_name}</p>
                  {selectedBill.customer_email && (
                    <p className="text-muted-foreground text-xs md:text-sm">{selectedBill.customer_email}</p>
                  )}
                </div>
                <div className="text-left sm:text-right p-3 md:p-4 rounded-lg bg-gradient-to-bl from-secondary/5 to-success/5">
                  <div className="space-y-1">
                    <p className="text-xs md:text-sm">
                      <span className="text-muted-foreground">Bill Date:</span>{" "}
                      <span className="text-foreground font-medium">
                        {new Date(selectedBill.bill_date).toLocaleDateString()}
                      </span>
                    </p>
                    <div className="mt-2">
                      {getStatusBadge(selectedBill.status)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-primary/10 to-accent/10">
                      <TableHead className="font-semibold text-xs md:text-sm">Description</TableHead>
                      <TableHead className="text-right font-semibold text-xs md:text-sm">Qty</TableHead>
                      <TableHead className="text-right font-semibold text-xs md:text-sm hidden sm:table-cell">Unit Price</TableHead>
                      <TableHead className="text-right font-semibold text-xs md:text-sm">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.map((item, index) => (
                      <TableRow key={item.id} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                        <TableCell className="font-medium text-xs md:text-sm">{item.description}</TableCell>
                        <TableCell className="text-right text-xs md:text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-xs md:text-sm hidden sm:table-cell">₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium text-xs md:text-sm">₹{item.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-full sm:w-64 space-y-2 p-3 md:p-4 rounded-lg bg-gradient-to-br from-primary/5 to-success/5">
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">₹{selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="font-medium">₹{selectedBill.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base md:text-lg font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-primary">₹{selectedBill.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedBill.notes && (
                <div className="p-3 md:p-4 rounded-lg bg-muted/30 print:bg-gray-50">
                  <h3 className="font-semibold text-muted-foreground mb-2 text-xs md:text-sm">Notes:</h3>
                  <p className="text-foreground text-xs md:text-sm">{selectedBill.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;