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
import { useRepaymentSchedule } from '../../api/hooks';

export const RepaymentSchedulePanel = ({
  loanId: propLoanId,
}: {
  loanId?: string;
}) => {
  const record = useRecordContext();
  const loanId = propLoanId ?? (record?.id ? String(record.id) : undefined);
  const { data, loading, error } = useRepaymentSchedule(loanId);

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Repayment Schedule
        </Typography>
        {!loanId && (
          <Typography color="text.secondary">
            Select a loan to load the repayment schedule.
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
                <TableCell>#</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="right">Principal</TableCell>
                <TableCell align="right">Interest</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">
                      No schedule generated yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {data.map((item: any) => (
                <TableRow key={`${item.installmentNumber}-${item.dueDate}`}>
                  <TableCell>{item.installmentNumber}</TableCell>
                  <TableCell>
                    {new Date(item.dueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(item.principalAmount).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(item.interestAmount).toFixed(2)}
                  </TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

