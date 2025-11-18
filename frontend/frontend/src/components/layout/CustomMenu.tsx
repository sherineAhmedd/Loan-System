import { Menu, useSidebarState } from 'react-admin';
import type { MenuProps } from 'react-admin';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import UndoIcon from '@mui/icons-material/Undo';
import FactCheckIcon from '@mui/icons-material/FactCheck';

export const CustomMenu = (props: MenuProps) => {
  const [open] = useSidebarState();
  return (
    <Menu {...props} sx={{ width: open ? 240 : 72 }}>
      <Menu.Item to="/loans" primaryText="Loans" leftIcon={<WorkspacesIcon />} />
      <Menu.Item
        to="/disbursements/create"
        primaryText="Disbursements"
        leftIcon={<PaymentsIcon />}
      />
      <Menu.Item
        to="/repayments/create"
        primaryText="Repayments"
        leftIcon={<ReceiptLongIcon />}
      />
      <Menu.Item to="/rollback" primaryText="Rollbacks" leftIcon={<UndoIcon />} />
      <Menu.Item to="/audit-logs" primaryText="Audit Logs" leftIcon={<FactCheckIcon />} />
    </Menu>
  );
};

