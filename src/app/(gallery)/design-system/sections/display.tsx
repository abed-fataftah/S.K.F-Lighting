import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Ltr } from "@/components/ltr";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { GallerySection, SampleGroup } from "../gallery-section";

// Board samples (gallery only): order numbers and totals are not words, so they stay here.
const orders = [
  { number: "26-00123", customer: "customerA", status: "new", totalAgorot: 125_000 },
  { number: "26-00122", customer: "customerB", status: "proc", totalAgorot: 34_000 },
] as const;

// Badge, card, table, notice, skeleton, breadcrumb, sheet (AC-7, AC-21), and the confirm dialog
// (spec 0006).
export async function DisplaySection() {
  const d = await getTranslations("DesignSystem.display");

  return (
    <GallerySection id="display" title={d("title")} text={d("text")}>
      <SampleGroup title={d("badgesGroup")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="new">{d("statusNew")}</Badge>
          <Badge variant="proc">{d("statusProc")}</Badge>
          <Badge variant="ok">{d("statusOk")}</Badge>
          <Badge variant="off">{d("statusOff")}</Badge>
          <Badge variant="spec">{d("specChip")}</Badge>
          <span className="inline-flex items-center gap-1.5 rounded-btn bg-ink p-2 text-white">
            <span className="type-caption">{d("countLabel")}</span>
            <Badge variant="count">{formatNumber(3)}</Badge>
            <Badge variant="count">{`${formatNumber(99)}+`}</Badge>
          </span>
        </div>
      </SampleGroup>

      <SampleGroup title={d("cardGroup")}>
        <Card className="max-w-(--page-max) bg-page">
          <CardHeader>
            <CardTitle>{d("cardTitle")}</CardTitle>
            <CardDescription>{d("cardText")}</CardDescription>
          </CardHeader>
        </Card>
      </SampleGroup>

      <SampleGroup title={d("tableGroup")}>
        <Table aria-label={d("tableLabel")}>
          <TableHeader>
            <TableRow>
              <TableHead>{d("colNumber")}</TableHead>
              <TableHead>{d("colCustomer")}</TableHead>
              <TableHead>{d("colStatus")}</TableHead>
              <TableHead>{d("colTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.number}>
                <TableCell>
                  <Ltr>{order.number}</Ltr>
                </TableCell>
                <TableCell className="whitespace-nowrap">{d(order.customer)}</TableCell>
                <TableCell>
                  <Badge variant={order.status}>
                    {order.status === "new" ? d("statusNew") : d("statusProc")}
                  </Badge>
                </TableCell>
                <TableCell className="font-bold">
                  <Ltr>{formatPrice(order.totalAgorot)}</Ltr>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SampleGroup>

      <SampleGroup title={d("alertGroup")}>
        <Alert className="max-w-(--page-max)">{d("alertText")}</Alert>
      </SampleGroup>

      <SampleGroup title={d("skeletonGroup")}>
        <div className="flex max-w-(--page-max) gap-3" data-testid="skeleton-sample">
          <Skeleton className="size-18 shrink-0 rounded-card" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-auto h-11 w-full rounded-btn" />
          </div>
        </div>
      </SampleGroup>

      <SampleGroup title={d("breadcrumbGroup")}>
        <Breadcrumb aria-label={d("breadcrumbLabel")}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#display">{d("home")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#display">{d("chandeliers")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{d("crystal")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </SampleGroup>

      <SampleGroup title={d("sheetGroup")}>
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>{d("openSheet")}</SheetTrigger>
          <SheetContent closeLabel={d("close")}>
            <SheetHeader>
              <SheetTitle>{d("sheetTitle")}</SheetTitle>
            </SheetHeader>
            <SheetDescription className="px-4">{d("sheetText")}</SheetDescription>
          </SheetContent>
        </Sheet>
      </SampleGroup>

      <SampleGroup title={d("dialogGroup")}>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" />}>
            {d("openDialog")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>{d("dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{d("dialogText")}</AlertDialogDescription>
            <AlertDialogActions>
              <AlertDialogClose render={<Button />}>{d("dialogConfirm")}</AlertDialogClose>
              <AlertDialogClose render={<Button variant="outline" />}>
                {d("dialogCancel")}
              </AlertDialogClose>
            </AlertDialogActions>
          </AlertDialogContent>
        </AlertDialog>
      </SampleGroup>

      <SampleGroup title={d("formDialogGroup")}>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>{d("openFormDialog")}</DialogTrigger>
          <DialogContent>
            <DialogTitle>{d("formDialogTitle")}</DialogTitle>
            <Field>
              <FieldLabel htmlFor="gallery-dialog-name">{d("formDialogLabel")}</FieldLabel>
              <Input id="gallery-dialog-name" />
            </Field>
            <DialogActions>
              <DialogClose render={<Button />}>{d("formDialogSave")}</DialogClose>
              <DialogClose render={<Button variant="outline" />}>{d("dialogCancel")}</DialogClose>
            </DialogActions>
          </DialogContent>
        </Dialog>
      </SampleGroup>
    </GallerySection>
  );
}
