import { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  reservationId?: string;
}

interface EmailProvider {
  send(input: { to: string; subject: string; body: string }): Promise<void>;
}

// No real email provider is configured for this MVP. Swap this for a real
// implementation (Resend, SES, Postmark...) behind the same interface —
// every call site goes through `notify()` below, so nothing else changes.
const mockEmailProvider: EmailProvider = {
  async send({ to, subject }) {
     
    console.log(`[mock-email] -> ${to}: ${subject}`);
  },
};

function getEmailProvider(): EmailProvider {
  return mockEmailProvider;
}

/**
 * Records an in-app notification and best-effort sends an email. Never
 * throws on delivery failure — a notification failing to send must not
 * roll back the reservation/payment transaction that triggered it.
 */
export async function notify(input: NotifyInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      channel: "IN_APP",
      title: input.title,
      body: input.body,
      reservationId: input.reservationId,
      sentAt: new Date(),
    },
  });

  try {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (user) {
      await getEmailProvider().send({ to: user.email, subject: input.title, body: input.body });
    }
  } catch (error) {
     
    console.error("Failed to send notification email:", error);
  }

  return notification;
}
