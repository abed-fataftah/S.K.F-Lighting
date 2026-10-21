import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Until the dashboard home (admin-home.md) is built, `/admin` opens the orders (spec 0004 AC-13).
export default function AdminHomePage() {
  redirect(routes.admin.orders);
}
