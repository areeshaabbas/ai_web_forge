import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioLines, Brush, Check, ChevronRight, CircleHelp, Fan, Hammer, MapPin, Mic, Square, Star, Volume2, Wrench, Zap, Droplets } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Session = createContext(null);
export const useDemo = () => useContext(Session);
export const trades = ['Electrician','Plumber','Carpenter','AC Technician','Mechanic','Painter','Other'];
export const cities = ['Islamabad','Rawalpindi'];
export const localities = {Islamabad:['G-10','G-11','I-8','F-10','G-9','F-8'],Rawalpindi:['Satellite Town','Bahria Phase 8','Saddar','Chaklala','DHA','Scheme 3']};
export const tradeIcons = {Electrician:Zap,Plumber:Droplets,Carpenter:Hammer,'AC Technician':Fan,Mechanic:Wrench,Painter:Brush,Other:CircleHelp};
export const tradeUrdu = {Electrician:'الیکٹریشن',Plumber:'پلمبر',Carpenter:'بڑھئی','AC Technician':'اے سی ٹیکنیشن',Mechanic:'مکینک',Painter:'پینٹر',Other:'دیگر'};
export const pk = (value) => 'Rs. '+Number(value).toLocaleString('en-PK');
export const prettyTime = value => new Intl.DateTimeFormat('en-PK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}).format(new Date(value));
export const fromPK = value => value ? new Date(value+'+05:00').toISOString() : '';
export const toPK = value => new Date(new Date(value).getTime()+5*3600000).toISOString().slice(0,16);
export function initialSlot(urgency='Today') {
  const start = new Date(Math.ceil((Date.now()+15*60000)/900000)*900000);
  if (urgency==='Soon') start.setDate(start.getDate()+1);
  return {start:toPK(start),end:toPK(+start+3600000)};
}
export function slotBody(start,end) {
  if (!start || !end || end<=start) throw new Error('Choose a start and an end time in order.');
  return {startsAt:fromPK(start),endsAt:fromPK(end)};
}
export function query(values) {
  return new URLSearchParams(Object.entries(values).filter(([,v])=>v!=='' && v!=null)).toString();
}
export function makeApi(userId) {
  return async (path,method='GET',body) => {
    const response=await fetch('/api'+path,{method,headers:{'x-demo-user':String(userId),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'),{status:response.status});
    return data;
  };
}
export function useTask() {
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const lock=useRef(false);
  async function run(action) {
    if (lock.current) return;
    lock.current=true;
    setPending(true); setError('');
    try { return await action(); }
    catch (error) { setError(error.message || 'Something went wrong.'); }
    finally { lock.current=false; setPending(false); }
  }
  return {pending,error,run,setError};
}
export function ErrorNote({error}) { return error ? <p className="error" role="alert">{error}</p> : null; }
export function Intro({eyebrow,title,description,icon:Icon}) {
  return <div className="page-intro"><div className="eyebrow">{Icon&&<Icon size={16}/>} {eyebrow}</div><h1>{title}</h1><p>{description}</p></div>;
}
export function Field({label,children}) {return <label className="field"><span>{label}</span>{children}</label>;}
export function Options({values,placeholder,labels,...props}) {
  return <select {...props}>{placeholder&&<option value="">{placeholder}</option>}{values.map(v=><option key={v} value={v}>{labels?.[v]??v}</option>)}</select>;
}
export function SlotFields({start,end,onStart,onEnd}) {
  return <div className="fields"><Field label="Starts · Pakistan time"><input required type="datetime-local" value={start} onChange={e=>onStart(e.target.value)}/></Field><Field label="Ends · Pakistan time"><input required type="datetime-local" value={end} onChange={e=>onEnd(e.target.value)}/></Field></div>;
}
export function TradeTiles({value,onChange}) {
  const {lang}=useDemo();
  return <div className="trade-tiles">{trades.map(trade=>{
    const Icon=tradeIcons[trade];
    return <button type="button" className={'tile '+(trade===value?'selected':'')} aria-pressed={trade===value} key={trade} onClick={()=>onChange(trade)}><Icon size={20}/><span>{lang==='ur'?tradeUrdu[trade]:trade}</span></button>;
  })}</div>;
}
export function Listen({text,language='ur-PK',label='Listen'}) {
  const [notice,setNotice]=useState('');
  return <span><button type="button" className="btn quiet mini" onClick={()=>{
    const speech=window.speechSynthesis;
    const voice=speech?.getVoices().find(v=>v.lang.toLowerCase().startsWith(language.slice(0,2)));
    if (!voice) {setNotice('This device has no matching speech voice.');return;}
    setNotice('');
    speech.cancel();
    const message=new SpeechSynthesisUtterance(text);
    message.voice=voice; message.lang=language; speech.speak(message);
  }}><Volume2 size={17}/> {label}</button>{notice&&<small className="voice-note" role="status">{notice}</small>}</span>;
}
export function VoiceInput({text,onChange,example,label='Describe in your own words',placeholder='Urdu, Roman Urdu, or English…',onSample,compact=false}) {
  const recognition=useRef(null);
  const [listening,setListening]=useState(false);
  const [note,setNote]=useState('');
  const [speechLang,setSpeechLang]=useState('ur-PK');
  const Speech=window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported=Boolean(Speech && window.isSecureContext);
  useEffect(()=>()=>{if(recognition.current){recognition.current.onend=null;recognition.current.onerror=null;recognition.current.onresult=null;recognition.current.abort();}},[]);
  function toggle() {
    if (listening) {recognition.current?.stop();return;}
    setNote('');
    const instance=new Speech();
    recognition.current=instance;
    instance.lang=speechLang;
    instance.onstart=()=>setListening(true);
    instance.onend=()=>setListening(false);
    instance.onresult=event=>onChange((text.trim()+' '+event.results[0][0].transcript).trim());
    instance.onerror=event=>setNote(event.error==='not-allowed'?'Microphone access was denied. Allow it in your browser or type below.':'Speech could not be captured. Try again or type below.');
    try { instance.start(); } catch {setNote('The microphone is busy or unavailable.');}
  }
  return <div className={'voice-box '+(compact?'compact':'')}><div className="voice-top"><button type="button" className={'mic '+(listening?'listening':'')} disabled={!supported} onClick={toggle} aria-label={listening?'Stop microphone':'Start microphone'}>{listening?<Square/>:<Mic/>}</button><div><strong>{listening?'Listening…':'Tap to speak'}</strong><small>{supported?'Microphone permission is required.':'Speech input is unavailable here. You can type below.'}</small></div><select className="voice-select" aria-label="Speech language" value={speechLang} onChange={e=>setSpeechLang(e.target.value)} disabled={listening}><option value="ur-PK">اردو</option><option value="en-PK">English</option></select></div>
    <ErrorNote error={note}/><Field label={label}><textarea dir="auto" rows={compact?2:4} maxLength={compact?500:2000} placeholder={placeholder} value={text} onChange={e=>onChange(e.target.value)}/></Field>
    {example&&<button className="btn quiet mini" type="button" onClick={()=>onSample?onSample(example):onChange(example)}><AudioLines size={16}/> Use example</button>}
  </div>;
}
export function WorkerCard({worker,chosen=false,onBook}) {
  const Icon=tradeIcons[worker.trade]??Wrench;
  const {lang}=useDemo();
  return <article className="worker-card">
    <div className="worker-top"><div className="avatar"><Icon size={23}/></div><span className={'pill '+(worker.available?'good':'neutral')}><i/>{worker.available?'Available':'Busy / paused'}</span></div>
    <div className="worker-title"><h3>{worker.name}</h3><p>{lang==='ur'?tradeUrdu[worker.trade]:worker.trade} <span>·</span> {worker.experienceYears} yrs experience</p></div>
    <div className="worker-meta"><span><MapPin size={15}/> {worker.locality}, {worker.city}</span><span><Star className="star" size={15}/> {worker.rating??'New'} {worker.reviewCount>0&&'('+worker.reviewCount+')'}</span></div>
    <div className="chips">{worker.skills.map(skill=><span key={skill}>{skill}</span>)}</div>
    {worker.match?.length>0&&<div className="match"><Check size={15}/> {worker.match.join(' · ')}</div>}
    <div className="worker-foot"><div><strong>{worker.price?pk(worker.price):'Discuss price'}</strong>{worker.price&&<small>indicative per visit</small>}</div><Link className="btn quiet mini" to={'/workers/'+worker.id}>Profile <ChevronRight size={16}/></Link></div>
    {onBook&&<button className="btn primary wide" disabled={!worker.available||chosen} onClick={()=>onBook(worker)}>{chosen?'Selected':'Request booking'} <ArrowRight size={17}/></button>}
  </article>;
}
