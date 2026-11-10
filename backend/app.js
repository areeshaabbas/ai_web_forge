import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { connect } from './db.js';
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
const presetMessages = [
  'Main available hoon.', 'Kitne bajay aana hai?', 'Meri price Rs. 1500 hai.', 'Theek hai, confirm kar dein.'
];

export function createApp({store, extract=extractionService(), now}) {
  const {db}=store;
  const market = marketplace(store,now);
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
  async function actor(req,role,optional=false) {
    const parsed=id.safeParse(req.get('x-demo-user'));
    const user=parsed.success&&await db.collection('users').findOne({_id:parsed.data},{projection:{name:1,role:1}});
    if (!user&&optional) return null;
    check(user,401,'Select a fictional demo user.');
    check(!role||user.role===role,403,'Switch to the corresponding demo role.');
    return {id:user._id,name:user.name,role:user.role};
  }
  async function owner(req,workerId) {
    check((await actor(req,'worker')).id===workerId,403,'Switch to this worker to edit their profile.');
  }
  api.get('/health',async (_req,res)=>{
    await db.command({ping:1});
    res.json({ok:true,demo:true,database:'mongodb'});
  });
  api.get('/demo-users',async (_req,res)=>{
    const users=await db.collection('users').find({},{projection:{name:1,role:1}}).sort({_id:1}).toArray();
    res.json(users.map(({_id,...user})=>({id:_id,...user})));
  });
  for (const [path,type] of [['worker-profile','profile'],['understand-job','job']]) {
    api.post('/ai/'+path,async (req,res)=>{
      await actor(req,type==='profile'?'worker':'customer');
      const {text}=z.object({text:cleanText(2000,3)}).parse(req.body);
      res.json(await extract(type,text));
    });
  }
  api.get('/workers',async (req,res)=>{
    const filters=searchQuery.parse(req.query);
    if(filters.startsAt||filters.endsAt) Object.assign(filters,slot.parse(filters));
    res.json(await market.search(filters));
  });
  api.get('/workers/:id',async (req,res)=>res.json(await market.worker(id.parse(req.params.id))));
  api.post('/workers',async (req,res)=>res.status(201).json(await market.saveWorker((await actor(req,'worker')).id,profile.parse(req.body),true)));
  api.patch('/workers/:id',async (req,res)=>{
    const workerId=id.parse(req.params.id);
    await owner(req,workerId);
    const current=await market.worker(workerId);
    res.json(await market.saveWorker(workerId,profile.parse({...current,...req.body}),false));
  });
  api.get('/workers/:id/availability',async (req,res)=>{
    const workerId=id.parse(req.params.id);
    const worker=await market.worker(workerId);
    const nowIso=(now?.()??new Date()).toISOString();
    res.json({accepting:worker.accepting,availableNow:worker.available,occupied:await market.blocked(workerId,nowIso,'9999-12-31T00:00:00.000Z')});
  });
  api.patch('/workers/:id/availability',async (req,res)=>{
    const workerId=id.parse(req.params.id);
    await owner(req,workerId);
    const {accepting}=z.object({accepting:z.boolean()}).parse(req.body);
    res.json(await market.setAvailability(workerId,accepting));
  });
  api.get('/workers/:id/reviews',async (req,res)=>res.json(await market.reviews(id.parse(req.params.id))));
  api.post('/service-requests',async (req,res)=>res.status(201).json(await market.createRequest(await actor(req,'customer'),request.parse(req.body))));
  api.get('/service-requests',async (req,res)=>res.json(await market.listRequests(await actor(req,'customer'))));
  api.get('/bookings',async (req,res)=>res.json(await market.listBookings(await actor(req))));
  api.get('/bookings/:id',async (req,res)=>res.json(await market.getBooking(id.parse(req.params.id),await actor(req))));
  api.post('/bookings',async (req,res)=>{
    const data=z.object({requestId:id,workerId:id}).and(terms).parse(req.body);
    res.status(201).json(await market.createBooking(await actor(req,'customer'),data));
  });
  api.patch('/bookings/:id',async (req,res)=>res.json(await market.updateBooking(id.parse(req.params.id),await actor(req),bookingAction.parse(req.body))));
  api.get('/bookings/:id/messages',async (req,res)=>res.json(await market.listMessages(id.parse(req.params.id),await actor(req))));
  api.post('/bookings/:id/messages',async (req,res)=>{
    const data=z.union([z.object({body:cleanText(500)}),z.object({preset:z.number().int().min(0).max(presetMessages.length-1)})]).parse(req.body);
    res.status(201).json(await market.sendMessage(id.parse(req.params.id),await actor(req),data.body??presetMessages[data.preset]));
  });
  api.post('/bookings/:id/addons',async (req,res)=>{
    const data=z.object({description:cleanText(250),amount:z.number().int().min(1).max(1000000)}).parse(req.body);
    res.status(201).json(await market.proposeAddon(id.parse(req.params.id),await actor(req,'worker'),data));
  });
  api.patch('/bookings/:id/addons/:addonId',async (req,res)=>{
    const {status}=z.object({status:z.enum(['APPROVED','DECLINED'])}).parse(req.body);
    res.json(await market.decideAddon(id.parse(req.params.id),await actor(req,'customer'),cleanText(80).parse(req.params.addonId),status));
  });
  api.post('/reviews',async (req,res)=>{
    const data=z.object({bookingId:id,rating,feedback:cleanText(350,0)}).parse(req.body);
    res.status(201).json(await market.addReview(await actor(req,'customer'),data));
  });
  api.put('/bookings/:id/evidence',async (req,res)=>{
    const worker=await actor(req,'worker');
    const data=z.object({mime:z.enum(['image/jpeg','image/png','image/webp']),base64:z.base64().max(1400000)}).parse(req.body);
    const photo=Buffer.from(data.base64,'base64');
    const signature={'image/jpeg':photo.subarray(0,3).equals(Buffer.from([255,216,255])),
      'image/png':photo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
      'image/webp':photo.toString('ascii',0,4)==='RIFF'&&photo.toString('ascii',8,12)==='WEBP'};
    check(signature[data.mime]&&photo.length<=1000000,422,'Choose a valid JPEG, PNG, or WebP under 1 MB.');
    await market.saveEvidence(id.parse(req.params.id),worker,{mime:data.mime,photo});
    res.status(201).json({hasEvidence:true});
  });
  api.get('/bookings/:id/evidence',async (req,res)=>{
    const evidence=await market.getEvidence(id.parse(req.params.id),await actor(req,undefined,true));
    res.type(evidence.mime).send(evidence.photo);
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
  try {
    const store=await connect();
    const server=createApp({store}).listen(port,'0.0.0.0',()=>console.log('Roshan Rozgar listening at http://localhost:'+port));
    for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>server.close(async()=>{await store.client.close();}));
  } catch(error) {
    console.error('MongoDB startup failed. Check MONGODB_URI, database permissions, and replica set configuration.');
    console.error(error.name+': '+(error.codeName||error.code||'connection or configuration error'));
    process.exitCode=1;
  }
}
