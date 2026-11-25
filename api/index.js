/* A Vercel executa uma função para todas as rotas da API.
   O vercel.json mapeia cada caminho permitido para ?route=... . */
import {handle} from '../lib/server.js';
const ROUTES = new Set(['state','request','cancel','command',
  'admin/status','admin/state','admin/login','admin/logout',
  'admin/approve','admin/reject','admin/reject-all','admin/revoke',
  'admin/reset-signals','admin/reset-demo','bridge/sync']);
export default (req,res) => {
  const u=new URL(req.url,'http://localhost');
  const route=String(req.query?.route||u.searchParams.get('route')||u.pathname.replace(/^\/api\//,'')||'');
  if (!ROUTES.has(route))return res.status(404).json({error:'Rota não encontrada.'});
  return handle(req,res,route);
};
