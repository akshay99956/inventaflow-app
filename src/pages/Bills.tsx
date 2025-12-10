import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Printer, Share2, Receipt, IndianRupee, XCircle, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CompanyBranding } from "@/components/CompanyBranding";
import { DocumentFilters, FilterState } from "@/components/DocumentFilters";

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
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!selectedBill) return;
    
    const message = `Bill ${selectedBill.bill_number}\n\nCustomer: ${selectedBill.customer_name}\nAmount: ₹${selectedBill.total.toFixed(2)}\n\nThank you for your business!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bills_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Bills exported to CSV');
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Bills</h1>
          <p className="text-muted-foreground">Create and manage customer bills</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleCSVExport}
            className="border-success hover:bg-success/10"
          >
            <Download className="mr-2 h-4 w-4 text-success" /> Export CSV
          </Button>
          <Button 
            onClick={() => navigate("/bills/new")}
            className="gradient-primary text-primary-foreground shadow-colorful"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Bill
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-primary" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bills</p>
                <p className="text-2xl font-bold">{totalBills}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-secondary" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Bills</p>
                <p className="text-2xl font-bold text-success">{activeBills.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-warm" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <IndianRupee className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-warning">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

      {/* Bill Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:mb-8">
            <DialogTitle className="text-2xl text-gradient">Bill Details</DialogTitle>
            <DialogDescription className="sr-only">
              View and manage bill details, print or share via WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          {selectedBill && (
            <div id="bill-print-area" className="space-y-6">
              <div className="flex justify-between items-start print:mb-6">
                <div>
                  <CompanyBranding />
                  <h2 className="text-3xl font-bold text-gradient">BILL</h2>
                  <p className="text-xl font-semibold text-muted-foreground mt-2">
                    {selectedBill.bill_number}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button onClick={handlePrint} variant="outline" size="sm" className="border-primary/20 hover:bg-primary/10">
                    <Printer className="h-4 w-4 mr-2 text-primary" />
                    Print
                  </Button>
                  <Button onClick={handleWhatsAppShare} variant="outline" size="sm" className="border-success/20 hover:bg-success/10">
                    <Share2 className="h-4 w-4 mr-2 text-success" />
                    WhatsApp
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 print:gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5">
                  <h3 className="font-semibold text-primary mb-2">Bill To:</h3>
                  <p className="text-foreground font-medium">{selectedBill.customer_name}</p>
                  {selectedBill.customer_email && (
                    <p className="text-muted-foreground text-sm">{selectedBill.customer_email}</p>
                  )}
                </div>
                <div className="text-right p-4 rounded-lg bg-gradient-to-bl from-secondary/5 to-success/5">
                  <div className="space-y-1">
                    <p className="text-sm">
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
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="text-right font-semibold">Quantity</TableHead>
                      <TableHead className="text-right font-semibold">Unit Price</TableHead>
                      <TableHead className="text-right font-semibold">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.map((item, index) => (
                      <TableRow key={item.id} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">₹{item.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-72 space-y-2 p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="text-foreground font-medium">₹{selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="text-foreground font-medium">₹{selectedBill.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2 border-t border-primary/20">
                    <span className="text-gradient">Total:</span>
                    <span className="text-gradient">₹{selectedBill.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedBill.notes && (
                <div className="pt-4 border-t">
                  <h3 className="font-semibold text-foreground mb-2">Notes:</h3>
                  <p className="text-muted-foreground text-sm">{selectedBill.notes}</p>
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
