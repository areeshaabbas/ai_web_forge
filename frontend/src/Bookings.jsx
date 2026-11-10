import { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, CircleCheck, Clock3, ImagePlus, MapPin, MessageCircle, RefreshCw, Star, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorNote, Field, Intro, Listen, pk, prettyTime, SlotFields, slotBody, toPK, useDemo, useTask, VoiceInput, WorkerCard } from './ui';

const openStates=['REQUESTED','NEGOTIATING'];
const presets=['Main available hoon.','Kitne bajay aana hai?','Meri price Rs. 1500 hai.','Theek hai, confirm kar dein.'];
const labels={REQUESTED:'Requested',NEGOTIATING:'Negotiating',CONFIRMED:'Confirmed',COMPLETED:'Completed',REJECTED:'Declined',CANCELLED:'Cancelled'};
export function Status({status}) {
  return <span className={'pill status-'+status.toLowerCase()}><i/>{labels[status]}</span>;
}
function BookingList({rows,user}) {
  return <div className="booking-list">{rows.map(row=><Link to={'/bookings/'+row.id} className="booking-row" key={row.id}>
    <span className="avatar"><CalendarDays size={19}/></span><div><strong>{row.description}</strong><small>{user.role==='worker'?row.customerName:row.workerName} · {prettyTime(row.startsAt)}</small></div>
    <Status status={row.status}/><ArrowRight size={17}/>
  </Link>)}</div>;
}
export function Dashboard() {
  const {user,api}=useDemo();
  const [worker,setWorker]=useState(null);
  const [bookings,setBookings]=useState(null);
  const [availability,setAvailability]=useState(null);
  const [requests,setRequests]=useState([]);
  const task=useTask();
  const isWorker=user.role==='worker';
  async function load() {
    const jobs=await api('/bookings');
    setBookings(jobs);
    if (isWorker) {
      try {
        const [w,a]=await Promise.all([api('/workers/'+user.id),api('/workers/'+user.id+'/availability')]);
        setWorker(w);setAvailability(a);
      } catch (e) {if(e.status!==404)throw e;}
    } else setRequests(await api('/service-requests'));
  }
  useEffect(()=>{task.run(load);},[api]);
  const groups=[
    ['Incoming requests',bookings?.filter(b=>b.status==='REQUESTED')],
    ['Negotiations',bookings?.filter(b=>b.status==='NEGOTIATING')],
    ['Confirmed bookings',bookings?.filter(b=>b.status==='CONFIRMED')],
    ['Booking history',bookings?.filter(b=>['COMPLETED','REJECTED','CANCELLED'].includes(b.status))]
  ];
  return <div className="container page hub-screen"><Intro eyebrow={isWorker?'WORKER HUB':'CUSTOMER HUB'} title={'Salam, '+user.name.split(' ')[0]+'.'} description={'Signed in as '+user.name+' · fictional demo account'} icon={BriefcaseBusiness}/>
    <div className="dashboard-actions">
      {isWorker?<Link className="btn primary" to="/onboard">{worker?'Edit my profile':'Create Bolo Profile'} <ArrowRight size={17}/></Link>:<Link className="btn primary" to="/find">New service request <ArrowRight size={17}/></Link>}
      <button className="btn outline" type="button" disabled={task.pending} onClick={()=>task.run(load)}><RefreshCw size={17}/> Refresh</button>
    </div><ErrorNote error={task.error}/>
    {isWorker&&worker&&<div className="discover-layout dashboard-summary"><WorkerCard worker={worker}/><section className="panel"><h2>Availability</h2>
      <p>{availability?.accepting?'You’re accepting new jobs.':'New requests are paused.'}</p>
      <button className="btn outline" disabled={task.pending||!availability} onClick={()=>task.run(async()=>{await api('/workers/'+user.id+'/availability','PATCH',{accepting:!availability.accepting});await load();})}>{availability?.accepting?'Pause new jobs':'Accept new jobs'}</button>
      <h3>Reserved slots</h3>{availability?.occupied.length?<ul className="slot-list">{availability.occupied.map(slot=><li key={slot.startsAt}>{prettyTime(slot.startsAt)} → {prettyTime(slot.endsAt)}</li>)}</ul>:<p>No upcoming confirmed slots.</p>}
      <Link to={'/workers/'+worker.id} className="text-link">See ratings &amp; feedback <ArrowRight size={17}/></Link></section></div>}
    {bookings===null&&task.pending&&<p role="status">Loading bookings…</p>}
    <div className="discover-layout dashboard-groups">{groups.map(([name,rows])=><section key={name} className="panel"><h2>{name} <span className="count">{rows?.length??0}</span></h2>{rows?.length?<BookingList rows={rows} user={user}/>:<p className="subtle">No bookings here yet.</p>}</section>)}</div>
    {!isWorker&&requests.some(r=>!r.seeded)&&<section className="panel dashboard-summary"><h2>Saved service requests</h2>{requests.filter(r=>!r.seeded).map(r=><div className="saved-request" key={r.id}><div><strong>{r.problem}</strong><small>{r.trade} · {r.locality}, {r.city}</small></div>{!bookings?.some(b=>b.requestId===r.id&&!['REJECTED','CANCELLED'].includes(b.status))&&<Link className="btn quiet mini" to={'/find?requestId='+r.id}>Find workers <ArrowRight size={16}/></Link>}</div>)}</section>}
  </div>;
}
function TermsSummary({booking}) {
  return <div className="terms-grid">
    <div><Wallet size={19}/><span>Agreed / proposed price<strong>{pk(booking.price)}</strong></span></div>
    <div><MapPin size={19}/><span>Visit location<strong>{booking.location}</strong></span></div>
    <div><CalendarDays size={19}/><span>Starts · Pakistan time<strong>{prettyTime(booking.startsAt)}</strong></span></div>
    <div><Clock3 size={19}/><span>Ends · Pakistan time<strong>{prettyTime(booking.endsAt)}</strong></span></div>
  </div>;
}
function Proposal({booking,onSave,pending,onCancel}) {
  const [form,setForm]=useState({description:booking.description,location:booking.location,price:booking.price,start:toPK(booking.startsAt),end:toPK(booking.endsAt)});
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  return <form className="proposal" onSubmit={e=>{e.preventDefault();onSave(form);}}>
    <h3>Propose new terms</h3>
    <Field label="Job description"><input required maxLength={500} value={form.description} onChange={e=>set('description',e.target.value)}/></Field>
    <div className="fields"><Field label="Offer in PKR"><input required min="100" max="1000000" type="number" value={form.price} onChange={e=>set('price',e.target.value)}/></Field><Field label="Visit location"><input required maxLength={250} value={form.location} onChange={e=>set('location',e.target.value)}/></Field></div>
    <div className="chips clickable">{[1000,1500,2000,2500].map(p=><button type="button" key={p} aria-pressed={Number(form.price)===p} onClick={()=>set('price',p)}>{pk(p)}</button>)}</div>
    <SlotFields start={form.start} end={form.end} onStart={v=>set('start',v)} onEnd={v=>set('end',v)}/>
    <div className="actions"><button className="btn primary" disabled={pending}>Send counteroffer</button><button className="btn quiet" type="button" onClick={onCancel}>Close</button></div>
  </form>;
}
function WorkPhoto({id,completed,userId}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{
    if (completed) return;
    let live=true, object;
    fetch('/api/bookings/'+id+'/evidence',{headers:{'x-demo-user':String(userId)}})
      .then(r=>{if(r.ok)return r.blob();}).then(b=>{if(live&&b){object=URL.createObjectURL(b);setUrl(object);}}).catch(()=>{});
    return()=>{live=false;if(object)URL.revokeObjectURL(object);};
  },[id,completed,userId]);
  return (completed||url)&&<img className="work-photo" alt="Work evidence uploaded by the worker" src={completed?'/api/bookings/'+id+'/evidence':url}/>;
}
export function Booking() {
  const {id}=useParams();
  const {api,user,choose}=useDemo();
  const [booking,setBooking]=useState(null);
  const [messages,setMessages]=useState([]);
  const [message,setMessage]=useState('');
  const [feedback,setFeedback]=useState('');
  const [rating,setRating]=useState(0);
  const [proposal,setProposal]=useState(false);
  const [notice,setNotice]=useState('');
  const task=useTask();
  const path='/bookings/'+id;
  async function load() {
    const [row,chat]=await Promise.all([api(path),api(path+'/messages')]);
    setBooking(row);setMessages(chat);
  }
  useEffect(()=>{task.run(load);},[api,id]);
  function action(action,extra={}) {
    return task.run(async()=>{
      const row=await api(path,'PATCH',{action,version:booking.version,...extra});
      setBooking(row);setProposal(false);setNotice('');
    });
  }
  function send(data) {
    return task.run(async()=>{
      const saved=await api(path+'/messages','POST',data);
      setMessages(rows=>[...rows,{...saved,senderName:user.name}]);
      if(data.body) setMessage('');
    });
  }
  if (!booking) return <div className="container page"><Intro eyebrow="PAKKI BAAT" title="Booking agreement"/><ErrorNote error={task.error}/>{task.pending&&<p role="status">Loading agreement…</p>}<Link className="btn outline" to="/dashboard">Back to dashboard</Link></div>;
  const open=openStates.includes(booking.status);
  const canChat=open||booking.status==='CONFIRMED';
  const canConfirm=open&&booking.proposedBy!==user.role;
  const canPhoto=user.role==='worker'&&['CONFIRMED','COMPLETED'].includes(booking.status);
  const canReview=user.role==='customer'&&booking.status==='COMPLETED'&&!booking.reviewed;
  const actorId=user.role==='worker'?booking.customerId:booking.workerId;
  return <div className="container page">
    <Link className="text-link" to="/dashboard">← Back to dashboard</Link>
    <Intro eyebrow="03–04 / PAKKI BAAT" title={booking.status==='CONFIRMED'?<>One less thing<br/>to worry about.</>:booking.status==='COMPLETED'?'How did the job go?':<>A fair price.<br/>A clear plan.</>} description={booking.description+' · '+booking.workerName+' with '+booking.customerName+' · Booking #'+booking.id} icon={MessageCircle}/>
    <div className="dashboard-actions"><Status status={booking.status}/><button className="btn quiet mini" disabled={task.pending} onClick={()=>task.run(load)}><RefreshCw size={16}/> Refresh</button><button className="btn outline mini" onClick={()=>choose(actorId)}>Switch to {user.role==='worker'?'customer':'worker'} view <ArrowRight size={16}/></button></div>
    <ErrorNote error={task.error}/>{notice&&<p className="callout" role="status"><Check size={16}/> {notice}</p>}
    <div className="discover-layout booking-layout">
      <section className={'panel agreement '+(booking.status==='CONFIRMED'?'confirmed':'')}>
        <div className="section-head"><div><h2>{booking.status==='CONFIRMED'?'Your confirmed agreement':'Booking agreement'}</h2><p>{booking.description}</p></div>{booking.status==='CONFIRMED'&&<CircleCheck size={30}/>}</div>
        <TermsSummary booking={booking}/>
        {open&&<p className="subtle">{canConfirm?'You can confirm the latest offer or make a counteroffer.':'Waiting for the other party to confirm the latest terms.'}</p>}
        {booking.status==='CONFIRMED'&&<p className="match"><Check size={16}/> This slot is reserved for {booking.workerName}.</p>}
        <div className="actions">
          {canConfirm&&<button disabled={task.pending} className="btn primary" onClick={()=>action('confirm')}><Check size={18}/> Confirm agreement</button>}
          {open&&!proposal&&<button className="btn outline" onClick={()=>setProposal(true)}>Propose new terms</button>}
          {booking.status==='CONFIRMED'&&user.role==='customer'&&<button className="btn primary" disabled={task.pending} onClick={()=>action('complete')}><Check size={18}/> Confirm job completed</button>}
          {open&&user.role==='worker'&&<button className="btn quiet" disabled={task.pending} onClick={()=>action('reject')}>Decline request</button>}
          {canChat&&<button className="btn quiet" disabled={task.pending} onClick={()=>action('cancel')}>Cancel booking</button>}
        </div>
        {proposal&&open&&<Proposal booking={booking} pending={task.pending} onCancel={()=>setProposal(false)} onSave={form=>{
          try{action('propose',{terms:{description:form.description,location:form.location,price:Number(form.price),...slotBody(form.start,form.end)}});}
          catch(e){task.setError(e.message);}
        }}/>}
      </section>
      <section className="panel chat"><h2>Job conversation</h2><p>Use a quick reply, type, or dictate your message.</p>
        <div className="messages" aria-live="polite">{messages.length?messages.map(m=><div key={m.id} className={'message '+(m.senderId===user.id?'mine':'')}><small>{m.senderName}</small><span dir="auto">{m.body}</span></div>):<p className="subtle">No messages yet.</p>}</div>
        {canChat&&<><div className="chips clickable">{presets.map((m,i)=><button type="button" key={m} disabled={task.pending} onClick={()=>send({preset:i})}>{m}</button>)}</div>
          <form onSubmit={e=>{e.preventDefault();send({body:message});}}><VoiceInput compact text={message} onChange={setMessage} label="Your message" placeholder="Write or dictate a reply"/><button className="btn primary" disabled={task.pending||!message.trim()}>Send message <ArrowRight size={16}/></button></form></>}
      </section>
    </div>
    {(canReview||canPhoto||booking.reviewed||booking.hasEvidence)&&<section className="panel dashboard-summary evidence"><div className="eyebrow"><Star size={16}/> 05 / KAAM KA SABOOT</div><h2>Work evidence &amp; customer feedback</h2>
      <p>Evidence and feedback come from this booking and are separate from identity verification.</p>
      {booking.hasEvidence&&<WorkPhoto key={booking.version+'-'+notice} id={id} completed={booking.status==='COMPLETED'} userId={user.id}/>}
      {canPhoto&&<label className="upload"><ImagePlus size={19}/> {booking.hasEvidence?'Replace work photo':'Add work photo'} <input aria-label="Work photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={task.pending} onChange={e=>{
        const file=e.target.files?.[0];e.target.value='';if(!file)return;
        task.run(async()=>{
          if(file.size>1000000)throw new Error('Choose an image under 1 MB.');
          const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Unable to read photo.'));reader.readAsDataURL(file);});
          await api(path+'/evidence','PUT',{mime:file.type,base64});await load();setNotice('Work photo saved.');
        });
      }}/></label>}
      {canReview&&<form onSubmit={e=>{e.preventDefault();task.run(async()=>{await api('/reviews','POST',{bookingId:Number(id),rating,feedback});await load();setNotice('Review saved and worker rating updated.');});}}>
        <fieldset className="star-picker"><legend>Rate the work</legend>{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={n+' stars'} aria-pressed={rating===n} onClick={()=>setRating(n)}><Star fill={rating>=n?'currentColor':'none'} size={25}/></button>)}</fieldset>
        <Field label="Short feedback · optional"><textarea rows={3} maxLength={350} dir="auto" value={feedback} onChange={e=>setFeedback(e.target.value)}/></Field>
        <button className="btn primary" disabled={task.pending||!rating}>Submit review</button>
      </form>}
      {Boolean(booking.reviewed)&&<Link className="text-link" to={'/workers/'+booking.workerId}>See customer feedback on the profile <ArrowRight size={17}/></Link>}
    </section>}
  </div>;
}
