-- Baseline: production schema as of 2026-09-28 (pg_dump --schema-only --schema=public), plus storage
-- buckets/policies at the end. Already applied on production — only run on fresh databases.

--
-- PostgreSQL database dump
--

\restrict iOBZegRr7OpYdUjnYLHoQpVvATBKLA9heQX0ZwJWNK3DMuY5m1wbSmZeLmWBVXC

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: delete_athlete("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."delete_athlete"("p_athlete_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_avatar_url text;
begin
  select avatar_url into v_avatar_url from athletes where id = p_athlete_id;

  delete from programs where athlete_id = p_athlete_id;
  delete from athletes where id = p_athlete_id;

  if not found then
    raise exception 'Athlete could not be deleted (not found, or your account is not allowed to delete athletes)';
  end if;

  return v_avatar_url;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: athletes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."athletes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "surname" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text"
);


--
-- Name: block_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."block_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "block_id" "uuid",
    "exercise_id" "uuid",
    "sets" integer,
    "reps" "text",
    "kg" "text",
    "rest_seconds" integer,
    "notes" "text",
    "order_index" integer NOT NULL
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_id" "uuid",
    "name" "text" NOT NULL,
    "order_index" integer NOT NULL
);


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "video_url" "text"
);


--
-- Name: program_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."program_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid",
    "name" "text" NOT NULL,
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "title" "text" NOT NULL,
    "public_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(6), 'hex'::"text") NOT NULL,
    "is_public" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text"
);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");


--
-- Name: admins admins_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_user_id_key" UNIQUE ("user_id");


--
-- Name: athletes athletes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_pkey" PRIMARY KEY ("id");


--
-- Name: block_exercises block_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."block_exercises"
    ADD CONSTRAINT "block_exercises_pkey" PRIMARY KEY ("id");


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");


--
-- Name: program_days program_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."program_days"
    ADD CONSTRAINT "program_days_pkey" PRIMARY KEY ("id");


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");


--
-- Name: programs programs_public_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_public_token_key" UNIQUE ("public_token");


--
-- Name: admins admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: block_exercises block_exercises_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."block_exercises"
    ADD CONSTRAINT "block_exercises_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;


--
-- Name: block_exercises block_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."block_exercises"
    ADD CONSTRAINT "block_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");


--
-- Name: blocks blocks_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "public"."program_days"("id") ON DELETE CASCADE;


--
-- Name: program_days program_days_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."program_days"
    ADD CONSTRAINT "program_days_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;


--
-- Name: programs programs_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;


--
-- Name: athletes Admins can delete athletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete athletes" ON "public"."athletes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: blocks Enable block delete for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable block delete for admins" ON "public"."blocks" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: block_exercises Enable block exercises delete for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable block exercises delete for admins" ON "public"."block_exercises" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: block_exercises Enable delete for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for admins" ON "public"."block_exercises" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: blocks Enable delete for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for admins" ON "public"."blocks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: program_days Enable delete for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for admins" ON "public"."program_days" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: programs Enable delete for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for admins" ON "public"."programs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: exercises Enable exercises delete for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable exercises delete for admins" ON "public"."exercises" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: athletes Enable insert for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for admins" ON "public"."athletes" FOR INSERT WITH CHECK (true);


--
-- Name: athletes Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users only" ON "public"."athletes" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: block_exercises Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users only" ON "public"."block_exercises" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: blocks Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users only" ON "public"."blocks" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: exercises Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users only" ON "public"."exercises" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: program_days Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users only" ON "public"."program_days" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: programs Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users only" ON "public"."programs" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: admins Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON "public"."admins" FOR SELECT USING (true);


--
-- Name: athletes Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON "public"."athletes" FOR SELECT USING (true);


--
-- Name: block_exercises Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON "public"."block_exercises" FOR SELECT USING (true);


--
-- Name: blocks Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON "public"."blocks" FOR SELECT USING (true);


--
-- Name: exercises Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON "public"."exercises" FOR SELECT USING (true);


--
-- Name: program_days Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON "public"."program_days" FOR SELECT USING (true);


--
-- Name: programs Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON "public"."programs" FOR SELECT USING (true);


--
-- Name: athletes Enable update for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for admins" ON "public"."athletes" FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: block_exercises Enable update for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for admins" ON "public"."block_exercises" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: blocks Enable update for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for admins" ON "public"."blocks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: exercises Enable update for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for admins" ON "public"."exercises" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: program_days Enable update for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for admins" ON "public"."program_days" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: programs Enable update for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update for admins" ON "public"."programs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));


--
-- Name: admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."admins" ENABLE ROW LEVEL SECURITY;

--
-- Name: athletes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."athletes" ENABLE ROW LEVEL SECURITY;

--
-- Name: block_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."block_exercises" ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;

--
-- Name: program_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."program_days" ENABLE ROW LEVEL SECURITY;

--
-- Name: programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "delete_athlete"("p_athlete_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."delete_athlete"("p_athlete_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_athlete"("p_athlete_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_athlete"("p_athlete_id" "uuid") TO "service_role";


--
-- Name: TABLE "admins"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."admins" TO "anon";
GRANT ALL ON TABLE "public"."admins" TO "authenticated";
GRANT ALL ON TABLE "public"."admins" TO "service_role";


--
-- Name: TABLE "athletes"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."athletes" TO "anon";
GRANT ALL ON TABLE "public"."athletes" TO "authenticated";
GRANT ALL ON TABLE "public"."athletes" TO "service_role";


--
-- Name: TABLE "block_exercises"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."block_exercises" TO "anon";
GRANT ALL ON TABLE "public"."block_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."block_exercises" TO "service_role";


--
-- Name: TABLE "blocks"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";


--
-- Name: TABLE "exercises"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";


--
-- Name: TABLE "program_days"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."program_days" TO "anon";
GRANT ALL ON TABLE "public"."program_days" TO "authenticated";
GRANT ALL ON TABLE "public"."program_days" TO "service_role";


--
-- Name: TABLE "programs"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict iOBZegRr7OpYdUjnYLHoQpVvATBKLA9heQX0ZwJWNK3DMuY5m1wbSmZeLmWBVXC


--
-- Storage: buckets + policies (copied from production's storage.buckets / pg_policies)
--

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('exercise-videos', 'exercise-videos', true, NULL, NULL),
  ('AtheletesImages', 'AtheletesImages', true, 5242880, '{image/png,image/jpeg,image/jpg,image/webp}')
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can delete videos" ON storage.objects FOR DELETE
  USING (bucket_id = 'exercise-videos' AND EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));
CREATE POLICY "Admins can upload athlete images" ON storage.objects TO authenticated
  USING (bucket_id = 'AtheletesImages') WITH CHECK (bucket_id = 'AtheletesImages');
CREATE POLICY "Admins can upload videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'exercise-videos' AND EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));
-- Typo 'AthletesImages' is in production too (harmless: the bucket is public, so reads don't need a policy)
CREATE POLICY "Anyone can view athlete images" ON storage.objects FOR SELECT
  USING (bucket_id = 'AthletesImages');
CREATE POLICY "Anyone can view videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'exercise-videos');
