import { prisma } from "@/lib/prisma";
import { getDefaultClub } from "@/lib/club";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7; // Monday-based week
  x.setDate(x.getDate() - diff);
  return x;
}

export async function getDashboardMetrics() {
  const club = await getDefaultClub();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 3_600_000);
  const weekStart = startOfWeek(now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3_600_000);

  const activeStatuses = ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED"] as const;

  const [reservationsToday, reservationsThisWeek, cancellationsThisWeek, payments, refunds, activeCourts, topCourts, recentReservations] =
    await Promise.all([
      prisma.reservation.count({
        where: { clubId: club.id, startsAt: { gte: todayStart, lt: todayEnd }, status: { in: [...activeStatuses] } },
      }),
      prisma.reservation.count({
        where: { clubId: club.id, startsAt: { gte: weekStart }, status: { in: [...activeStatuses] } },
      }),
      prisma.reservation.count({
        where: { clubId: club.id, cancelledAt: { gte: weekStart } },
      }),
      prisma.payment.findMany({
        where: { status: "SUCCEEDED", createdAt: { gte: weekStart }, reservation: { clubId: club.id } },
        select: { amountCents: true },
      }),
      prisma.refund.findMany({
        where: { createdAt: { gte: weekStart }, payment: { reservation: { clubId: club.id } } },
        select: { amountCents: true },
      }),
      prisma.court.count({ where: { clubId: club.id, active: true } }),
      prisma.reservation.groupBy({
        by: ["courtId"],
        where: { clubId: club.id, startsAt: { gte: thirtyDaysAgo }, status: { in: ["CONFIRMED", "COMPLETED"] } },
        _count: { courtId: true },
        orderBy: { _count: { courtId: "desc" } },
        take: 1,
      }),
      prisma.reservation.findMany({
        where: { clubId: club.id, startsAt: { gte: thirtyDaysAgo }, status: { in: ["CONFIRMED", "COMPLETED"] } },
        select: { startsAt: true },
      }),
    ]);

  const revenueThisWeekCents =
    payments.reduce((sum, p) => sum + p.amountCents, 0) - refunds.reduce((sum, r) => sum + r.amountCents, 0);

  const openingHours = await prisma.clubOpeningHours.findUnique({
    where: { clubId_dayOfWeek: { clubId: club.id, dayOfWeek: now.getDay() } },
  });
  let occupancyPercent = 0;
  if (openingHours && !openingHours.closed && activeCourts > 0) {
    const [oh, om] = openingHours.opensAt.split(":").map(Number);
    const [ch, cm] = openingHours.closesAt.split(":").map(Number);
    const openMinutesToday = ch * 60 + cm - (oh * 60 + om);
    const bookedReservations = await prisma.reservation.findMany({
      where: { clubId: club.id, startsAt: { gte: todayStart, lt: todayEnd }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      select: { startsAt: true, endsAt: true },
    });
    const bookedMinutes = bookedReservations.reduce(
      (sum, r) => sum + (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000,
      0
    );
    const capacityMinutes = openMinutesToday * activeCourts;
    occupancyPercent = capacityMinutes > 0 ? Math.round((bookedMinutes / capacityMinutes) * 100) : 0;
  }

  const topCourt = topCourts[0]
    ? await prisma.court.findUnique({ where: { id: topCourts[0].courtId }, select: { name: true } })
    : null;

  const hourCounts = new Map<number, number>();
  for (const r of recentReservations) {
    const hour = r.startsAt.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    reservationsToday,
    reservationsThisWeek,
    cancellationsThisWeek,
    revenueThisWeekCents,
    occupancyPercent,
    topCourtName: topCourt?.name ?? "—",
    peakHourLabel: peakHour !== undefined ? `${String(peakHour).padStart(2, "0")}:00` : "—",
    currency: club.currency,
  };
}
