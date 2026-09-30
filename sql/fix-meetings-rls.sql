-- แก้ให้ อำเภอ / จังหวัด / ส่วนกลาง บันทึกการประชุมได้
-- รันทั้งก้อนใน Supabase → SQL Editor

CREATE OR REPLACE FUNCTION public.is_central()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'central' AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_subdistrict_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT subdistrict_id FROM public.profiles WHERE id = auth.uid() AND active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_district_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT district_id FROM public.profiles WHERE id = auth.uid() AND active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_province_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT province_id FROM public.profiles WHERE id = auth.uid() AND active = true LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_central() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_subdistrict_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_district_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_province_id() TO authenticated;

-- ลบ policy เก่า
DROP POLICY IF EXISTS "read_meetings" ON public.meetings;
DROP POLICY IF EXISTS "write_meetings" ON public.meetings;
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

-- อ่านตามเขต
CREATE POLICY "meetings_select" ON public.meetings
FOR SELECT TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND (
        province_id = public.my_province_id()
        OR subdistrict_id IN (
          SELECT s.id FROM public.subdistricts s
          JOIN public.districts d ON d.id = s.district_id
          WHERE d.province_id = public.my_province_id()
        )
      ))
  OR (public.my_role() = 'district' AND (
        district_id = public.my_district_id()
        OR subdistrict_id IN (
          SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id()
        )
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

-- บันทึก/แก้ไข/ลบ ตามเขต (รวมจังหวัด)
CREATE POLICY "meetings_insert" ON public.meetings
FOR INSERT TO authenticated
WITH CHECK (
  public.is_central()
  OR (public.my_role() = 'province' AND subdistrict_id IN (
        SELECT s.id FROM public.subdistricts s
        JOIN public.districts d ON d.id = s.district_id
        WHERE d.province_id = public.my_province_id()
      ))
  OR (public.my_role() = 'district' AND subdistrict_id IN (
        SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id()
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

CREATE POLICY "meetings_update" ON public.meetings
FOR UPDATE TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND subdistrict_id IN (
        SELECT s.id FROM public.subdistricts s
        JOIN public.districts d ON d.id = s.district_id
        WHERE d.province_id = public.my_province_id()
      ))
  OR (public.my_role() = 'district' AND subdistrict_id IN (
        SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id()
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
)
WITH CHECK (
  public.is_central()
  OR (public.my_role() = 'province' AND subdistrict_id IN (
        SELECT s.id FROM public.subdistricts s
        JOIN public.districts d ON d.id = s.district_id
        WHERE d.province_id = public.my_province_id()
      ))
  OR (public.my_role() = 'district' AND subdistrict_id IN (
        SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id()
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

CREATE POLICY "meetings_delete" ON public.meetings
FOR DELETE TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND subdistrict_id IN (
        SELECT s.id FROM public.subdistricts s
        JOIN public.districts d ON d.id = s.district_id
        WHERE d.province_id = public.my_province_id()
      ))
  OR (public.my_role() = 'district' AND subdistrict_id IN (
        SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id()
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

-- members: ให้จังหวัดแก้ไขในเขตได้ด้วย
DROP POLICY IF EXISTS "members_write" ON public.members;
DROP POLICY IF EXISTS "write_members" ON public.members;

CREATE POLICY "members_write" ON public.members
FOR ALL TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND subdistrict_id IN (
        SELECT s.id FROM public.subdistricts s
        JOIN public.districts d ON d.id = s.district_id
        WHERE d.province_id = public.my_province_id()
      ))
  OR (public.my_role() = 'district' AND subdistrict_id IN (
        SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id()
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
)
WITH CHECK (
  public.is_central()
  OR (public.my_role() = 'province' AND subdistrict_id IN (
        SELECT s.id FROM public.subdistricts s
        JOIN public.districts d ON d.id = s.district_id
        WHERE d.province_id = public.my_province_id()
      ))
  OR (public.my_role() = 'district' AND subdistrict_id IN (
        SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id()
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);
