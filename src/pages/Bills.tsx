import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Share2, FileText, IndianRupee, XCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Bill = {
  id: string;
  bill_number: string;
  customer_name: string;
  bill_date: string;
  total: number;
  status?: string;
};

const Bills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
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

  const restoreStock = async (billId: string) => {
    // Get bill items with product_id
    const { data: items, error: itemsError } = await supabase
      .from("bill_items")
      .select("product_id, quantity")
      .eq("bill_id", billId);

    if (itemsError) {
      console.error("Failed to fetch bill items for stock restoration:", itemsError);
      return false;
    }

    // Restore stock for each item
    for (const item of items || []) {
      if (item.product_id) {
        // Get current product quantity
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("quantity")
          .eq("id", item.product_id)
          .maybeSingle();

        if (productError || !product) {
          console.error("Failed to fetch product:", productError);
          continue;
        }

        // Restore the quantity
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
    // If changing to cancelled, restore stock
    if (newStatus === "cancelled" && currentStatus !== "cancelled") {
      const restored = await restoreStock(billId);
      if (restored) {
        toast.success("Stock quantities have been restored");
      }
    }

    const { error } = await supabase
      .from("bills")
      .update({ status: newStatus })
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

  const handleShare = async (bill: Bill) => {
    const shareText = `Bill ${bill.bill_number}\nCustomer: ${bill.customer_name}\nTotal: ₹${bill.total.toFixed(2)}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bill ${bill.bill_number}`,
          text: shareText,
        });
        toast.success("Bill shared successfully");
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error("Error sharing bill");
        }
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Bill details copied to clipboard");
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bills</h1>
          <p className="text-muted-foreground">Create and manage customer bills</p>
        </div>
        <Button onClick={() => navigate("/bills/new")}>
          <Plus className="mr-2 h-4 w-4" /> Create Bill
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow 
                  key={bill.id}
                  className={bill.status === "cancelled" ? "opacity-60" : ""}
                >
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.customer_name}</TableCell>
                  <TableCell>{new Date(bill.bill_date).toLocaleDateString()}</TableCell>
                  <TableCell>
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
                  <TableCell className="font-semibold">₹{bill.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShare(bill)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Bills;
