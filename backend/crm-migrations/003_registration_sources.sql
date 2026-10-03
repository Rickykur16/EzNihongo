-- Also covers a fresh CRM activation after main migration 201 has already run.
ALTER TABLE marketing_leads DROP CONSTRAINT marketing_leads_source_check;
ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_source_check
  CHECK (source IN ('referral','instagram','tiktok','facebook','youtube','google','whatsapp','website','event','other'));
ALTER TABLE marketing_channel_spend DROP CONSTRAINT marketing_channel_spend_source_check;
ALTER TABLE marketing_channel_spend ADD CONSTRAINT marketing_channel_spend_source_check
  CHECK (source IN ('referral','instagram','tiktok','facebook','youtube','google','whatsapp','website','event','other'));
