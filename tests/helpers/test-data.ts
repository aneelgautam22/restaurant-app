export type UniqueCustomer = {
  id: number;
  name: string;
  phone: string;
  address: string;
  note: string;
};

export function uniqueCustomer(prefix = 'E2E Customer'): UniqueCustomer {
  const id = Date.now();
  return {
    id,
    name: `${prefix} ${id}`,
    phone: `98${String(id).slice(-8)}`,
    address: `E2E Address ${id}`,
    note: `Created by Playwright ${id}`,
  };
}

export function uniqueRewardTitle(prefix = 'E2E Reward') {
  return `${prefix} ${Date.now()}`;
}
