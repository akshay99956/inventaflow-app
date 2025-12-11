import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Printer, Share2, FileText, IndianRupee, Clock, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CompanyBranding } from "@/components/CompanyBranding";
import { DocumentFilters, FilterState } from "@/components/DocumentFilters";

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  issue_date: string;
  due_date: string | null;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  notes: string | null;
  client_id: string | null;
};

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  product_id: string | null;
};

type InvoicePrintColumn = 'description' | 'quantity' | 'unit_price' | 'amount';

const invoicePrintColumnLabels: Record<InvoicePrintColumn, string> = {
  description: 'Description',
  quantity: 'Quantity',
  unit_price: 'Unit Price',
  amount: 'Amount',
};

const invoiceStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPrintColumns, setSelectedPrintColumns] = useState<InvoicePrintColumn[]>(['description', 'quantity', 'unit_price', 'amount']);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    clientId: "",
    status: "",
  });
  const navigate = useNavigate();

  const togglePrintColumn = (col: InvoicePrintColumn) => {
    setSelectedPrintColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Error fetching invoices");
    } else {
      setInvoices(data || []);
    }
  };

  useEffect(() => {
    fetchInvoices();

    const channel = supabase
      .channel("invoices-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        fetchInvoices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...invoices];

    if (filters.dateFrom) {
      result = result.filter(inv => inv.issue_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter(inv => inv.issue_date <= filters.dateTo);
    }
    if (filters.clientId) {
      result = result.filter(inv => inv.client_id === filters.clientId);
    }
    if (filters.status) {
      result = result.filter(inv => inv.status === filters.status);
    }

    setFilteredInvoices(result);
  }, [invoices, filters]);

  const fetchInvoiceItems = async (invoiceId: string) => {
    const { data, error } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId);
    
    if (error) {
      toast.error("Error fetching invoice items");
    } else {
      setInvoiceItems(data || []);
    }
  };

  const handleInvoiceClick = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    await fetchInvoiceItems(invoice.id);
    setIsDialogOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!selectedInvoice) return;
    
    let message = `Invoice ${selectedInvoice.invoice_number}\n\nCustomer: ${selectedInvoice.customer_name}`;
    
    if (invoiceItems.length > 0) {
      message += `\n\nItems:`;
      invoiceItems.forEach(item => {
        let itemLine = `\n• ${item.description}`;
        const details: string[] = [];
        if (selectedPrintColumns.includes('quantity')) details.push(`Qty: ${item.quantity}`);
        if (selectedPrintColumns.includes('unit_price')) details.push(`Price: ₹${item.unit_price.toFixed(2)}`);
        if (selectedPrintColumns.includes('amount')) details.push(`Amount: ₹${item.amount.toFixed(2)}`);
        if (details.length > 0) itemLine += ` (${details.join(', ')})`;
        message += itemLine;
      });
    }
    
    message += `\n\nTotal: ₹${selectedInvoice.total.toFixed(2)}\nStatus: ${selectedInvoice.status}\n\nThank you for your business!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const restoreStock = async (invoiceId: string) => {
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("product_id, quantity")
      .eq("invoice_id", invoiceId);

    if (itemsError) {
      console.error("Failed to fetch invoice items for stock restoration:", itemsError);
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

  const handleStatusChange = async (invoiceId: string, newStatus: string, currentStatus: string) => {
    if (newStatus === "cancelled" && currentStatus !== "cancelled") {
      const restored = await restoreStock(invoiceId);
      if (restored) {
        toast.success("Stock quantities have been restored");
      }
    }

    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", invoiceId);

    if (error) {
      toast.error("Failed to update invoice status");
    } else {
      toast.success("Invoice status updated");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { 
        className: "bg-muted text-muted-foreground border-muted-foreground/20",
        icon: FileText 
      },
      sent: { 
        className: "bg-info text-info-foreground",
        icon: Clock 
      },
      paid: { 
        className: "bg-success text-success-foreground",
        icon: IndianRupee 
      },
      overdue: { 
        className: "bg-warning text-warning-foreground",
        icon: Clock 
      },
      cancelled: { 
        className: "bg-destructive/10 text-destructive border border-destructive/20",
        icon: XCircle 
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge className={`${config.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Calculate summary stats from filtered invoices
  const totalInvoices = filteredInvoices.length;
  const paidInvoices = filteredInvoices.filter(inv => inv.status === "paid");
  const pendingInvoices = filteredInvoices.filter(inv => inv.status === "sent" || inv.status === "draft");
  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const handleCSVExport = () => {
    const headers = ['Invoice #', 'Customer', 'Email', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'Tax', 'Total'];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      inv.customer_name,
      inv.customer_email || '',
      inv.issue_date,
      inv.due_date || '',
      inv.status,
      inv.subtotal.toFixed(2),
      inv.tax.toFixed(2),
      inv.total.toFixed(2)
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
    link.download = `invoices${dateRange}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Invoices exported to CSV');
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices and payments</p>
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
            onClick={() => navigate("/invoices/new")}
            className="gradient-primary text-primary-foreground shadow-colorful hover:opacity-90 transition-opacity"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DocumentFilters
        onFiltersChange={setFilters}
        statusOptions={invoiceStatusOptions}
        showClientFilter={true}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-primary" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{totalInvoices}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-secondary" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <IndianRupee className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-success">₹{totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-warm" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Amount</p>
                <p className="text-2xl font-bold text-warning">₹{pendingAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-colorful overflow-hidden">
          <div className="h-1 gradient-cool" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <FileText className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Invoices</p>
                <p className="text-2xl font-bold text-info">{pendingInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-colorful">
        <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-accent/5">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            All Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Invoice #</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Issue Date</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice, index) => (
                <TableRow 
                  key={invoice.id} 
                  className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                    invoice.status === "cancelled" ? "opacity-60" : ""
                  } ${index % 2 === 0 ? "bg-card" : "bg-muted/20"}`}
                  onClick={() => handleInvoiceClick(invoice)}
                >
                  <TableCell className="font-medium text-primary">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={invoice.status}
                      onValueChange={(value) => handleStatusChange(invoice.id, value, invoice.status)}
                    >
                      <SelectTrigger className="w-[140px] h-8 border-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="font-semibold text-right">
                    <span className={invoice.status === "paid" ? "text-success" : ""}>
                      ₹{invoice.total.toFixed(2)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:mb-8">
            <DialogTitle className="text-2xl text-gradient">Invoice Details</DialogTitle>
            <DialogDescription className="sr-only">
              View and manage invoice details, print or share via WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div id="invoice-print-area" className="space-y-6">
              {/* Column Selection - Hidden on Print */}
              <div className="print:hidden p-4 bg-muted/30 rounded-lg">
                <Label className="text-sm font-medium mb-3 block">Select columns for print/share:</Label>
                <div className="flex flex-wrap gap-4">
                  {(Object.keys(invoicePrintColumnLabels) as InvoicePrintColumn[]).map(col => (
                    <div key={col} className="flex items-center space-x-2">
                      <Checkbox
                        id={`inv-col-${col}`}
                        checked={selectedPrintColumns.includes(col)}
                        onCheckedChange={() => togglePrintColumn(col)}
                      />
                      <Label htmlFor={`inv-col-${col}`} className="text-sm cursor-pointer">
                        {invoicePrintColumnLabels[col]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-start print:mb-6">
                <div>
                  <CompanyBranding />
                  <h2 className="text-3xl font-bold text-gradient">INVOICE</h2>
                  <p className="text-xl font-semibold text-muted-foreground mt-2">
                    {selectedInvoice.invoice_number}
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
                  <p className="text-foreground font-medium">{selectedInvoice.customer_name}</p>
                  {selectedInvoice.customer_email && (
                    <p className="text-muted-foreground text-sm">{selectedInvoice.customer_email}</p>
                  )}
                </div>
                <div className="text-right p-4 rounded-lg bg-gradient-to-bl from-secondary/5 to-success/5">
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Issue Date:</span>{" "}
                      <span className="text-foreground font-medium">
                        {new Date(selectedInvoice.issue_date).toLocaleDateString()}
                      </span>
                    </p>
                    {selectedInvoice.due_date && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Due Date:</span>{" "}
                        <span className="text-foreground font-medium">
                          {new Date(selectedInvoice.due_date).toLocaleDateString()}
                        </span>
                      </p>
                    )}
                    <div className="mt-2">
                      {getStatusBadge(selectedInvoice.status)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-primary/10 to-accent/10">
                      {selectedPrintColumns.includes('description') && <TableHead className="font-semibold">Description</TableHead>}
                      {selectedPrintColumns.includes('quantity') && <TableHead className="text-right font-semibold">Quantity</TableHead>}
                      {selectedPrintColumns.includes('unit_price') && <TableHead className="text-right font-semibold">Unit Price</TableHead>}
                      {selectedPrintColumns.includes('amount') && <TableHead className="text-right font-semibold">Amount</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.map((item, index) => (
                      <TableRow key={item.id} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                        {selectedPrintColumns.includes('description') && <TableCell className="font-medium">{item.description}</TableCell>}
                        {selectedPrintColumns.includes('quantity') && <TableCell className="text-right">{item.quantity}</TableCell>}
                        {selectedPrintColumns.includes('unit_price') && <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>}
                        {selectedPrintColumns.includes('amount') && <TableCell className="text-right font-medium">₹{item.amount.toFixed(2)}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                    {invoiceItems.map((item, index) => (
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
                    <span className="text-foreground font-medium">₹{selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="text-foreground font-medium">₹{selectedInvoice.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2 border-t border-primary/20">
                    <span className="text-gradient">Total:</span>
                    <span className="text-gradient">₹{selectedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="pt-4 border-t">
                  <h3 className="font-semibold text-foreground mb-2">Notes:</h3>
                  <p className="text-muted-foreground text-sm">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
