import { Admin, CustomRoutes, Resource } from 'react-admin';
import { Route } from 'react-router-dom';
import dataProvider from './api/dataProvider';
import { LoanList, LoanShow } from './components/loans/LoanList';
import { DisbursementCreate } from './components/disbursements/DisbursementCreate';
import { RepaymentCreate } from './components/repayments/RepaymentCreate';
import { RollbackPage } from './components/rollback/RollbackPage';
import { AuditLogViewer } from './components/audit/AuditLogViewer';
import Dashboard from './components/dashboard/Dashboard';
import { AppLayout } from './components/layout/AppLayout';
import './App.css';

function App() {
  return (
    <Admin dataProvider={dataProvider} dashboard={Dashboard} layout={AppLayout}>
      <Resource name="loans" list={LoanList} show={LoanShow} recordRepresentation="borrowerId" />
      <Resource name="disbursements" create={DisbursementCreate} />
      <Resource name="repayments" create={RepaymentCreate} />
      <CustomRoutes>
        <Route path="/rollback" element={<RollbackPage />} />
        <Route path="/audit-logs" element={<AuditLogViewer />} />
      </CustomRoutes>
    </Admin>
  );
}

export default App;
