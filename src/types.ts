export type JobStatus = 'pending' | 'assigned' | 'in_route' | 'in_progress' | 'completed';
export type TechStatus = 'available' | 'busy' | 'offline';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Job {
  id?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  technicianId: string | null;
  status: JobStatus;
  type: string;
  title: string;
  description: string;
  location: GeoPoint;
  address: string;
  serviceId: string;
  pricing: { basePrice: number; addOnTotal: number; finalTotal: number };
  addons: string[];
  createdAt: number;
  rating?: number;
  reviewComment?: string;
  paymentMethod?: 'cash_field' | 'hq_settled' | 'onsite' | 'hq';
  paymentStatus?: 'pending' | 'paid';
  beforeImage?: string | null;
  afterImage?: string | null;
  customerSignature?: string | null;
  startedAt?: number;
  completedAt?: number;
  proofOfWork?: {
    beforePhoto?: string | null;
    afterPhoto?: string | null;
    customerSignature?: string | null;
    completedAt?: number;
  };
  customerLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export interface InventoryItem {
  id?: string;
  name: string;
  category: string;
  quantity: number;
  lastUpdated: number;
}

export interface Technician {
  id?: string;
  name: string;
  isAvailable: boolean;
  expertise: string[];
  distance: string;
  cashOnHand: number;
  status: TechStatus;
  location: GeoPoint;
  phone: string;
  pinCode?: string;
  inventory?: { id: string; name: string; category: string; quantity: number }[];
  rating?: number;
  completedJobsCount?: number;
  reviews?: { id: string; customerName: string; rating: number; comment: string; date: string }[];
}

export interface AddOn {
  id?: string;
  name: string;
  price: number;
}

export interface Service {
  id?: string;
  category: string;
  name: string;
  basePrice: number;
  isActive: boolean;
  addOns: AddOn[];
}

