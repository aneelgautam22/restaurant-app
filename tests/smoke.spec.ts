import { expect, test } from '@playwright/test';
import { openOwnerPos } from './helpers/auth';

test.describe('owner POS smoke', () => {
  test('opens owner POS and shows main navigation', async ({ page }) => {
    await openOwnerPos(page);

    await expect(page.getByRole('button', { name: /Order/i }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: /Manage/i }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: /Insights/i }).last()).toBeVisible();
  });
});
