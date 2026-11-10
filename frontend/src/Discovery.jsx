import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, Search, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cities, ErrorNote, Field, initialSlot, Intro, localities, Options, pk, query, SlotFields, slotBody, trades, useDemo, useTask, VoiceInput, WorkerCard } from './ui';

const example='Mere kitchen mein pipe leak ho raha hai, mujhe plumber chahiye jo aaj aa sakay.';
const empty={trade:'',problem:'',urgency:'',city:'',locality:''};
export default function Discovery() {
  const {api,user,choose,lang,token}=useDemo();
  const [params]=useSearchParams();
  const nav=useNavigate();
  const [text,setText]=useState('');
  const [job,setJob]=useState(()=>({...empty,trade:params.get('trade')??'',city:params.get('city')??'',locality:params.get('locality')??''}));
  const [time,setTime]=useState(initialSlot);
  const [onlyFree,setOnlyFree]=useState(true);
  const [minRating,setMinRating]=useState('');
  const [minExperience,setMinExperience]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [sort,setSort]=useState('');
  const [workers,setWorkers]=useState([]);
  const [source,setSource]=useState('');
  const [analysis,setAnalysis]=useState(null);
  const [selected,setSelected]=useState(null);
  const [terms,setTerms]=useState({price:'',location:''});
  const [searchState,setSearchState]=useState('loading');
  const slotFields=useRef(null);
  const [requestId,setRequestId]=useState(null);
  const task=useTask();
  const [searchError,setSearchError]=useState('');
  const set=(key,value)=>{
    setAnalysis(null);
    setJob(j=>({...j,[key]:value,...(key==='city'?{locality:''}:{})}));
    setRequestId(null);
    if(key==='urgency') setTime(initialSlot(value));
  };
  const [expanded,setExpanded]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const savedId=params.get('requestId');
  useEffect(()=>{
    if (!savedId || user.role!=='customer') return;
    let live=true;
    api('/service-requests').then(items=>{
      if(!live) return;
      const saved=items.find(item=>String(item.id)===savedId);
      if(!saved){task.setError('Saved service request not found.');return;}
      setJob(Object.fromEntries(Object.keys(empty).map(key=>[key,saved[key]])));
      setTime(initialSlot(saved.urgency));
      setRequestId(saved.id);
    }).catch(e=>{if(live)task.setError(e.message);});
    return ()=>{live=false;};
  },[api,savedId,user.role]);
  useEffect(()=>{
    let live=true;
    setSearchError('');
    let slot;
    try {slot=slotBody(time.start,time.end);}
    catch(e) {setSearchError(e.message);setWorkers([]);setSearchState('error');return;}
    const filters={trade:job.trade,city:job.city,locality:expanded?'':job.locality,available:onlyFree,minRating,minExperience,maxPrice,sort,...slot};
    setSearchState('loading');
    api('/workers?'+query(filters)).then(data=>{
      if (!live) return;
      setWorkers(data);
      setSelected(current=>current?data.find(worker=>worker.id===current.id&&worker.available)??null:null);
      setSearchState('ready');
    }).catch(e=>{
      if (!live) return;
      setWorkers([]);
      setSearchState('error');
      setSearchError(e.message);
    });
    return ()=>{live=false;};
  },[api,job.trade,job.city,job.locality,time.start,time.end,onlyFree,minRating,minExperience,maxPrice,sort,expanded,refresh]);
  const rankedWorkers=workers.map(w=>{const skillMatches=(analysis?.requiredSkills??[]).filter(skill=>w.skills.some(s=>s.toLowerCase()===skill.toLowerCase()));return {...w,skillMatches,match:[...w.match,...skillMatches.map(s=>'Skill: '+s)]};}).sort((a,b)=>sort?0:b.skillMatches.length-a.skillMatches.length);
  const results=searchState==='loading'?'Checking worker availability…':searchState==='error'?'Search unavailable':workers.length===1?'1 matching worker':workers.length+' matching workers';
  function select(worker) {
    setSelected(worker);
    setTerms({price:worker.price??'',location:[job.locality,job.city].filter(Boolean).join(', ')});
    if (!job.trade) {
      setJob(j=>({...j,trade:worker.trade}));
      setRequestId(null);
    }
    requestAnimationFrame(()=>document.getElementById('book-form')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  async function submitBooking() {
    if(!job.trade||!job.problem.trim()||!job.city||!job.locality||!job.urgency) throw new Error('Complete the job summary, including its description, urgency and location.');
    const bookingTerms={description:job.problem,price:Number(terms.price),location:terms.location,...slotBody(time.start,time.end)};
    let id=requestId;
    if(!id){const saved=await api('/service-requests','POST',job);id=saved.id;setRequestId(id);}
    const booked=await api('/bookings','POST',{requestId:id,workerId:selected.id,...bookingTerms});
    nav('/bookings/'+booked.id);
  }
  return <div className="container page">
    <div className="discover-layout job-intake"><Intro eyebrow="02 / KAAM SAMJHO" title={lang==='ur'?'آپ کو کیا کام کروانا ہے؟':<>What needs<br/>fixing today?</>} description="Describe the problem. We’ll identify the trade and check local workers against the time you need." icon={Sparkles}/>
    <section className="panel job-capture"><h2>Describe the job</h2>
      <form onSubmit={e=>{e.preventDefault();task.run(async()=>{
        const result=await api('/ai/understand-job','POST',{text});
        setAnalysis(result.analysis??null);
        setJob({...empty,...Object.fromEntries(Object.entries(result.data).filter(([,v])=>v!==null))});
        if(result.data.urgency) setTime(initialSlot(result.data.urgency));
        setSource(result.source==='gemini'?'Understood with Gemini':result.reason);
        setExpanded(false);setRequestId(null);setSelected(null);
      });}}>
        <VoiceInput text={text} onChange={setText} example={example}/>
        <p className="subtle">When enabled, Gemini processes the description. Keep personal addresses out of this field.</p>
        <button className="btn primary wide" disabled={user.role!=='customer'||task.pending||text.trim().length<3}><Sparkles size={18}/> {task.pending?'Understanding…':'Understand my job'}</button>
      </form>
      {user.role!=='customer'&&(user.role==='guest'?<p className="callout"><Link to="/signup">Create an account</Link> or <Link to="/signin">sign in</Link> to use AI and book a worker.</p>:token?<p className="callout">Booking requests need a customer account.</p>:<button className="btn outline wide" onClick={()=>choose(1)}>Switch to customer demo</button>)}
    </section>
    <section className="panel job-summary"><h2>Job summary</h2><p>{source||'Fill in the details below, or start with your own words.'}</p>
      {source&&(!job.city||!job.locality)&&<p className="callout"><MapPin size={16}/> Where is the job? Choose a city and neighbourhood.</p>}
      {analysis&&<aside className="callout" aria-label="Job planning assistant">
        <strong>{source.includes('Gemini')?'AI job plan':'Local job checklist'} · review before booking</strong>
        {analysis.requiredSkills.length>0&&<p>Suggested skills: {analysis.requiredSkills.join(', ')}</p>}
        {analysis.questions.length>0&&<><p>Details to clarify</p><ul>{analysis.questions.map(q=><li key={q}>{q}</li>)}</ul></>}
        <p>Before work starts</p><ul>{analysis.checklist.map(q=><li key={q}>{q}</li>)}</ul>
        <button type="button" className="btn outline mini" onClick={()=>{
          const brief=[job.problem,...analysis.checklist.filter(line=>!job.problem.includes(line))].join(' ');
          if(brief.length>500){task.setError('The brief is too long. Shorten the problem description before adding the checklist.');return;}
          setJob(j=>({...j,problem:brief}));setRequestId(null);
        }}>Use checklist in booking brief</button>
        <p className="subtle">Add answers to your description above, then run “Understand my job” again. You approve the final scope and price.</p>
      </aside>}
      <Field label="Problem identified"><input maxLength={500} dir="auto" value={job.problem} onChange={e=>set('problem',e.target.value)} placeholder="e.g. Kitchen pipe leakage"/></Field>
      <div className="fields"><Field label="Required trade"><Options values={trades} value={job.trade} placeholder="Any trade" onChange={e=>{setSelected(null);set('trade',e.target.value);}}/></Field>
      <Field label="Urgency"><Options values={['Today','Soon','Flexible']} value={job.urgency} placeholder="Choose timing" onChange={e=>set('urgency',e.target.value)}/></Field>
      <Field label="City"><Options values={cities} value={job.city} placeholder="Any city" onChange={e=>{setSelected(null);setExpanded(false);set('city',e.target.value);}}/></Field>
      <Field label="Locality"><input maxLength={90} list="job-localities" value={job.locality} placeholder="Enter neighbourhood" onChange={e=>{setExpanded(false);set('locality',e.target.value);}}/><datalist id="job-localities">{(localities[job.city]??[]).map(v=><option key={v} value={v}/>)}</datalist></Field></div>
      <div ref={slotFields}><SlotFields start={time.start} end={time.end} onStart={start=>setTime(t=>({...t,start}))} onEnd={end=>setTime(t=>({...t,end}))}/></div>
    </section></div>
    <ErrorNote error={task.error}/>
    <section className="section results"><div className="section-head"><div><div className="eyebrow"><Search size={15}/> SMART DISCOVERY</div><h2>Good people. Right nearby.</h2><p aria-live="polite">{results}</p></div><button type="button" className="btn quiet" onClick={()=>setRefresh(r=>r+1)}>Refresh availability</button></div>
      <div className="filterbar"><label className="check"><input type="checkbox" checked={onlyFree} onChange={e=>setOnlyFree(e.target.checked)}/> Free for this slot</label>
      <Options aria-label="Minimum rating" placeholder="Any rating" values={['4','4.5','5']} labels={{4:'4+ stars',4.5:'4.5+ stars',5:'5 stars'}} value={minRating} onChange={e=>setMinRating(e.target.value)}/>
      <Options aria-label="Minimum experience" placeholder="Any experience" values={['5','10','15']} labels={{5:'5+ years',10:'10+ years',15:'15+ years'}} value={minExperience} onChange={e=>setMinExperience(e.target.value)}/>
      <Options aria-label="Maximum labour rate" placeholder="Any rate" values={['1500','2000','2500','3000']} labels={{1500:'Up to Rs. 1,500',2000:'Up to Rs. 2,000',2500:'Up to Rs. 2,500',3000:'Up to Rs. 3,000'}} value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/>
      <Options aria-label="Sort workers" placeholder="Sort: best match" values={['rating','priceLow','priceHigh']} labels={{rating:'Highest rated',priceLow:'Lowest rate first',priceHigh:'Highest rate first'}} value={sort} onChange={e=>setSort(e.target.value)}/>
      {job.locality&&<button className="btn quiet mini" type="button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Search selected locality':'Expand to whole city'}</button>}</div>
      <ErrorNote error={searchError}/>
      {searchState==='ready'&&!workers.length&&<section className="panel no-matches" aria-labelledby="no-matches-title">
        <span className="avatar"><Search size={21}/></span>
        <div><h3 id="no-matches-title">{onlyFree?'No workers free for this time':'No workers match these filters'}</h3>
          <p>{job.locality&&!expanded?'Try a different time or look beyond '+job.locality+'.':'Try a different time or adjust your filters.'}</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={()=>slotFields.current?.querySelector('input')?.focus()}><CalendarDays size={17}/> Change time</button>
            {job.locality&&!expanded&&<button type="button" className="btn outline" onClick={()=>setExpanded(true)}><MapPin size={17}/> Expand search area</button>}
            {(minRating||minExperience||maxPrice)&&<button type="button" className="btn outline" onClick={()=>{setMinRating('');setMinExperience('');setMaxPrice('');}}>Clear rating, rate and experience filters</button>}
          </div>
        </div>
      </section>}
      <div className="worker-grid">{searchState==='ready'&&[...rankedWorkers].sort((a,b)=>Number(String(b.id)===params.get('worker'))-Number(String(a.id)===params.get('worker'))).map(w=><WorkerCard key={w.id} worker={w} chosen={selected?.id===w.id} onBook={user.role==='customer'?select:undefined}/>)}</div>
    </section>
    {selected&&user.role==='customer'&&<form id="book-form" className="panel book-form" onSubmit={e=>{e.preventDefault();task.run(submitBooking);}}>
      <div className="section-head"><div><div className="eyebrow">PAKKI BAAT</div><h2>Request {selected.name}</h2><p>{job.problem||'Add the job description in the summary above.'} · {selected.price?pk(selected.price)+' indicative':'Discuss a price'}</p></div><button type="button" className="btn quiet" onClick={()=>setSelected(null)}>Clear selection</button></div>
      <div className="fields"><Field label="Your price offer in PKR"><input type="number" required min="100" max="1000000" value={terms.price} onChange={e=>setTerms(t=>({...t,price:e.target.value}))}/></Field>
      <Field label="Visit location"><input required maxLength={250} dir="auto" value={terms.location} onChange={e=>setTerms(t=>({...t,location:e.target.value}))}/></Field></div>
      <SlotFields start={time.start} end={time.end} onStart={start=>setTime(t=>({...t,start}))} onEnd={end=>setTime(t=>({...t,end}))}/>
      <ErrorNote error={task.error}/><button className="btn primary" disabled={task.pending||searchState!=='ready'}>{task.pending?'Sending…':'Send booking request'} <ArrowRight size={18}/></button>
    </form>}
    {user.role==='customer'&&<Link className="text-link" to="/dashboard">Go to my bookings <ArrowRight size={17}/></Link>}
  </div>;
}
