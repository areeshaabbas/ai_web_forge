import { useEffect, useState } from 'react';
import { ArrowUpRight, Mic, MapPin, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tradeIcons, useDemo, VoiceSignal } from './ui';

const steps = [
  ['01','Speak naturally','Describe a job or introduce your trade in your own words.'],
  ['02','Find your people','See local workers who fit the job and the time you need.'],
  ['03','Agree, then begin','Set the terms together and confirm your booking.']
];

export default function Home() {
  const {api,choose,lang}=useDemo();
  const [featured,setFeatured]=useState(null);
  const ur=lang==='ur';
  useEffect(()=>{
    let active=true;
    api('/workers?available=true').then(workers=>{if(active)setFeatured(workers[0]??null);}).catch(()=>{});
    return ()=>{active=false;};
  },[api]);
  const TradeIcon=tradeIcons[featured?.trade]??Zap;
  return <>
    <section className="container welcome" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <div className="eyebrow"><MapPin size={14}/> {ur?'اسلام آباد اور راولپنڈی':'Local work · Islamabad & Rawalpindi'}</div>
        <h1 id="welcome-title" lang={ur?'ur':undefined}>{ur?'اچھا کام۔ گھر کے قریب۔':<>Good work.<br/>Closer to home.</>}</h1>
        <p>{ur?'اپنے علاقے میں کاریگر ڈھونڈیں یا اپنے ہنر سے روزگار حاصل کریں۔':'A little help finding work. A trusted hand when you need one.'}</p>
        <span className="welcome-tagline" lang="ur">بولو، کام ہو گیا۔</span>
        <div className="welcome-actions">
          <Link to="/onboard" className="btn primary" onClick={()=>choose(2)}>{ur?'مجھے کام چاہیے':'I’m a worker'} <ArrowUpRight size={16}/></Link>
          <Link to="/find" className="btn dark" onClick={()=>choose(1)}>{ur?'مجھے کاریگر چاہیے':'I need a worker'} <ArrowUpRight size={16}/></Link>
        </div>
        <small className="demo-caption">Fictional profiles for the hackathon demo.</small>
      </div>
      <div className="welcome-side">
        <section className="voice-showcase" aria-label="Voice onboarding preview">
          <span>BOLO PROFILE · VOICE ONBOARDING</span>
          <VoiceSignal><Link className="mic" to="/onboard" aria-label="Open voice onboarding" onClick={()=>choose(2)}><Mic size={23}/></Link></VoiceSignal>
          <small>Tap the mic to start your profile.</small>
        </section>
        {featured&&<Link className="welcome-worker" to={'/workers/'+featured.id}>
          <span className="avatar"><TradeIcon size={23}/></span>
          <span><strong>{featured.name} · {featured.trade}</strong><small>{featured.locality}, {featured.city} · Available</small></span>
          <ArrowUpRight size={17}/>
        </Link>}
      </div>
    </section>
    <section className="welcome-steps" aria-label="How Roshan Rozgar works"><div className="container">
      {steps.map(([index,title,copy])=><article key={index}><span>{index}</span><h2>{title}</h2><p>{copy}</p></article>)}
    </div></section>
  </>;
}
