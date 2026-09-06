import { SearchForm } from "@/components/booking/search-form";
import { Section } from "@/components/layout/section";
import { getDefaultClub, getSports } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [club, sports] = await Promise.all([getDefaultClub(), getSports()]);

  return (
    <Section>
      <div className="mx-auto max-w-xl">
        <SearchForm sports={sports} clubId={club.id} timezone={club.timezone} />
      </div>
    </Section>
  );
}
