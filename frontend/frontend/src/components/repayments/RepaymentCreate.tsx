import {
  Create,
  DateInput,
  NumberInput,
  SelectInput,
  SimpleForm,
  TextInput,
  required,
} from 'react-admin';

const statusChoices = [
  { id: 'POSTED', name: 'Posted' },
  { id: 'PENDING', name: 'Pending' },
  { id: 'FAILED', name: 'Failed' },
];

export const RepaymentCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="loanId" label="Loan ID" validate={required()} fullWidth />
      <NumberInput
        source="amount"
        label="Total amount"
        validate={required()}
        fullWidth
      />
      <DateInput
        source="paymentDate"
        label="Payment date"
        defaultValue={new Date().toISOString()}
        fullWidth
      />
      <NumberInput
        source="principalPaid"
        label="Principal component"
        validate={required()}
        fullWidth
      />
      <NumberInput
        source="interestPaid"
        label="Interest component"
        validate={required()}
        fullWidth
      />
      <NumberInput source="lateFeePaid" label="Late fee paid" fullWidth />
      <NumberInput source="daysLate" label="Days late" fullWidth />
      <SelectInput
        source="status"
        label="Status"
        choices={statusChoices}
        defaultValue="POSTED"
        fullWidth
      />
    </SimpleForm>
  </Create>
);

