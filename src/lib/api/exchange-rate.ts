/**
 * Exchange Rate API Integration
 * 
 * Fetches live USD to INR exchange rates from exchangerate-api.com
 * Falls back to demo rate if API is unavailable
 */

export interface ExchangeRateData {
  rate: number;
  timestamp: string;
  source: string;
  isDemo: boolean;
}

const DEMO_RATE = 83.50; // Approximate USD to INR rate (Nov 2026 demo fallback)
const API_ENDPOINT = 'https://api.exchangerate-api.com/v4/latest/USD';

/**
 * Fetch current USD to INR exchange rate
 * Returns demo rate if API fails
 */
export async function fetchExchangeRate(): Promise<ExchangeRateData> {
  try {
    const response = await fetch(API_ENDPOINT, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.rates?.INR) {
      throw new Error('INR rate not found in API response');
    }
    
    return {
      rate: data.rates.INR,
      timestamp: data.time_last_updated || new Date().toISOString(),
      source: 'exchangerate-api.com',
      isDemo: false,
    };
  } catch (error) {
    console.warn('Exchange rate API failed, using demo rate:', error);
    
    // Fallback to demo rate
    return {
      rate: DEMO_RATE,
      timestamp: new Date().toISOString(),
      source: 'demo (fallback)',
      isDemo: true,
    };
  }
}

/**
 * Convert USD to INR
 */
export function convertUsdToInr(usd: number, rate: number): number {
  return Math.round(usd * rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert INR to USD
 */
export function convertInrToUsd(inr: number, rate: number): number {
  return Math.round((inr / rate) * 100) / 100; // Round to 2 decimal places
}

/**
 * Format exchange rate for display
 */
export function formatExchangeRate(rate: number): string {
  return rate.toFixed(2);
}

/**
 * Format timestamp for display
 */
export function formatRateTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}
