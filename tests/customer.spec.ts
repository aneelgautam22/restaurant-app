import { expect, test } from '@playwright/test';
import { openOwnerPos } from './helpers/auth';
import { createCustomer, customerCard, expectCustomerInList, searchCustomers } from './helpers/customer';
import { openCustomersCreditAndLoyalty } from './helpers/navigation';
import { uniqueCustomer } from './helpers/test-data';

test.describe('customer management', () => {
  test.beforeEach(async ({ page }) => {
    await openOwnerPos(page);
  });

  test('creates a customer with unique name and phone', async ({ page }) => {
    const customer = uniqueCustomer();

    await createCustomer(page, customer);
    await searchCustomers(page, customer.name);
    await expectCustomerInList(page, customer);
  });

  test('search by phone finds the created customer', async ({ page }) => {
    const customer = uniqueCustomer('E2E Phone Search Customer');

    await createCustomer(page, customer);
    await searchCustomers(page, customer.phone);
    await expectCustomerInList(page, customer);
  });

  test('opens customer profile for a created customer', async ({ page }) => {
    const customer = uniqueCustomer('E2E Profile Customer');

    await createCustomer(page, customer);
    await searchCustomers(page, customer.phone);
    await customerCard(page, customer).getByRole('button', { name: 'Profile' }).click();

    await expect(page.getByText('Customer Profile')).toBeVisible();
    await expect(page.getByRole('heading', { name: customer.name })).toBeVisible();
  });

  test('customers page can be opened directly from manage', async ({ page }) => {
    await openCustomersCreditAndLoyalty(page);
    await expect(page.getByPlaceholder('Search name, phone, address, note')).toBeVisible();
  });
});
