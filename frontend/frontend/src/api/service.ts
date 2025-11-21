import { httpClient, API_URL } from './httpClient';

export const rollbackDisbursement = async (
  disbursementId: string,
  payload: { reason?: string; performedBy?: string },
) => {
  const { json } = await httpClient(
    `${API_URL}/api/disbursements/${disbursementId}/rollback`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return json;
};

export const fetchPaymentHistory = async (loanId: string) => {
  const { json } = await httpClient(`${API_URL}/repayments/${loanId}`);
  return Array.isArray(json) ? json : json?.data ?? [];
};

export const fetchRepaymentSchedule = async (loanId: string) => {
  const { json } = await httpClient(
    `${API_URL}/repayments/${loanId}/schedule`,
  );
  return Array.isArray(json) ? json : json?.data ?? [];
};

export const fetchDueNow = async (loanId: string) => {
  const { json } = await httpClient(
    `${API_URL}/repayments/${loanId}/calculate`,
  );
  return json;
};

export const fetchAuditLogs = async (
  loanId: string,
  search?: string,
  operation?: string,
) => {
  const { json } = await httpClient(`${API_URL}/loans/${loanId}/audit-trail`);
  let logs = Array.isArray(json) ? json : json?.data ?? [];

  if (search) {
    logs = logs.filter(
      (item: any) =>
        item.transactionId?.includes(search) ||
        item.operation?.toLowerCase().includes(search.toLowerCase()),
    );
  }

  if (operation) {
    logs = logs.filter(
      (item: any) =>
        item.operation?.toLowerCase() === operation.toLowerCase(),
    );
  }

  return logs;
};

