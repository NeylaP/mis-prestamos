// Producción (GitHub Pages).
// Si existen las variables de Actions SUPABASE_URL y SUPABASE_ANON_KEY, el workflow
// "Publicar en GitHub Pages" las escribe aquí antes de compilar.
// Si no, se usan estos valores por defecto. La llave "anon" es pública por diseño:
// la protección la dan las políticas RLS. NUNCA pongas aquí la llave service_role.
export const environment = {
  production: true,
  supabaseUrl: 'https://qvxkqvlhzjdhohgxzbym.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2eGtxdmxoempkaG9oZ3h6YnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNTAzODEsImV4cCI6MjEwNzkyNjM4MX0.BLDP4Tg60xUNZq-8r6dxMyI7LA26r70QiHmup2wHki8',
};
