export interface SupplierEntity {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  country: { countryName?: string; countryCode?: string; flag?: string } | null;
  address: string;
  category: SupplierCategory;
  serviceId: string | null;
  serviceName: string;
  serviceDescription: string;
  contactName: string;
  website: string;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SupplierCategory =
  | 'infrastructure' | 'hosting' | 'bandwidth'
  | 'software' | 'marketing' | 'telecom' | 'other';

export const SUPPLIER_CATEGORIES: { value: SupplierCategory; label: string }[] = [
  { value: 'infrastructure', label: 'Infraestructura' },
  { value: 'hosting',        label: 'Hosting'         },
  { value: 'bandwidth',      label: 'Ancho de banda'  },
  { value: 'software',       label: 'Software'        },
  { value: 'marketing',      label: 'Marketing'       },
  { value: 'telecom',        label: 'Telecomunicaciones' },
  { value: 'other',          label: 'Otro'            },
];
