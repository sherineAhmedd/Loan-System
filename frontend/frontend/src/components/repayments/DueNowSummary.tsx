import {
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { useRecordContext } from 'react-admin';
import { useDueSummary } from '../../api/hooks';

export const DueNowSummary = ({ loanId: propLoanId }: { loanId?: string }) => {
  const record = useRecordContext();
  const loanId = propLoanId ?? (record?.id ? String(record.id) : undefined);
  const { data, loading, error } = useDueSummary(loanId);

  if (!loanId) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography color="text.secondary">
            Select a loan to calculate what&apos;s due.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          What&apos;s Due Now
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Metric label="Overdue installments" value={data.summary?.overdueInstallments ?? 0} />
          </Grid>
          <Grid item xs={12} md={3}>
            <Metric
              label="Principal due"
              value={`$${Number(data.summary?.principalDue ?? 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}`}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Metric
              label="Interest due"
              value={`$${Number(data.summary?.interestDue ?? 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}`}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Metric
              label="Total due"
              value={`$${Number(data.summary?.totalDue ?? 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}`}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div>
    <Typography variant="overline" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h5">{value}</Typography>
  </div>
);

