CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.opp_status AS ENUM ('visible','soon','hidden');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  university text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_ar text,
  description text,
  description_ar text,
  category text NOT NULL,
  organization text,
  location text,
  deadline date,
  apply_url text,
  image_url text,
  status public.opp_status NOT NULL DEFAULT 'visible',
  featured boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can view visible opportunities" ON public.opportunities FOR SELECT TO anon, authenticated USING (status <> 'hidden');
CREATE POLICY "admins manage opportunities" ON public.opportunities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can view partners" ON public.partners FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage partners" ON public.partners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.saved_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_opportunities TO authenticated;
GRANT ALL ON public.saved_opportunities TO service_role;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved" ON public.saved_opportunities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_opps_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.opportunities (title, title_ar, description, description_ar, category, organization, location, deadline, apply_url, featured) VALUES
('Global Innovation Challenge','تحدي الابتكار العالمي','A worldwide competition for student innovators.','مسابقة عالمية لمبتكري الطلاب.','competition','UN Innovation Lab','Online','2026-09-30','https://example.com/apply/1', true),
('Fulbright Scholarship 2027','منحة فولبرايت 2027','Fully funded graduate scholarship in the USA.','منحة دراسات عليا ممولة بالكامل في أمريكا.','scholarship','Fulbright','USA','2026-11-15','https://example.com/apply/2', true),
('Red Crescent Volunteering','تطوع الهلال الأحمر','Join community relief programs.','انضم لبرامج الإغاثة المجتمعية.','volunteering','Red Crescent','Cairo','2026-08-20','https://example.com/apply/3', false),
('Junior Frontend Developer','مطور واجهات مبتدئ','Entry-level frontend role for fresh graduates.','وظيفة واجهات أمامية للخريجين الجدد.','job','Nexus Tech','Remote','2026-08-31','https://example.com/apply/4', false);

INSERT INTO public.partners (name, website_url) VALUES
('Nexus Tech','https://example.com'),
('Youth Hub','https://example.com'),
('EduBridge','https://example.com');

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.site_store (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_store TO anon;
GRANT SELECT ON public.site_store TO authenticated;
GRANT ALL ON public.site_store TO service_role;
ALTER TABLE public.site_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can read site store" ON public.site_store
  FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER update_site_store_updated_at
  BEFORE UPDATE ON public.site_store
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();