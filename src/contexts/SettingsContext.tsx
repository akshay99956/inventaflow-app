import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  id?: string;
  currency_symbol: string;
  currency_code: string;
  default_tax_rate: number;
  tax_name: string;
  tax_enabled: boolean;
  email_notifications: boolean;
  low_stock_alerts: boolean;
  invoice_reminders: boolean;
  bill_due_alerts: boolean;
  show_dashboard: boolean;
  show_sales: boolean;
  show_inventory: boolean;
  show_clients: boolean;
  invoice_prefix: string;
  bill_prefix: string;
  default_payment_terms: number;
  items_per_page: number;
  date_format: string;
}

const defaultSettings: UserSettings = {
  currency_symbol: "₹",
  currency_code: "INR",
  default_tax_rate: 18,
  tax_name: "GST",
  tax_enabled: true,
  email_notifications: true,
  low_stock_alerts: true,
  invoice_reminders: true,
  bill_due_alerts: true,
  show_dashboard: true,
  show_sales: true,
  show_inventory: true,
  show_clients: true,
  invoice_prefix: "INV-",
  bill_prefix: "BILL-",
  default_payment_terms: 30,
  items_per_page: 10,
  date_format: "DD/MM/YYYY",
};

interface SettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSettings(defaultSettings);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          currency_symbol: data.currency_symbol,
          currency_code: data.currency_code,
          default_tax_rate: Number(data.default_tax_rate),
          tax_name: data.tax_name,
          tax_enabled: data.tax_enabled,
          email_notifications: data.email_notifications,
          low_stock_alerts: data.low_stock_alerts,
          invoice_reminders: data.invoice_reminders,
          bill_due_alerts: data.bill_due_alerts,
          show_dashboard: data.show_dashboard,
          show_sales: data.show_sales,
          show_inventory: data.show_inventory,
          show_clients: data.show_clients,
          invoice_prefix: data.invoice_prefix,
          bill_prefix: data.bill_prefix,
          default_payment_terms: data.default_payment_terms,
          items_per_page: data.items_per_page,
          date_format: data.date_format,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      if (settings.id) {
        await supabase
          .from("user_settings")
          .update(newSettings)
          .eq("id", settings.id);
      } else {
        const { data } = await supabase
          .from("user_settings")
          .insert({ user_id: user.id, ...updatedSettings })
          .select()
          .single();
        
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    }
  };

  const refreshSettings = async () => {
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSettings();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
