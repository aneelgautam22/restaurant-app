import { expect, test } from '@playwright/test';
import { openOwnerPos } from './helpers/auth';
import { openCustomersCreditAndLoyalty } from './helpers/navigation';
import { uniqueRewardTitle } from './helpers/test-data';

test.describe('customer rewards scaffolding', () => {
  test('reward rules manager is visible from customers area', async ({ page }) => {
    await openOwnerPos(page);
    await openCustomersCreditAndLoyalty(page);

    await expect(page.getByRole('heading', { name: 'Reward Rules' })).toBeVisible();
    await expect(page.getByPlaceholder('Required Paid Visits')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Rule|Update/ })).toBeVisible();
  });

  test('can create a uniquely titled reward rule', async ({ page }) => {
    await openOwnerPos(page);
    await openCustomersCreditAndLoyalty(page);

    const title = uniqueRewardTitle();
    const rewardRules = page
      .getByRole('heading', { name: 'Reward Rules' })
      .locator('xpath=ancestor::div[contains(@class, "rounded-[28px]")][1]');

    await rewardRules.getByPlaceholder('Title').fill(title);
    await rewardRules.getByPlaceholder('Required Paid Visits').fill('999999');
    await rewardRules.getByRole('combobox').selectOption('discount_amount');
    await rewardRules.getByPlaceholder('Value').fill('1');
    await rewardRules.getByRole('button', { name: 'Add Rule' }).click();

    await expect(rewardRules.getByText(title)).toBeVisible({ timeout: 20_000 });

    // TODO: Add reward redemption coverage after stable selectors exist for a full paid table flow.
  });
});
