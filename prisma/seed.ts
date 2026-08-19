import { PrismaClient, DayCategory, ReservationStatus, PaymentStatus, DiscountType, CourtClosureKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.stripeWebhookEvent.deleteMany(),
    prisma.reservationParticipant.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.promoCode.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.courtClosure.deleteMany(),
    prisma.clubHoliday.deleteMany(),
    prisma.pricingRule.deleteMany(),
    prisma.court.deleteMany(),
    prisma.courtType.deleteMany(),
    prisma.clubOpeningHours.deleteMany(),
    prisma.cancellationPolicyTier.deleteMany(),
    prisma.cancellationPolicy.deleteMany(),
    prisma.playerProfile.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.sport.deleteMany(),
    prisma.club.deleteMany(),
  ]);

  const club = await prisma.club.create({
    data: {
      name: "Valencia Padel & Tennis Club",
      slug: "valencia-padel-tennis-club",
      description: "Club deportivo con 6 pistas de pádel y tenis en el corazón de Valencia.",
      address: "Av. del Deporte 24, 46013 Valencia",
      phone: "+34 963 000 000",
      email: "info@vptc.example",
      timezone: "Europe/Madrid",
      currency: "EUR",
    },
  });

  const [padel, tenis] = await Promise.all([
    prisma.sport.create({ data: { name: "Pádel", slug: "padel", icon: "🎾" } }),
    prisma.sport.create({ data: { name: "Tenis", slug: "tenis", icon: "🎾" } }),
  ]);

  const [panoramica, muro, rapida] = await Promise.all([
    prisma.courtType.create({ data: { name: "Panorámica", description: "Cristal panorámico, la más solicitada." } }),
    prisma.courtType.create({ data: { name: "Muro", description: "Pista clásica de muro." } }),
    prisma.courtType.create({ data: { name: "Pista rápida", description: "Superficie dura de tenis." } }),
  ]);

  const courts = await Promise.all([
    prisma.court.create({
      data: { clubId: club.id, sportId: padel.id, courtTypeId: panoramica.id, name: "Pádel 1", indoor: true, covered: true, basePriceCents: 2800, sortOrder: 1 },
    }),
    prisma.court.create({
      data: { clubId: club.id, sportId: padel.id, courtTypeId: panoramica.id, name: "Pádel 2", indoor: true, covered: true, basePriceCents: 2800, sortOrder: 2 },
    }),
    prisma.court.create({
      data: { clubId: club.id, sportId: padel.id, courtTypeId: muro.id, name: "Pádel 3", indoor: false, covered: false, basePriceCents: 2200, sortOrder: 3 },
    }),
    prisma.court.create({
      data: { clubId: club.id, sportId: padel.id, courtTypeId: muro.id, name: "Pádel 4", indoor: false, covered: false, basePriceCents: 2200, sortOrder: 4 },
    }),
    prisma.court.create({
      data: { clubId: club.id, sportId: tenis.id, courtTypeId: rapida.id, name: "Tenis 1", indoor: false, covered: false, basePriceCents: 2400, sortOrder: 5 },
    }),
    prisma.court.create({
      data: { clubId: club.id, sportId: tenis.id, courtTypeId: rapida.id, name: "Tenis 2", indoor: false, covered: false, basePriceCents: 2400, sortOrder: 6 },
    }),
  ]);

  // Opening hours: Mon-Fri 08:00-23:00, Sat 09:00-22:00, Sun 09:00-21:00
  await prisma.clubOpeningHours.createMany({
    data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ clubId: club.id, dayOfWeek, opensAt: "08:00", closesAt: "23:00" })),
  });
  await prisma.clubOpeningHours.create({ data: { clubId: club.id, dayOfWeek: 6, opensAt: "09:00", closesAt: "22:00" } });
  await prisma.clubOpeningHours.create({ data: { clubId: club.id, dayOfWeek: 0, opensAt: "09:00", closesAt: "21:00" } });

  // Pricing: weekday off-peak / peak, weekend flat, per sport.
  for (const sport of [padel, tenis]) {
    const peak = sport.id === padel.id ? 3200 : 2800;
    const offPeak = sport.id === padel.id ? 2200 : 1800;
    const weekend = sport.id === padel.id ? 2600 : 2200;

    await prisma.pricingRule.createMany({
      data: [
        { clubId: club.id, sportId: sport.id, name: "Valle (mañanas)", dayCategory: DayCategory.WEEKDAY, startTime: "08:00", endTime: "18:00", pricePerHourCents: offPeak, priority: 1 },
        { clubId: club.id, sportId: sport.id, name: "Punta (tardes)", dayCategory: DayCategory.WEEKDAY, startTime: "18:00", endTime: "23:00", pricePerHourCents: peak, priority: 1 },
        { clubId: club.id, sportId: sport.id, name: "Fin de semana", dayCategory: DayCategory.WEEKEND, startTime: "00:00", endTime: "23:59", pricePerHourCents: weekend, priority: 1 },
        { clubId: club.id, sportId: sport.id, name: "Festivo", dayCategory: DayCategory.HOLIDAY, startTime: "00:00", endTime: "23:59", pricePerHourCents: weekend, priority: 1 },
      ],
    });
  }

  const nextNewYear = new Date();
  nextNewYear.setUTCFullYear(nextNewYear.getUTCFullYear() + 1, 0, 1);
  await prisma.clubHoliday.create({ data: { clubId: club.id, date: nextNewYear, name: "Año Nuevo" } });

  const policy = await prisma.cancellationPolicy.create({
    data: { clubId: club.id, name: "Política estándar", isDefault: true },
  });
  await prisma.cancellationPolicyTier.createMany({
    data: [
      { policyId: policy.id, minHoursBefore: 24, refundPercentage: 100 },
      { policyId: policy.id, minHoursBefore: 12, refundPercentage: 50 },
      { policyId: policy.id, minHoursBefore: 0, refundPercentage: 0 },
    ],
  });

  const passwordHash = await bcrypt.hash("Password123", 12);

  const admin = await prisma.user.create({
    data: { email: "admin@vptc.example", name: "Marta Ibáñez", role: "SUPER_ADMIN", passwordHash, emailVerifiedAt: new Date() },
  });
  const staff = await prisma.user.create({
    data: { email: "staff@vptc.example", name: "Jordi Ferrer", role: "STAFF", passwordHash, emailVerifiedAt: new Date() },
  });

  const players = await Promise.all(
    [
      { email: "ana.garcia@example.com", name: "Ana García" },
      { email: "carlos.ruiz@example.com", name: "Carlos Ruiz" },
      { email: "lucia.moreno@example.com", name: "Lucía Moreno" },
      { email: "pablo.alapont@example.com", name: "Pablo Alapont" },
    ].map((p) =>
      prisma.user.create({
        data: {
          email: p.email,
          name: p.name,
          role: "PLAYER",
          passwordHash,
          emailVerifiedAt: new Date(),
          playerProfile: { create: { skillLevel: "Intermedio", marketingOptIn: true } },
        },
      })
    )
  );

  const promotion = await prisma.promotion.create({
    data: {
      clubId: club.id,
      name: "Bienvenida de verano",
      description: "10% de descuento en tu próxima reserva de pádel.",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      sportId: padel.id,
      startsAt: new Date(Date.now() - 7 * 24 * 3_600_000),
      endsAt: new Date(Date.now() + 60 * 24 * 3_600_000),
      active: true,
    },
  });
  await prisma.promoCode.create({
    data: { promotionId: promotion.id, code: "VERANO10", maxRedemptions: 100 },
  });

  await prisma.courtClosure.create({
    data: {
      courtId: courts[3].id,
      kind: CourtClosureKind.MAINTENANCE,
      reason: "Cambio de césped artificial",
      startsAt: new Date(Date.now() + 2 * 24 * 3_600_000),
      endsAt: new Date(Date.now() + 3 * 24 * 3_600_000),
      createdById: staff.id,
    },
  });

  // Sample reservations in different states.
  const inTwoDays9am = addHours(startOfNextDay(2), 9);
  const confirmed = await prisma.reservation.create({
    data: {
      clubId: club.id,
      courtId: courts[0].id,
      sportId: padel.id,
      createdById: players[0].id,
      startsAt: inTwoDays9am,
      endsAt: addMinutes(inTwoDays9am, 90),
      status: ReservationStatus.CONFIRMED,
      priceCents: 3300,
      totalCents: 3300,
      currency: "EUR",
      participants: { create: [{ userId: players[0].id }, { userId: players[1].id }] },
    },
  });
  await prisma.payment.create({
    data: {
      reservationId: confirmed.id,
      userId: players[0].id,
      stripePaymentIntentId: "pi_seed_confirmed_example",
      idempotencyKey: `payment-intent:${confirmed.id}`,
      amountCents: 3300,
      status: PaymentStatus.SUCCEEDED,
    },
  });

  const inThreeDays19h = addHours(startOfNextDay(3), 19);
  await prisma.reservation.create({
    data: {
      clubId: club.id,
      courtId: courts[4].id,
      sportId: tenis.id,
      createdById: players[2].id,
      startsAt: inThreeDays19h,
      endsAt: addMinutes(inThreeDays19h, 60),
      status: ReservationStatus.PENDING_PAYMENT,
      priceCents: 2800,
      totalCents: 2800,
      currency: "EUR",
      expiresAt: new Date(Date.now() + 15 * 60_000),
      participants: { create: [{ userId: players[2].id }] },
    },
  });

  const lastWeek = addHours(startOfPastDay(7), 18);
  const completed = await prisma.reservation.create({
    data: {
      clubId: club.id,
      courtId: courts[1].id,
      sportId: padel.id,
      createdById: players[3].id,
      startsAt: lastWeek,
      endsAt: addMinutes(lastWeek, 90),
      status: ReservationStatus.COMPLETED,
      priceCents: 4800,
      totalCents: 4800,
      currency: "EUR",
      participants: { create: [{ userId: players[3].id }] },
    },
  });
  await prisma.payment.create({
    data: {
      reservationId: completed.id,
      userId: players[3].id,
      stripePaymentIntentId: "pi_seed_completed_example",
      idempotencyKey: `payment-intent:${completed.id}`,
      amountCents: 4800,
      status: PaymentStatus.SUCCEEDED,
    },
  });

  const lastMonth = addHours(startOfPastDay(20), 10);
  await prisma.reservation.create({
    data: {
      clubId: club.id,
      courtId: courts[2].id,
      sportId: padel.id,
      createdById: players[1].id,
      startsAt: lastMonth,
      endsAt: addMinutes(lastMonth, 90),
      status: ReservationStatus.CANCELLED,
      priceCents: 3300,
      totalCents: 3300,
      currency: "EUR",
      cancelledAt: addHours(lastMonth, -30),
      cancelledById: players[1].id,
      cancellationReason: "Imprevisto laboral",
      refundPercentage: 100,
      participants: { create: [{ userId: players[1].id }] },
    },
  });

  console.log("Seed complete:");
  console.log(`  Club: ${club.name} (${club.slug})`);
  console.log(`  Admin login: admin@vptc.example / Password123`);
  console.log(`  Staff login: staff@vptc.example / Password123`);
  console.log(`  Player login: ana.garcia@example.com / Password123`);
}

function startOfNextDay(daysAhead: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfPastDay(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}
function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
