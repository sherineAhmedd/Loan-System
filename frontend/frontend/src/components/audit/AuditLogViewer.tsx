import {
  Alert,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import { useAuditLogSearch } from '../../api/hooks';

const operationOptions = [
  { label: 'Any operation', value: '' },
  { label: 'Loan Disbursement', value: 'LOAN_DISBURSEMENT' },
  { label: 'Repayment', value: 'LOAN_REPAYMENT' },
  { label: 'Rollback', value: 'LOAN_DISBURSEMENT_ROLLBACK' },
];

export const AuditLogViewer = () => {
  const {
    loanId,
    setLoanId,
    query,
    setQuery,
    operation,
    setOperation,
    runSearch,
    data,
    loading,
    error,
  } = useAuditLogSearch();

  return (
    <Stack spacing={3} sx={{ mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Audit Log Viewer
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mt={2}>
            <TextField
              label="Loan ID"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
              fullWidth
            />
            <TextField
              label="Search"
              placeholder="Transaction ID or operation"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Operation"
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              fullWidth
            >
              {operationOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              onClick={() => runSearch()}
              disabled={loading}
            >
              Search
            </Button>
          </Stack>
          {loading && <CircularProgress sx={{ mt: 2 }} />}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Results
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Operation</TableCell>
                <TableCell>Transaction</TableCell>
                <TableCell>Performed By</TableCell>
                <TableCell>Metadata</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">
                      No audit entries yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {data.map((entry: any) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{entry.operation}</TableCell>
                  <TableCell>{entry.transactionId}</TableCell>
                  <TableCell>{entry.userId ?? '—'}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {JSON.stringify(entry.metadata ?? {}, null, 0)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
};

