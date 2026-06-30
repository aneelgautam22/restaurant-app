import { expect, type Page } from '@playwright/test';

export const RESTAURANT_ID = '2';
export const OWNER_DEVICE_NAME = 'e2e-owner';
export const OWNER_PASSWORD = 'Suraj@12';

export async function openOwnerPos(page: Page) {
  page.on('dialog', async (dialog) => {
    await dialog.dismiss().catch(() => undefined);
  });

  await page.goto(`/launcher?id=${RESTAURANT_ID}`);

  const ownerPanelButton = page.getByRole('button', { name: 'Owner Panel' });
  const redirectedToMini = await page
    .getByRole('button', { name: /Order/i })
    .last()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);

  if (!redirectedToMini) {
    await expect(ownerPanelButton).toBeVisible({ timeout: 20_000 });
    await ownerPanelButton.click();
    await expect(page.getByText('Owner Login')).toBeVisible();
    await page.getByPlaceholder('Device name e.g. Owner Laptop').fill(OWNER_DEVICE_NAME);
    await page.getByPlaceholder('Enter password').fill(OWNER_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
  }

  await expect(page.getByText('Restaurant link not found')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Order/i }).last()).toBeVisible({ timeout: 20_000 });
}
