// src/dataProvider.ts
import type { DataProvider } from 'react-admin';
import { API_URL, httpClient} from './httpClient';

type Loan = {
  id: string;
  borrowerId: string;
  amount: string | number;
  interestRate: string | number;
  tenor: number;
  status: string;
  createdAt?: string;
};

const normalizeLoan = (loan: Loan) => ({
  ...loan,
  amount: Number(loan.amount),
  interestRate: Number(loan.interestRate),
});

const notImplemented = (name: string) =>
  Promise.reject(new Error(`${name} is not implemented in data provider`));

const dataProvider: DataProvider = {
  getList: async (resource, params) => {
    console.log('getList called but not implemented yet', resource, params);
    return { data: [], total: 0 };
  },

  getOne: async (resource, params) => {
    switch (resource) {
      case 'loans': {
        const url = `${API_URL}/loans/${params.id}`;
        console.log('GET loan URL:', url);
        const { json } = await httpClient(url);
        return { data: normalizeLoan(json) as any };
      }
      default:
        return notImplemented(`getOne(${resource})`);
    }
  },

  getMany: () => notImplemented('getMany'),
  getManyReference: () => notImplemented('getManyReference'),

  create: async (resource, params) => {
    switch (resource) {
      case 'disbursements': {
        const { json } = await httpClient(`${API_URL}/api/disbursements`, {
          method: 'POST',
          body: JSON.stringify(params.data),
        });
        return { data: json };
      }
      case 'repayments': {
        const { json } = await httpClient(`${API_URL}/api/repayments`, {
          method: 'POST',
          body: JSON.stringify(params.data),
        });
        return { data: json };
      }
      default:
        return notImplemented(`create(${resource})`);
    }
  },

  update: () => notImplemented('update'),
  updateMany: () => notImplemented('updateMany'),
  delete: () => notImplemented('delete'),
  deleteMany: () => notImplemented('deleteMany'),
};

export default dataProvider;
