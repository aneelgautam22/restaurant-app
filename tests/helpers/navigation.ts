import { expect, type Page } from '@playwright/test';

export async function goToManage(page: Page) {
  await page.getByRole('button', { name: /Manage/i }).last().click();
  await expect(page.getByRole('heading', { name: 'Manage', level: 1 })).toBeVisible();
}

export async function openCustomersCreditAndLoyalty(page: Page) {
  await goToManage(page);
  await page.getByRole('button', { name: /Customers.*Credit.*loyalty/i }).click();
  await expect(page.getByRole('heading', { name: 'Customers', level: 2 })).toBeVisible();
}

export async function goToOrder(page: Page) {
  await page.getByRole('button', { name: /Order/i }).last().click();
  await expect(page.getByRole('button', { name: /\+ Take Order/i })).toBeVisible({ timeout: 15_000 });
}

export async function goToBillingIfVisible(page: Page) {
  const billingButton = page.getByRole('button', { name: /^Billing$/ });
  if (await billingButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await billingButton.click();
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
  }
  // TODO: Add a stable Billing navigation assertion after the app exposes a dedicated accessible Billing nav item.
}
