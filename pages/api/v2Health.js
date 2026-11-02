export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    environment: process.env.VERCEL_ENV || null,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
