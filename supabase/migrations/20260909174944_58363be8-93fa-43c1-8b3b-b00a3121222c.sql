CREATE OR REPLACE FUNCTION public.sgm_exec_sql(sql text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.sgm_exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sgm_exec_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.sgm_exec_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sgm_exec_sql(text) TO service_role;