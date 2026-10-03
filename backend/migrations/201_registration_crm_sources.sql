-- Expand source attribution for CRM installations already active in production.
-- CRM remains optional on sites that have not enabled its separate migrations.
DO $$
BEGIN
  IF to_regclass('marketing_leads') IS NOT NULL THEN
    ALTER TABLE marketing_leads DROP CONSTRAINT marketing_leads_source_check;
    ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_source_check
      CHECK (source IN ('referral','instagram','tiktok','facebook','youtube','google','whatsapp','website','event','other'));
  END IF;
  IF to_regclass('marketing_channel_spend') IS NOT NULL THEN
    ALTER TABLE marketing_channel_spend DROP CONSTRAINT marketing_channel_spend_source_check;
    ALTER TABLE marketing_channel_spend ADD CONSTRAINT marketing_channel_spend_source_check
      CHECK (source IN ('referral','instagram','tiktok','facebook','youtube','google','whatsapp','website','event','other'));
  END IF;
END $$;
