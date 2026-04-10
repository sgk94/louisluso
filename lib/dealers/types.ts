export interface DealerAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface DealerCoordinates {
  lat: number;
  lng: number;
}

export interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: DealerAddress;
  coordinates: DealerCoordinates;
}

export interface ContactDealerInput {
  customerName: string;
  customerEmail: string;
  message?: string;
  productSlug?: string;
}
