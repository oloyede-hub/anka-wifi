export interface OpayCheckoutInput {
  reference: string;
  amount: number;
  email: string;
  phone: string;
  productName: string;
  returnUrl: string;
  callbackUrl: string;
  cancelUrl: string;
}

export interface OpayCallbackPayload {
  amount: string;
  currency: string;
  reference: string;
  refunded: boolean;
  status: string;
  timestamp: string;
  token: string;
  transactionId: string;
}
