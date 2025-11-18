import {
  Create,
  DateInput,
  NumberInput,
  SelectInput,
  SimpleForm,
  TextInput,
  required,
} from 'react-admin';

const currencyChoices = [
  { id: 'USD', name: 'USD' },
  { id: 'EUR', name: 'EUR' },
  { id: 'EGP', name: 'EGP' },
];

const statusChoices = [
  { id: 'pending', name: 'Pending' },
  { id: 'completed', name: 'Completed' },
  { id: 'failed', name: 'Failed' },
  { id: 'rolled_back', name: 'Rolled Back' },
];

export const DisbursementCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="loanId" label="Loan ID" validate={required()} fullWidth />
      <TextInput
        source="borrowerId"
        label="Borrower ID"
        validate={required()}
        fullWidth
      />
      <NumberInput
        source="amount"
        label="Amount"
        validate={required()}
        fullWidth
      />
      <SelectInput
        source="currency"
        label="Currency"
        choices={currencyChoices}
        validate={required()}
        fullWidth
      />
      <DateInput
        source="disbursementDate"
        label="Disbursement date"
        validate={required()}
        fullWidth
      />
      <DateInput
        source="firstPaymentDate"
        label="First payment date"
        validate={required()}
        fullWidth
      />
      <NumberInput
        source="tenor"
        label="Tenor (months)"
        validate={required()}
        fullWidth
      />
      <NumberInput
        source="interestRate"
        label="Interest rate (%)"
        validate={required()}
        fullWidth
      />
      <SelectInput
        source="status"
        label="Status"
        choices={statusChoices}
        defaultValue="pending"
        fullWidth
      />
    </SimpleForm>
  </Create>
);

