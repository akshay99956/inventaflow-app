import Papa from 'papaparse';

// Characters that could trigger formula execution in spreadsheets
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitizes a CSV value to prevent CSV injection attacks
 * Removes or escapes dangerous characters that could be interpreted as formulas
 */
export function sanitizeCSVValue(value: string | undefined | null): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  let sanitized = String(value).trim();
  
  // Check if the value starts with a dangerous character
  if (FORMULA_PREFIXES.some(prefix => sanitized.startsWith(prefix))) {
    // Prefix with a single quote to prevent formula execution
    sanitized = "'" + sanitized;
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes a numeric value from CSV
 */
export function parseCSVNumber(value: string | undefined | null, defaultValue: number = 0): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  // Remove any non-numeric characters except decimal point and minus
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }
  
  // Ensure non-negative for quantities and prices
  return Math.max(0, parsed);
}

/**
 * Validates and sanitizes an integer value from CSV
 */
export function parseCSVInteger(value: string | undefined | null, defaultValue: number = 0): number {
  const num = parseCSVNumber(value, defaultValue);
  return Math.floor(num);
}

export interface CSVParseResult<T> {
  data: T[];
  errors: string[];
}

export interface ProductCSVRow {
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  purchase_price: number;
  unit_price: number;
  low_stock_threshold: number;
}

/**
 * Parses and validates a CSV file for product import
 */
export function parseProductCSV(
  file: File,
  maxRows: number = 1000
): Promise<CSVParseResult<ProductCSVRow>> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const data: ProductCSVRow[] = [];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.toLowerCase().trim(),
      complete: (results) => {
        // Check for parsing errors
        if (results.errors.length > 0) {
          results.errors.forEach((err) => {
            errors.push(`Row ${err.row}: ${err.message}`);
          });
        }

        // Check row limit
        if (results.data.length > maxRows) {
          errors.push(`Maximum ${maxRows} products per import. Your file has ${results.data.length} rows.`);
          resolve({ data: [], errors });
          return;
        }

        // Process each row
        results.data.forEach((row: any, index: number) => {
          // Find the name column (flexible matching)
          const nameKey = Object.keys(row).find(
            (k) => k === 'name' || k === 'product name' || k === 'product_name'
          );
          
          if (!nameKey || !row[nameKey]) {
            // Skip empty rows silently
            return;
          }

          const name = sanitizeCSVValue(row[nameKey]);
          if (!name || name.length === 0) {
            return;
          }

          // Validate name length
          if (name.length > 200) {
            errors.push(`Row ${index + 2}: Product name too long (max 200 characters)`);
            return;
          }

          // Find other columns with flexible matching
          const skuKey = Object.keys(row).find((k) => k === 'sku');
          const categoryKey = Object.keys(row).find((k) => k === 'category');
          const quantityKey = Object.keys(row).find(
            (k) => k === 'quantity' || k === 'qty'
          );
          const purchasePriceKey = Object.keys(row).find(
            (k) => k.includes('purchase') || k.includes('cost')
          );
          const salePriceKey = Object.keys(row).find(
            (k) => k.includes('sale') || k.includes('unit') || k === 'price'
          );

          const sku = skuKey ? sanitizeCSVValue(row[skuKey]) : null;
          const category = categoryKey ? sanitizeCSVValue(row[categoryKey]) : null;
          const quantity = quantityKey ? parseCSVInteger(row[quantityKey], 0) : 0;
          const purchase_price = purchasePriceKey ? parseCSVNumber(row[purchasePriceKey], 0) : 0;
          const unit_price = salePriceKey ? parseCSVNumber(row[salePriceKey], 0) : 0;

          // Validate SKU length
          if (sku && sku.length > 100) {
            errors.push(`Row ${index + 2}: SKU too long (max 100 characters)`);
            return;
          }

          // Validate category length
          if (category && category.length > 100) {
            errors.push(`Row ${index + 2}: Category too long (max 100 characters)`);
            return;
          }

          data.push({
            name,
            sku: sku || null,
            category: category || null,
            quantity,
            purchase_price,
            unit_price,
            low_stock_threshold: 10,
          });
        });

        resolve({ data, errors });
      },
      error: (error) => {
        errors.push(`Failed to parse CSV: ${error.message}`);
        resolve({ data: [], errors });
      },
    });
  });
}
