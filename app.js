const $=s=>document.querySelector(s),ed=$('#ed'),sig=$('#sig'),dlg=$('#dlg');
const PUBLIC_URL='https://lkdxtesgwqoizobxaawp.supabase.co';
const PUBLIC_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZHh0ZXNnd3FvaXpvYnhhYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODMxNjIsImV4cCI6MjEwNzY1OTE2Mn0.rDQ8n8O6I9uHY6z4goQCTFfRjE8zExkifIRWFbBLycE';
const ADMIN_EMAIL='contacto@cupissa.com';
const EDGE_NAME='cupissa-buzon';
// Logotipo oficial integrado: no depende de Ajustes ni de Supabase Storage.
const DEFAULT_LOGO_URL=new URL('./logo.png', document.baseURI).href;
// En correo se publica una copia permanente mediante Supabase Storage.
const MAIL_LOGO_KEY='cupissa_buzon_public_mail_logo_v1';
let cfg=JSON.parse(localStorage.getItem('cfg')||'{}'),al=[{sendAsEmail:ADMIN_EMAIL,displayName:'CUPISSA'}],cl=[],sel=new Set(),rg=null,files=[],gr='',emoTarget='e';
let deferredInstallPrompt=null, sending=false;
const F=['furl'];
const authdlg=$('#authdlg');
const sb=window.supabase.createClient(PUBLIC_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
cfg.surl=PUBLIC_URL;cfg.skey=PUBLIC_KEY;
const PRE={'Blanco limpio':['#f4f4f7','','#ffffff'],'Rosa suave':['#ffe4ec','linear-gradient(135deg,#ffe4ec,#ffd1e0)','#ffffff'],'Noche':['#1b1340','linear-gradient(135deg,#14142b,#2d1b69)','#ffffff'],'Cálido':['#ffe9c7','linear-gradient(135deg,#fff4e0,#ffd9a8)','#fffdf8'],'Océano':['#cfeaff','linear-gradient(135deg,#e0f4ff,#b3e0ff)','#ffffff']};
const EM='😀 😍 🥰 😎 🤩 🎉 🎁 🔥 ✨ ⭐ 💜 💖 👍 👏 🙌 💯 🛍️ 🛒 💸 🏷️ ⏰ 📣 📢 🚀 🌟 🍰 🎂 🍫 🌸 🌈 ☀️ 🎈 ❤️ ✅ 👉 📍 📞 💌 🎊 🏆'.split(' ');
const msg=t=>$('#msg').textContent=t,sleep=ms=>new Promise(r=>setTimeout(r,ms));
$('#pre').innerHTML=Object.keys(PRE).map(k=>`<option>${k}</option>`).join('');
$('#emo').innerHTML=EM.map(e=>`<span onmousedown="event.preventDefault()" onclick="putEmo('${e}')">${e}</span>`).join('');
function style(){$('#stage').style.cssText=`background:${$('#cbg').value};${gr?'background-image:'+gr:''}`;$('#card').style.background=$('#ccd').value}
function preset(){const p=PRE[$('#pre').value];$('#cbg').value=p[0];gr=p[1];$('#ccd').value=p[2];style()}
function logoUI(){$('#logo').innerHTML=`<img src="${DEFAULT_LOGO_URL}" alt="CUPISSA">`}
function openCfg(){F.forEach(k=>$('#'+k).value=cfg[k]||'');$('#surl').value=PUBLIC_URL;$('#skey').value=PUBLIC_KEY;dlg.showModal()}
function small(file,max,cb){const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/i.width),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);cb(c.toDataURL(file.type=='image/png'?'image/png':'image/jpeg',.88))};i.src=r.result};r.readAsDataURL(file)}
async function uploadImage(data){const result=await edge('upload_image',{image:data});return result.url}
function resized(file,max){return new Promise(resolve=>small(file,max,resolve))}
async function saveCfg(){F.forEach(k=>cfg[k]=$('#'+k).value.trim());localStorage.setItem('cfg',JSON.stringify({furl:cfg.furl}));logoUI();dlg.close()}
function login(){authdlg.showModal();$('#authPassword').focus()}
async function loginPassword(){const b=$('#authPassword');$('#authMsg').textContent='Validando acceso…';try{const {data,error}=await sb.auth.signInWithPassword({email:ADMIN_EMAIL,password:b.value});b.value='';if(error)throw error;if(data.user?.email?.toLowerCase()!==ADMIN_EMAIL){await sb.auth.signOut();throw Error('Esta cuenta no tiene autorización.')}authdlg.close();await refreshAuth()}catch(e){b.value='';$('#authMsg').textContent=e.message}}
async function logout(){await sb.auth.signOut();cl=[];sel.clear();renderClients();await refreshAuth()}
async function refreshAuth(){const {data}=await sb.auth.getUser();const ok=data.user?.email?.toLowerCase()===ADMIN_EMAIL;$('#who').textContent=ok?'Administrador autenticado':'Sin sesión';$('#bLogin').style.display=ok?'none':'';$('#bLogout').style.display=ok?'':'none';return ok}
async function edge(action,data={}){const {data:session,error:se}=await sb.auth.getSession();if(se||!session.session)throw Error('Inicia sesión como administrador.');if(session.session.user.email?.toLowerCase()!==ADMIN_EMAIL)throw Error('Administrador no autorizado.');let r;
try{r=await fetch(`${PUBLIC_URL}/functions/v1/${EDGE_NAME}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLIC_KEY,'Authorization':'Bearer '+session.session.access_token},body:JSON.stringify({action,...data})});}
catch(err){throw Error(`No se pudo conectar con ${EDGE_NAME} en Supabase. La función debe estar desplegada en el proyecto ${PUBLIC_URL}. Revisa Edge Functions → ${EDGE_NAME} y su configuración CORS. Detalle del navegador: ${String(err.message||err)}`);}
const raw=await r.text();let out={};try{out=JSON.parse(raw)}catch{}
if(!r.ok||!out.ok){const detail=out.error||out.msg||raw.slice(0,170)||'Respuesta no válida';throw Error(`${detail} (HTTP ${r.status}).`);}
return out}
/* ---- Instalación PWA ---- */
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('#bInstall').textContent='⬇ Instalar aplicación'});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;$('#bInstall').textContent='✓ Aplicación instalada'});
async function installApp(){
  if(deferredInstallPrompt){
    const promptEvent=deferredInstallPrompt;deferredInstallPrompt=null;
    promptEvent.prompt();await promptEvent.userChoice;
    return;
  }
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
  alert(ios?'Para instalar Buzón Cupissa en iPhone: abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio».':'Para instalar Buzón Cupissa: abre el menú del navegador (⋮) y selecciona «Instalar aplicación» o «Añadir a pantalla principal». La opción depende del navegador.');
}
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
/* ---- Firmas ---- */
function loadSig(){sig.innerHTML=localStorage.getItem('sig_'+ADMIN_EMAIL)||''}
sig.oninput=()=>localStorage.setItem('sig_'+ADMIN_EMAIL,sig.innerHTML);
/* ---- Destinatarios: consulta administrativa protegida vía función ---- */
async function loadClients(){
  msg('Consultando clientes en Supabase…');
  const btn=$('#loadClientsBtn');if(btn)btn.disabled=true;
  try {
    if(!await refreshAuth()) throw Error('Primero inicia sesión con la cuenta administrativa de Supabase.');
    const out=await edge('list_clients');
    cl=Array.isArray(out.clients)?out.clients:[];
    sel.clear();renderClients();
    const counts=out.counts||{};
    const problems=Array.isArray(out.warnings)?out.warnings:[];
    msg(`${cl.length} correos únicos cargados. Clientes web: ${counts.clientes_web??0}. Clientes del administrador: ${counts.clientes??0}.` + (problems.length?'\nAvisos: '+problems.join(' | '):'') + (cl.length?'\nSelecciona solamente clientes que autorizaron comunicaciones comerciales.':'\nNo se encontraron correos. Revisa los avisos o comprueba que la Edge Function esté publicada.'));
  }catch(e){console.error('[Buzón] Error al cargar clientes',e);msg('No se pudieron cargar los clientes: '+e.message+'\nVerifica que cupissa-buzon esté desplegada en Supabase y que hayas iniciado sesión con contacto@cupissa.com.');}
  finally{if(btn)btn.disabled=false;}
}
const escHTML=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function vis(){const q=$('#q').value.toLowerCase();return cl.filter(c=>(c.e+c.n).toLowerCase().includes(q))}
function renderClients(){const visible=vis();$('#list').innerHTML=visible.map(c=>`<label><input type="checkbox" data-email="${escHTML(c.e)}" ${sel.has(c.e)?'checked':''}><span>${escHTML(c.n||'(sin nombre)')}<small>${escHTML(c.e)}</small></span></label>`).join('');$('#cnt').textContent=sel.size+' seleccionados / '+cl.length+' correos cargados'}
$('#list').addEventListener('change',e=>{if(e.target.matches('input[data-email]'))tg(e.target.dataset.email,e.target.checked)});
function tg(e,v){v?sel.add(e):sel.delete(e);$('#cnt').textContent=sel.size+' seleccionados / '+cl.length+' correos cargados'}
function selAll(v){vis().forEach(c=>v?sel.add(c.e):sel.delete(c.e));renderClients()}
function addMan(){const e=$('#man').value.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))return msg('Correo inválido.');if(!cl.find(c=>c.e===e))cl.unshift({e,n:''});sel.add(e);$('#man').value='';renderClients()}
/* ---- Editor ---- */
const sv=()=>{const s=getSelection();if(s.rangeCount&&ed.contains(s.anchorNode))rg=s.getRangeAt(0)};
['keyup','mouseup','focus'].forEach(e=>ed.addEventListener(e,sv));
function rs(){ed.focus();if(rg){const s=getSelection();s.removeAllRanges();s.addRange(rg)}}
function cmd(c,v){rs();document.execCommand('styleWithCSS',false,true);document.execCommand(c,false,v);sv()}
function setSize(px){if(!px)return;rs();document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,7);ed.querySelectorAll('font[size="7"]').forEach(f=>{f.removeAttribute('size');f.style.fontSize=px+'px'});sv()}
function bump(d){rs();const s=getSelection();let n=s.anchorNode;if(n&&n.nodeType==3)n=n.parentElement;setSize(Math.max(8,parseInt(getComputedStyle(n||ed).fontSize)+d))}
function toggleEmo(){const e=$('#emo');e.style.display=e.style.display=='flex'?'none':'flex'}
function putEmo(e){if(emoTarget=='s'){const i=$('#subj'),p=i.selectionStart??i.value.length;i.value=i.value.slice(0,p)+e+i.value.slice(p);i.focus()}else cmd('insertText',e)}
function addLink(){const u=prompt('URL del enlace:','https://');if(u)cmd('createLink',u)}
function addBtn(k){const t=prompt('Texto del botón:',k=='Formulario'?'Llenar formulario':'¡Compra ahora!');if(!t)return;const u=prompt('URL de destino:',k=='Formulario'?(cfg.furl||'https://'):'https://');if(!u)return;const c=prompt('Color del botón (hex):','#7c3aed')||'#7c3aed';
cmd('insertHTML',`<div style="text-align:center;margin:18px 0"><a href="${u}" style="background:${c};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${t}</a></div><p><br></p>`)}
async function addImg(i){const f=i.files[0];i.value='';if(!f)return;try{msg('Subiendo imagen a Supabase Storage…');const url=await uploadImage(await resized(f,900));cmd('insertHTML',`<img src="${url}" style="max-width:100%;height:auto;border-radius:8px">`);msg('Imagen insertada correctamente.')}catch(e){msg('No se pudo subir la imagen: '+e.message)}}
function addFiles(i){[...i.files].forEach(f=>{const r=new FileReader();r.onload=()=>{files.push({name:f.name,type:f.type,data:r.result.split(',')[1]});$('#fl').textContent=files.map(x=>x.name).join(', ')};r.readAsDataURL(f)});i.value=''}
/* ---- Compatibilidad con correo: imágenes públicas y Unicode ---- */
// Los proveedores que re-codifican el HTML pueden corromper emojis.
// Entidades numéricas ASCII dejan el contenido legible incluso si el transporte
// del correo no conserva correctamente caracteres de 4 bytes.
function mailSafeUnicode(html){
  return html.replace(/[^\x00-\x7F]/gu, ch=>'&#'+ch.codePointAt(0)+';');
}
async function ensurePublicMailLogo(){
  const saved=localStorage.getItem(MAIL_LOGO_KEY);
  if(saved&&/^https:\/\/[^\s"'<>]+$/i.test(saved))return saved;
  const r=await fetch(DEFAULT_LOGO_URL,{cache:'no-store'});
  if(!r.ok)throw Error('No se pudo abrir logo.png ('+r.status+'). Comprueba que esté publicado en Buzón.');
  const blob=await r.blob();
  if(!blob.type.startsWith('image/'))throw Error('logo.png no devolvió una imagen válida.');
  if(blob.size>1900000)throw Error('El logo supera el tamaño admitido por Supabase Storage.');
  const dataUrl=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(Error('No se pudo leer el logo.'));
    reader.readAsDataURL(blob);
  });
  const result=await edge('upload_image',{image:dataUrl});
  if(!/^https:\/\/[^\s"'<>]+$/i.test(result.url||''))throw Error('Supabase no devolvió una URL pública del logo.');
  localStorage.setItem(MAIL_LOGO_KEY,result.url);
  return result.url;
}
/* ---- HTML y envío mediante Supabase Edge Function ---- */
function build(mailLogoUrl=DEFAULT_LOGO_URL){const logo=`<div style="text-align:center;padding-bottom:16px"><img src="${mailLogoUrl}" alt="CUPISSA" width="180" style="max-width:180px;width:100%;height:auto;border:0;display:block;margin:0 auto"><div style="font-family:Arial,Helvetica,sans-serif;color:#f4699a;letter-spacing:2px;font-size:12px;font-weight:bold;margin-top:6px">CUPISSA</div></div>`;const bg=$('#cbg').value;
return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:${bg}"><table width="100%" cellpadding="0" cellspacing="0" bgcolor="${bg}" style="background-color:${bg};${gr?'background-image:'+gr:''}"><tr><td align="center" style="padding:24px 12px"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${$('#ccd').value};border-radius:12px"><tr><td style="padding:28px;font-family:Arial,sans-serif;color:#222;font-size:16px;line-height:1.5">${logo}${ed.innerHTML}<div style="margin-top:24px;border-top:1px solid #eee;padding-top:12px">${sig.innerHTML}</div></td></tr></table></td></tr></table></body></html>`}
async function send(test){if(sending)return;const subj=$('#subj').value.trim();if(!subj)return msg('Falta el asunto.');if(!$('#consent').checked&&!test)return msg('Confirma el consentimiento de los destinatarios.');if(files.length)return msg('Los archivos adjuntos no están habilitados con el mailer actual. Retíralos antes de enviar.');
const to=test?[{e:ADMIN_EMAIL,n:'Prueba'}]:cl.filter(c=>sel.has(c.e));if(!to.length)return msg('Selecciona destinatarios.');if(!test&&!confirm(`Enviar ${to.length} correo(s) desde ${ADMIN_EMAIL}?`))return;
let mailLogoUrl;try{msg('Preparando logo público para el correo…');mailLogoUrl=await ensurePublicMailLogo()}catch(e){return msg('No se puede enviar el logo: '+e.message+'\nComprueba que el bucket buzon-imagenes sea público en Supabase Storage.')}
const html=mailSafeUnicode(build(mailLogoUrl));if(/src=["']data:/i.test(html))return msg('Las imágenes incrustadas no se pueden enviar mediante el mailer actual. Usa imágenes con URL pública HTTPS en la plantilla.');
if(html.length>140000)return msg('La plantilla supera el límite de 140 KB.');
sending=true;$('#sendBtn').disabled=$('#testBtn').disabled=true;let ok=0,bad=[];
try{for(let i=0;i<to.length;i+=20){msg(`Enviando ${Math.min(i+20,to.length)}/${to.length}… ✓ ${ok}, ✗ ${bad.length}`);let out;try{out=await edge('send_campaign',{subject:subj,html,recipients:to.slice(i,i+20),campaign_id:campaignId})}catch(e){bad.push(...to.slice(i,i+20).map(x=>x.e+' ('+e.message+')'));break}ok+=out.sent||0;bad.push(...(out.errors||[]).map(x=>x.email+' ('+x.error+')'));if(i+20<to.length)await sleep(500)}msg(`Envío terminado. Correos aceptados por el proveedor: ${ok}.`+(bad.length?`\nErrores: ${bad.join(', ')}`:''))}
finally{sending=false;$('#sendBtn').disabled=$('#testBtn').disabled=false}}
let campaignId=crypto.randomUUID();
ed.addEventListener('input',()=>campaignId=crypto.randomUUID());$('#subj').addEventListener('input',()=>campaignId=crypto.randomUUID());
logoUI();preset();loadSig();refreshAuth();

// Evita que el navegador restaure o autocomplemente un destinatario en el campo Asunto.
const subjectInput = $('#subj');
subjectInput.value = '';
subjectInput.defaultValue = '';
window.addEventListener('pageshow', event => {
  if (event.persisted) { subjectInput.value = ''; subjectInput.defaultValue = ''; }
});
