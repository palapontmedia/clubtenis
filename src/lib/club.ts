import { cache } from "react";

import { prisma } from "@/lib/prisma";

// Single-club deployment for this MVP (see product spec: "gestión de un
// club de tenis y pádel"). `cache()` de-dupes the lookup within a single
// request/render pass without needing a global singleton.
export const getDefaultClub = cache(async () => {
  return prisma.club.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
  });
});

export const getSports = cache(async () => {
  return prisma.sport.findMany({ orderBy: { name: "asc" } });
});
