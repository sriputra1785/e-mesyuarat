-- องค์ประชุมหลายระดับ (ตำบล / อำเภอ / จังหวัด)
-- รันทั้งก้อนใน Supabase → SQL Editor

ALTER TABLE public.members
  ALTER COLUMN subdistrict_id DROP NOT NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE CASCADE;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS province_id uuid REFERENCES public.provinces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS members_district_idx ON public.members(district_id);
CREATE INDEX IF NOT EXISTS members_province_idx ON public.members(province_id);

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

DROP POLICY IF EXISTS "read_members" ON public.members;
DROP POLICY IF EXISTS "write_members" ON public.members;
DROP POLICY IF EXISTS "members_select" ON public.members;
DROP POLICY IF EXISTS "members_write" ON public.members;
DROP POLICY IF EXISTS "members_insert" ON public.members;
DROP POLICY IF EXISTS "members_update" ON public.members;
DROP POLICY IF EXISTS "members_delete" ON public.members;

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
  OR (public.my_role() = 'province' AND (
        (province_id = public.my_province_id() AND district_id IS NULL AND subdistrict_id IS NULL)
        OR district_id IN (SELECT id FROM public.districts WHERE province_id = public.my_province_id())
        OR subdistrict_id IN (
          SELECT s.id FROM public.subdistricts s
          JOIN public.districts d ON d.id = s.district_id
          WHERE d.province_id = public.my_province_id()
        )
      ))
  OR (public.my_role() = 'district' AND (
        (district_id = public.my_district_id() AND subdistrict_id IS NULL)
        OR subdistrict_id IN (SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id())
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
)
WITH CHECK (
  public.is_central()
  OR (public.my_role() = 'province' AND (
        (province_id = public.my_province_id() AND district_id IS NULL AND subdistrict_id IS NULL)
        OR district_id IN (SELECT id FROM public.districts WHERE province_id = public.my_province_id())
        OR subdistrict_id IN (
          SELECT s.id FROM public.subdistricts s
          JOIN public.districts d ON d.id = s.district_id
          WHERE d.province_id = public.my_province_id()
        )
      ))
  OR (public.my_role() = 'district' AND (
        (district_id = public.my_district_id() AND subdistrict_id IS NULL)
        OR subdistrict_id IN (SELECT id FROM public.subdistricts WHERE district_id = public.my_district_id())
      ))
  OR (public.my_role() = 'subdistrict' AND subdistrict_id = public.my_subdistrict_id())
);
