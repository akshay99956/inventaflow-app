-- Create a table for user settings
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Currency settings
  currency_symbol TEXT NOT NULL DEFAULT '₹',
  currency_code TEXT NOT NULL DEFAULT 'INR',
  
  -- Tax settings
  default_tax_rate NUMERIC NOT NULL DEFAULT 18,
  tax_name TEXT NOT NULL DEFAULT 'GST',
  tax_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Notification settings
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  low_stock_alerts BOOLEAN NOT NULL DEFAULT true,
  invoice_reminders BOOLEAN NOT NULL DEFAULT true,
  bill_due_alerts BOOLEAN NOT NULL DEFAULT true,
  
  -- Navigation settings (which items to show in bottom nav)
  show_dashboard BOOLEAN NOT NULL DEFAULT true,
  show_sales BOOLEAN NOT NULL DEFAULT true,
  show_inventory BOOLEAN NOT NULL DEFAULT true,
  show_clients BOOLEAN NOT NULL DEFAULT true,
  
  -- Invoice/Bill settings
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  bill_prefix TEXT NOT NULL DEFAULT 'BILL-',
  default_payment_terms INTEGER NOT NULL DEFAULT 30,
  
  -- Display settings
  items_per_page INTEGER NOT NULL DEFAULT 10,
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY'
);

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" 
ON public.user_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();