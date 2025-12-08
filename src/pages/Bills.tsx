import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Bill = {
  id: string;
  bill_number: string;
  customer_name: string;
  bill_date: string;
  total: number;
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
                <TableHead>Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.customer_name}</TableCell>
                  <TableCell>{new Date(bill.bill_date).toLocaleDateString()}</TableCell>
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
