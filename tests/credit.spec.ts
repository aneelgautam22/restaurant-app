import { expect, test } from '@playwright/test';
import { openOwnerPos } from './helpers/auth';
import { createCustomer, searchCustomers } from './helpers/customer';
import { uniqueCustomer } from './helpers/test-data';

test.describe('customer credit scaffolding', () => {
  test('customers page loads credit-related fields for a customer', async ({ page }) => {
    await openOwnerPos(page);
    const customer = uniqueCustomer('E2E Credit Customer');

    await createCustomer(page, customer);
    await searchCustomers(page, customer.phone);

    await expect(page.getByText('Receive Due Payment')).toBeVisible();
    await expect(page.getByText('Credit Due')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();

    // TODO: Add full credit-sale and due-payment coverage after stable selectors exist
    // for table creation, credit customer attachment, and payment settlement confirmation.
  });
});
