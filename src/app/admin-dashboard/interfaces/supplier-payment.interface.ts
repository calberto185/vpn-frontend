export type ExpenseCategory = 'infrastructure' | 'hosting' | 'bandwidth' | 'software' | 'marketing' | 'telecom' | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'infrastructure', label: 'Infraestructura' },
  { value: 'hosting',        label: 'Hosting'         },
  { value: 'bandwidth',      label: 'Ancho de banda'  },
  { value: 'software',       label: 'Software'        },
  { value: 'marketing',      label: 'Marketing'       },
  { value: 'telecom',        label: 'Telecom'         },
  { value: 'other',          label: 'Otro'            },
];

export interface SupplierPaymentEntity {
  id: string;
  supplierId: string | null;
  supplierName: string;
  recipientId?: string | null;
  concept: string;
  category: ExpenseCategory;
  serviceId: string | null;
  serviceName: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string;
  period: string;        // "2025-06"
  dueDate: string | null;
  paidAt: string | null;
  state: PaymentState;
  picture: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  signature?: string;
  signedAt?: string;
}

export type PaymentState  = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'bank_transfer' | 'crypto' | 'card' | 'cash' | 'other';

export const PAYMENT_STATES: { value: PaymentState; label: string; badge: string }[] = [
  { value: 'pending',   label: 'Pendiente',  badge: 'badge-warning'  },
  { value: 'paid',      label: 'Pagado',     badge: 'badge-success'  },
  { value: 'overdue',   label: 'Vencido',    badge: 'badge-error'    },
  { value: 'cancelled', label: 'Cancelado',  badge: 'badge-ghost'    },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Transferencia bancaria' },
  { value: 'crypto',        label: 'Criptomoneda'           },
  { value: 'card',          label: 'Tarjeta'                },
  { value: 'cash',          label: 'Efectivo'               },
  { value: 'other',         label: 'Otro'                   },
];
