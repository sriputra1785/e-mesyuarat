-- ให้บันทึกการประชุมได้หลายระดับ (ตำบล / อำเภอ / จังหวัด / ส่วนกลาง)
-- รันใน Supabase → SQL Editor

-- 1) อนุญาตให้ subdistrict_id ว่างได้ (การประชุมระดับอำเภอ/จังหวัด)
ALTER TABLE public.meetings
  ALTER COLUMN subdistrict_id DROP NOT NULL;

-- 2) Policy ใหม่
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;
DROP POLICY IF EXISTS "read_meetings" ON public.meetings;
DROP POLICY IF EXISTS "write_meetings" ON public.meetings;

CREATE POLICY "meetings_select" ON public.meetings
FOR SELECT TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND province_id = public.my_province_id())
  OR (public.my_role() = 'district' AND (
        district_id = public.my_district_id()
        OR subdistrict_id IN (SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id())
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

CREATE POLICY "meetings_insert" ON public.meetings
FOR INSERT TO authenticated
WITH CHECK (
  public.is_central()
  OR (public.my_role() = 'province' AND province_id = public.my_province_id()
      AND district_id IS NULL AND subdistrict_id IS NULL)
  OR (public.my_role() = 'district' AND district_id = public.my_district_id()
      AND subdistrict_id IS NULL)
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

CREATE POLICY "meetings_update" ON public.meetings
FOR UPDATE TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND province_id = public.my_province_id()
      AND district_id IS NULL AND subdistrict_id IS NULL)
  OR (public.my_role() = 'district' AND district_id = public.my_district_id()
      AND subdistrict_id IS NULL)
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
)
WITH CHECK (
  public.is_central()
  OR (public.my_role() = 'province' AND province_id = public.my_province_id()
      AND district_id IS NULL AND subdistrict_id IS NULL)
  OR (public.my_role() = 'district' AND district_id = public.my_district_id()
      AND subdistrict_id IS NULL)
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

CREATE POLICY "meetings_delete" ON public.meetings
FOR DELETE TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND province_id = public.my_province_id()
      AND district_id IS NULL AND subdistrict_id IS NULL)
  OR (public.my_role() = 'district' AND district_id = public.my_district_id()
      AND subdistrict_id IS NULL)
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);
