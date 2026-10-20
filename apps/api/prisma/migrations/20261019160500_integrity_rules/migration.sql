-- ─────────────────────────────────────────────────────────────────────────────
-- Règles d'intégrité imposées par la base (défense en profondeur).
--
-- L'API applique déjà ces règles ; la base les garantit même en cas d'erreur
-- applicative ou d'intervention manuelle. Toute correction passe par un
-- mécanisme tracé (avenant, version corrigée de CRA, annulation motivée).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Contraintes de cohérence ────────────────────────────────────────────────

ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK (email = lower(email));

ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_hours_range" CHECK (hours > 0 AND hours <= 24);
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_period_order" CHECK ("periodEnd" >= "periodStart");
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_total_non_negative" CHECK ("totalHours" >= 0);
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_on_behalf_reason"
  CHECK (NOT "approvedOnBehalf" OR ("approvalReason" IS NOT NULL AND length(trim("approvalReason")) > 0));

ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE "Availability" ADD CONSTRAINT "Availability_period_order" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_period_order" CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_budget_order" CHECK ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMax" >= "budgetMin");
ALTER TABLE "FreelancerProfile" ADD CONSTRAINT "Profile_rate_order" CHECK ("rateMin" IS NULL OR "rateMax" IS NULL OR "rateMax" >= "rateMin");

ALTER TABLE "CommercialProposal" ADD CONSTRAINT "Proposal_amounts_non_negative"
  CHECK (("freelanceRate" IS NULL OR "freelanceRate" >= 0) AND ("clientRate" IS NULL OR "clientRate" >= 0)
     AND ("commissionValue" IS NULL OR "commissionValue" >= 0));
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "Proposal_hours_per_day_range"
  CHECK ("hoursPerDay" IS NULL OR ("hoursPerDay" > 0 AND "hoursPerDay" <= 24));
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "Proposal_percentage_range"
  CHECK ("commissionMode" IS DISTINCT FROM 'PERCENTAGE' OR "commissionValue" IS NULL OR "commissionValue" <= 100);

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_period_order" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_amounts_non_negative"
  CHECK ("freelanceRate" >= 0 AND "clientRate" >= 0 AND ("commissionValue" IS NULL OR "commissionValue" >= 0));
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_day_unit_requires_hours"
  CHECK ("billingUnit" <> 'DAY' OR ("hoursPerDay" IS NOT NULL AND "hoursPerDay" > 0 AND "hoursPerDay" <= 24));
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_commission_defined"
  CHECK ("commissionPayer" = 'NONE' OR ("commissionMode" IS NOT NULL AND "commissionValue" IS NOT NULL
     AND ("commissionMode" <> 'PERCENTAGE' OR "commissionBase" IS NOT NULL)));
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_percentage_range"
  CHECK ("commissionMode" IS DISTINCT FROM 'PERCENTAGE' OR "commissionValue" <= 100);

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_consistent"
  CHECK ("amountExclTax" >= 0 AND "taxAmount" >= 0 AND "amountInclTax" = "amountExclTax" + "taxAmount");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paid_range" CHECK ("paidAmount" >= 0 AND "paidAmount" <= "amountInclTax");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dates_order" CHECK ("dueDate" >= "issueDate");

ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_amount_positive" CHECK (amount > 0);
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_reference_present" CHECK (length(trim(reference)) > 0);
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_amount_positive" CHECK (amount > 0);
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_reference_present" CHECK (length(trim(reference)) > 0);

ALTER TABLE "Document" ADD CONSTRAINT "Document_size_positive" CHECK ("sizeBytes" > 0);

-- ── Journal d'audit en ajout seul ───────────────────────────────────────────

CREATE FUNCTION empgt_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EMPGT_IMMUTABLE: % sur % interdit (%)', TG_OP, TG_TABLE_NAME, TG_ARGV[0]
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION empgt_reject_change('journal d''audit en ajout seul');

-- ── Contrat : conditions figées dès la création ─────────────────────────────

CREATE FUNCTION empgt_contract_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.reference, OLD."proposalId", OLD."missionId", OLD."applicationId", OLD."companyId", OLD."profileId",
      OLD."startDate", OLD."endDate", OLD.currency, OLD."billingUnit", OLD."hoursPerDay",
      OLD."freelanceRate", OLD."clientRate", OLD."commissionPayer", OLD."commissionMode",
      OLD."commissionBase", OLD."commissionValue", OLD."commissionNote",
      OLD."commissionVisibleToCompany", OLD."commissionVisibleToFreelancer",
      OLD."expensesPolicy", OLD."taxNote", OLD."timesheetValidationRule",
      OLD."clientPaymentTermsDays", OLD."freelancerPaymentTermsDays", OLD."paymentTermsNote",
      OLD."freelancerInvoiceAddressee", OLD."partiesSnapshot"::text, OLD."termsSnapshot"::text, OLD."termsHash",
      OLD."createdById", OLD."createdAt")
     IS DISTINCT FROM
     (NEW.reference, NEW."proposalId", NEW."missionId", NEW."applicationId", NEW."companyId", NEW."profileId",
      NEW."startDate", NEW."endDate", NEW.currency, NEW."billingUnit", NEW."hoursPerDay",
      NEW."freelanceRate", NEW."clientRate", NEW."commissionPayer", NEW."commissionMode",
      NEW."commissionBase", NEW."commissionValue", NEW."commissionNote",
      NEW."commissionVisibleToCompany", NEW."commissionVisibleToFreelancer",
      NEW."expensesPolicy", NEW."taxNote", NEW."timesheetValidationRule",
      NEW."clientPaymentTermsDays", NEW."freelancerPaymentTermsDays", NEW."paymentTermsNote",
      NEW."freelancerInvoiceAddressee", NEW."partiesSnapshot"::text, NEW."termsSnapshot"::text, NEW."termsHash",
      NEW."createdById", NEW."createdAt") THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: les conditions d''un contrat sont figées ; utiliser un avenant'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD."signedDocumentId" IS NOT NULL AND
     (OLD."signedDocumentId", OLD."signedAt", OLD."signatureProofNote", OLD."signatureRecordedById")
       IS DISTINCT FROM
     (NEW."signedDocumentId", NEW."signedAt", NEW."signatureProofNote", NEW."signatureRecordedById") THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: le dépôt du contrat signé ne peut pas être remplacé'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.status IN ('COMPLETED', 'TERMINATED', 'CANCELLED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: un contrat clôturé ne change plus de statut'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Contract_terms_immutable"
  BEFORE UPDATE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION empgt_contract_guard();

CREATE TRIGGER "Contract_no_delete"
  BEFORE DELETE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION empgt_reject_change('un contrat ne se supprime pas ; l''annuler');

-- ── Avenant : figé une fois signé ou annulé ─────────────────────────────────

CREATE FUNCTION empgt_amendment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('SIGNED', 'CANCELLED') THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: un avenant signé ou annulé est figé' USING ERRCODE = 'P0001';
  END IF;
  IF (OLD."contractId", OLD.number, OLD.type, OLD."effectiveDate", OLD."newEndDate", OLD."newFreelanceRate",
      OLD."newClientRate", OLD."newHoursPerDay", OLD."newCommissionValue", OLD."changesSnapshot"::text)
     IS DISTINCT FROM
     (NEW."contractId", NEW.number, NEW.type, NEW."effectiveDate", NEW."newEndDate", NEW."newFreelanceRate",
      NEW."newClientRate", NEW."newHoursPerDay", NEW."newCommissionValue", NEW."changesSnapshot"::text) THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: le contenu d''un avenant ne se modifie pas ; l''annuler et en créer un nouveau'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ContractAmendment_guard"
  BEFORE UPDATE ON "ContractAmendment"
  FOR EACH ROW EXECUTE FUNCTION empgt_amendment_guard();

CREATE TRIGGER "ContractAmendment_no_delete"
  BEFORE DELETE ON "ContractAmendment"
  FOR EACH ROW EXECUTE FUNCTION empgt_reject_change('un avenant ne se supprime pas ; l''annuler');

-- ── CRA : lignes modifiables uniquement en brouillon ou correction demandée ─

CREATE FUNCTION empgt_timesheet_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM "Timesheet"
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."timesheetId" ELSE NEW."timesheetId" END;
  -- Parent absent : suppression en cascade d'un brouillon déjà contrôlée par le trigger du CRA.
  IF parent_status IS NOT NULL AND parent_status NOT IN ('DRAFT', 'CHANGES_REQUESTED') THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: les lignes d''un CRA % ne sont pas modifiables', parent_status
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."timesheetId" IS DISTINCT FROM OLD."timesheetId" THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: une ligne ne change pas de CRA' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "TimesheetEntry_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "TimesheetEntry"
  FOR EACH ROW EXECUTE FUNCTION empgt_timesheet_entry_guard();

-- ── CRA : un CRA approuvé ne se modifie pas silencieusement ─────────────────

CREATE FUNCTION empgt_timesheet_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'EMPGT_IMMUTABLE: seul un CRA brouillon peut être supprimé' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  IF (OLD."contractId", OLD."periodStart", OLD."periodEnd", OLD.version, OLD."supersedesId")
     IS DISTINCT FROM (NEW."contractId", NEW."periodStart", NEW."periodEnd", NEW.version, NEW."supersedesId") THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: la période et la version d''un CRA sont figées' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.status IN ('SUPERSEDED', 'CANCELLED') THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: un CRA % est figé', OLD.status USING ERRCODE = 'P0001';
  END IF;

  IF OLD.status = 'APPROVED' THEN
    IF NEW.status NOT IN ('APPROVED', 'SUPERSEDED') THEN
      RAISE EXCEPTION 'EMPGT_IMMUTABLE: un CRA approuvé ne peut qu''être remplacé par une version corrigée'
        USING ERRCODE = 'P0001';
    END IF;
    IF (OLD."totalHours", OLD."amountsSnapshot"::text, OLD."approvedAt", OLD."approvedById",
        OLD."approvedOnBehalf", OLD."approvalReason", OLD."submittedAt", OLD."submittedById")
       IS DISTINCT FROM
       (NEW."totalHours", NEW."amountsSnapshot"::text, NEW."approvedAt", NEW."approvedById",
        NEW."approvedOnBehalf", NEW."approvalReason", NEW."submittedAt", NEW."submittedById") THEN
      RAISE EXCEPTION 'EMPGT_IMMUTABLE: un CRA approuvé ne se modifie pas ; créer une version corrigée'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Timesheet_guard"
  BEFORE UPDATE OR DELETE ON "Timesheet"
  FOR EACH ROW EXECUTE FUNCTION empgt_timesheet_guard();

-- ── Factures : montants déclarés figés, pas de suppression ──────────────────

CREATE FUNCTION empgt_invoice_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.kind, OLD.number, OLD."contractId", OLD."timesheetId", OLD."companyId", OLD."profileId",
      OLD."issuerLabel", OLD.addressee, OLD."issueDate", OLD."dueDate", OLD.currency,
      OLD."amountExclTax", OLD."taxAmount", OLD."amountInclTax", OLD."expectedAmountExclTax",
      OLD."documentId", OLD."submittedById", OLD."createdAt")
     IS DISTINCT FROM
     (NEW.kind, NEW.number, NEW."contractId", NEW."timesheetId", NEW."companyId", NEW."profileId",
      NEW."issuerLabel", NEW.addressee, NEW."issueDate", NEW."dueDate", NEW.currency,
      NEW."amountExclTax", NEW."taxAmount", NEW."amountInclTax", NEW."expectedAmountExclTax",
      NEW."documentId", NEW."submittedById", NEW."createdAt") THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: une facture déposée ne se modifie pas ; la refuser ou l''annuler puis redéposer'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD.status IN ('REJECTED', 'CANCELLED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: une facture % est figée', OLD.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Invoice_guard"
  BEFORE UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION empgt_invoice_guard();

CREATE TRIGGER "Invoice_no_delete"
  BEFORE DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION empgt_reject_change('une facture ne se supprime pas ; l''annuler');

-- ── Encaissements et règlements : seule l'annulation motivée est possible ───

CREATE FUNCTION empgt_money_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: un enregistrement annulé est figé' USING ERRCODE = 'P0001';
  END IF;
  IF (to_jsonb(OLD) - ARRAY['status', 'cancelledAt', 'cancelledById', 'cancelReason'])
     IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['status', 'cancelledAt', 'cancelledById', 'cancelReason']) THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: un paiement enregistré ne se modifie pas ; l''annuler avec un motif'
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status = 'CANCELLED' AND (NEW."cancelReason" IS NULL OR length(trim(NEW."cancelReason")) = 0) THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: motif d''annulation obligatoire' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PaymentRecord_guard"
  BEFORE UPDATE ON "PaymentRecord"
  FOR EACH ROW EXECUTE FUNCTION empgt_money_record_guard();
CREATE TRIGGER "PaymentRecord_no_delete"
  BEFORE DELETE ON "PaymentRecord"
  FOR EACH ROW EXECUTE FUNCTION empgt_reject_change('un encaissement ne se supprime pas');
CREATE TRIGGER "PayoutRecord_guard"
  BEFORE UPDATE ON "PayoutRecord"
  FOR EACH ROW EXECUTE FUNCTION empgt_money_record_guard();
CREATE TRIGGER "PayoutRecord_no_delete"
  BEFORE DELETE ON "PayoutRecord"
  FOR EACH ROW EXECUTE FUNCTION empgt_reject_change('un règlement ne se supprime pas');

-- ── Documents : contenu figé, suppression logique uniquement ────────────────

CREATE FUNCTION empgt_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD."storageKey", OLD.sha256, OLD."sizeBytes", OLD."mimeType", OLD."originalFilename", OLD."uploadedById", OLD."createdAt")
     IS DISTINCT FROM
     (NEW."storageKey", NEW.sha256, NEW."sizeBytes", NEW."mimeType", NEW."originalFilename", NEW."uploadedById", NEW."createdAt") THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: le contenu d''un document déposé est figé' USING ERRCODE = 'P0001';
  END IF;
  IF OLD."deletedAt" IS NOT NULL AND NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
    RAISE EXCEPTION 'EMPGT_IMMUTABLE: un document supprimé ne peut pas être restauré silencieusement' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Document_guard"
  BEFORE UPDATE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION empgt_document_guard();
CREATE TRIGGER "Document_no_delete"
  BEFORE DELETE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION empgt_reject_change('suppression logique uniquement (deletedAt)');

-- ── Journal des changements pour la synchronisation incrémentale ────────────
-- TG_ARGV[0] : type d'entité publié ; TG_ARGV[1] : colonne portant l'identifiant.

CREATE FUNCTION empgt_record_sync_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb;
  entity_id uuid;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  entity_id := (row_data ->> TG_ARGV[1])::uuid;
  IF entity_id IS NOT NULL THEN
    INSERT INTO "SyncChange" ("entityType", "entityId", operation)
    VALUES (TG_ARGV[0], entity_id,
            CASE WHEN TG_OP = 'DELETE' AND TG_ARGV[1] = 'id' THEN 'DELETE' ELSE 'UPSERT' END);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "FreelancerProfile_sync" AFTER INSERT OR UPDATE OR DELETE ON "FreelancerProfile"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('freelancer', 'id');
CREATE TRIGGER "FreelancerSkill_sync" AFTER INSERT OR UPDATE OR DELETE ON "FreelancerSkill"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('freelancer', 'profileId');
CREATE TRIGGER "Experience_sync" AFTER INSERT OR UPDATE OR DELETE ON "Experience"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('freelancer', 'profileId');
CREATE TRIGGER "Education_sync" AFTER INSERT OR UPDATE OR DELETE ON "Education"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('freelancer', 'profileId');
CREATE TRIGGER "Language_sync" AFTER INSERT OR UPDATE OR DELETE ON "Language"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('freelancer', 'profileId');
CREATE TRIGGER "Qualification_sync" AFTER INSERT OR UPDATE OR DELETE ON "Qualification"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('freelancer', 'profileId');
CREATE TRIGGER "Availability_sync" AFTER INSERT OR UPDATE OR DELETE ON "Availability"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('availability', 'id');
CREATE TRIGGER "Skill_sync" AFTER INSERT OR UPDATE OR DELETE ON "Skill"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('skill', 'id');
CREATE TRIGGER "Mission_sync" AFTER INSERT OR UPDATE OR DELETE ON "Mission"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('mission', 'id');
CREATE TRIGGER "MissionSkill_sync" AFTER INSERT OR UPDATE OR DELETE ON "MissionSkill"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('mission', 'missionId');
CREATE TRIGGER "Application_sync" AFTER INSERT OR UPDATE OR DELETE ON "Application"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('application', 'id');
CREATE TRIGGER "Contract_sync" AFTER INSERT OR UPDATE ON "Contract"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('contract', 'id');
CREATE TRIGGER "ContractAmendment_sync" AFTER INSERT OR UPDATE ON "ContractAmendment"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('contract', 'contractId');
CREATE TRIGGER "Timesheet_sync" AFTER INSERT OR UPDATE OR DELETE ON "Timesheet"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('cost', 'id');
CREATE TRIGGER "Review_sync" AFTER INSERT OR UPDATE OR DELETE ON "Review"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('review', 'id');
CREATE TRIGGER "Document_sync" AFTER INSERT OR UPDATE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION empgt_record_sync_change('document', 'id');
