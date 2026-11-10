import { useEffect, useState } from 'react';
import { ArrowRight, CircleCheck, Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorNote, Intro, query, Speak, useDemo, WorkerCard } from './ui';

export default function Worker() {
  const {id}=useParams();
  const {api,choose}=useDemo();
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    Promise.all([api('/workers/'+id),api('/workers/'+id+'/reviews')])
      .then(([worker,reviews])=>{if(live)setData({worker,reviews});}).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[id,api]);
  if(!data)return <div className="container page"><ErrorNote error={error}/>{!error&&<p role="status">Loading profile…</p>}</div>;
  const {worker,reviews}=data;
  return <div className="container page"><Link to="/find" className="text-link">← Worker discovery</Link>
    <Intro eyebrow="KARIGAR PROFILE" title={<>A familiar face.<br/>A skilled hand.</>} description={worker.trade+' · '+worker.locality+', '+worker.city+(worker.seeded?' · Fictional demo profile':'')}/>
    <div className="discover-layout"><div><WorkerCard worker={worker}/><Link className="btn primary wide" onClick={()=>choose(1)} to={'/find?'+query({trade:worker.trade,city:worker.city,locality:worker.locality,worker:worker.id})}>Find a booking slot <ArrowRight size={18}/></Link></div>
    <section className="panel"><div className="eyebrow"><CircleCheck size={16}/> KAAM KA SABOOT</div><h2>Customer feedback</h2><Speak text="گاہکوں کی رائے۔ یہاں مکمل کیے گئے کاموں کی ریٹنگ اور رائے نظر آتی ہے۔ اچھی ریٹنگ سے آپ کو زیادہ کام ملتا ہے۔"/><p>{worker.completedJobs} completed {worker.completedJobs===1?'job':'jobs'} · {worker.reviewCount} {worker.reviewCount===1?'review':'reviews'}</p><p className="subtle">Customer feedback reflects completed work. Profiles are fictional and have no formal verification.</p>
      {reviews.map(r=><article className="review" key={r.bookingId}><strong><Star size={17} className="star"/> {r.rating}/5 · {r.customerName}</strong><p dir="auto">{r.feedback||'Rating only'}</p><small>{r.seeded?'Simulated sample review':'Review from this demo session'}</small>{Boolean(r.hasEvidence)&&<img className="work-photo" alt="Work evidence supplied for this completed job" src={'/api/bookings/'+r.bookingId+'/evidence'}/>}</article>)}
      {!reviews.length&&<p className="empty">Reviews will appear after the first completed job.</p>}</section></div>
  </div>;
}
