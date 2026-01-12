-- Fix RLS policies on all tables to require authenticated role (not allow anonymous users)

-- Fix bill_items policies
DROP POLICY IF EXISTS "Users can delete bill items for their bills" ON public.bill_items;
DROP POLICY IF EXISTS "Users can update bill items for their bills" ON public.bill_items;
DROP POLICY IF EXISTS "Users can view bill items for their bills" ON public.bill_items;
DROP POLICY IF EXISTS "Users can insert bill items for their bills" ON public.bill_items;

CREATE POLICY "Users can view bill items for their bills" ON public.bill_items FOR SELECT TO authenticated
USING (bill_id IN (SELECT id FROM public.bills WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert bill items for their bills" ON public.bill_items FOR INSERT TO authenticated
WITH CHECK (bill_id IN (SELECT id FROM public.bills WHERE user_id = auth.uid()));

CREATE POLICY "Users can update bill items for their bills" ON public.bill_items FOR UPDATE TO authenticated
USING (bill_id IN (SELECT id FROM public.bills WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete bill items for their bills" ON public.bill_items FOR DELETE TO authenticated
USING (bill_id IN (SELECT id FROM public.bills WHERE user_id = auth.uid()));

-- Fix bills policies
DROP POLICY IF EXISTS "Users can delete their own bills" ON public.bills;
DROP POLICY IF EXISTS "Users can update their own bills" ON public.bills;
DROP POLICY IF EXISTS "Users can view their own bills" ON public.bills;
DROP POLICY IF EXISTS "Users can insert their own bills" ON public.bills;

CREATE POLICY "Users can view their own bills" ON public.bills FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bills" ON public.bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bills" ON public.bills FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bills" ON public.bills FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix clients policies
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;

CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix company_profile policies
DROP POLICY IF EXISTS "Users can delete their own company profile" ON public.company_profile;
DROP POLICY IF EXISTS "Users can update their own company profile" ON public.company_profile;
DROP POLICY IF EXISTS "Users can view their own company profile" ON public.company_profile;
DROP POLICY IF EXISTS "Users can insert their own company profile" ON public.company_profile;

CREATE POLICY "Users can view their own company profile" ON public.company_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own company profile" ON public.company_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own company profile" ON public.company_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own company profile" ON public.company_profile FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix invoice_items policies
DROP POLICY IF EXISTS "Users can delete invoice items for their invoices" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items for their invoices" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can view invoice items for their invoices" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert invoice items for their invoices" ON public.invoice_items;

CREATE POLICY "Users can view invoice items for their invoices" ON public.invoice_items FOR SELECT TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert invoice items for their invoices" ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

CREATE POLICY "Users can update invoice items for their invoices" ON public.invoice_items FOR UPDATE TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete invoice items for their invoices" ON public.invoice_items FOR DELETE TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

-- Fix invoices policies
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.invoices;

CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix products policies
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert their own products" ON public.products;

CREATE POLICY "Users can view their own products" ON public.products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own products" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix transactions policies
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;

CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix storage.objects policies for company-logos bucket
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own logo" ON storage.objects;

-- Recreate storage policies with authenticated role
-- Keep logos publicly viewable since they appear on shared invoices/bills
CREATE POLICY "Public can view logos" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');

CREATE POLICY "Users can upload their own logo" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own logo" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own logo" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);