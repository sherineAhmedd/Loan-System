import type { DataProvider } from 'react-admin';
import { API_URL, httpClient, buildQueryString } from './httpClient';

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

const toArrayResponse = (json: any) => {
  if (Array.isArray(json)) {
    return { data: json, total: json.length };
  }
  if (Array.isArray(json?.data)) {
    return { data: json.data, total: json.total ?? json.data.length };
  }
  return { data: [], total: 0 };
};

const notImplemented = (name: string) =>
  Promise.reject(new Error(`${name} is not implemented in data provider`));

const dataProvider: DataProvider = {
  getList: async (resource, params) => {
    switch (resource) {
      case 'loans': {
        const filterQuery: Record<string, string> = {};
        if (params.filter?.q) {
          filterQuery.q = params.filter.q;
        }
        if (params.filter?.borrowerId) {
          filterQuery.borrowerId = params.filter.borrowerId;
        }
        if (params.pagination) {
          filterQuery.page = String(params.pagination.page);
          filterQuery.perPage = String(params.pagination.perPage);
        }
        const query = buildQueryString(filterQuery);
        const { json } = await httpClient(`${API_URL}/api/loans${query}`);
        const { data, total } = toArrayResponse(json);
        return {
          data: data.map(normalizeLoan),
          total,
        };
      }
      default:
        return notImplemented(`getList(${resource})`);
    }
  },

  getOne: async (resource, params) => {
    switch (resource) {
      case 'loans': {
        const { json } = await httpClient(`${API_URL}/loan/${params.id}`);
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

