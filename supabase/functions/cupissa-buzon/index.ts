import { createClient } from 'npm:@supabase/supabase-js@2';

// Buzón CUPISSA: autenticación administrativa y envío servidor-a-servidor.
// Secrets (Supabase): CUPISSA_MAILER_URL, CUPISSA_MAILER_SECRET, CUPISSA_ADMIN_EMAIL.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son proporcionados por Supabase.
const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const emailOK = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length <= 254;
const safeText = (v: unknown) => String(v ?? '').trim().slice(0, 200);
const adminDb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireAdmin(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const { data, error } = await adminDb.auth.getUser(token);
  if (error || !data?.user) return false;
  const allowed = env('CUPISSA_ADMIN_EMAIL').trim().toLowerCase();
  return !!allowed && data.user.email?.trim().toLowerCase() === allowed;
}

// Se consultan los clientes únicamente en el servidor, jamás con service_role en el navegador.
async function listClients() {
  const clients = new Map<string, {e: string; n: string}>();
  const counts: Record<string, number> = {clientes_web: 0, clientes: 0};
  const warnings: string[] = [];
  let succeeded = 0;
  // Dos orígenes distintos: una tabla inaccesible no debe impedir leer la otra.
  const tables = [
    {name: 'clientes_web', columns: 'id,nombres,apellidos,correo'},
    {name: 'clientes', columns: 'id,nombre,correo'},
  ];
  for (const table of tables) {
    let tableOK = true;
    for (let from = 0; from < 500000; from += 1000) {
      const {data, error} = await adminDb.from(table.name).select(table.columns).range(from, from + 999);
      if (error) { warnings.push(`${table.name}: ${error.message}`); tableOK = false; break; }
      counts[table.name] += data?.length || 0;
      for (const row of data || []) {
        const e = safeText(row.correo).toLowerCase();
        if (!emailOK(e)) continue;
        const n = safeText([row.nombres, row.apellidos].filter(Boolean).join(' ') || row.nombre);
        if (!clients.has(e) || (!clients.get(e)?.n && n)) clients.set(e, {e, n});
      }
      if (!data || data.length < 1000) break;
    }
    if (tableOK) succeeded++;
  }
  if (!succeeded) throw new Error('No se pudo consultar ninguna tabla: '+warnings.join(' | '));
  return {clients: [...clients.values()].sort((a,b)=>a.n.localeCompare(b.n,'es',{sensitivity:'base'}) || a.e.localeCompare(b.e)), counts, warnings};
}

function cleanHtml(html: string) {
  // El remitente controla el editor, pero se eliminan etiquetas ejecutables y cargas locales.
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}
function plain(html: string) { return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
function personalize(value: string, name: string) { return value.replace(/{{nombre}}/gi, name); }

async function deliver(to: string, subject: string, html: string, idempotencyKey: string) {
  const url = env('CUPISSA_MAILER_URL');
  const secret = env('CUPISSA_MAILER_SECRET');
  if (!url || !secret) throw new Error('Configura CUPISSA_MAILER_URL y CUPISSA_MAILER_SECRET en Supabase Secrets.');
  if (!url.startsWith('https://')) throw new Error('CUPISSA_MAILER_URL debe utilizar HTTPS.');
  const response = await fetch(url, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-cupissa-mailer-secret': secret},
    body: JSON.stringify({ to, subject, html, text: plain(html), idempotencyKey, fromName: 'CUPISSA', secret }),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let result: {ok?: boolean; error?: string} = {};
  try { result = JSON.parse(raw); } catch { /* invalid provider response */ }
  if (!response.ok || result.ok !== true) throw new Error(`Proveedor de correo: ${result.error || 'respuesta no confirmada'} (${response.status})`);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ok:false,error:'Método no permitido'}, 405);
  try {
    if (!await requireAdmin(req)) return json({ok:false,error:'Sesión de administrador no válida. Inicia sesión nuevamente.'},403);
    const body = await req.json();
    if (body.action === 'list_clients') return json({ ok: true, ...await listClients() });
    if (body.action === 'upload_image') {
      const raw = String(body.image || '');
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(raw);
      if (!match || raw.length > 2800000) return json({ok:false,error:'Imagen inválida o mayor de 2 MB.'},400);
      const type = match[1];
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      if (bytes.length > 2000000) return json({ok:false,error:'La imagen supera 2 MB.'},400);
      const bucket = 'buzon-imagenes';
      // El bucket debe crearse previamente como público desde Supabase Storage.
      const ext = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
      const key = `${crypto.randomUUID()}.${ext}`;
      const {error: uploadError} = await adminDb.storage.from(bucket).upload(key, bytes, {contentType:type,cacheControl:'31536000',upsert:false});
      if (uploadError) throw new Error('Storage buzon-imagenes: '+uploadError.message);
      const {data:publicData} = adminDb.storage.from(bucket).getPublicUrl(key);
      return json({ok:true,url:publicData.publicUrl});
    }
    if (body.action !== 'send_campaign') return json({ok:false,error:'Acción desconocida.'},400);
    if (!Array.isArray(body.recipients) || body.recipients.length < 1 || body.recipients.length > 20)
      return json({ok:false,error:'Envía de 1 a 20 destinatarios por lote.'},400);
    if (typeof body.subject !== 'string' || !body.subject.trim() || body.subject.length > 250 || /[\r\n]/.test(body.subject))
      return json({ok:false,error:'Asunto no válido.'},400);
    if (typeof body.html !== 'string' || body.html.length < 1 || body.html.length > 140000)
      return json({ok:false,error:'Contenido HTML no válido (máximo 140 KB).'},400);
    if (/src\s*=\s*["']?\s*data:/i.test(body.html))
      return json({ok:false,error:'Usa URL pública HTTPS para imágenes; el servicio no admite imágenes base64 incrustadas.'},400);
    if (!/^[\w-]{8,100}$/.test(String(body.campaign_id || '')))
      return json({ok:false,error:'Identificador de campaña inválido.'},400);
    const unique = new Set<string>();
    const recipients: {e:string;n:string}[] = [];
    for (const c of body.recipients) {
      const e = safeText(c?.e).toLowerCase();
      if (!emailOK(e)) return json({ok:false,error:'Destinatario no válido.'},400);
      if (!unique.has(e)) {unique.add(e); recipients.push({e,n:safeText(c?.n) || 'Cliente'});}
    }
    const errors: {email:string;error:string}[] = [];
    let sent = 0;
    const html = cleanHtml(body.html);
    for (const c of recipients) {
      try {
        const recipientHtml = personalize(html, c.n);
        const subject = personalize(body.subject, c.n);
        await deliver(c.e, subject, recipientHtml, `buzon:${body.campaign_id}:${c.e}`);
        sent++;
      } catch (error) {
        console.error('[cupissa-buzon] send failed', c.e, String(error));
        errors.push({email:c.e,error:String(error).slice(0,250)});
      }
    }
    return json({ok:true,sent,errors});
  } catch (error) {
    console.error('[cupissa-buzon]', error);
    return json({ok:false,error:String(error).slice(0,350)},500);
  }
});
