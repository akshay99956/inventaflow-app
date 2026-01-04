import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Eye, MoreVertical, Package, PackageCheck, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DocumentFilters, FilterState } from "@/components/DocumentFilters";
import { SwipeableCard } from "@/components/SwipeableCard";
import { useIsMobile } from "@/hooks/use-mobile";

type PurchaseOrder = {
  id: string;
  bill_number: string;
  customer_name: string;
  customer_email: string | null;
  bill_date: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type PurchaseOrderItem = {
  id: string;
  description: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
};

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    clientId: "",
    status: "",
  });

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("purchase-orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bills" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let result = [...orders];

    if (filters.dateFrom) {
      result = result.filter(
        (order) => new Date(order.bill_date) >= new Date(filters.dateFrom)
      );
    }
    if (filters.dateTo) {
      result = result.filter(
        (order) => new Date(order.bill_date) <= new Date(filters.dateTo)
      );
    }
    if (filters.clientId) {
      const clientName = filters.clientId; // For purchase orders, we filter by name input
      result = result.filter((order) =>
        order.customer_name.toLowerCase().includes(clientName.toLowerCase())
      );
    }
    if (filters.status) {
      result = result.filter((order) => order.status === filters.status);
    }

    setFilteredOrders(result);
  }, [orders, filters]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch purchase orders");
      return;
    }

    setOrders(data || []);
  };

  const fetchOrderItems = async (orderId: string) => {
    const { data, error } = await supabase
      .from("bill_items")
      .select("*")
      .eq("bill_id", orderId);

    if (error) {
      toast.error("Failed to fetch order items");
      return;
    }

    setOrderItems(data || []);
  };

  const handleViewDetails = async (order: PurchaseOrder) => {
    setSelectedOrder(order);
    await fetchOrderItems(order.id);
    setIsDetailsOpen(true);
  };

  const handleReceiveOrder = async (order: PurchaseOrder) => {
    if (order.status === "received") {
      toast.info("This order has already been received");
      return;
    }

    try {
      // Fetch order items
      const { data: items, error: itemsError } = await supabase
        .from("bill_items")
        .select("*")
        .eq("bill_id", order.id);

      if (itemsError) throw itemsError;

      // Update inventory for each item that has a product_id
      for (const item of items || []) {
        if (item.product_id) {
          const { data: product, error: productError } = await supabase
            .from("products")
            .select("quantity")
            .eq("id", item.product_id)
            .single();

          if (productError) continue;

          const newQuantity = (product?.quantity || 0) + item.quantity;

          await supabase
            .from("products")
            .update({ quantity: newQuantity })
            .eq("id", item.product_id);
        }
      }

      // Update order status to received
      const { error: updateError } = await supabase
        .from("bills")
        .update({ status: "received" })
        .eq("id", order.id);

      if (updateError) throw updateError;

      toast.success("Order received! Inventory has been updated.");
      fetchOrders();
    } catch (error) {
      console.error("Error receiving order:", error);
      toast.error("Failed to receive order");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      // Delete order items first
      await supabase.from("bill_items").delete().eq("bill_id", orderId);

      // Delete the order
      const { error } = await supabase.from("bills").delete().eq("id", orderId);

      if (error) throw error;

      toast.success("Purchase order deleted");
      fetchOrders();
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Failed to delete order");
    }
  };

  const handleCSVExport = () => {
    const headers = ["Order #", "Supplier", "Date", "Total", "Status"];
    const rows = filteredOrders.map((order) => [
      order.bill_number,
      order.customer_name,
      format(new Date(order.bill_date), "yyyy-MM-dd"),
      order.total.toFixed(2),
      order.status,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
      case "received":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Received</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingOrders = filteredOrders.filter((o) => o.status === "pending").length;
  const totalAmount = filteredOrders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage supplier purchase orders and stock receipts
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleCSVExport} size="sm" className="flex-1 sm:flex-initial">
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button onClick={() => navigate("/purchase-orders/new")} size="sm" className="flex-1 sm:flex-initial gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            <span>New Order</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DocumentFilters
        onFiltersChange={setFilters}
        statusOptions={[
          { value: "pending", label: "Pending" },
          { value: "received", label: "Received" },
          { value: "cancelled", label: "Cancelled" },
        ]}
        clientLabel="Supplier"
        showClientFilter={false}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{filteredOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Pending Receipt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-yellow-600">{pendingOrders}</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">₹{totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      {isMobile ? (
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No purchase orders found
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <SwipeableCard
                key={order.id}
                onEdit={() => handleViewDetails(order)}
                onDelete={() => handleDeleteOrder(order.id)}
              >
                <Card className="cursor-pointer" onClick={() => handleViewDetails(order)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{order.bill_number}</p>
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(order.bill_date), "dd MMM yyyy")}
                      </span>
                      <span className="font-bold">₹{order.total.toFixed(2)}</span>
                    </div>
                    {order.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3 text-green-600 border-green-500/30 hover:bg-green-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReceiveOrder(order);
                        }}
                      >
                        <PackageCheck className="h-4 w-4 mr-2" />
                        Receive Stock
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </SwipeableCard>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No purchase orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.bill_number}</TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell>{format(new Date(order.bill_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>₹{order.total.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {order.status === "pending" && (
                              <DropdownMenuItem onClick={() => handleReceiveOrder(order)}>
                                <PackageCheck className="h-4 w-4 mr-2" />
                                Receive Stock
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteOrder(order.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order #</p>
                  <p className="font-medium">{selectedOrder.bill_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedOrder.bill_date), "dd MMM yyyy")}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Items</h4>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.description} x{item.quantity}
                      </span>
                      <span className="font-medium">₹{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>₹{selectedOrder.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>₹{selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}

              {selectedOrder.status === "pending" && (
                <Button
                  className="w-full gradient-primary"
                  onClick={() => {
                    handleReceiveOrder(selectedOrder);
                    setIsDetailsOpen(false);
                  }}
                >
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Receive Stock & Update Inventory
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrders;