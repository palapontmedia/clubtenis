-- CreateTable
CREATE TABLE "ClubHoliday" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ClubHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubHoliday_clubId_date_key" ON "ClubHoliday"("clubId", "date");

-- AddForeignKey
ALTER TABLE "ClubHoliday" ADD CONSTRAINT "ClubHoliday_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
