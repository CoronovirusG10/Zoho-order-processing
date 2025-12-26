/**
 * Synonym dictionaries for English and Farsi headers
 *
 * Canonical fields per SOLUTION_DESIGN.md section 4.8:
 * - CustomerName: Customer identification
 * - SKU: Stock Keeping Unit / Item Code
 * - GTIN: Global Trade Item Number (EAN/UPC/barcode)
 * - Quantity: Order quantity
 * - UnitPrice: Price per unit (from spreadsheet, audit only)
 * - LineTotal: Line total amount (from spreadsheet, audit only)
 * - Description: Product name/description
 */

export const FIELD_SYNONYMS: Record<string, string[]> = {
  // Item identification - SKU (primary identifier)
  sku: [
    // English terms
    'sku', 'item code', 'itemcode', 'item_code', 'product code', 'productcode',
    'product_code', 'part number', 'partnumber', 'part_number', 'part no',
    'part#', 'code', 'item no', 'item#', 'item number', 'item_no',
    'article', 'article number', 'article no', 'article#', 'articlenumber',
    'stock code', 'stockcode', 'material', 'material number', 'material code',
    'ref', 'reference', 'ref no', 'ref#', 'reference number',
    // Farsi terms
    'کد کالا', 'کد محصول', 'کد', 'شماره کالا', 'کد انبار', 'شماره فنی',
    'کد قطعه', 'کد مرجع', 'شماره مرجع', 'کد ماده', 'شماره ماده'
  ],

  // GTIN - Global Trade Item Number (barcode)
  gtin: [
    // English terms
    'gtin', 'ean', 'upc', 'barcode', 'bar code', 'bar_code', 'ean13', 'ean-13',
    'ean8', 'ean-8', 'upc-a', 'upca', 'upc-e', 'upce', 'gs1', 'gtin-13', 'gtin-14',
    'global trade item number', 'isbn', 'asin', 'jan', 'itf', 'itf-14',
    // Farsi terms
    'بارکد', 'کد بارکد', 'شماره بارکد', 'کد جهانی', 'بار کد'
  ],

  // Description / Product Name
  product_name: [
    // English terms (Description is a common alias)
    'description', 'desc', 'product description', 'item description',
    'product_description', 'item_description', 'full description',
    'name', 'product name', 'productname', 'product_name', 'item name',
    'itemname', 'item_name', 'product', 'item', 'title', 'product title',
    'goods', 'goods description', 'merchandise', 'commodity', 'article name',
    'details', 'particulars', 'specification', 'spec',
    // Farsi terms
    'نام', 'شرح', 'شرح کالا', 'نام محصول', 'توضیحات', 'عنوان', 'نام کالا',
    'مشخصات', 'جزئیات', 'شرح محصول', 'تشریح', 'توضیح کالا', 'وصف'
  ],

  // Quantity
  quantity: [
    // English terms
    'qty', 'quantity', 'quan', 'qnty', 'q', 'units', 'unit', 'count', 'amount',
    'number', 'num', 'no of units', 'number of units', 'pcs', 'pieces', 'pc',
    'order qty', 'order quantity', 'ordered', 'order_qty', 'requested',
    'requested qty', 'requested quantity', 'required', 'required qty',
    'volume', 'ea', 'each', 'nos',
    // Farsi terms
    'تعداد', 'مقدار', 'واحد', 'عدد', 'کمیت', 'تیراژ', 'تعداد سفارش',
    'میزان', 'مقدار سفارش'
  ],

  // Unit Price (spreadsheet value - audit only per SOLUTION_DESIGN)
  unit_price: [
    // English terms
    'price', 'unit price', 'unitprice', 'unit_price', 'rate', 'unit rate',
    'unit_rate', 'price per unit', 'cost', 'unit cost', 'unit_cost',
    'unit value', 'selling price', 'sale price', 'sales price',
    'list price', 'list_price', 'retail price', 'each price', 'price each',
    'price/unit', 'price per', 'per unit', 'item price', 'single price',
    // Farsi terms
    'قیمت', 'قیمت واحد', 'نرخ', 'بها', 'فی', 'قیمت هر واحد', 'ارزش واحد',
    'قیمت فروش', 'قیمت خرده', 'نرخ واحد'
  ],

  // Line Total (spreadsheet value - audit only per SOLUTION_DESIGN)
  line_total: [
    // English terms
    'total', 'amount', 'line total', 'linetotal', 'line_total', 'line amount',
    'lineamount', 'line_amount', 'row total', 'rowtotal', 'row_total',
    'extended', 'extended price', 'extended amount', 'ext price', 'ext amount',
    'sum', 'net', 'net amount', 'net total', 'value', 'item total',
    'sub total', 'subtotal', 'line value', 'total price', 'total amount',
    'amt', 'extended value',
    // Farsi terms
    'جمع', 'مبلغ', 'مجموع', 'جمع سطر', 'مبلغ کل', 'جمع خط', 'ارزش',
    'مبلغ سطر', 'قیمت کل', 'جمع قیمت'
  ],

  // Customer Name
  customer: [
    // English terms
    'customer', 'client', 'buyer', 'purchaser', 'customer name', 'customername',
    'customer_name', 'client name', 'clientname', 'client_name', 'buyer name',
    'buyername', 'buyer_name', 'bill to', 'billto', 'bill_to', 'sold to',
    'soldto', 'sold_to', 'ship to', 'shipto', 'ship_to', 'consignee',
    'account', 'account name', 'company', 'company name', 'organization',
    'org', 'party', 'party name', 'recipient', 'addressee',
    // Farsi terms
    'مشتری', 'خریدار', 'نام مشتری', 'طرف حساب', 'مشترک', 'گیرنده',
    'سفارش دهنده', 'شرکت', 'نام شرکت', 'سازمان', 'موسسه', 'ذینفع'
  ],

  // Subtotal (document-level)
  subtotal: [
    // English terms
    'subtotal', 'sub total', 'sub-total', 'sub_total', 'net total', 'net amount',
    'net', 'before tax', 'pretax', 'pre-tax', 'pre tax', 'taxable amount',
    'goods total', 'items total', 'merchandise total', 'base amount',
    // Farsi terms
    'جمع جزء', 'جمع فرعی', 'مبلغ خالص', 'قبل از مالیات', 'جمع کالاها',
    'جمع اقلام', 'مبلغ پایه'
  ],

  // Tax
  tax: [
    // English terms
    'tax', 'vat', 'sales tax', 'gst', 'tax amount', 'vat amount', 'tax total',
    'taxes', 'duty', 'duties', 'levy', 'tariff', 'excise', 'hst', 'pst',
    'tax value', 'tax charge', 'vat charge', 'service tax',
    // Farsi terms
    'مالیات', 'عوارض', 'مالیات بر ارزش افزوده', 'مالیات فروش', 'تعرفه',
    'عوارض گمرکی', 'حقوق گمرکی', 'مبلغ مالیات'
  ],

  // Grand Total (document-level)
  total: [
    // English terms
    'total', 'grand total', 'grandtotal', 'grand_total', 'final total',
    'final amount', 'final', 'invoice total', 'order total', 'order amount',
    'overall total', 'sum total', 'total due', 'amount due', 'payable',
    'total payable', 'balance', 'balance due', 'total amount', 'total value',
    'net payable', 'gross total', 'gross amount',
    // Farsi terms
    'جمع کل', 'مجموع کل', 'مبلغ نهایی', 'جمع نهایی', 'کل', 'مبلغ قابل پرداخت',
    'قابل پرداخت', 'مبلغ فاکتور', 'جمع سفارش', 'مانده'
  ]
};

/**
 * Canonical field names as per SOLUTION_DESIGN.md section 4.8
 * Maps internal field names to display names
 */
export const CANONICAL_FIELD_DISPLAY_NAMES: Record<string, string> = {
  customer: 'CustomerName',
  sku: 'SKU',
  gtin: 'GTIN',
  product_name: 'Description',
  quantity: 'Quantity',
  unit_price: 'UnitPrice',
  line_total: 'LineTotal',
  subtotal: 'Subtotal',
  tax: 'Tax',
  total: 'Total'
};

/**
 * Normalize header text for matching
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get all synonyms for a canonical field
 */
export function getSynonyms(canonicalField: string): string[] {
  return FIELD_SYNONYMS[canonicalField] || [];
}

/**
 * Check if a header matches any synonym for a field
 */
export function matchesSynonym(header: string, canonicalField: string): boolean {
  const normalized = normalizeHeader(header);
  const synonyms = getSynonyms(canonicalField);

  return synonyms.some(syn => {
    const normalizedSyn = normalizeHeader(syn);
    return normalized === normalizedSyn || normalized.includes(normalizedSyn) || normalizedSyn.includes(normalized);
  });
}

/**
 * Get best matching canonical field for a header
 */
export function getBestFieldMatch(header: string): { field: string; score: number } | null {
  const normalized = normalizeHeader(header);
  let bestMatch: { field: string; score: number } | null = null;

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      const normalizedSyn = normalizeHeader(syn);

      // Exact match
      if (normalized === normalizedSyn) {
        return { field, score: 1.0 };
      }

      // Substring match
      if (normalized.includes(normalizedSyn) || normalizedSyn.includes(normalized)) {
        const score = Math.min(normalized.length, normalizedSyn.length) /
                     Math.max(normalized.length, normalizedSyn.length);

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { field, score };
        }
      }
    }
  }

  return bestMatch;
}
