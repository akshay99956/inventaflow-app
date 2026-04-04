import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle, Package, Users, Receipt, FileText, ArrowDownUp, RefreshCw, Loader2 } from "lucide-react";
import { toastWithSound as toast } from "@/lib/toastWithSound";

interface DataCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  tables: string[];
  dependentTables?: string[];
  color: string;
}

const dataCategories: DataCategory[] = [
  {
    id: "transactions",
    label: "Transactions",
    description: "All income & expense records",
    icon: <ArrowDownUp className="h-5 w-5" />,
    tables: ["transactions"],
    color: "text-blue-500",
  },
  {
    id: "inventory",
    label: "Inventory / Products",
    description: "All products and stock data",
    icon: <Package className="h-5 w-5" />,
    tables: ["products"],
    color: "text-emerald-500",
  },
  {
    id: "clients",
    label: "Clients",
    description: "All customer records",
    icon: <Users className="h-5 w-5" />,
    tables: ["clients"],
    color: "text-violet-500",
  },
  {
    id: "bills",
    label: "Bills",
    description: "All bills and bill items",
    icon: <Receipt className="h-5 w-5" />,
    tables: ["bills"],
    dependentTables: ["bill_items"],
    color: "text-orange-500",
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "All invoices and invoice items",
    icon: <FileText className="h-5 w-5" />,
    tables: ["invoices"],
    dependentTables: ["invoice_items"],
    color: "text-pink-500",
  },
  {
    id: "purchase_orders",
    label: "Purchase Orders",
    description: "All purchase orders and items",
    icon: <Receipt className="h-5 w-5" />,
    tables: ["purchase_orders"],
    dependentTables: ["purchase_order_items"],
    color: "text-cyan-500",
  },
];

const DataManagement = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const toggleCategory = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === dataCategories.length) {
      setSelected([]);
    } else {
      setSelected(dataCategories.map((c) => c.id));
    }
  };

  const handleClearData = async () => {
    if (confirmText !== "DELETE") return;
    setClearing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const categoriesToClear = dataCategories.filter((c) => selected.includes(c.id));

      for (const cat of categoriesToClear) {
        // Delete dependent tables first (e.g., bill_items before bills)
        if (cat.dependentTables) {
          for (const depTable of cat.dependentTables) {
            // Get parent IDs first
            const parentTable = cat.tables[0];
            const { data: parentRows } = await supabase
              .from(parentTable as any)
              .select("id")
              .eq("user_id", user.id);

            if (parentRows?.length) {
              const fkColumn = depTable === "bill_items" ? "bill_id" 
                : depTable === "invoice_items" ? "invoice_id" 
                : "po_id";
              await supabase
                .from(depTable as any)
                .delete()
                .in(fkColumn, parentRows.map((r: any) => r.id));
            }
          }
        }

        // Delete main tables
        for (const table of cat.tables) {
          await supabase.from(table as any).delete().eq("user_id", user.id);
        }
      }

      toast.success(`Successfully cleared ${categoriesToClear.map((c) => c.label).join(", ")}`);
      setSelected([]);
      setConfirmOpen(false);
      setConfirmText("");
    } catch (error) {
      console.error("Clear data error:", error);
      toast.error("Failed to clear some data");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="px-4 md:px-6 py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-primary" />
            Data Management
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Select data categories to clear. This helps you start fresh without deleting your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-4">
          {/* Select All */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selected.length === dataCategories.length}
                onCheckedChange={selectAll}
              />
              <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All
              </Label>
            </div>
            {selected.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selected.length} selected
              </Badge>
            )}
          </div>

          {/* Category Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dataCategories.map((cat) => {
              const isSelected = selected.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  <div className={`p-2 rounded-lg bg-muted ${cat.color}`}>
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Clear Button */}
          <Button
            variant="destructive"
            className="w-full"
            disabled={selected.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Selected Data ({selected.length})
          </Button>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-destructive">Warning</p>
            <p className="text-muted-foreground mt-1">
              Clearing data is permanent and cannot be undone. Your account, settings, and company profile will remain intact.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); setConfirmText(""); }}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Data Deletion
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete the following data:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {dataCategories
                .filter((c) => selected.includes(c.id))
                .map((c) => (
                  <Badge key={c.id} variant="destructive" className="text-xs">
                    {c.label}
                  </Badge>
                ))}
            </div>
            <div className="space-y-2">
              <Label className="text-sm">
                Type <span className="font-bold text-destructive">DELETE</span> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "DELETE" || clearing}
              onClick={handleClearData}
            >
              {clearing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataManagement;
