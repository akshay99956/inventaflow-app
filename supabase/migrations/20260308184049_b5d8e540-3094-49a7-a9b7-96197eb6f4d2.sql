
-- Purchase Orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Order Items table
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS for purchase_orders
CREATE POLICY "Users can view their own POs" ON public.purchase_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own POs" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own POs" ON public.purchase_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own POs" ON public.purchase_orders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS for purchase_order_items
CREATE POLICY "Users can view PO items" ON public.purchase_order_items FOR SELECT TO authenticated USING (po_id IN (SELECT id FROM public.purchase_orders WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert PO items" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (po_id IN (SELECT id FROM public.purchase_orders WHERE user_id = auth.uid()));
CREATE POLICY "Users can update PO items" ON public.purchase_order_items FOR UPDATE TO authenticated USING (po_id IN (SELECT id FROM public.purchase_orders WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete PO items" ON public.purchase_order_items FOR DELETE TO authenticated USING (po_id IN (SELECT id FROM public.purchase_orders WHERE user_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
