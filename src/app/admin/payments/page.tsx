import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefundDialog } from "@/components/admin/refund-dialog";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted" | "destructive"> = {
  PENDING: "warning",
  SUCCEEDED: "success",
  FAILED: "destructive",
  CANCELED: "muted",
  REFUNDED: "muted",
  PARTIALLY_REFUNDED: "muted",
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function AdminPaymentsPage() {
  await requireRole("STAFF");
  const club = await getDefaultClub();

  const payments = await prisma.payment.findMany({
    where: { reservation: { clubId: club.id } },
    include: { user: { select: { name: true, email: true } }, refunds: true, reservation: { include: { court: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Últimos 100 pagos y reembolsos.</p>

      <div className="mt-6 space-y-2">
        {payments.map((p) => {
          const refundedCents = p.refunds.reduce((sum, r) => sum + r.amountCents, 0);
          const remainingCents = p.amountCents - refundedCents;
          return (
            <Card key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{formatMoney(p.amountCents, p.currency)}</p>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "muted"}>{p.status}</Badge>
                  {refundedCents > 0 && (
                    <Badge variant="warning">Reembolsado {formatMoney(refundedCents, p.currency)}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.user.name} ({p.user.email}) · {p.reservation.court.name} · {formatDateTime(p.createdAt)}
                </p>
              </div>
              {p.status === "SUCCEEDED" && remainingCents > 0 && (
                <RefundDialog paymentId={p.id} maxEuros={remainingCents / 100} />
              )}
            </Card>
          );
        })}
        {payments.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No hay pagos todavía.</Card>}
      </div>
    </div>
  );
}
