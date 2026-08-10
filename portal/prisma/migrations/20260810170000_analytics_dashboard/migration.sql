-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "campaign" TEXT NOT NULL DEFAULT '',
    "sessions" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "newUsers" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "engagedSess" INTEGER NOT NULL,
    "avgDurationS" DOUBLE PRECISION NOT NULL,
    "bounceRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "avgDurationS" DOUBLE PRECISION NOT NULL,
    "entrances" INTEGER NOT NULL,
    "exits" INTEGER NOT NULL,

    CONSTRAINT "PageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQueryDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "device" TEXT NOT NULL DEFAULT '',
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SearchQueryDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdsDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adGroupId" TEXT NOT NULL DEFAULT '',
    "adGroupName" TEXT,
    "keyword" TEXT NOT NULL DEFAULT '',
    "matchType" TEXT NOT NULL DEFAULT '',
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "costMicros" BIGINT NOT NULL,
    "conversions" DOUBLE PRECISION NOT NULL,
    "convValueMicros" BIGINT,

    CONSTRAINT "AdsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackEvent" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorHash" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "country" TEXT,
    "device" TEXT,
    "meta" JSONB,

    CONSTRAINT "TrackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "signups" INTEGER NOT NULL,
    "activeTrials" INTEGER NOT NULL,
    "activeSubs" INTEGER NOT NULL,
    "newSubs" INTEGER NOT NULL,
    "canceledSubs" INTEGER NOT NULL,
    "billedUnits" INTEGER NOT NULL,
    "billedStellplaetze" INTEGER NOT NULL,
    "mrrCents" INTEGER NOT NULL,

    CONSTRAINT "BusinessDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "subscribers" INTEGER NOT NULL,
    "newSubs" INTEGER NOT NULL,
    "unsubscribes" INTEGER NOT NULL,

    CONSTRAINT "NewsletterDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsDaily_date_idx" ON "AnalyticsDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDaily_date_source_medium_campaign_key" ON "AnalyticsDaily"("date", "source", "medium", "campaign");

-- CreateIndex
CREATE INDEX "PageDaily_date_idx" ON "PageDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PageDaily_date_path_key" ON "PageDaily"("date", "path");

-- CreateIndex
CREATE INDEX "SearchQueryDaily_date_idx" ON "SearchQueryDaily"("date");

-- CreateIndex
CREATE INDEX "SearchQueryDaily_query_idx" ON "SearchQueryDaily"("query");

-- CreateIndex
CREATE UNIQUE INDEX "SearchQueryDaily_date_query_page_country_device_key" ON "SearchQueryDaily"("date", "query", "page", "country", "device");

-- CreateIndex
CREATE INDEX "AdsDaily_date_idx" ON "AdsDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdsDaily_date_campaignId_adGroupId_keyword_matchType_key" ON "AdsDaily"("date", "campaignId", "adGroupId", "keyword", "matchType");

-- CreateIndex
CREATE INDEX "TrackEvent_ts_idx" ON "TrackEvent"("ts");

-- CreateIndex
CREATE INDEX "TrackEvent_type_ts_idx" ON "TrackEvent"("type", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDaily_date_key" ON "BusinessDaily"("date");

-- CreateIndex
CREATE INDEX "BusinessDaily_date_idx" ON "BusinessDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterDaily_date_key" ON "NewsletterDaily"("date");

-- CreateIndex
CREATE INDEX "IngestRun_source_startedAt_idx" ON "IngestRun"("source", "startedAt");

