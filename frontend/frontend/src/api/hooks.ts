import { useEffect, useState } from 'react';
import { fetchAuditLogs, fetchDueNow, fetchPaymentHistory, fetchRepaymentSchedule,} from './service';

type AsyncState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

const makeInitialState = <T,>(initial: T): AsyncState<T> => ({
  data: initial,
  loading: false,
  error: null,
});

export const usePaymentHistory = (loanId?: string) => {
  const [state, setState] = useState<AsyncState<any[]>>(makeInitialState([]));

  useEffect(() => {
    let mounted = true;
    if (!loanId) {
      setState(makeInitialState([]));
      return () => {
        mounted = false;
      };
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchPaymentHistory(loanId)
      .then((data) => {
        if (mounted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: Error) => {
        if (mounted) {
          setState({
            data: [],
            loading: false,
            error: error.message ?? 'Failed to load payments',
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [loanId]);

  return state;
};

export const useRepaymentSchedule = (loanId?: string) => {
  const [state, setState] = useState<AsyncState<any[]>>(makeInitialState([]));

  useEffect(() => {
    let mounted = true;
    if (!loanId) {
      setState(makeInitialState([]));
      return () => {
        mounted = false;
      };
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchRepaymentSchedule(loanId)
      .then((data) => mounted && setState({ data, loading: false, error: null }))
      .catch((error: Error) => {
        if (mounted) {
          setState({
            data: [],
            loading: false,
            error: error.message ?? 'Failed to load schedule',
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [loanId]);

  return state;
};

export const useDueSummary = (loanId?: string) => {
  const [state, setState] = useState<AsyncState<any | null>>(
    makeInitialState(null),
  );

  useEffect(() => {
    let mounted = true;
    if (!loanId) {
      setState(makeInitialState(null));
      return () => {
        mounted = false;
      };
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchDueNow(loanId)
      .then((data) => mounted && setState({ data, loading: false, error: null }))
      .catch((error: Error) => {
        if (mounted) {
          setState({
            data: null,
            loading: false,
            error: error.message ?? 'Failed to calculate due amount',
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [loanId]);

  return state;
};

export const useAuditLogSearch = () => {
  const [loanId, setLoanId] = useState('');
  const [query, setQuery] = useState('');
  const [operation, setOperation] = useState('');
  const [state, setState] = useState<AsyncState<any[]>>(makeInitialState([]));

  const runSearch = (overrideLoanId?: string) => {
    const targetLoanId = overrideLoanId ?? loanId;
    if (!targetLoanId) {
      setState({
        data: [],
        loading: false,
        error: 'Provide a loan ID to search the audit trail',
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchAuditLogs(targetLoanId, query, operation)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: Error) => {
        setState({
          data: [],
          loading: false,
          error: error.message ?? 'Unable to fetch audit logs',
        });
      });
  };

  return {
    loanId,
    setLoanId,
    query,
    setQuery,
    operation,
    setOperation,
    runSearch,
    ...state,
  };
};

