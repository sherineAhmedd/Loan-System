import type { ReactElement } from 'react';
import {
  Datagrid,
  DateField,
  List,
  NumberField,
  Show,
  TextField,
  TextInput,
  useRecordContext,
} from 'react-admin';
import { Card, CardContent, Divider, Grid, Typography, Box } from '@mui/material';
import { PaymentHistoryPanel } from '../repayments/PaymentHistoryPanel';
import { RepaymentSchedulePanel } from '../repayments/RepaymentSchedulePanel';
import { DueNowSummary } from '../repayments/DueNowSummary';

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

export const LoanList = () => (
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
);

const LoanHeader = () => {
  const record = useRecordContext();
  if (!record) return null;
  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid item xs={12} md={4}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline">Borrower</Typography>
            <Typography variant="h6">{record.borrowerId}</Typography>
            <Typography color="text.secondary">{record.status}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline">Principal</Typography>
            <Typography variant="h6">
              ${Number(record.amount).toLocaleString()}
            </Typography>
            <Typography color="text.secondary">
              APR {Number(record.interestRate).toFixed(2)}%
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline">Tenor</Typography>
            <Typography variant="h6">{record.tenor} months</Typography>
            {record.createdAt && (
              <Typography color="text.secondary">
                Created {new Date(record.createdAt).toLocaleDateString()}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export const LoanShow = () => (
  <Show>
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

