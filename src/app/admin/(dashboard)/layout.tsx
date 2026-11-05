import { SignOutButton } from "@/features/admin-auth/components/sign-out-button";
import { AutoRefresh } from "@/features/orders/components/auto-refresh";
import { unseenOrdersForSidebar } from "@/features/orders/server/unseen-badge";
import { AdminSide } from "@/features/shell/components/admin-side";
import { requireAdminPage } from "@/server/auth/admin";

// The dashboard frame (design.md section 4): the black sidebar and the content in one wrapping row,
// so below 780px the sidebar sits above the content with no media query. The guard runs here and
// again in every page query and admin action (spec 0004 AC-1). The sidebar's unseen count is read
// behind a time limit, and `AutoRefresh` keeps it and the page current (spec 0014 AC-15, AC-16).
export default async function DashboardLayout({ children }: LayoutProps<"/admin">) {
  await requireAdminPage();
  const unseenOrders = await unseenOrdersForSidebar();

  return (
    <div className="flex min-h-dvh flex-wrap bg-page">
      <AdminSide unseenOrders={unseenOrders}>
        <SignOutButton />
      </AdminSide>
      <main
        id="main"
        tabIndex={-1}
        className="flex min-w-0 flex-[999_1_var(--admin-content-basis)] flex-col gap-4 p-(--admin-pad)"
      >
        {children}
      </main>
      <AutoRefresh />
    </div>
  );
}
