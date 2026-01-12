import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Users, FileText, Search as SearchIcon, Receipt } from "lucide-react";
import { toast } from "sonner";

type SearchResult = {
  type: "product" | "client" | "invoice" | "bill";
  id: string;
  title: string;
  subtitle: string;
  extra?: string;
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const allResults: SearchResult[] = [];

    try {
      // Search products
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sku, category, quantity")
        .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
        .limit(10);

      if (products) {
        allResults.push(
          ...products.map((p) => ({
            type: "product" as const,
            id: p.id,
            title: p.name,
            subtitle: p.sku || "No SKU",
            extra: `Stock: ${p.quantity}`,
          }))
        );
      }

      // Search clients
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, email, phone")
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(10);

      if (clients) {
        allResults.push(
          ...clients.map((c) => ({
            type: "client" as const,
            id: c.id,
            title: c.name,
            subtitle: c.email || c.phone || "No contact",
          }))
        );
      }

      // Search invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, total, status")
        .or(`invoice_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
        .limit(10);

      if (invoices) {
        allResults.push(
          ...invoices.map((i) => ({
            type: "invoice" as const,
            id: i.id,
            title: i.invoice_number,
            subtitle: i.customer_name,
            extra: `₹${i.total} - ${i.status}`,
          }))
        );
      }

      // Search bills
      const { data: bills } = await supabase
        .from("bills")
        .select("id, bill_number, customer_name, total, status")
        .or(`bill_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
        .limit(10);

      if (bills) {
        allResults.push(
          ...bills.map((b) => ({
            type: "bill" as const,
            id: b.id,
            title: b.bill_number,
            subtitle: b.customer_name,
            extra: `₹${b.total} - ${b.status}`,
          }))
        );
      }

      setResults(allResults);
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery(query);
    performSearch(query);
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case "product":
        navigate("/inventory");
        break;
      case "client":
        navigate("/clients");
        break;
      case "invoice":
        navigate("/invoices");
        break;
      case "bill":
        navigate("/bills");
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "product":
        return <Package className="h-4 w-4 text-primary" />;
      case "client":
        return <Users className="h-4 w-4 text-info" />;
      case "invoice":
        return <FileText className="h-4 w-4 text-success" />;
      case "bill":
        return <Receipt className="h-4 w-4 text-warning" />;
      default:
        return <SearchIcon className="h-4 w-4" />;
    }
  };

  const filteredResults = activeTab === "all" 
    ? results 
    : results.filter(r => r.type === activeTab);

  const counts = {
    all: results.length,
    product: results.filter(r => r.type === "product").length,
    client: results.filter(r => r.type === "client").length,
    invoice: results.filter(r => r.type === "invoice").length,
    bill: results.filter(r => r.type === "bill").length,
  };

  return (
    <div className="p-4 md:p-8 space-y-4 pb-24 md:pb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gradient">Search</h1>
        <p className="text-sm text-muted-foreground">Find products, clients, invoices, and bills</p>
      </div>

      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
      </form>

      {query && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all" className="text-xs">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="product" className="text-xs">
              <Package className="h-3 w-3 mr-1" />
              {counts.product}
            </TabsTrigger>
            <TabsTrigger value="client" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {counts.client}
            </TabsTrigger>
            <TabsTrigger value="invoice" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              {counts.invoice}
            </TabsTrigger>
            <TabsTrigger value="bill" className="text-xs">
              <Receipt className="h-3 w-3 mr-1" />
              {counts.bill}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Searching...</div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {query ? "No results found" : "Enter a search term"}
              </div>
            ) : (
              filteredResults.map((result) => (
                <Card
                  key={`${result.type}-${result.id}`}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleResultClick(result)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <Badge variant="outline" className="text-xs capitalize">
                        {result.type}
                      </Badge>
                      {result.extra && (
                        <p className="text-xs text-muted-foreground mt-1">{result.extra}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Search;