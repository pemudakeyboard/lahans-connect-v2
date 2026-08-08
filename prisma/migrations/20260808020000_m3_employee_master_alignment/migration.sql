-- M3: Employee master alignment to the source-of-truth template
-- (docs/Source of truth/data_pegawai_master.pdf). Adds the guide columns the
-- schema was missing: ALAMAT, AGAMA, STATUS PTKP, BPJS numbers, REKAN/KELUARGA
-- contact, and the GOLONGAN (job_grade) FK. Applied with `prisma migrate deploy`.

-- 1. New employee columns (nullable, so existing rows are unaffected)
ALTER TABLE "employees" ADD COLUMN "address" TEXT;
ALTER TABLE "employees" ADD COLUMN "religion" TEXT;
ALTER TABLE "employees" ADD COLUMN "tax_status_ptkp" TEXT;
ALTER TABLE "employees" ADD COLUMN "bpjs_tk_number" TEXT;
ALTER TABLE "employees" ADD COLUMN "bpjs_kes_number" TEXT;
ALTER TABLE "employees" ADD COLUMN "emergency_contact_name" TEXT;
ALTER TABLE "employees" ADD COLUMN "emergency_contact_phone" TEXT;
ALTER TABLE "employees" ADD COLUMN "emergency_contact_relation" TEXT;
ALTER TABLE "employees" ADD COLUMN "job_grade_id" UUID;

-- 2. Indexes to match Prisma-generated shape
CREATE INDEX "employees_job_grade_id_idx" ON "employees"("job_grade_id");

-- 3. FK for the new job_grade relation (matches job_position style: RESTRICT)
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_grade_id_fkey"
    FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;