export type StatementCustomer = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  phone: string | null;
  balance: number;
  creditLimit: number;
};

export type StatementTransaction = {
  id: string;
  date: string;
  reference: string;
  descriptionAr: string;
  descriptionEn: string;
  debit: number;
  credit: number;
  balance: number;
};

export type StatementPayload = {
  customer: StatementCustomer;
  tenant: {
    nameAr: string;
    nameEn: string;
  };
  from: string | null;
  to: string | null;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  transactions: StatementTransaction[];
};
