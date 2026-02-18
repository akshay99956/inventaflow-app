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
import { Plus, Printer, Share2, FileText, IndianRupee, Clock, XCircle, Download, MoreHorizontal, Eye, Trash2, Edit2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CompanyBranding } from "@/components/CompanyBranding";
import { DocumentFilters, FilterState } from "@/components/DocumentFilters";
import { SwipeableCard } from "@/components/SwipeableCard";
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
  amount: 'Amount'
};
const invoiceStatusOptions = [{
  value: "draft",
  label: "Draft"
}, {
  value: "sent",
  label: "Sent"
}, {
  value: "paid",
  label: "Paid"
}, {
  value: "overdue",
  label: "Overdue"
}, {
  value: "cancelled",
  label: "Cancelled"
}];
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
    status: ""
  });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const togglePrintColumn = (col: InvoicePrintColumn) => {
    setSelectedPrintColumns((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  };
  const fetchInvoices = async () => {
    const {
      data,
      error
    } = await supabase.from("invoices").select("*").order("created_at", {
      ascending: false
    });
    if (error) {
      toast.error("Error fetching invoices");
    } else {
      setInvoices(data || []);
    }
  };
  useEffect(() => {
    fetchInvoices();
    const channel = supabase.channel("invoices-changes").on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "invoices"
    }, () => {
      fetchInvoices();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...invoices];
    if (filters.dateFrom) {
      result = result.filter((inv) => inv.issue_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter((inv) => inv.issue_date <= filters.dateTo);
    }
    if (filters.clientId) {
      result = result.filter((inv) => inv.client_id === filters.clientId);
    }
    if (filters.status) {
      result = result.filter((inv) => inv.status === filters.status);
    }
    setFilteredInvoices(result);
  }, [invoices, filters]);
  const fetchInvoiceItems = async (invoiceId: string) => {
    const {
      data,
      error
    } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId);
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
      invoiceItems.forEach((item) => {
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
    const {
      data: items,
      error: itemsError
    } = await supabase.from("invoice_items").select("product_id, quantity").eq("invoice_id", invoiceId);
    if (itemsError) {
      if (import.meta.env.DEV) {
        console.error("Failed to fetch invoice items for stock restoration:", itemsError);
      }
      return false;
    }
    for (const item of items || []) {
      if (item.product_id) {
        const {
          data: product,
          error: productError
        } = await supabase.from("products").select("quantity").eq("id", item.product_id).maybeSingle();
        if (productError || !product) {
          if (import.meta.env.DEV) {
            console.error("Failed to fetch product:", productError);
          }
          continue;
        }
        const {
          error: updateError
        } = await supabase.from("products").update({
          quantity: product.quantity + item.quantity
        }).eq("id", item.product_id);
        if (updateError) {
          if (import.meta.env.DEV) {
            console.error("Failed to restore product quantity:", updateError);
          }
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
    const {
      error
    } = await supabase.from("invoices").update({
      status: newStatus
    }).eq("id", invoiceId);
    if (error) {
      toast.error("Failed to update invoice status");
    } else {
      toast.success("Invoice status updated");
    }
  };
  const handleDeleteInvoice = async (invoiceId: string, currentStatus: string) => {
    // Restore stock if not already cancelled
    if (currentStatus !== "cancelled") {
      await restoreStock(invoiceId);
    }

    // Delete invoice items first
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

    // Delete the invoice
    const {
      error
    } = await supabase.from("invoices").delete().eq("id", invoiceId);
    if (error) {
      toast.error("Failed to delete invoice");
    } else {
      toast.success("Invoice deleted and stock restored");
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
      }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;
    return <Badge className={`${config.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>;
  };

  // Calculate summary stats from filtered invoices
  const totalInvoices = filteredInvoices.length;
  const paidInvoices = filteredInvoices.filter((inv) => inv.status === "paid");
  const pendingInvoices = filteredInvoices.filter((inv) => inv.status === "sent" || inv.status === "draft");
  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const handleCSVExport = () => {
    const headers = ['Invoice #', 'Customer', 'Email', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'Tax', 'Total'];
    const rows = filteredInvoices.map((inv) => [inv.invoice_number, inv.customer_name, inv.customer_email || '', inv.issue_date, inv.due_date || '', inv.status, inv.subtotal.toFixed(2), inv.tax.toFixed(2), inv.total.toFixed(2)]);
    const dateRange = filters.dateFrom || filters.dateTo ? `_${filters.dateFrom || 'start'}_to_${filters.dateTo || 'end'}` : `_${new Date().toISOString().split('T')[0]}`;
    const csvContent = [filters.dateFrom || filters.dateTo ? `Date Range: ${filters.dateFrom || 'All'} to ${filters.dateTo || 'All'}` : '', headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].filter(Boolean).join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `invoices${dateRange}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Invoices exported to CSV');
  };
  return <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gradient">Invoices</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage invoices and payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCSVExport} className="border-success hover:bg-success/10 flex-1 sm:flex-none">
            <Download className="h-4 w-4 sm:mr-2 text-success" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={() => navigate("/invoices/new")} className="gradient-primary text-primary-foreground shadow-colorful hover:opacity-90 transition-opacity flex-1 sm:flex-none">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Create Invoice</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DocumentFilters onFiltersChange={setFilters} statusOptions={invoiceStatusOptions} showClientFilter={true} />

      {/* Summary Cards */}
      {/* Summary Cards - Inline on mobile */}
      <div className="grid grid-cols-4 gap-2 md:gap-4 shadow-md rounded-sm opacity-80 border-[#f8f7f7] border-0 border-none bg-muted">
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-primary" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Invoices</p>
              <p className="text-sm md:text-2xl font-bold">{totalInvoices}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-secondary" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Revenue</p>
              <p className="text-sm md:text-2xl font-bold text-success">₹{totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(0)}k` : totalRevenue}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-warm" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Pending</p>
              <p className="text-sm md:text-2xl font-bold text-warning">₹{pendingAmount >= 1000 ? `${(pendingAmount / 1000).toFixed(0)}k` : pendingAmount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1 gradient-cool" />
          <CardContent className="p-2 md:p-6">
            <div className="text-center">
              <p className="text-[10px] md:text-sm text-muted-foreground truncate">Count</p>
              <p className="text-sm md:text-2xl font-bold text-info">{pendingInvoices.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Invoice Cards - Compact Modern Design */}
      {isMobile && <div className="space-y-2">
          {filteredInvoices.map((invoice) => <Card key={invoice.id} className={`border-0 shadow-sm overflow-hidden ${invoice.status === "cancelled" ? "opacity-60" : ""}`}>
              <div className={`h-0.5 ${invoice.status === "paid" ? "bg-success" : invoice.status === "overdue" ? "bg-warning" : invoice.status === "cancelled" ? "bg-destructive" : "gradient-primary"}`} />
              <CardContent className="p-3">
                {/* Main Row - Tap to view */}
                <div className="flex items-center justify-between gap-2" onClick={() => handleInvoiceClick(invoice)}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{invoice.customer_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-primary font-medium">{invoice.invoice_number}</span>
                      <span>•</span>
                      <span>{new Date(invoice.issue_date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short'
                  })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className={`text-base font-bold ${invoice.status === "paid" ? "text-success" : ""}`}>
                      ₹{invoice.total.toLocaleString('en-IN', {
                  maximumFractionDigits: 0
                })}
                    </p>
                    {getStatusBadge(invoice.status)}
                  </div>
                </div>
                
                {/* Compact Action Row */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                  {/* Status Dropdown - Compact */}
                  <Select value={invoice.status} onValueChange={(value) => handleStatusChange(invoice.id, value, invoice.status)}>
                    <SelectTrigger className="h-7 w-24 text-xs border-0 bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {invoiceStatusOptions.map((option) => <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  
                  {/* Action Buttons - Compact */}
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleInvoiceClick(invoice)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => handleInvoiceClick(invoice)} className="text-xs">
                          <Eye className="h-3.5 w-3.5 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteInvoice(invoice.id, invoice.status)} className="text-destructive text-xs">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>)}
          {filteredInvoices.length === 0 && <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No invoices found
              </CardContent>
            </Card>}
        </div>}

      {/* Desktop Table View */}
      {!isMobile && <Card className="border-0 shadow-colorful">
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
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice, index) => <TableRow key={invoice.id} className={`cursor-pointer hover:bg-muted/50 transition-colors ${invoice.status === "cancelled" ? "opacity-60" : ""} ${index % 2 === 0 ? "bg-card" : "bg-muted/20"}`} onClick={() => handleInvoiceClick(invoice)}>
                    <TableCell className="font-medium text-primary">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.customer_name}</TableCell>
                    <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={invoice.status} onValueChange={(value) => handleStatusChange(invoice.id, value, invoice.status)}>
                        <SelectTrigger className="w-[120px] h-8 border-0 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {invoiceStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-semibold text-right">₹{invoice.total.toLocaleString('en-IN')}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleInvoiceClick(invoice)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteInvoice(invoice.id, invoice.status)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader className="print:mb-8">
            <DialogTitle className="text-xl md:text-2xl text-gradient">Invoice Details</DialogTitle>
            <DialogDescription className="sr-only">
              View and manage invoice details, print or share via WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && <div id="invoice-print-area" className="space-y-4 md:space-y-6">
              {/* Column Selection - Hidden on Print */}
              <div className="print:hidden p-3 md:p-4 bg-muted/30 rounded-lg">
                <Label className="text-xs md:text-sm font-medium mb-2 block">Select columns for print/share:</Label>
                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-4">
                  {(Object.keys(invoicePrintColumnLabels) as InvoicePrintColumn[]).map((col) => <div key={col} className="flex items-center space-x-2">
                      <Checkbox id={`inv-col-${col}`} checked={selectedPrintColumns.includes(col)} onCheckedChange={() => togglePrintColumn(col)} />
                      <Label htmlFor={`inv-col-${col}`} className="text-xs md:text-sm cursor-pointer">
                        {invoicePrintColumnLabels[col]}
                      </Label>
                    </div>)}
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start gap-4 print:mb-6">
                <div className="w-full md:w-auto">
                  <CompanyBranding />
                  <h2 className="text-2xl md:text-3xl font-bold text-gradient">INVOICE</h2>
                  <p className="text-lg md:text-xl font-semibold text-muted-foreground mt-1 md:mt-2">
                    {selectedInvoice.invoice_number}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden w-full md:w-auto">
                  <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 md:flex-none border-primary/20 hover:bg-primary/10">
                    <Printer className="h-4 w-4 mr-2 text-primary" />
                    Print
                  </Button>
                  <Button onClick={handleWhatsAppShare} variant="outline" size="sm" className="flex-1 md:flex-none border-success/20 hover:bg-success/10">
                    <Share2 className="h-4 w-4 mr-2 text-success" />
                    WhatsApp
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 print:gap-4">
                <div className="p-3 md:p-4 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5">
                  <h3 className="font-semibold text-primary mb-1 md:mb-2 text-sm md:text-base">Bill To:</h3>
                  <p className="text-foreground font-medium text-sm md:text-base">{selectedInvoice.customer_name}</p>
                  {selectedInvoice.customer_email && <p className="text-muted-foreground text-xs md:text-sm">{selectedInvoice.customer_email}</p>}
                </div>
                <div className="md:text-right p-3 md:p-4 rounded-lg bg-gradient-to-bl from-secondary/5 to-success/5">
                  <div className="space-y-1">
                    <p className="text-xs md:text-sm">
                      <span className="text-muted-foreground">Issue Date:</span>{" "}
                      <span className="text-foreground font-medium">
                        {new Date(selectedInvoice.issue_date).toLocaleDateString()}
                      </span>
                    </p>
                    {selectedInvoice.due_date && <p className="text-xs md:text-sm">
                        <span className="text-muted-foreground">Due Date:</span>{" "}
                        <span className="text-foreground font-medium">
                          {new Date(selectedInvoice.due_date).toLocaleDateString()}
                        </span>
                      </p>}
                    <div className="mt-2">
                      {getStatusBadge(selectedInvoice.status)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-primary/10 to-accent/10">
                      {selectedPrintColumns.includes('description') && <TableHead className="font-semibold text-xs md:text-sm">Description</TableHead>}
                      {selectedPrintColumns.includes('quantity') && <TableHead className="text-right font-semibold text-xs md:text-sm">Qty</TableHead>}
                      {selectedPrintColumns.includes('unit_price') && <TableHead className="text-right font-semibold text-xs md:text-sm">Price</TableHead>}
                      {selectedPrintColumns.includes('amount') && <TableHead className="text-right font-semibold text-xs md:text-sm">Amount</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.map((item, index) => <TableRow key={item.id} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                        {selectedPrintColumns.includes('description') && <TableCell className="font-medium text-xs md:text-sm">{item.description}</TableCell>}
                        {selectedPrintColumns.includes('quantity') && <TableCell className="text-right text-xs md:text-sm">{item.quantity}</TableCell>}
                        {selectedPrintColumns.includes('unit_price') && <TableCell className="text-right text-xs md:text-sm">₹{item.unit_price.toFixed(2)}</TableCell>}
                        {selectedPrintColumns.includes('amount') && <TableCell className="text-right font-medium text-xs md:text-sm">₹{item.amount.toFixed(2)}</TableCell>}
                      </TableRow>)}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-full md:w-72 space-y-2 p-3 md:p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30">
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="text-foreground font-medium">₹{selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="text-foreground font-medium">₹{selectedInvoice.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg md:text-xl font-bold pt-2 border-t border-primary/20">
                    <span className="text-gradient">Total:</span>
                    <span className="text-gradient">₹{selectedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && <div className="pt-3 md:pt-4 border-t">
                  <h3 className="font-semibold text-foreground mb-1 md:mb-2 text-sm md:text-base">Notes:</h3>
                  <p className="text-muted-foreground text-xs md:text-sm">{selectedInvoice.notes}</p>
                </div>}
            </div>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default Invoices;