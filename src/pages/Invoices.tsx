import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  total: number;
};

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const navigate = useNavigate();

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

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: "secondary",
      sent: "default",
      paid: "default",
      overdue: "destructive",
    } as const;

    const statusColor = statusColors[status as keyof typeof statusColors] || "secondary";

    return (
      <Badge variant={statusColor} className={status === "paid" ? "bg-success text-success-foreground" : ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices and payments</p>
        </div>
        <Button onClick={() => navigate("/invoices/new")}>
          <Plus className="mr-2 h-4 w-4" /> Create Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="font-semibold">${invoice.total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Invoices;
