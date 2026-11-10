import { requireAdmin } from '@/lib/auth';
import { listTesterUsers } from '@/lib/plan-tester';

import { UserListClient } from './user-list-client';

export async function UserList() {
  await requireAdmin();
  const users = await listTesterUsers();
  return <UserListClient users={users} />;
}
