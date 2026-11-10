import { randomUUID } from 'node:crypto';
import { nextId, transaction } from './db.js';
import { requireThat as check } from './domain.js';

const openStates=['REQUESTED','NEGOTIATING'];
const chatStates=[...openStates,'CONFIRMED'];
const publicId=({_id,...rest})=>({id:_id,...rest});
const bookingProjection={ 'evidence.photo':0, activity:0, active:0 };
const bookingView=row=>{
  const {review,evidence,active,addons=[],...rest}=publicId(row);
  return {...rest,addons,reviewed:Number(Boolean(review)),hasEvidence:Number(Boolean(evidence)),
    agreedTotal:row.price+addons.reduce((sum,item)=>sum+(item.status==='APPROVED'?item.amount:0),0)};
};

export function marketplace(store,now=()=>new Date()) {
  const {db}=store;
  const users=db.collection('users');
  const requests=db.collection('requests');
  const bookings=db.collection('bookings');
  const messages=db.collection('messages');
  const stamp=()=>now().toISOString();
  const workerFilter=id=>({_id:id,role:'worker',profile:{$exists:true}});
  const own=(id,actor)=>({_id:id,[actor.role==='worker'?'workerId':'customerId']:actor.id});
  const overlaps=(ids,start,end,skip=0)=>({workerId:{$in:ids},status:'CONFIRMED',startsAt:{$lt:end},endsAt:{$gt:start},_id:{$ne:skip}});
  async function blocked(id,start,end,session,skip=0) {
    return bookings.find(overlaps([id],start,end,skip),{session,projection:{_id:0,startsAt:1,endsAt:1}}).sort({startsAt:1}).toArray();
  }
  async function cards(rows,filters={}) {
    if (!rows.length) return [];
    const ids=rows.map(row=>row._id);
    const instant=now();
    const start=filters.startsAt??instant.toISOString();
    const end=filters.endsAt??new Date(+instant+1).toISOString();
    const [busy,history]=await Promise.all([
      bookings.distinct('workerId',overlaps(ids,start,end)),
      bookings.aggregate([
        {$match:{workerId:{$in:ids},status:'COMPLETED'}},
        {$group:{_id:'$workerId',rating:{$avg:'$review.rating'},reviewCount:{$sum:{$cond:[{$ifNull:['$review.rating',false]},1,0]}},completedJobs:{$sum:1}}}
      ]).toArray()
    ]);
    const histories=new Map(history.map(row=>[row._id,row]));
    const occupied=new Set(busy);
    return rows.map(row=>{
      const available=Boolean(row.profile.accepting&&!occupied.has(row._id));
      const stats=histories.get(row._id);
      const match=[];
      if(filters.trade) match.push(filters.trade);
      if(filters.locality) match.push('Same locality');
      else if(filters.city) match.push('Same city');
      if(available) match.push(filters.startsAt?'Free for your slot':'Free now');
      return {id:row._id,name:row.name,...row.profile,available,match,rating:stats?.rating==null?null:Math.round(stats.rating*10)/10,
        reviewCount:stats?.reviewCount??0,completedJobs:stats?.completedJobs??0};
    });
  }
  async function worker(id) {
    const row=await users.findOne(workerFilter(id));
    check(row,404,'Worker profile not found.');
    return (await cards([row]))[0];
  }
  async function search(filters) {
    const query={role:'worker',profile:{$exists:true}};
    for (const field of ['trade','city','locality']) if(filters[field]) query['profile.'+field]=filters[field];
    if(filters.minExperience) query['profile.experienceYears']={$gte:filters.minExperience};
    const rows=await users.find(query,{collation:{locale:'en',strength:2}}).toArray();
    return (await cards(rows,filters))
      .filter(row=>(!filters.available||row.available)&&(!filters.minRating||row.rating>=filters.minRating))
      .sort((a,b)=>Number(b.available)-Number(a.available)||(b.rating??0)-(a.rating??0)||b.experienceYears-a.experienceYears||a.id-b.id);
  }
  async function saveWorker(id,data,create) {
    await transaction(store,async session=>{
      const row=await users.findOne({_id:id,role:'worker'},{session});
      check(row,404,'Worker account not found.');
      check(create?!row.profile:row.profile,create?409:404,create?'This profile already exists. Edit it from Worker hub.':'Worker profile not found.');
      const {name,skills,...fields}=data;
      const unique=[...new Map(skills.map(skill=>[skill.toLowerCase(),skill])).values()];
      await users.updateOne({_id:id},{$set:{name,profile:{...fields,skills:unique,seeded:row.profile?.seeded??0,createdAt:row.profile?.createdAt??stamp()}}},{session});
      if(name!==row.name) {
        await bookings.updateMany({workerId:id},{$set:{workerName:name}},{session});
        await messages.updateMany({senderId:id},{$set:{senderName:name}},{session});
      }
    });
    return worker(id);
  }
  async function setAvailability(id,accepting) {
    const update=await users.updateOne(workerFilter(id),{$set:{'profile.accepting':accepting}});
    check(update.matchedCount,404,'Worker profile not found.');
    return worker(id);
  }
  async function reviews(id) {
    check(await users.findOne(workerFilter(id)),404,'Worker profile not found.');
    const rows=await bookings.find({workerId:id,review:{$exists:true}},{projection:bookingProjection}).sort({'review.createdAt':-1,_id:-1}).toArray();
    return rows.map(row=>({bookingId:row._id,...row.review,customerName:row.customerName,seeded:row.seeded,hasEvidence:Number(Boolean(row.evidence))}));
  }
  async function getBooking(id,actor,session) {
    const row=await bookings.findOne(own(id,actor),{session,projection:bookingProjection});
    check(row,404,'Booking not found for this demo role.');
    return bookingView(row);
  }
  async function listBookings(actor) {
    return (await bookings.find({[actor.role==='worker'?'workerId':'customerId']:actor.id},{projection:bookingProjection}).sort({_id:-1}).toArray()).map(bookingView);
  }
  async function free(workerId,data,session,skip) {
    const worker=await users.findOne(workerFilter(workerId),{session});
    check(worker?.profile.accepting,409,'This worker has paused new jobs.');
    check(!(await blocked(workerId,data.startsAt,data.endsAt,session,skip)).length,409,'That time overlaps a confirmed booking. Propose another slot.');
    return worker;
  }
  async function createRequest(actor,data) {
    const row={_id:await nextId(db,'requests'),customerId:actor.id,...data,seeded:0,createdAt:stamp()};
    await requests.insertOne(row);
    return publicId(row);
  }
  async function listRequests(actor) {
    return (await requests.find({customerId:actor.id}).sort({_id:-1}).toArray()).map(publicId);
  }
  async function createBooking(actor,data) {
    try {
      return await transaction(store,async session=>{
        const job=await requests.findOne({_id:data.requestId,customerId:actor.id},{session});
        check(job,404,'Service request not found.');
        check(data.startsAt>=stamp(),422,'Choose a future start time.');
        const worker=await free(data.workerId,data,session);
        check(worker.profile.trade===job.trade&&worker.profile.city===job.city,422,'Choose a worker who matches the trade and city.');
        const row={_id:await nextId(db,'bookings',session),...data,customerId:actor.id,customerName:actor.name,workerName:worker.name,
          trade:job.trade,city:job.city,locality:job.locality,status:'REQUESTED',active:true,proposedBy:'customer',version:1,seeded:0,createdAt:stamp(),addons:[]};
        await bookings.insertOne(row,{session});
        return bookingView(row);
      });
    } catch(error) {
      if(error.code===11000) check(false,409,'This service request already has a booking.');
      throw error;
    }
  }
  async function updateBooking(id,actor,input) {
    return transaction(store,async session=>{
      const row=await getBooking(id,actor,session);
      check(row.version===input.version,409,'The agreement changed. Refresh to see the latest terms.');
      const open=openStates.includes(row.status);
      let updates;
      switch(input.action) {
        case 'propose':
          check(open,409,'This agreement is closed to new proposals.');
          check(input.terms.startsAt>=stamp(),422,'Choose a future start time.');
          updates={...input.terms,proposedBy:actor.role,status:'NEGOTIATING'};
          break;
        case 'confirm':
          check(open&&actor.role!==row.proposedBy,409,'The other party must accept the latest terms.');
          check(row.startsAt>=stamp(),409,'The proposed start time passed. Propose another time.');
          // Every confirmation writes the worker document first. Competing transactions retry on the same worker.
          await users.updateOne(workerFilter(row.workerId),{$inc:{calendarRevision:1}},{session});
          await free(row.workerId,row,session,id);
          updates={status:'CONFIRMED'};
          break;
        case 'complete':
          check(actor.role==='customer'&&row.status==='CONFIRMED',409,'Only the customer can confirm completion of a booked job.');
          check(!row.addons.some(item=>item.status==='PENDING'),409,'Approve or decline the extra work before completing the job.');
          updates={status:'COMPLETED'};
          break;
        case 'reject':
          check(actor.role==='worker'&&open,409,'Only the worker can decline an open request.');
          updates={status:'REJECTED',active:false};
          break;
        case 'cancel':
          check(chatStates.includes(row.status),409,'This booking is already closed.');
          updates={status:'CANCELLED',active:false,addons:row.addons.map(item=>item.status==='PENDING'?{...item,status:'WITHDRAWN',decidedAt:stamp()}:item)};
          break;
      }
      const updated=await bookings.findOneAndUpdate(own(id,actor),{$set:updates,$inc:{version:1}},{session,returnDocument:'after',projection:bookingProjection});
      return bookingView(updated);
    });
  }
  async function listMessages(id,actor) {
    await getBooking(id,actor);
    return (await messages.find({bookingId:id}).sort({_id:1}).toArray()).map(publicId);
  }
  async function sendMessage(id,actor,body) {
    return transaction(store,async session=>{
      const booking=await getBooking(id,actor,session);
      check(chatStates.includes(booking.status),409,'Messaging is closed for this job.');
      await bookings.updateOne(own(id,actor),{$inc:{activity:1}},{session});
      const row={_id:await nextId(db,'messages',session),bookingId:id,senderId:actor.id,senderName:actor.name,body,createdAt:stamp()};
      await messages.insertOne(row,{session});
      return publicId(row);
    });
  }
  async function addReview(actor,{bookingId,rating,feedback}) {
    const row=await getBooking(bookingId,actor);
    check(row.status==='COMPLETED',409,'Complete the job before adding a review.');
    const review={rating,feedback,createdAt:stamp()};
    const result=await bookings.updateOne({...own(bookingId,actor),status:'COMPLETED',review:{$exists:false}},{$set:{review}});
    check(result.modifiedCount,409,'This booking already has a review.');
    return {bookingId,...review};
  }
  async function saveEvidence(id,actor,evidence) {
    await getBooking(id,actor);
    const result=await bookings.updateOne({...own(id,actor),status:{$in:['CONFIRMED','COMPLETED']}},{$set:{evidence}});
    check(result.matchedCount,409,'Only booked or completed jobs can have a work photo.');
  }
  async function getEvidence(id,actor) {
    const query=actor?{_id:id,$or:[{status:'COMPLETED'},own(id,actor)]}:{_id:id,status:'COMPLETED'};
    const row=await bookings.findOne({...query,evidence:{$exists:true}},{projection:{evidence:1}});
    check(row,404,'Work photo not found.');
    return {mime:row.evidence.mime,photo:Buffer.from(row.evidence.photo.value())};
  }
  async function proposeAddon(id,actor,data) {
    const row=await getBooking(id,actor);
    check(row.status==='CONFIRMED',409,'Extra work can only be proposed on a confirmed job.');
    check(row.addons.length<30,409,'This booking has reached its extra-work limit.');
    const addon={id:randomUUID(),...data,status:'PENDING',createdAt:stamp()};
    const updated=await bookings.findOneAndUpdate({...own(id,actor),version:row.version,status:'CONFIRMED','addons.status':{$ne:'PENDING'}},
      {$push:{addons:addon},$inc:{version:1}},{returnDocument:'after',projection:bookingProjection});
    check(updated,409,'An extra is awaiting a decision or the booking changed. Refresh and try again.');
    return bookingView(updated);
  }
  async function decideAddon(id,actor,addonId,status) {
    const row=await getBooking(id,actor);
    check(row.status==='CONFIRMED',409,'This booking is no longer open to extra work.');
    const updated=await bookings.findOneAndUpdate({...own(id,actor),version:row.version,status:'CONFIRMED',addons:{$elemMatch:{id:addonId,status:'PENDING'}}},
      {$set:{'addons.$.status':status,'addons.$.decidedAt':stamp()},$inc:{version:1}},{returnDocument:'after',projection:bookingProjection});
    check(updated,409,'This extra is no longer awaiting a decision. Refresh to see the latest terms.');
    return bookingView(updated);
  }
  return {worker,search,saveWorker,setAvailability,reviews,blocked,getBooking,listBookings,createBooking,updateBooking,
    createRequest,listRequests,listMessages,sendMessage,addReview,saveEvidence,getEvidence,proposeAddon,decideAddon};
}
