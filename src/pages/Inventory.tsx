import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  sku: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  quantity: z.number().min(0, "Quantity must be positive"),
  unit_price: z.number().min(0, "Price must be positive"),
  category: z.string().max(100).optional(),
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  category: string | null;
};

const Inventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    quantity: 0,
    unit_price: 0,
    category: "",
  });

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Error fetching products");
    } else {
      setProducts(data || []);
      setFilteredProducts(data || []);
    }
  };

  useEffect(() => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    setFilteredProducts(filtered);
  }, [searchTerm, categoryFilter, products]);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = productSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update({ ...formData })
        .eq("id", editingProduct.id);
      
      if (error) {
        toast.error("Error updating product");
      } else {
        toast.success("Product updated successfully");
      }
    } else {
      const { error } = await supabase.from("products").insert([{ ...formData, user_id: user.id }]);
      
      if (error) {
        toast.error("Error creating product");
      } else {
        toast.success("Product created successfully");
      }
    }

    setIsDialogOpen(false);
    resetForm();
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    
    if (error) {
      toast.error("Error deleting product");
    } else {
      toast.success("Product deleted successfully");
      fetchProducts();
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      quantity: product.quantity,
      unit_price: product.unit_price,
      category: product.category || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      description: "",
      quantity: 0,
      unit_price: 0,
      category: "",
    });
    setEditingProduct(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const totalValue = filteredProducts.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
    const message = `Inventory Stock Report\n\nTotal Products: ${filteredProducts.length}\nTotal Inventory Value: $${totalValue.toFixed(2)}\n\n${filteredProducts.map(p => `${p.name} - Qty: ${p.quantity} - $${(p.quantity * p.unit_price).toFixed(2)}`).join('\n')}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const totalInventoryValue = filteredProducts.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsPrintDialogOpen(true)}>
            <Printer className="mr-2 h-4 w-4" /> Print Stock
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogDescription className="sr-only">
                  {editingProduct ? "Edit product details" : "Add a new product to inventory"}
                </DialogDescription>
              </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Unit Price *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingProduct ? "Update Product" : "Add Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:mb-8">
            <DialogTitle className="text-2xl">Inventory Stock Report</DialogTitle>
            <DialogDescription className="sr-only">
              View and print inventory stock report or share via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div id="inventory-print-area" className="space-y-6">
            <div className="flex justify-between items-start print:mb-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">INVENTORY REPORT</h2>
                <p className="text-muted-foreground mt-2">
                  Generated on {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleWhatsAppShare} variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || "-"}</TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right">${product.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ${(product.quantity * product.unit_price).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Products:</span>
                  <span className="text-foreground font-medium">{filteredProducts.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span className="text-foreground">Total Inventory Value:</span>
                  <span className="text-foreground">${totalInventoryValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:mb-8">
            <DialogTitle className="text-2xl">Inventory Stock Report</DialogTitle>
            <DialogDescription className="sr-only">
              View and print inventory stock report or share via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div id="inventory-print-area" className="space-y-6">
            <div className="flex justify-between items-start print:mb-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">INVENTORY REPORT</h2>
                <p className="text-muted-foreground mt-2">
                  Generated on {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleWhatsAppShare} variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || "-"}</TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right">${product.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ${(product.quantity * product.unit_price).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Products:</span>
                  <span className="text-foreground font-medium">{filteredProducts.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span className="text-foreground">Total Inventory Value:</span>
                  <span className="text-foreground">${totalInventoryValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Products</CardTitle>
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:w-64"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex h-10 w-full md:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat || ""}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku || "-"}</TableCell>
                  <TableCell>{product.category || "-"}</TableCell>
                  <TableCell>{product.quantity}</TableCell>
                  <TableCell>${product.unit_price.toFixed(2)}</TableCell>
                  <TableCell>${(product.quantity * product.unit_price).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

export default Inventory;
