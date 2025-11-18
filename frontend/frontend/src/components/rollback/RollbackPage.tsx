import {
  Card,
  CardActions,
  CardContent,
  Stack,
  TextField,
  Typography,
  Button,
  Alert,
} from '@mui/material';
import { useState } from 'react';
import { rollbackDisbursement } from '../../api/service';

export const RollbackPage = () => {
  const [disbursementId, setDisbursementId] = useState('');
  const [reason, setReason] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!disbursementId) {
      setStatus({ type: 'error', message: 'Provide a disbursement ID.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      await rollbackDisbursement(disbursementId, {
        reason,
        performedBy,
      });
      setStatus({
        type: 'success',
        message: 'Rollback request submitted successfully.',
      });
      setReason('');
      setPerformedBy('');
    } catch (error: any) {
      setStatus({
        type: 'error',
        message: error?.body?.message ?? error.message ?? 'Rollback failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 640, mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Rollback a Disbursement
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Disbursement ID"
            value={disbursementId}
            onChange={(e) => setDisbursementId(e.target.value)}
            required
          />
          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Duplicate disbursement, incorrect amount, etc."
            multiline
            minRows={2}
          />
          <TextField
            label="Performed by"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            placeholder="ops.user@company.com"
          />
        </Stack>
        {status && (
          <Alert severity={status.type} sx={{ mt: 2 }}>
            {status.message}
          </Alert>
        )}
      </CardContent>
      <CardActions>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Rolling back...' : 'Rollback'}
        </Button>
      </CardActions>
    </Card>
  );
};

