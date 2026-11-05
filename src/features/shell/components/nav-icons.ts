import {
  ChartColumn,
  ClipboardList,
  FolderTree,
  House,
  LayoutDashboard,
  LayoutGrid,
  Package,
  PanelsTopLeft,
  Search,
  Settings,
  ShoppingCart,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminLinkId, TabId } from "../nav";

// The icons of the shell links (spec 0003, Icons table).
export const tabIcons: Readonly<Record<TabId, LucideIcon>> = {
  home: House,
  cats: LayoutGrid,
  cart: ShoppingCart,
  search: Search,
  account: User,
};

export const adminIcons: Readonly<Record<AdminLinkId, LucideIcon>> = {
  home: LayoutDashboard,
  orders: ClipboardList,
  customers: Users,
  reports: ChartColumn,
  products: Package,
  categories: FolderTree,
  homepage: PanelsTopLeft,
  settings: Settings,
};
