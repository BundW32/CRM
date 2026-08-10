-- CreateTable
CREATE TABLE "TrackingSalt" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "salt" TEXT NOT NULL,

    CONSTRAINT "TrackingSalt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSalt_day_key" ON "TrackingSalt"("day");

