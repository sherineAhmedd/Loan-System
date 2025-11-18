import { Layout } from 'react-admin';
import type { LayoutProps } from 'react-admin';
import { CustomMenu } from './CustomMenu';

export const AppLayout = (props: LayoutProps) => (
  <Layout {...props} menu={CustomMenu} />
);

