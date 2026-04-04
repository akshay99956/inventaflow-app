import { Button } from "@/components/ui/button";
import { toastWithSound as toast } from "@/lib/toastWithSound";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Printer, Send, Share2, X, Receipt, ClipboardList } from "lucide-react";
import { CompanyBranding } from "@/components/CompanyBranding";
import { useSettings } from "@/contexts/SettingsContext";
import { useRef } from "react";

type PreviewItem = {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

type DocumentPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "bill" | "purchase_order";
  docNumber: string;
  partyName: string;
  partyPhone?: string;
  date: string;
  items: PreviewItem[];
  subtotal: number;
  tax: number;
  total: number;
};

const DocumentPreview = ({
  open,
  onOpenChange,
  type,
  docNumber,
  partyName,
  partyPhone,
  date,
  items,
  subtotal,
  tax,
  total,
}: DocumentPreviewProps) => {
  const { settings } = useSettings();
  const cs = settings.currency_symbol || "₹";
  const printRef = useRef<HTMLDivElement>(null);

  const isBill = type === "bill";
  const title = isBill ? "Bill" : "Purchase Order";
  const partyLabel = isBill ? "Customer" : "Supplier";
  const Icon = isBill ? Receipt : ClipboardList;

  const buildWhatsAppMessage = () => {
    const emoji = isBill ? "🧾" : "📋";
    let msg = `${emoji} *${title}: ${docNumber}*\n`;
    msg += `👤 ${partyName}\n`;
    msg += `📅 ${new Date(date).toLocaleDateString("en-IN")}\n\n`;
    msg += `*Items:*\n`;
    items.forEach((item, i) => {
      msg += `${i + 1}. ${item.name}\n   ${item.qty} × ${cs}${item.unitPrice.toLocaleString("en-IN")} = ${cs}${item.amount.toLocaleString("en-IN")}\n`;
    });
    msg += `\n─────────────\n`;
    msg += `Subtotal: ${cs}${subtotal.toLocaleString("en-IN")}\n`;
    if (settings.tax_enabled && tax > 0) {
      msg += `${settings.tax_name}: ${cs}${tax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}\n`;
    }
    msg += `*Total: ${cs}${total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}*\n`;
    msg += isBill ? `\nThank you for your purchase! 🙏` : `\nPlease confirm this order. 🙏`;
    return msg;
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${title} - ${docNumber}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; color: #1a1a1a; max-width: 600px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px; }
        .doc-num { font-size: 18px; font-weight: 700; }
        .meta { font-size: 13px; color: #666; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { text-align: left; font-size: 12px; color: #666; border-bottom: 1px solid #ddd; padding: 6px 4px; }
        td { font-size: 13px; padding: 6px 4px; border-bottom: 1px solid #f0f0f0; }
        .amount { text-align: right; }
        .totals { margin-top: 12px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .grand-total { font-weight: 700; font-size: 16px; border-top: 2px solid #333; padding-top: 8px; margin-top: 4px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <div class="doc-num">${title} #${docNumber}</div>
        <div class="meta">${partyLabel}: ${partyName}</div>
        <div class="meta">Date: ${new Date(date).toLocaleDateString("en-IN")}</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th class="amount">Amount</th></tr></thead>
        <tbody>
          ${items.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${item.name}</td>
              <td>${item.qty}</td>
              <td>${cs}${item.unitPrice.toLocaleString("en-IN")}</td>
              <td class="amount">${cs}${item.amount.toLocaleString("en-IN")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>${cs}${subtotal.toLocaleString("en-IN")}</span></div>
        ${settings.tax_enabled && tax > 0 ? `<div class="total-row"><span>${settings.tax_name}</span><span>${cs}${tax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>` : ""}
        <div class="total-row grand-total"><span>Total</span><span>${cs}${total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
      </div>
      <div class="footer">Thank you for your business!</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleWhatsAppShare = (phone?: string) => {
    const msg = buildWhatsAppMessage();
    if (phone) {
      const cleaned = phone.replace(/\D/g, "");
      const full = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
      window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title} Preview
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="flex-1 overflow-y-auto px-4 pb-2">
          {/* Doc Header */}
          <div className="text-center space-y-1 mb-3">
            <p className="text-lg font-bold text-primary">{docNumber}</p>
            <p className="text-sm text-muted-foreground">
              {partyLabel}: <span className="font-medium text-foreground">{partyName}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>

          <Separator className="mb-3" />

          {/* Items */}
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty} × {cs}{item.unitPrice.toLocaleString("en-IN")}
                  </p>
                </div>
                <p className="font-bold text-sm">
                  {cs}{item.amount.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{cs}{subtotal.toLocaleString("en-IN")}</span>
            </div>
            {settings.tax_enabled && tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{settings.tax_name}</span>
                <span>{cs}{tax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t">
              <span>Total</span>
              <span className="text-primary">{cs}{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t p-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-1" />
            Print / PDF
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white"
            onClick={() => handleWhatsAppShare(partyPhone)}
          >
            <Send className="h-4 w-4 mr-1" />
            {partyPhone ? "WhatsApp" : "Share WhatsApp"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const msg = buildWhatsAppMessage();
            navigator.clipboard.writeText(msg);
            toast.success("Copied to clipboard!");
          }} className="flex-1">
            <Share2 className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;
