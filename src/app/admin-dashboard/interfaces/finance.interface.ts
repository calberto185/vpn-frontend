export interface ExchangeRates {
  id: string;
  baseCurrency: string;
  rates: { USD: number; EUR: number; PEN: number; RUB: number };
  updatedAt: string;
  updatedBy: string | null;
}

export interface FinanceSummary {
  year: number;
  currency: string;
  revenue: number;
  revenueGrowth: number;
  expenses: number;
  expensesGrowth: number;
  supplierExpenses: number;
  withdrawalExpenses: number;
  profit: number;
  profitGrowth: number;
  margin: number;
  pendingPayments: number;
  pendingExpenses: number;
  pendingSupplierExp: number;
  pendingWithdrawals: number;
}

export interface MonthlyDataPoint {
  month: number;
  total: number;
  count: number;
  supplierTotal?: number;
  withdrawalTotal?: number;
}

export interface WithdrawalRecipient {
  _id: string;           // recipient name
  recipientId: string | null;
  types: string[];
  total: number;
  count: number;
  lastWithdrawal: string;
}

export interface MonthlyData {
  year: number;
  currency: string;
  months: MonthlyDataPoint[];
}

export interface ServiceRevenue {
  _id: string;
  total: number;
  count: number;
}

export interface MethodRevenue {
  _id: string;
  total: number;
  count: number;
}

export interface SupplierExpense {
  _id: string;
  supplierName: string;
  total: number;
  count: number;
}

export interface CategoryExpense {
  _id: string;
  total: number;
  count: number;
}

export interface TopClient {
  _id: string;
  userName: string;
  userEmail: string;
  total: number;
  count: number;
  lastPay: string;
}

export interface CashflowPoint {
  label: string;   // "2025-04"
  revenue: number;
  expenses: number;
  profit: number;
}

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$',  label: 'USD — Dólar'         },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro'          },
  { code: 'PEN', symbol: 'S/', label: 'PEN — Sol Peruano'   },
  { code: 'RUB', symbol: '₽',  label: 'RUB — Rublo'        },
];
