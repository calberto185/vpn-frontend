export interface WithdrawalEntity {
  id:            string;
  type:          WithdrawalType;
  recipient:     string;
  recipientId:   string | null;
  concept:       string;
  amount:        number;
  currency:      string;
  method:        WithdrawalMethod;
  reference:     string;
  period:        string;        // "2025-06"
  executedAt:    string | null;
  state:         WithdrawalState;
  attachmentUrl: string;
  notes:         string;
  createdBy:     string;
  createdAt:     string;
  updatedAt:     string;
  signature?:    string;
  signedAt?:     string;
}

export type WithdrawalType =
  | 'employee_payment'
  | 'client_refund'
  | 'client_loan'
  | 'office_expense'
  | 'tax_payment'
  | 'other';

export type WithdrawalState  = 'pending' | 'completed' | 'cancelled';
export type WithdrawalMethod = 'bank_transfer' | 'crypto' | 'card' | 'cash' | 'other';

export const WITHDRAWAL_TYPES: { value: WithdrawalType; label: string; icon: string; badge: string }[] = [
  { value: 'employee_payment', label: 'Pago a empleado',         icon: '👤', badge: 'badge-info'    },
  { value: 'client_refund',    label: 'Devolución a cliente',    icon: '↩️', badge: 'badge-warning' },
  { value: 'client_loan',      label: 'Préstamo a cliente',      icon: '🤝', badge: 'badge-accent'  },
  { value: 'office_expense',   label: 'Gasto operativo',         icon: '🏢', badge: 'badge-neutral' },
  { value: 'tax_payment',      label: 'Impuesto / Tasa',         icon: '🧾', badge: 'badge-ghost'   },
  { value: 'other',            label: 'Otro retiro',             icon: '💸', badge: 'badge-ghost'   },
];

export const WITHDRAWAL_STATES: { value: WithdrawalState; label: string; badge: string }[] = [
  { value: 'pending',   label: 'Pendiente',   badge: 'badge-warning' },
  { value: 'completed', label: 'Completado',  badge: 'badge-success' },
  { value: 'cancelled', label: 'Cancelado',   badge: 'badge-ghost'   },
];

export const WITHDRAWAL_METHODS: { value: WithdrawalMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Transferencia bancaria' },
  { value: 'crypto',        label: 'Criptomoneda'           },
  { value: 'card',          label: 'Tarjeta'                },
  { value: 'cash',          label: 'Efectivo'               },
  { value: 'other',         label: 'Otro'                   },
];
