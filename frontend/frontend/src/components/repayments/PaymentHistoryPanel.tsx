import {
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useRecordContext } from 'react-admin';
import { usePaymentHistory } from '../../api/hooks';

export const PaymentHistoryPanel = ({
  loanId: propLoanId,
}: {
  loanId?: string;
}) => {
  const record = useRecordContext();
  const loanId = propLoanId ?? (record?.id ? String(record.id) : undefined);
  const { data, loading, error } = usePaymentHistory(loanId);

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Payment History
        </Typography>
        {!loanId && (
          <Typography color="text.secondary">
            Select a loan to view payment history.
          </Typography>
        )}
        {loanId && loading && <CircularProgress size={24} />}
        {loanId && error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        )}
        {loanId && !loading && !error && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Principal</TableCell>
                <TableCell align="right">Interest</TableCell>
                <TableCell align="right">Late Fee</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">
                      No payments recorded.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {data.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(payment.amount).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(payment.principalPaid).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(payment.interestPaid).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(payment.lateFeePaid ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell>{payment.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

