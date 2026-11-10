import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { connect, seed, transaction } from './db.js';
import { cleanText, profile, request, requireThat as check, slot, terms, trades, cities } from './domain.js';
import { marketplace } from './market.js';
import { extractionService } from './ai.js';

const id = z.coerce.number().int().positive();
const rating = z.number().int().min(1).max(5);
const bookingAction = z.discriminatedUnion('action', [
  z.object({action:z.literal('propose'),version:id,terms}),
  z.object({action:z.enum(['confirm','complete','reject','cancel']),version:id})
]);
const searchQuery = z.object({
  trade:z.enum(trades).optional(), city:z.enum(cities).optional(), locality:cleanText(90).optional(),
  available:z.enum(['true','false']).transform(v=>v==='true').optional(),
  minRating:z.coerce.number().min(1).max(5).optional(), minExperience:z.coerce.number().int().min(0).max(80).optional(),
  startsAt:z.string().optional(),endsAt:z.string().optional()
});
const demoUsers = "SELECT id,name,role FROM users ORDER BY id";
const presetMessages = [
  'Main available hoon.', 'Kitne bajay aana hai?', 'Meri price Rs. 1500 hai.', 'Theek hai, confirm kar dein.'
];

export function createApp({db=connect(), extract=extractionService(), now}={}) {
  seed(db);
  const market = marketplace(db,now);
  const app = express();
  const api = express.Router();
  app.disable('x-powered-by');
  app.use(express.json({limit:'2mb'}));
  app.use((_req,res,next) => {
    res.set('X-Content-Type-Options','nosniff');
    next();
  });
  app.use('/api', api);
  api.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  const actor = (req,role) => {
    const parsed = id.safeParse(req.get('x-demo-user'));
    const user = parsed.success && db.prepare('SELECT id,name,role FROM users WHERE id=?').get(parsed.data);
    check(user,401,'Select a fictional demo user.');
    check(!role || user.role===role,403,'Switch to the corresponding demo role.');
    return user;
  };
  const owner = (req,workerId) => check(actor(req,'worker').id===workerId,403,'Switch to this worker to edit their profile.');
  const booking = req => market.getBooking(id.parse(req.params.id),actor(req));
  api.get('/health', (_req,res) => res.json({ok:true,demo:true}));
  api.get('/demo-users', (_req,res) => res.json(db.prepare(demoUsers).all()));
  for (const [path,type] of [['worker-profile','profile'],['understand-job','job']]) {
    api.post('/ai/'+path,async (req,res) => {
      actor(req,type==='profile'?'worker':'customer');
      const {text} = z.object({text:cleanText(2000,3)}).parse(req.body);
      res.json(await extract(type,text));
    });
  }
  api.get('/workers',(req,res)=>{
    const filters = searchQuery.parse(req.query);
    if (filters.startsAt || filters.endsAt) Object.assign(filters,slot.parse(filters));
    res.json(market.search(filters));
  });
  api.get('/workers/:id',(req,res)=>res.json(market.worker(id.parse(req.params.id))));
  api.post('/workers',(req,res)=>res.status(201).json(market.saveWorker(actor(req,'worker').id,profile.parse(req.body),true)));
  api.patch('/workers/:id',(req,res)=>{
    const workerId=id.parse(req.params.id);
    owner(req,workerId);
    const current=market.worker(workerId);
    res.json(market.saveWorker(workerId,profile.parse({...current,accepting:Boolean(current.accepting),...req.body}),false));
  });
  api.get('/workers/:id/availability',(req,res)=>{
    const workerId=id.parse(req.params.id);
    const w=market.worker(workerId);
    const nowIso = (now?.() ?? new Date()).toISOString();
    res.json({accepting:Boolean(w.accepting),availableNow:w.available,occupied:market.blocked(workerId,nowIso,'9999-12-31T00:00:00.000Z')});
  });
  api.patch('/workers/:id/availability',(req,res)=>{
    const workerId=id.parse(req.params.id);
    owner(req,workerId);
    market.worker(workerId);
    const {accepting}=z.object({accepting:z.boolean()}).parse(req.body);
    db.prepare('UPDATE availability SET accepting=? WHERE workerId=?').run(Number(accepting),workerId);
    res.json(market.worker(workerId));
  });
  api.get('/workers/:id/reviews',(req,res)=>res.json(market.reviews(id.parse(req.params.id))));
  api.post('/service-requests',(req,res)=>{
    const customer=actor(req,'customer');
    const data=request.parse(req.body);
    const row=db.prepare('INSERT INTO service_requests(customerId,trade,problem,urgency,city,locality) VALUES(?,?,?,?,?,?)')
      .run(customer.id,data.trade,data.problem,data.urgency,data.city,data.locality);
    res.status(201).json({id:Number(row.lastInsertRowid),...data});
  });
  api.get('/service-requests',(req,res)=>res.json(db.prepare('SELECT * FROM service_requests WHERE customerId=? ORDER BY id DESC').all(actor(req,'customer').id)));
  api.get('/bookings',(req,res)=>res.json(market.listBookings(actor(req))));
  api.get('/bookings/:id',(req,res)=>res.json(booking(req)));
  api.post('/bookings',(req,res)=>{
    const data=z.object({requestId:id,workerId:id}).and(terms).parse(req.body);
    res.status(201).json(market.createBooking(actor(req,'customer'),data));
  });
  api.patch('/bookings/:id',(req,res)=>res.json(market.updateBooking(id.parse(req.params.id),actor(req),bookingAction.parse(req.body))));
  api.get('/bookings/:id/messages',(req,res)=>{
    const row=booking(req);
    res.json(db.prepare('SELECT m.*,u.name senderName FROM messages m JOIN users u ON u.id=m.senderId WHERE bookingId=? ORDER BY id').all(row.id));
  });
  api.post('/bookings/:id/messages',(req,res)=>{
    const data=z.union([z.object({body:cleanText(500)}),z.object({preset:z.number().int().min(0).max(presetMessages.length-1)})]).parse(req.body);
    const result=transaction(db,()=>{
      const row=booking(req);
      check(['REQUESTED','NEGOTIATING','CONFIRMED'].includes(row.status),409,'Messaging is closed for this job.');
      const user=actor(req);
      const info=db.prepare('INSERT INTO messages(bookingId,senderId,body) VALUES(?,?,?)').run(row.id,user.id,data.body ?? presetMessages[data.preset]);
      return db.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
    });
    res.status(201).json(result);
  });
  api.post('/reviews',(req,res)=>{
    const user=actor(req,'customer');
    const data=z.object({bookingId:id,rating,feedback:cleanText(350,0)}).parse(req.body);
    const review=transaction(db,()=>{
      const row=market.getBooking(data.bookingId,user);
      check(row.status==='COMPLETED',409,'Complete the job before adding a review.');
      check(!row.reviewed,409,'This booking already has a review.');
      db.prepare('INSERT INTO reviews(bookingId,rating,feedback) VALUES(?,?,?)').run(row.id,data.rating,data.feedback);
      return db.prepare('SELECT * FROM reviews WHERE bookingId=?').get(row.id);
    });
    res.status(201).json(review);
  });
  api.put('/bookings/:id/evidence',(req,res)=>{
    const row=booking(req);
    actor(req,'worker');
    const data=z.object({mime:z.enum(['image/jpeg','image/png','image/webp']),base64:z.base64().max(1400000)}).parse(req.body);
    const bytes=Buffer.from(data.base64,'base64');
    const signature={'image/jpeg':bytes.subarray(0,3).equals(Buffer.from([255,216,255])),
      'image/png':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
      'image/webp':bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP'};
    check(signature[data.mime] && bytes.length<=1000000,422,'Choose a valid JPEG, PNG, or WebP under 1 MB.');
    transaction(db,()=>{
      check(['CONFIRMED','COMPLETED'].includes(booking(req).status),409,'Only booked or completed jobs can have a work photo.');
      db.prepare('INSERT INTO work_evidence(bookingId,mime,photo) VALUES(?,?,?) ON CONFLICT(bookingId) DO UPDATE SET mime=excluded.mime,photo=excluded.photo').run(row.id,data.mime,bytes);
    });
    res.status(201).json({hasEvidence:true});
  });
  api.get('/bookings/:id/evidence',(req,res)=>{
    const bookingId=id.parse(req.params.id);
    const row=db.prepare('SELECT e.mime,e.photo,b.status FROM work_evidence e JOIN bookings b ON b.id=e.bookingId WHERE e.bookingId=?').get(bookingId);
    check(row,404,'Work photo not found.');
    if (row.status!=='COMPLETED') booking(req);
    res.type(row.mime).send(Buffer.from(row.photo));
  });
  api.use((_req,res)=>res.status(404).json({error:'API endpoint not found.'}));
  const frontend=fileURLToPath(new URL('../frontend/dist/',import.meta.url));
  if (existsSync(frontend+'index.html')) {
    app.use(express.static(frontend));
    app.get('/{*path}',(_req,res)=>res.sendFile(frontend+'index.html'));
  }
  app.use((error,_req,res,_next)=>{
    if (error instanceof z.ZodError) return res.status(422).json({error:error.issues.map(issue=>[issue.path.join('.'),issue.message].filter(Boolean).join(' — ')).join('; ')});
    if (error.status && error.status<500) return res.status(error.status).json({error:error.type==='entity.too.large'?'The upload is too large.':error.type==='entity.parse.failed'?'Invalid JSON.':error.message});
    console.error(error);
    res.status(500).json({error:'Something went wrong. Please try again.'});
  });
  return app;
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3001);
  createApp().listen(port,'0.0.0.0',()=>console.log('Roshan Rozgar listening at http://localhost:'+port));
}
