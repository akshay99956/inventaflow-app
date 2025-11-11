-- Create bills table
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bill_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bill_items table
CREATE TABLE public.bill_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL,
  product_id UUID,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

-- Create policies for bills
CREATE POLICY "Users can view their own bills" 
ON public.bills 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bills" 
ON public.bills 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bills" 
ON public.bills 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bills" 
ON public.bills 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for bill_items
CREATE POLICY "Users can view bill items for their bills" 
ON public.bill_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM bills 
  WHERE bills.id = bill_items.bill_id 
  AND bills.user_id = auth.uid()
));

CREATE POLICY "Users can insert bill items for their bills" 
ON public.bill_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM bills 
  WHERE bills.id = bill_items.bill_id 
  AND bills.user_id = auth.uid()
));

CREATE POLICY "Users can update bill items for their bills" 
ON public.bill_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM bills 
  WHERE bills.id = bill_items.bill_id 
  AND bills.user_id = auth.uid()
));

CREATE POLICY "Users can delete bill items for their bills" 
ON public.bill_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM bills 
  WHERE bills.id = bill_items.bill_id 
  AND bills.user_id = auth.uid()
));

-- Add trigger for automatic timestamp updates on bills
CREATE TRIGGER update_bills_updated_at
BEFORE UPDATE ON public.bills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();