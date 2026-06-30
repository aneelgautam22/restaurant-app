import { expect, type Locator, type Page } from '@playwright/test';
import type { UniqueCustomer } from './test-data';
import { openCustomersCreditAndLoyalty } from './navigation';

export function customerCard(page: Page, customer: Pick<UniqueCustomer, 'name'>): Locator {
  return page
    .getByText(customer.name, { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-[20px]")][1]');
}

export async function createCustomer(page: Page, customer: UniqueCustomer) {
  await openCustomersCreditAndLoyalty(page);

  await page.getByRole('button', { name: '+ Add' }).click();

  const addCustomerForm = page
    .getByRole('heading', { name: 'Add Customer' })
    .locator('xpath=ancestor::div[contains(@class, "rounded-[28px]")][1]');

  await addCustomerForm.getByPlaceholder('Name *').fill(customer.name);
  await addCustomerForm.getByPlaceholder('Phone').fill(customer.phone);
  await addCustomerForm.getByPlaceholder('Address').fill(customer.address);
  await addCustomerForm.getByPlaceholder('Note').fill(customer.note);
  await addCustomerForm.getByRole('button', { name: 'Save Customer' }).click();

  await expect(page.getByText('Customer saved')).toBeVisible({ timeout: 20_000 });
}

export async function searchCustomers(page: Page, searchTerm: string) {
  await page.getByPlaceholder('Search name, phone, address, note').fill(searchTerm);
}

export async function expectCustomerInList(page: Page, customer: UniqueCustomer) {
  const card = customerCard(page, customer);
  await expect(card).toBeVisible();
  await expect(card).toContainText(customer.name);
  await expect(card).toContainText(customer.phone);
  await expect(card).toContainText(customer.address);
  await expect(card).toContainText(customer.note);
}
