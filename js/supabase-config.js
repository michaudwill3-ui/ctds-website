/* =====================================================================
   CTDS — Supabase configuration
   Project: ctds
   The anon key below is safe to expose in the browser — Row Level
   Security is what protects your data. Never put the service_role key here.
   ===================================================================== */

const SUPABASE_URL      = "https://sdqyumtraqwdelvyiqpf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcXl1bXRyYXF3ZGVsdnlpcXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzMyMDYsImV4cCI6MjEwMDk0OTIwNn0.myYhCAW3lbvE-7L5G-C8XYMfejN5igOHHhLactAco-4";

// Creates the global client used across the site (loaded via CDN UMD build).
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);