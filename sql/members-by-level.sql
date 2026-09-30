-- แยกองค์ประชุมตามระดับ (ตำบล / อำเภอ / จังหวัด)
-- รันใน Supabase → SQL Editor

-- อนุญาตให้ subdistrict_id ว่าง (องค์ประชุมระดับอำเภอ/จังหวัด)
ALTER TABLE public.members
  ALTER COLUMN subdistrict_id DROP NOT NULL;

-- คอลัมน์ระดับอำเภอ / จังหวัด
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE CASCADE;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS province_id uuid REFERENCES public.provinces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS members_district_idx ON public.members(district_id);
CREATE INDEX IF NOT EXISTS members_province_idx ON public.members(province_id);

-- Policy: อ่าน/เขียนตามระดับ
DROP POLICY IF EXISTS "read_members" ON public.members;
DROP POLICY IF EXISTS "write_members" ON public.members;
DROP POLICY IF EXISTS "members_select" ON public.members;
DROP POLICY IF EXISTS "members_write" ON public.members;

CREATE POLICY "members_select" ON public.members
FOR SELECT TO authenticated
USING (
  public.is_central()
  OR (public.my_role() = 'province' AND (
        province_id = public.my_province_id()
        OR district_id IN (SELECT id FROM public.districts WHERE province_id = public.my_province_id())
        OR subdistrict_id IN (
          SELECT s.id FROM public.subdistricts s
          JOIN public.districts d ON d.id = s.district_id
          WHERE d.province_id = public.my_province_id()
        )
      ))
  OR (public.my_role() = 'district' AND (
        district_id = public.my_district_id()
        OR subdistrict_id IN (SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id())
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);

CREATE POLICY "members_write" ON public.members
FOR ALL TO authenticated
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
