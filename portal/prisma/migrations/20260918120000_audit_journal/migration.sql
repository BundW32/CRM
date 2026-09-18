BEGIN;
ALTER TABLE "AuditLog"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "propertyId" TEXT,
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'SECURITY',
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actorName" TEXT,
  ADD COLUMN "actorKind" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "effectiveActorId" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "operation" TEXT,
  ADD COLUMN "changes" JSONB,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;

-- Only facts that are still available can be backfilled. No invented old values.
UPDATE "AuditLog" a SET "organizationId" = u."organizationId"
FROM "User" u WHERE a."actorId" = u.id;
UPDATE "AuditLog" SET category = 'JOURNAL'
WHERE action LIKE 'WEG\_%' ESCAPE '\' OR action LIKE 'HANDWERKER\_%' ESCAPE '\'
   OR action LIKE 'TICKET\_%' ESCAPE '\' OR action LIKE 'CERT\_%' ESCAPE '\'
   OR action = 'CERTIFICATE_GENERATED';
-- Known target organizations take precedence over the operator's organization.
UPDATE "AuditLog" a SET "organizationId" = o.id
FROM "Organization" o WHERE a."targetType" = 'Organization' AND a."targetId" = o.id;
CREATE INDEX "AuditLog_organizationId_category_createdAt_id_idx" ON "AuditLog"("organizationId",category,"createdAt",id);
CREATE INDEX "AuditLog_propertyId_createdAt_idx" ON "AuditLog"("propertyId","createdAt");
CREATE INDEX "AuditLog_expiresAt_idx" ON "AuditLog"("expiresAt");

-- Explicit per-table field allowlists. Secrets, account numbers, message bodies,
-- file locations and entire documents never enter the journal.
CREATE FUNCTION audit_capture_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prior JSONB := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  subsequent JSONB := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  rowdata JSONB;
  context JSONB := COALESCE(NULLIF(current_setting('app.audit_context', true), ''), '{}')::jsonb;
  delta JSONB := '{}'::jsonb;
  field TEXT;
  org TEXT;
  property TEXT;
  parent JSONB;
  aid TEXT;
  parent_type TEXT;
  parent_id TEXT;
  category_value TEXT;
  expiry TIMESTAMP(3);
  before_label TEXT;
  after_label TEXT;
BEGIN
  rowdata := CASE WHEN TG_OP = 'DELETE' THEN prior ELSE subsequent END;
  FOREACH field IN ARRAY string_to_array(TG_ARGV[0] || ',organizationId,propertyId', ',') LOOP
    IF (prior -> field) IS DISTINCT FROM (subsequent -> field) THEN
      delta := delta || jsonb_build_object(field, jsonb_build_object('before',prior -> field,'after',subsequent -> field));
      before_label := NULL; after_label := NULL;
      CASE field
        WHEN 'costTypeId' THEN
          SELECT name INTO before_label FROM "CostType" WHERE id = prior->>field;
          SELECT name INTO after_label FROM "CostType" WHERE id = subsequent->>field;
        WHEN 'accountId' THEN
          SELECT name INTO before_label FROM "LedgerAccount" WHERE id = prior->>field;
          SELECT name INTO after_label FROM "LedgerAccount" WHERE id = subsequent->>field;
        WHEN 'unitId' THEN
          SELECT label INTO before_label FROM "Unit" WHERE id = prior->>field;
          SELECT label INTO after_label FROM "Unit" WHERE id = subsequent->>field;
        WHEN 'propertyId' THEN
          SELECT name INTO before_label FROM "Property" WHERE id = prior->>field;
          SELECT name INTO after_label FROM "Property" WHERE id = subsequent->>field;
        ELSE NULL;
      END CASE;
      IF before_label IS NOT NULL OR after_label IS NOT NULL THEN
        delta := jsonb_set(delta, ARRAY[field], delta->field || jsonb_build_object('beforeLabel',before_label,'afterLabel',after_label));
      END IF;
    END IF;
  END LOOP;
  IF TG_TABLE_NAME = 'User' AND TG_OP = 'UPDATE' AND prior->'passwordHash' IS DISTINCT FROM subsequent->'passwordHash' THEN
    delta := delta || '{"passwordChanged":{"before":null,"after":true}}'::jsonb;
  END IF;
  -- Sensitive content is recorded as a change marker, never as a value/hash.
  FOREACH field IN ARRAY ARRAY['iban','bic','secretEnc','configJson','snapshot','storedName','belegStoredName','proofStoredName','contractStoredName','email','phone','name','street','zip','city'] LOOP
    IF (TG_TABLE_NAME IN ('User','IntegrationSetting') OR field IN ('iban','bic','snapshot','storedName','belegStoredName','proofStoredName','contractStoredName'))
       AND (prior->field) IS DISTINCT FROM (subsequent->field) THEN
      delta := delta || jsonb_build_object(field || 'Changed', jsonb_build_object('before',NULL,'after',true));
    END IF;
  END LOOP;
  IF delta = '{}'::jsonb THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  org := rowdata->>'organizationId';
  property := rowdata->>'propertyId';
  IF TG_TABLE_NAME = 'Property' THEN property := rowdata->>'id'; END IF;
  IF TG_TABLE_NAME = 'Organization' THEN org := rowdata->>'id'; END IF;
  IF rowdata ? 'unitId' AND property IS NULL THEN
    SELECT "propertyId" INTO property FROM "Unit" WHERE id = rowdata->>'unitId';
    IF property IS NULL AND TG_OP = 'DELETE' THEN
      SELECT "propertyId" INTO property FROM "AuditLog" WHERE "targetType" = 'Unit' AND "targetId" = rowdata->>'unitId' AND "schemaVersion" = 1 ORDER BY "createdAt" DESC, id DESC LIMIT 1;
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('EconomicPlanItem','StatementUnitAmount','StatementAccountCheck','MeetingAgendaItem','ResolutionVote','DocumentRecipient','PaymentAllocation','MeterReading') THEN
    CASE TG_TABLE_NAME
      WHEN 'EconomicPlanItem' THEN SELECT to_jsonb(p) INTO parent FROM "EconomicPlan" p WHERE id = rowdata->>'planId';
      WHEN 'StatementUnitAmount' THEN SELECT to_jsonb(p) INTO parent FROM "AnnualStatement" p WHERE id = rowdata->>'statementId';
      WHEN 'StatementAccountCheck' THEN SELECT to_jsonb(p) INTO parent FROM "AnnualStatement" p WHERE id = rowdata->>'statementId';
      WHEN 'MeetingAgendaItem' THEN SELECT to_jsonb(p) INTO parent FROM "OwnersMeeting" p WHERE id = rowdata->>'meetingId';
      WHEN 'ResolutionVote' THEN SELECT to_jsonb(p) INTO parent FROM "Resolution" p WHERE id = rowdata->>'resolutionId';
      WHEN 'DocumentRecipient' THEN SELECT to_jsonb(p) INTO parent FROM "Document" p WHERE id = rowdata->>'documentId';
      WHEN 'PaymentAllocation' THEN SELECT to_jsonb(p) INTO parent FROM "Booking" p WHERE id = rowdata->>'bookingId';
      WHEN 'MeterReading' THEN SELECT to_jsonb(p) INTO parent FROM "Meter" p WHERE id = rowdata->>'meterId';
    END CASE;
    IF parent IS NULL AND TG_OP = 'DELETE' THEN
      parent_type := CASE TG_TABLE_NAME WHEN 'EconomicPlanItem' THEN 'EconomicPlan' WHEN 'StatementUnitAmount' THEN 'AnnualStatement' WHEN 'StatementAccountCheck' THEN 'AnnualStatement' WHEN 'MeetingAgendaItem' THEN 'OwnersMeeting' WHEN 'ResolutionVote' THEN 'Resolution' WHEN 'DocumentRecipient' THEN 'Document' WHEN 'PaymentAllocation' THEN 'Booking' WHEN 'MeterReading' THEN 'Meter' END;
      parent_id := COALESCE(rowdata->>'planId',rowdata->>'statementId',rowdata->>'meetingId',rowdata->>'resolutionId',rowdata->>'documentId',rowdata->>'bookingId',rowdata->>'meterId');
      SELECT jsonb_build_object('organizationId',"organizationId",'propertyId',"propertyId") INTO parent FROM "AuditLog" WHERE "targetType" = parent_type AND "targetId" = parent_id AND "schemaVersion" = 1 ORDER BY "createdAt" DESC,id DESC LIMIT 1;
    END IF;
    org := COALESCE(org,parent->>'organizationId');
    property := COALESCE(property,parent->>'propertyId');
    IF property IS NULL AND parent->>'unitId' IS NOT NULL THEN
      SELECT "propertyId" INTO property FROM "Unit" WHERE id = parent->>'unitId';
    END IF;
  END IF;
  IF property IS NOT NULL THEN
    org := COALESCE((SELECT "organizationId" FROM "Property" WHERE id = property), org);
    IF org IS NULL AND TG_OP = 'DELETE' THEN
      SELECT "organizationId" INTO org FROM "AuditLog" WHERE "targetType"='Property' AND "targetId"=property AND "schemaVersion"=1 ORDER BY "createdAt" DESC,id DESC LIMIT 1;
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'CraftsmanAssignment' THEN
    SELECT "organizationId" INTO org FROM "User" WHERE id = rowdata->>'userId';
  END IF;
  IF TG_TABLE_NAME = 'CraftsmanInvoice' THEN
    SELECT "propertyId" INTO property FROM "Ticket" WHERE id = rowdata->>'ticketId';
  END IF;
  -- Context cannot silently relabel a row belonging to another tenant.
  IF org IS NOT NULL AND context->>'organizationId' IS NOT NULL AND org <> context->>'organizationId'
     AND context->>'actorKind' <> 'SUPPORT' THEN RAISE EXCEPTION 'Audit organization mismatch'; END IF;
  aid := context->>'actorId';
  IF NOT EXISTS(SELECT 1 FROM "User" WHERE id = aid) THEN aid := NULL; END IF;
  category_value := CASE WHEN TG_TABLE_NAME IN ('User','PropertyAssignment','CraftsmanAssignment','IntegrationSetting','Organization') THEN 'SECURITY' ELSE 'JOURNAL' END;
  IF category_value = 'SECURITY' AND context->>'securityRetentionDays' ~ '^[0-9]{1,4}$' THEN
    IF (context->>'securityRetentionDays')::integer BETWEEN 1 AND 3650 THEN
      expiry := (clock_timestamp() AT TIME ZONE 'UTC') + make_interval(days => (context->>'securityRetentionDays')::integer);
    END IF;
  END IF;
  INSERT INTO "AuditLog" (id,"organizationId","propertyId",category,"schemaVersion",
    "actorId","actorName","actorKind","effectiveActorId","requestId",action,operation,
    "targetType","targetId",changes,"createdAt","expiresAt")
  VALUES (gen_random_uuid()::text,org,property,
    category_value,
    1,aid,context->>'actorName',COALESCE(context->>'actorKind','UNKNOWN'),context->>'effectiveActorId',
    context->>'requestId','RECORD_' || TG_OP,TG_OP,TG_TABLE_NAME,rowdata->>'id',delta,clock_timestamp() AT TIME ZONE 'UTC',expiry);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DO $$
DECLARE entry RECORD;
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('Booking','kind,bookingDate,valueDate,amountCents,laborShareCents,text,reference,costTypeId,accountId,unitId,craftsmanId,reversalOfId,transferGroupId,transferOut,importBatchId,bauabzugCents,bauabzugAngemeldetAt,belegFileName'),
    ('CostType','name,distributionKey,category,laborShareType,laborSharePercent,heatingCost,heatingConsumptionPercent,constructionWork,recoverableBetrKV,active,orderIndex'),
    ('LedgerAccount','name,kind,openingBalanceCents,openingBalanceDate,active'),
    ('BankImportBatch','fileName,rowsImported,rowsSkipped'),
    ('EconomicPlan','year,status,resolvedAt,validFrom,validUntil,resolutionNote,hausgeldRounding,beiratReviewStatus'),
    ('EconomicPlanItem','planId,costTypeId,amountCents,previousActualCents'),
    ('AnnualStatement','year,status,finalizedAt,beiratReviewStatus'),
    ('StatementUnitAmount','statementId,unitId,costTypeId,amountCents'),
    ('StatementAccountCheck','statementId,accountId,reportedEndCents'),
    ('DuePosting','unitId,source,amountCents,dueDate,periodYear,periodMonth,planId,sonderumlageId'),
    ('PaymentAllocation','bookingId,duePostingId,amountCents'),
    ('UnitOwnership','unitId,userId,sharePercent,validFrom,validTo'),
    ('Property','name,managementType,meaTotal,votingPrinciple,fiscalYearStartMonth,mahnkostenCents,dueDayRule,dueDayOfMonth,hausgeldRounding,active'),
    ('Unit','label,unitType,stellplatzTyp,livingArea,mea,personCount,floor,orderIndex'),
    ('Meter','unitId,type,meterNumber,location,remoteReadable'),
    ('MeterReading','meterId,value,readingDate'),
    ('OwnerMotion','title,type,status,resolutionId,meetingId,decidedAt'),
    ('BeiratTask','title,done'),
    ('Ownership','userId,propertyId,mea,voteUnits,isBoardMember'),
    ('Tenancy','userId,unitId,active,startDate,endDate,bkPrepaymentMonthlyCents'),
    ('HausgeldMahnung','unitId,level,arrearsCents,paymentDeadline,sentAt,interestCents,feeCents'),
    ('Sonderumlage','title,totalAmountCents,distributionKey,dueDate,resolutionNote'),
    ('Verbindlichkeit','title,kind,amountCents,incurredOn,dueDate,settledAt'),
    ('SepaMandate','unitId,mandateRef,signedDate,sequence,active'),
    ('Co2Allocation','year,totalCo2Cents,emissionsKg'),
    ('MaintenanceMeasure','title,trade,targetYear,estimatedCents,done'),
    ('MaintenanceTask','title,interval,lastDoneAt,dueDate,active,craftsmanId'),
    ('Resolution','title,description,number,status,decidedAt,majority,deadline'),
    ('ResolutionVote','resolutionId,userId,choice,castByUserId,proofFileName'),
    ('OwnersMeeting','title,scheduledAt,status,invitationSentAt,protocolGeneratedAt'),
    ('MeetingAgendaItem','meetingId,title,type,resolutionId,sortOrder'),
    ('Document','title,category,audience,propertyId,unitId,fileName'),
    ('DocumentRecipient','documentId,userId'),
    ('Ticket','title,status,priority,propertyId,unitId,assignedToId,craftsmanId,closedAt,externalReleasedAt'),
    ('CraftsmanInvoice','ticketId,craftsmanId,amountCents,status,reviewedAt'),
    ('User','role,isSuperAdmin,isPlatformAdmin,active,anonymizedAt,totpEnabledAt,mfaEmailEnabledAt,sessionsValidFrom'),
    ('PropertyAssignment','userId,propertyId'),
    ('CraftsmanAssignment','userId,craftsmanId'),
    ('IntegrationSetting','provider,enabled'),
    ('Organization','active,accountType,plan,subscriptionStatus')
  ) AS t(tab,fields) LOOP
    EXECUTE format('CREATE TRIGGER audit_change BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_capture_change(%L)',entry.tab,entry.fields);
  END LOOP;
END $$;

-- Lifecycle metadata has its own narrow permissions. IP removal is deliberate;
-- normal application access cannot overwrite the evidence payload.
CREATE FUNCTION audit_guard_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT OLD."legalHold" AND OLD."expiresAt" IS NOT NULL AND OLD."expiresAt" < (now() AT TIME ZONE 'UTC') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Audit evidence cannot be deleted before expiry';
  END IF;
  -- Preservation can be enabled without rewriting evidence. Releasing a hold
  -- is deliberately a privileged, documented operator procedure, not an app edit.
  IF NOT OLD."legalHold" AND NEW."legalHold" AND (to_jsonb(NEW) - 'legalHold') = (to_jsonb(OLD) - 'legalHold') THEN
    INSERT INTO "AuditLog" (id,"organizationId","propertyId",category,"schemaVersion","actorKind",action,"targetType","targetId","createdAt")
    VALUES (gen_random_uuid()::text,OLD."organizationId",OLD."propertyId",'SECURITY',1,'UNKNOWN','AUDIT_HOLD_SET','AuditLog',OLD.id,clock_timestamp() AT TIME ZONE 'UTC');
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'ip' - 'actorId' - 'actorName') = (to_jsonb(OLD) - 'ip' - 'actorId' - 'actorName')
     AND (NEW.ip IS NOT DISTINCT FROM OLD.ip OR (NEW.ip IS NULL AND NOT OLD."legalHold" AND OLD."createdAt" < (now() AT TIME ZONE 'UTC') - interval '90 days'))
     AND (NEW."actorName" IS NOT DISTINCT FROM OLD."actorName" OR (NEW."actorName" IS NULL AND NOT OLD."legalHold" AND EXISTS(SELECT 1 FROM "User" WHERE id=OLD."actorId" AND "anonymizedAt" IS NOT NULL)))
     AND (NEW."actorId" IS NOT DISTINCT FROM OLD."actorId" OR (NEW."actorId" IS NULL AND NOT EXISTS(SELECT 1 FROM "User" WHERE id=OLD."actorId"))) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Audit evidence is append-only';
END $$;
CREATE TRIGGER audit_guard BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION audit_guard_change();
-- Respect the existing user anonymization workflow: remove the additional
-- actor-name snapshot unless a preservation hold explicitly requires it.
CREATE FUNCTION audit_anonymize_actor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."anonymizedAt" IS NOT NULL AND OLD."anonymizedAt" IS NULL THEN
    UPDATE "AuditLog" SET "actorName" = NULL WHERE "actorId" = NEW.id AND NOT "legalHold" AND "actorName" IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_anonymize_actor AFTER UPDATE OF "anonymizedAt" ON "User" FOR EACH ROW EXECUTE FUNCTION audit_anonymize_actor();
COMMIT;
