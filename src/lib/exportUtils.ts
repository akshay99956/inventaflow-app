import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value ?? "");
        return stringValue.includes(",") || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportDashboardToPDF = async (
  stats: any,
  revenueData: any[],
  topProducts: any[],
  outstandingInvoices: any[]
) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  let yPosition = 20;

  // Title
  pdf.setFontSize(20);
  pdf.text("Dashboard Report", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Date
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 15;

  // Stats Section
  pdf.setFontSize(14);
  pdf.text("Key Metrics", 20, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.text(`Total Products: ${stats.totalProducts}`, 20, yPosition);
  yPosition += 7;
  pdf.text(`Total Invoices: ${stats.totalInvoices}`, 20, yPosition);
  yPosition += 7;
  pdf.text(`Pending Invoices: ${stats.pendingInvoices}`, 20, yPosition);
  yPosition += 7;
  pdf.text(`Total Revenue: $${stats.totalRevenue.toFixed(2)}`, 20, yPosition);
  yPosition += 15;

  // Revenue Chart
  const revenueChart = document.querySelector('[data-chart="revenue"]');
  if (revenueChart) {
    pdf.setFontSize(14);
    pdf.text("Revenue Trends", 20, yPosition);
    yPosition += 10;

    const canvas = await html2canvas(revenueChart as HTMLElement);
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    if (yPosition + imgHeight > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage();
      yPosition = 20;
    }
    
    pdf.addImage(imgData, "PNG", 20, yPosition, imgWidth, imgHeight);
    yPosition += imgHeight + 15;
  }

  // Top Products Chart
  if (yPosition > pdf.internal.pageSize.getHeight() - 80) {
    pdf.addPage();
    yPosition = 20;
  }

  const productsChart = document.querySelector('[data-chart="products"]');
  if (productsChart) {
    pdf.setFontSize(14);
    pdf.text("Top Products by Revenue", 20, yPosition);
    yPosition += 10;

    const canvas = await html2canvas(productsChart as HTMLElement);
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    if (yPosition + imgHeight > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage();
      yPosition = 20;
    }
    
    pdf.addImage(imgData, "PNG", 20, yPosition, imgWidth, imgHeight);
    yPosition += imgHeight + 15;
  }

  // Outstanding Invoices Table
  if (outstandingInvoices.length > 0) {
    if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFontSize(14);
    pdf.text("Outstanding Invoices", 20, yPosition);
    yPosition += 10;

    pdf.setFontSize(9);
    outstandingInvoices.slice(0, 10).forEach((invoice) => {
      if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(`${invoice.customer_name} - Invoice #${invoice.invoice_number}`, 20, yPosition);
      pdf.text(`$${Number(invoice.total).toFixed(2)}`, pageWidth - 40, yPosition);
      pdf.text(invoice.status, pageWidth - 20, yPosition, { align: "right" });
      yPosition += 7;
    });
  }

  pdf.save(`dashboard-report-${new Date().toISOString().split("T")[0]}.pdf`);
};
