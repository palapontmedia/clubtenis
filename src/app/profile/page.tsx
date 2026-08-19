import { prisma } from "@/lib/prisma";
import { requireUserOrRedirect } from "@/lib/auth-guards";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const user = await requireUserOrRedirect("/profile");

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { playerProfile: true },
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>

      <div className="mt-6">
        <ProfileForm
          initial={{
            name: profile.name,
            phone: profile.phone ?? "",
            bio: profile.playerProfile?.bio ?? "",
            skillLevel: profile.playerProfile?.skillLevel ?? "",
            marketingOptIn: profile.playerProfile?.marketingOptIn ?? false,
          }}
        />
      </div>
    </div>
  );
}
