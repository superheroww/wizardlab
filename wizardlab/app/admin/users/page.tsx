import { MainShell } from "@/components/layout/MainShell";
import { fetchAdminUsers } from "@/lib/users/fetchUsers";
import UsersTable from "./components/UsersTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersPage() {
  const users = await fetchAdminUsers();

  return (
    <div className="flex flex-col gap-8">
      <MainShell
        title="Users"
        description="Internal view of registered app users; local parts of emails are never revealed."
      >
        <UsersTable rows={users} />
      </MainShell>
    </div>
  );
}
