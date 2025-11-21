import type { ReactElement } from 'react';
import { useState } from 'react';
import {
  Datagrid,
  DateField,
  List,
  NumberField,
  Show,
  TextField,
  TextInput,
  useDataProvider,
  useRecordContext,
} from 'react-admin';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField as MuiTextField,
  Typography,
} from '@mui/material';
import { PaymentHistoryPanel } from '../repayments/PaymentHistoryPanel';
import { RepaymentSchedulePanel } from '../repayments/RepaymentSchedulePanel';
import { DueNowSummary } from '../repayments/DueNowSummary';
import { useParams } from 'react-router-dom';

type LoanRecord = {
  id: string;
  borrowerId: string;
  amount: number | string;
  interestRate: number | string;
  tenor: number;
  status: string;
  createdAt?: string;
};

const loanFilters: ReactElement[] = [
  <TextInput source="q" alwaysOn key="q" placeholder="Search…" />,
  <TextInput source="borrowerId" key="borrowerId" placeholder="Borrower ID" />,
];

const CurrencyField = ({
  source,
  label,
}: {
  source: string;
  label?: string;
}) => (
  <NumberField
    source={source}
    label={label}
    options={{ style: 'currency', currency: 'USD', maximumFractionDigits: 2 }}
  />
);

export const LoanList = () => {
  return (
    <Box>
      <LoanLookupBox />
      <List
        perPage={25}
        filters={loanFilters}
        sort={{ field: 'createdAt', order: 'DESC' }}
      >
        <Datagrid rowClick="show">
          <TextField source="id" />
          <TextField source="borrowerId" />
          <CurrencyField source="amount" label="Principal" />
          <NumberField
            source="interestRate"
            label="APR (%)"
            options={{ maximumFractionDigits: 2 }}
          />
          <TextField source="tenor" label="Tenor (months)" />
          <TextField source="status" />
          <DateField source="createdAt" label="Created" />
        </Datagrid>
      </List>
    </Box>
  );
};

const LoanLookupBox = () => {
  const dataProvider = useDataProvider();
  const [loanIdInput, setLoanIdInput] = useState('');
  const [loan, setLoan] = useState<LoanRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoan = async () => {
    const trimmed = loanIdInput.trim();
    if (!trimmed) {
      setError('Enter a loan ID to retrieve details.');
      return;
    }

    setLoading(true);
    setError(null);
    setLoan(null);
    try {
      const response = await dataProvider.getOne<LoanRecord>('loans', {
        id: trimmed,
      });
      setLoan(response.data);
    } catch (err: any) {
      const message =
        err?.body?.message ||
        err?.message ||
        'Unable to fetch loan details. Check the ID and try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    fetchLoan();
  };

  return (
    <Box mb={4}>
      <Card variant="outlined">
        <CardContent component="form" onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>
            Lookup Loan Details
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <MuiTextField
              label="Loan ID"
              placeholder="e.g. 63322b51-1c9d-4f4b-898a-f85ac44ca2f5"
              value={loanIdInput}
              onChange={(event) => setLoanIdInput(event.target.value)}
              autoComplete="off"
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ minWidth: 140 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Fetch Loan'}
            </Button>
          </Stack>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {loan && (
        <Box mt={3}>
          <LoanSummary loan={loan} />
          <Divider sx={{ my: 2 }} />
          <DueNowSummary loanId={loan.id} />
          <Divider sx={{ my: 2 }} />
          <PaymentHistoryPanel loanId={loan.id} />
          <RepaymentSchedulePanel loanId={loan.id} />
        </Box>
      )}
    </Box>
  );
};

const LoanSummary = ({ loan }: { loan: LoanRecord }) => (
  <Grid container spacing={2}>
    <Grid item xs={12} md={4}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="overline">Borrower</Typography>
          <Typography variant="h6">{loan.borrowerId}</Typography>
          <Typography color="text.secondary">{loan.status}</Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="overline">Principal</Typography>
          <Typography variant="h6">
            ${Number(loan.amount).toLocaleString()}
          </Typography>
          <Typography color="text.secondary">
            APR {Number(loan.interestRate).toFixed(2)}%
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="overline">Tenor</Typography>
          <Typography variant="h6">{loan.tenor} months</Typography>
          {loan.createdAt && (
            <Typography color="text.secondary">
              Created {new Date(loan.createdAt).toLocaleDateString()}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const LoanHeader = () => {
  const record = useRecordContext<LoanRecord>();
  if (!record) return null;
  return <LoanSummary loan={record} />;
};

export const LoanShow = () => {
   const {id} = useParams();
   if (!id) return <div>No loan ID provided</div>;

  return (
  <Show id={id} resource="loans">
    <Box>
      <LoanHeader />
      <Divider sx={{ my: 2 }} />
      <DueNowSummary />
      <Divider sx={{ my: 2 }} />
      <PaymentHistoryPanel />
      <RepaymentSchedulePanel />
    </Box>
  </Show>
);
}

