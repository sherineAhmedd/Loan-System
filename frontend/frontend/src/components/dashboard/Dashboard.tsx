import {
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const cards = [
  {
    title: 'Loans',
    description: 'View, filter and inspect loans',
    path: '/loans',
  },
  {
    title: 'Create Disbursement',
    description: 'Disburse approved loans',
    path: '/disbursements/create',
  },
  {
    title: 'Record Repayment',
    description: 'Log borrower repayments',
    path: '/repayments/create',
  },
  {
    title: 'Rollback Disbursement',
    description: 'Reverse disbursements safely',
    path: '/rollback',
  },
  {
    title: 'Audit Logs',
    description: 'Search and filter historical actions',
    path: '/audit-logs',
  },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  return (
    <Grid container spacing={3} sx={{ mt: 2 }}>
      {cards.map((card) => (
        <Grid item xs={12} md={6} lg={4} key={card.title}>
          <Card>
            <CardActionArea onClick={() => navigate(card.path)}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {card.title}
                </Typography>
                <Typography color="text.secondary">
                  {card.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default Dashboard;

