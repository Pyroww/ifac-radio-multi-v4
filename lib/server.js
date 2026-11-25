/* IFAC Rádio em Movimento — API v1.0.
   Serverless stateless: fila, sessões e semáforos persistidos no Supabase.
   As chaves secretas e a senha do expositor nunca saem desta camada. */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const VISITOR_COOKIE = 'ifac_multi4_visitante';
const ADMIN_COOKIE = 'ifac_multi4_expositor';
const TARGETS = new Set(['SEM-001','SEM-002']);
const KINDS = new Set(['red','yellow','green','off','auto']);

function ensureSecrets(){
  if (!/^https:\/\//.test(process.env.SUPABASE_URL || '') ||
      !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
    throw new HttpError(503,'Configure SUPABASE_URL e SUPABASE_SECRET_KEY na Vercel.');
  if ((process.env.SESSION_SECRET || '').length < 32)
    throw new HttpError(503,'Configure SESSION_SECRET com pelo menos 32 caracteres.');
  if ((process.env.ADMIN_PASSWORD || '').length < 12)
    throw new HttpError(503,'Configure ADMIN_PASSWORD com pelo menos 12 caracteres.');
}
class HttpError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
function mac(value){
  return createHmac('sha256',process.env.SESSION_SECRET).update(value).digest('base64url');
}
function sign(value){return 'v1.'+value+'.'+mac('v1.'+value);}
function verify(value){
  if (!value || value.length > 2000 || !value.startsWith('v1.')) return null;
  const ix=value.lastIndexOf('.');
  if (ix <= 3) return null;
  const body=value.slice(3,ix);
  const expect=mac('v1.'+body),actual=value.slice(ix+1);
  if (actual.length!==expect.length || !timingSafeEqual(Buffer.from(actual),Buffer.from(expect))) return null;
  return body;
}
function readCookies(req){
  const jar={};
  for (const part of String(req.headers.cookie||'').split(';')){
    const ix=part.indexOf('=');
    if(ix<=0)continue;
    jar[part.slice(0,ix).trim()]=part.slice(ix+1).trim();
  }
  return jar;
}
function visitorId(req,res){
  const value=verify(readCookies(req)[VISITOR_COOKIE]);
  if(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))return value;
  const id=randomUUID();
  setCookie(req,res,VISITOR_COOKIE,sign(id),60*60*24*7,'Lax');
  return id;
}
function adminOk(req){
  const value=verify(readCookies(req)[ADMIN_COOKIE]);
  if(!value)return false;
  try{
    const data=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    return data.role==='admin' && Number.isFinite(data.exp) && data.exp>Date.now();
  }catch{return false;}
}
function setCookie(req,res,name,value,maxAge,sameSite='Lax'){
  const host=String(req.headers.host||'');
  const secure=!(host.startsWith('localhost:') || host.startsWith('127.0.0.1:'));
  const parts=[`${name}=${value}`,'Path=/','HttpOnly',`SameSite=${sameSite}`,`Max-Age=${maxAge}`];
  if(secure)parts.push('Secure');
  res.setHeader('Set-Cookie',parts.join('; '));
}
function requireOrigin(req){
  const origin=String(req.headers.origin||'');
  if(!origin)throw new HttpError(403,'Requisição sem origem de navegador.');
  try{
    const parsed=new URL(origin);
    const host=String(req.headers.host||'');
    if(parsed.host!==host || !['http:','https:'].includes(parsed.protocol))throw Error();
  }catch{throw new HttpError(403,'Origem não autorizada.');}
}
function requestBody(req){
  const data=req.body;
  if(!data || typeof data!=='object' || Array.isArray(data))throw new HttpError(400,'Corpo JSON inválido.');
  if(JSON.stringify(data).length>3000)throw new HttpError(413,'Solicitação excede o tamanho permitido.');
  return data;
}
function ipDigest(req){
  // Somente para limitação de abuso; o IP não é armazenado em claro.
  const raw=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,100);
  return createHmac('sha256',process.env.SESSION_SECRET).update('ip:'+raw).digest('hex');
}
async function rpc(name,params){
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/'+name;
  const headers={'apikey':key,'Content-Type':'application/json','Accept':'application/json'};
  if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
  let response;
  try{
    response=await fetch(url,{method:'POST',headers,body:JSON.stringify(params),signal:AbortSignal.timeout(10000)});
  }catch{
    throw new HttpError(503,'Não foi possível conectar ao Supabase.');
  }
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    if(data.code==='P0001' || data.code==='23514' || data.code==='23505')
      throw new HttpError(409,data.message||'Operação não permitida.');
    if(response.status===429)throw new HttpError(429,'Muitas requisições; tente novamente.');
    console.error('Supabase RPC',name,response.status,data.code||'erro');
    throw new HttpError(503,'Falha no banco de dados. Confira a instalação do SQL e as variáveis da Vercel.');
  }
  return data;
}
function output(res,data,status=200){
  res.status(status).json(data);
}
function onlyMethod(req,expected){
  if(req.method!==expected)throw new HttpError(405,'Método não permitido.');
}
export async function handle(req,res,route){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Cookie');
  try{
    ensureSecrets();
    // Ponte Python: autenticacao por token separado da senha do expositor.
    // O Python conversa com esta API; a API persiste informacoes no Supabase.
    if (route==='bridge/sync') {
      onlyMethod(req,'POST');
      const expected=process.env.BRIDGE_TOKEN||'';
      if(expected.length<32)throw new HttpError(503,'Configure BRIDGE_TOKEN com pelo menos 32 caracteres.');
      const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
      const a=Buffer.from(supplied),b=Buffer.from(expected);
      if(a.length!==b.length || !timingSafeEqual(a,b))throw new HttpError(401,'Token da ponte invalido.');
      const body=requestBody(req);
      const owner=String(body.owner||'');
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner))throw new HttpError(400,'Identidade da ponte inválida.');
      const stations={};
      for(const id of TARGETS){
        const r=body.stations?.[id]||{};
        stations[id]={online:r.online===true,cycle_capable:r.cycle_capable===true,output:r.output||null,recovering:r.recovering===true,rssi:Number.isInteger(r.rssi)&&r.rssi>=0&&r.rssi<255?r.rssi:null,resets:Number.isSafeInteger(r.resets)&&r.resets>=0?r.resets:null};
      }
      return output(res,await rpc('ifac_multi4_sync',{p_owner:owner,p_tx:body.tx_online===true,p_stations:stations,p_report:body.report||null,p_busy:body.busy===true}));
    }
    const isAdmin=route.startsWith('admin/');
    if(isAdmin){
      const act=route.slice(6);
      if(act==='status'){
        onlyMethod(req,'GET');
        return output(res,{authenticated:adminOk(req),local:false});
      }
      if(act==='login'){
        onlyMethod(req,'POST');requireOrigin(req);
        const body=requestBody(req);
        const given=String(body.pin||'').slice(0,256);
        const correct=process.env.ADMIN_PASSWORD;
        const a=Buffer.from(given),b=Buffer.from(correct);
        const matches=a.length===b.length && timingSafeEqual(a,b);
        const allowed=await rpc('ifac_multi4_login_gate',{p_ip_hash:ipDigest(req),p_correct:matches});
        if(!allowed)throw new HttpError(429,'Muitas tentativas. Aguarde dez minutos.');
        if(!matches)throw new HttpError(401,'Senha do expositor incorreta.');
        const ticket=Buffer.from(JSON.stringify({role:'admin',exp:Date.now()+8*60*60*1000})).toString('base64url');
        setCookie(req,res,ADMIN_COOKIE,sign(ticket),8*60*60,'Strict');
        return output(res,{ok:true});
      }
      if(act==='logout'){
        onlyMethod(req,'POST');requireOrigin(req);
        setCookie(req,res,ADMIN_COOKIE,'',0,'Strict');
        return output(res,{ok:true});
      }
      if(!adminOk(req))throw new HttpError(401,'Faça login no painel administrativo.');
      if(act==='state'){
        onlyMethod(req,'GET');
        return output(res,await rpc('ifac_multi4_state',{p_id:null,p_admin:true}));
      }
      onlyMethod(req,'POST');requireOrigin(req);
      const allowedActions=new Set(['approve','reject','reject-all','revoke','reset-signals','reset-demo']);
      if(!allowedActions.has(act))throw new HttpError(404,'Ação administrativa desconhecida.');
      const body=requestBody(req);
      if(['approve','reject'].includes(act)&&!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id||'')))
        throw new HttpError(400,'Identificador do visitante inválido.');
      return output(res,await rpc('ifac_multi4_do',{p_action:'admin/'+act,p_id:['approve','reject'].includes(act)?body.id:null,p_body:body,p_ip_hash:ipDigest(req)}));
    }

    const vid=visitorId(req,res);
    if(route==='state'){
      onlyMethod(req,'GET');
      return output(res,await rpc('ifac_multi4_state',{p_id:vid,p_admin:false}));
    }
    if(!['request','cancel','command'].includes(route))throw new HttpError(404,'Rota desconhecida.');
    onlyMethod(req,'POST');requireOrigin(req);
    const body=requestBody(req);
    if(route==='request'){
      body.name=String(body.name||'Visitante').replace(/\s+/g,' ').trim().slice(0,30)||'Visitante';
    }
    if(route==='command'){
      if(!TARGETS.has(body.target_id))throw new HttpError(400,'ID do semáforo inválido.');
      if(!KINDS.has(body.kind))throw new HttpError(400,'Comando inválido.');
      if(body.kind==='auto'){
        for(const key of ['green','yellow','red']){
          if(!Number.isInteger(body[key])||body[key]<2||body[key]>30)
            throw new HttpError(400,'Os tempos devem ser números inteiros entre 2 e 30 segundos.');
        }
      }
    }
    return output(res,await rpc('ifac_multi4_do',{p_action:route,p_id:vid,p_body:body,p_ip_hash:ipDigest(req)}));
  }catch(e){
    if(!(e instanceof HttpError))console.error('API unexpected error',route,e?.message||e);
    res.status(e instanceof HttpError ? e.status : 500).json({error:e instanceof HttpError?e.message:'Erro interno. Verifique os logs do servidor.'});
  }
}
