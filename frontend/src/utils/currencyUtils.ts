// Currency conversion utilities using exchangerate-api.com (free tier)
// Free tier: 1,500 requests/month

const EXCHANGE_RATE_API_BASE = 'https://open.exchangerate-api.com/v6/latest';

export interface ExchangeRates {
  [currency: string]: number;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

// Common currencies
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
];

let cachedRates: { rates: ExchangeRates; timestamp: number } | null = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Fetches current exchange rates from USD base
 * Results are cached for 1 hour to reduce API calls
 */
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  // Return cached rates if still valid
  if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_DURATION) {
    return cachedRates.rates;
  }

  try {
    const response = await fetch(`${EXCHANGE_RATE_API_BASE}/USD`);

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    // Cache the rates
    cachedRates = {
      rates: data.rates,
      timestamp: Date.now(),
    };

    return data.rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);

    // Return fallback rates if API fails
    return getFallbackRates();
  }
}

/**
 * Converts an amount from one currency to USD
 */
export async function convertToUSD(
  amount: number,
  fromCurrency: string
): Promise<number> {
  if (fromCurrency === 'USD') {
    return amount;
  }

  const rates = await fetchExchangeRates();
  const rate = rates[fromCurrency];

  if (!rate) {
    console.warn(`Exchange rate not found for ${fromCurrency}, using 1:1`);
    return amount;
  }

  // Convert to USD: amount in foreign currency / exchange rate
  return amount / rate;
}

/**
 * Gets the exchange rate for a currency relative to USD
 */
export async function getExchangeRate(currency: string): Promise<number> {
  if (currency === 'USD') {
    return 1.0;
  }

  const rates = await fetchExchangeRates();
  return rates[currency] || 1.0;
}

/**
 * Formats a currency amount with symbol
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  const symbol = currencyInfo?.symbol || currency;

  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Fallback exchange rates (approximate, updated periodically)
 * Used when API is unavailable
 */
function getFallbackRates(): ExchangeRates {
  return {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    BRL: 5.05,
    CAD: 1.36,
    MXN: 17.15,
    JPY: 149.50,
    CNY: 7.24,
    INR: 83.12,
    AUD: 1.52,
  };
}

/**
 * Clears the exchange rate cache (useful for testing or forcing refresh)
 */
export function clearExchangeRateCache(): void {
  cachedRates = null;
}

/**
 * Detects currency from text (useful for OCR receipt analysis)
 * Looks for currency symbols and codes in the text
 */
export function detectCurrencyFromText(text: string): string {
  if (!text) return 'USD';

  const normalizedText = text.toUpperCase();

  const currencyPatterns = [
    { pattern: /\$|USD|US\s*DOLLAR/i, currency: 'USD' },
    { pattern: /€|EUR|EURO/i, currency: 'EUR' },
    { pattern: /£|GBP|POUND/i, currency: 'GBP' },
    { pattern: /R\$|BRL|REAL|REAIS/i, currency: 'BRL' },
    { pattern: /CA\$|CAD|CANADIAN\s*DOLLAR/i, currency: 'CAD' },
    { pattern: /MX\$|MXN|PESO/i, currency: 'MXN' },
    { pattern: /¥|JPY|YEN/i, currency: 'JPY' },
    { pattern: /CNY|YUAN|RMB/i, currency: 'CNY' },
    { pattern: /₹|INR|RUPEE/i, currency: 'INR' },
    { pattern: /A\$|AUD|AUSTRALIAN\s*DOLLAR/i, currency: 'AUD' },
  ];

  for (const { pattern, currency } of currencyPatterns) {
    if (pattern.test(normalizedText)) {
      return currency;
    }
  }

  // Default to USD if no currency detected
  return 'USD';
}
