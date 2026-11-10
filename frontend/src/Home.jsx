import { useEffect, useState } from 'react';
import { ArrowRight, AudioLines, BriefcaseBusiness, Hammer, MapPin, Mic, Search, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tradeIcons, trades, tradeUrdu, useDemo, WorkerCard } from './ui';

function Illustration() {
  return <div className="hero-art" aria-hidden="true">
    <svg viewBox="0 0 480 405" role="presentation">
      <defs><pattern id="grid" width="21" height="21" patternUnits="userSpaceOnUse"><path d="M21 0H0V21" fill="none" stroke="#a6bf92" strokeOpacity=".13"/></pattern></defs>
      <rect x="0" y="0" width="480" height="405" rx="25" fill="#123c30"/>
      <rect x="0" y="0" width="480" height="405" rx="25" fill="url(#grid)"/>
      <path d="M79 337V186a161 161 0 0 1 322 0v151z" fill="#1c513e" stroke="#537659"/>
      <path d="M105 337V190a135 135 0 0 1 270 0v147" fill="none" stroke="#78916b" strokeDasharray="3 7"/>
      <circle cx="240" cy="174" r="86" fill="#e7b955"/>
      <path d="M105 337 105 288 138 288 138 256 166 256 166 337m144 0v-82h22v28h29v54M85 338h310" fill="none" stroke="#86a079" strokeWidth="2"/>
      <path d="M151 336c6-61 30-97 79-107l40-1c47 10 78 50 83 108z" fill="#d9a84f" stroke="#15382a" strokeWidth="4"/>
      <path d="M209 240v-40h57v39c-13 25-42 26-57 1Z" fill="#b96f42" stroke="#15382a" strokeWidth="4"/>
      <path d="M191 158c0-25 18-45 47-45 36 0 49 24 49 49l-5 27c-4 22-20 40-42 40-24 0-43-19-47-39z" fill="#d9905a" stroke="#15382a" strokeWidth="4"/>
      <path d="M190 166c-21-5-16 28 4 28m91-28c21-5 17 28-4 28" fill="#d9905a" stroke="#15382a" strokeWidth="4"/>
      <path d="M189 159c-6-19 0-48 13-59 15-15 37-19 58-9 18 8 28 22 31 47-28-3-47-9-61-21-10 18-26 30-41 42Z" fill="#17392b"/>
      <path d="M179 131c4-35 27-57 61-56 32 1 54 20 61 54l12 13-6 8-133-4-6-7z" fill="#f1cf70" stroke="#15382a" strokeWidth="4"/>
      <path d="M230 76c-9 13-12 29-11 48m35-47c8 13 10 29 10 48m-82 6 117 1" fill="none" stroke="#aa7939" strokeWidth="3"/>
      <path d="M203 181c8 16 17 22 36 22 18 0 31-7 40-21l-3 17c-5 19-18 29-36 30-22-2-37-20-37-48Z" fill="#17392b"/>
      <path d="M216 169h4m40 0h4m-25 5-4 13h8m-15 12c7 5 15 6 23 0" fill="none" stroke="#17392b" strokeWidth="3" strokeLinecap="round"/>
      <path d="M230 201c7 4 14 4 21 0" fill="none" stroke="#f3ba86" strokeWidth="2" strokeLinecap="round"/>
      <path d="m181 262 19-19 15 30h54l15-30 20 16-9 77H188z" fill="#467b60" stroke="#15382a" strokeWidth="4"/>
      <path d="M212 280v56m61-56v56m-47-38h34v21h-34z" fill="none" stroke="#a9bf86" strokeWidth="3"/>
      <path d="m305 327 35-59-5-16 9-18 8 14 13 2 12-10-1 21-13 14-35 61" fill="#d3d5b0" stroke="#15382a" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M306 324c11-17 21-20 33-9 8 7 7 14 2 21h-40z" fill="#d9905a" stroke="#15382a" strokeWidth="4"/>
      <path d="M40 337h400" stroke="#d2bc78" strokeWidth="2"/>
      <g fill="none" stroke="#efd278" strokeWidth="2" strokeLinecap="round"><path d="M124 131v22m-11-11h22m212-27v24m-12-12h24M69 198v14m-7-7h14m332-35v15m-7-7h14"/><circle cx="379" cy="204" r="4"/><circle cx="102" cy="240" r="4"/></g>
      <text x="240" y="377" textAnchor="middle" fill="#eadbb1" fontSize="17" fontFamily="serif">روشن روزگار</text>
    </svg>
    <span className="art-tag speech"><Mic size={17}/> Bolo, kaam ho gaya.</span><span className="art-tag local"><MapPin size={17}/> Made for your mohalla</span>
  </div>;
}
export default function Home() {
  const {api,choose,lang}=useDemo();
  const [workers,setWorkers]=useState([]);
  const [error,setError]=useState('');
  useEffect(()=>{api('/workers?available=true').then(items=>setWorkers(items.slice(0,3))).catch(e=>setError(e.message));},[api]);
  const ur=lang==='ur';
  return <>
    <section className="hero"><div className="container hero-grid">
      <div className="hero-copy"><div className="eyebrow"><span className="dot"/> {ur?'اسلام آباد اور راولپنڈی':'BUILT FOR ISLAMABAD & RAWALPINDI'}</div>
      <h1>{ur?<span lang="ur">ہنرمند ہاتھ۔<br/>روشن مستقبل۔</span>:<>Hunarmand Haath.<br/><em>Roshan Mustaqbil.</em></>}</h1>
      <p>{ur?'اپنے علاقے میں ہنرمند کاریگر ڈھونڈیں، یا اپنے ہنر سے روزگار حاصل کریں۔':'Find trusted local skilled workers, or turn your skills into opportunities — with a platform built for everyone.'}</p>
      <div className="hero-actions"><Link to="/find" onClick={()=>choose(1)} className="btn primary"><Search size={20}/><span>{ur?'مجھے کاریگر چاہیے':'Mujhe Karigar Chahiye'}<small>I need a worker</small></span><ArrowRight size={19}/></Link>
      <Link to="/onboard" onClick={()=>choose(2)} className="btn outline"><BriefcaseBusiness size={20}/><span>{ur?'مجھے کام چاہیے':'Mujhe Kaam Chahiye'}<small>I am a worker</small></span></Link></div>
      <div className="hero-note"><ShieldCheck size={17}/> {ur?'فرضی صارفین کے ساتھ ڈیمو':'Demo marketplace · All people and sample jobs are fictional'}</div></div>
      <Illustration/>
    </div></section>
    <section className="container section"><div className="section-head"><div><div className="eyebrow">FIND YOUR KARIGAR</div><h2>What needs fixing?</h2></div><Link className="text-link" to="/find" onClick={()=>choose(1)}>Browse all workers <ArrowRight size={17}/></Link></div>
      <div className="home-trades">{trades.slice(0,6).map(trade=>{const Icon=tradeIcons[trade];return <Link key={trade} to={'/find?trade='+encodeURIComponent(trade)} onClick={()=>choose(1)}><Icon size={25}/><span>{ur?tradeUrdu[trade]:trade}</span></Link>;})}</div>
    </section>
    <section className="container section featured"><div className="section-head"><div><div className="eyebrow"><MapPin size={15}/> LOCAL TO THE TWIN CITIES</div><h2>Meet your neighbourhood experts</h2></div><Link className="text-link" to="/find" onClick={()=>choose(1)}>Find a worker <ArrowRight size={17}/></Link></div>
      {error&&<p role="alert">{error}</p>}<div className="worker-grid">{workers.map(w=><WorkerCard worker={w} key={w.id}/>)}</div>
    </section>
    <section className="promise"><div className="container promise-grid">{[[AudioLines,'Bolo Profile','Say what you do and review the profile it becomes.'],[Sparkles,'Kaam Samjho','Describe the problem in your own words.'],[Hammer,'Pakki Baat','Agree on the job, price and time in one place.'],[Star,'Kaam ka Saboot','Share feedback from completed jobs.']].map(([Icon,title,copy])=><div key={title}><Icon size={22}/><h3>{title}</h3><p>{copy}</p></div>)}</div></section>
  </>;
}
