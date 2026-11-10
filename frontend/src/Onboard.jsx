import { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleCheck, Mic, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cities, ErrorNote, Field, Intro, Listen, localities, Options, TradeTiles, useDemo, useTask, VoiceInput } from './ui';

const example='Mera naam Usman Ali hai. Main 12 saal se electrician ka kaam kar raha hoon. Main Satellite Town, Rawalpindi mein rehta hoon aur wiring, fan repair aur switch board ka kaam karta hoon.';
const skillsByTrade={Electrician:['Wiring','Fan Repair','Switchboard Repair'],Plumber:['Pipe Leakage','Tap Repair','Drain Cleaning'],Carpenter:['Door Repair','Furniture Repair'], 'AC Technician':['AC Servicing','Cooling Repair'],Mechanic:['Engine Service','Battery Check'],Painter:['Wall Painting','Paint Touchups'],Other:['Home Repairs','General Maintenance']};
const blank={name:'',trade:'',experienceYears:'',city:'',locality:'',skills:'',price:'',accepting:true};
export default function Onboard() {
  const {api,user,lang,choose}=useDemo();
  const [current,setCurrent]=useState(null);
  const [text,setText]=useState('');
  const [draft,setDraft]=useState(blank);
  const [step,setStep]=useState(1);
  const [source,setSource]=useState('');
  const [ready,setReady]=useState(false);
  const task=useTask();
  useEffect(()=>{
    let live=true;
    api('/workers/'+user.id).then(data=>{if(live){setCurrent(data);setDraft({...data,skills:data.skills.join(', '),price:data.price??'',accepting:Boolean(data.accepting)});setStep(2);}}).catch(e=>{if(live&&e.status!==404)task.setError(e.message);}).finally(()=>{if(live)setReady(true);});
    return ()=>{live=false;};
  },[api,user.id]);
  const change=(key,value)=>setDraft(d=>({...d,[key]:value,...(key==='city'?{locality:''}:{})}));
  const selected=draft.skills.split(',').map(s=>s.trim()).filter(Boolean);
  const toggleSkill=skill=>change('skills',(selected.includes(skill)?selected.filter(x=>x!==skill):[...selected,skill]).join(', '));
  const ur=lang==='ur';
  if (user.role!=='worker') return <div className="container page"><Intro eyebrow="BOLO PROFILE" title="Start as a worker"/><Link to="/onboard" className="btn primary" onClick={()=>choose(2)}>Switch to worker demo</Link></div>;
  return <div className={'container page onboarding-screen stage-'+step}>
    <div className="onboard-intro"><Intro eyebrow="01 / BOLO PROFILE" title={ur?'اپنا ہنر بتائیں':task.pending?(step===1?'Making your skills shine.':'Saving your profile.'):step===1?<>Your skill.<br/>Your own words.</>:step===2?<>Meet your<br/>new beginning.</>:'Your profile is ready.'} description="Speak in Urdu or type naturally. Review what we understood and turn it into a profile." icon={Mic}/>
    <div className="steps">{['Tell us','Review profile','Live profile'].map((label,i)=><div key={label} className={step>=i+1?'active':''}><span>{step>i+1?<Check size={15}/>:i+1}</span>{label}</div>)}</div>
    <ErrorNote error={task.error}/></div>
    {!ready&&<p role="status">Loading profile…</p>}
    {ready&&step===1&&<section className="panel onboard-capture"><div className="section-head"><div><h2>{ur?'اپنے کام کے بارے میں بتائیں':'What kind of work do you do?'}</h2><p>Tell us your name, trade, experience, and where you work.</p></div><Listen text="اپنا نام، ہنر، تجربہ اور علاقہ بتائیں۔" label="اردو میں سنیں"/></div>
      <form onSubmit={e=>{e.preventDefault();task.run(async()=>{
        const result=await api('/ai/worker-profile','POST',{text});
        const d=result.data;
        setDraft({...blank,...Object.fromEntries(Object.entries(d).filter(([,value])=>value!==null)),skills:d.skills.join(', ')});
        setSource(result.source==='gemini'?'Extracted with Gemini':result.reason);
        setStep(2);
      });}}>
        <VoiceInput text={text} onChange={setText} example={example}/>
        <p className="subtle">When Gemini is configured, this description is sent to Google for extraction. Use fictional demo details.</p>
        <div className="actions"><button className="btn primary" disabled={task.pending||text.trim().length<3}><Sparkles size={18}/>{task.pending?'Understanding…':ur?'پروفائل بنائیں':'Build my profile'} <ArrowRight size={17}/></button><button className="btn quiet" type="button" onClick={()=>{setSource('');setStep(2);}}>Choose details manually</button></div>
      </form></section>}
    {ready&&step===2&&<form className="panel" onSubmit={e=>{e.preventDefault();task.run(async()=>{
      if (!draft.trade||!selected.length) throw new Error('Choose your trade and at least one skill.');
      const body={...draft,experienceYears:Number(draft.experienceYears),skills:selected,price:draft.price===''?null:Number(draft.price)};
      const saved=await api(current?'/workers/'+user.id:'/workers',current?'PATCH':'POST',body);
      setCurrent(saved);setStep(3);
    });}}>
      <div className="section-head"><div><h2>{current?'Edit your worker profile':'Does this sound like you?'}</h2><p>{source||'Tap the options that describe your work.'}</p></div><Listen text="اپنی معلومات چیک کریں اور پروفائل محفوظ کریں۔" label="اردو میں سنیں"/></div>
      {(!draft.city||!draft.locality||draft.experienceYears==='')&&<p className="callout">Add anything we missed, especially your work area and years of experience.</p>}
      <div className="fields">
        <Field label={ur?'نام':'Your name'}><input required maxLength={70} dir="auto" value={draft.name} onChange={e=>change('name',e.target.value)}/></Field>
        <Field label={ur?'سال کا تجربہ':'Years of experience'}><input type="number" required min="0" max="80" value={draft.experienceYears} onChange={e=>change('experienceYears',e.target.value)}/></Field>
      </div>
      {user.id===2&&!draft.name&&<button type="button" className="btn quiet mini" onClick={()=>change('name','Usman Ali')}>Use fictional demo name</button>}
      <div className="field"><span>{ur?'آپ کا ہنر':'Your trade'}</span><TradeTiles value={draft.trade} onChange={v=>change('trade',v)}/></div>
      <div className="fields"><Field label={ur?'شہر':'City'}><Options required value={draft.city} onChange={e=>change('city',e.target.value)} values={cities} placeholder="Choose a city" labels={ur?{Islamabad:'اسلام آباد',Rawalpindi:'راولپنڈی'}:null}/></Field>
      <Field label={ur?'علاقہ':'Locality'}><Options required value={draft.locality} onChange={e=>change('locality',e.target.value)} values={[...new Set([...(localities[draft.city]??[]),...(draft.locality?[draft.locality]:[])])]} placeholder="Choose your neighbourhood"/></Field></div>
      <Field label={ur?'مہارتیں':'Skills · separated by commas'}><input dir="auto" value={draft.skills} maxLength={420} onChange={e=>change('skills',e.target.value)}/></Field>
      <div className="chips clickable">{(skillsByTrade[draft.trade]??[]).map(skill=><button type="button" aria-pressed={selected.includes(skill)} key={skill} onClick={()=>toggleSkill(skill)}>{selected.includes(skill)&&<Check size={14}/>} {skill}</button>)}</div>
      <Field label="Indicative price per visit in PKR · optional"><input type="number" min="100" max="1000000" value={draft.price} onChange={e=>change('price',e.target.value)}/></Field>
      <label className="check"><input type="checkbox" checked={draft.accepting} onChange={e=>change('accepting',e.target.checked)}/> Accepting new jobs</label>
      <div className="actions"><button className="btn primary" disabled={task.pending}><Check size={18}/>{task.pending?'Saving…':ur?'محفوظ کریں':'Confirm & save profile'}</button>{!current&&<button type="button" className="btn quiet" onClick={()=>setStep(1)}>Back to description</button>}</div>
    </form>}
    {ready&&step===3&&<div className="panel success"><CircleCheck size={48}/><h2>Your profile is live, {current.name}.</h2><p>{current.trade} · {current.experienceYears} years · {current.locality}, {current.city}</p><div className="chips">{current.skills.map(skill=><span key={skill}>{skill}</span>)}</div><Link className="btn primary" to="/dashboard">Open worker hub <ArrowRight size={18}/></Link></div>}
  </div>;
}
