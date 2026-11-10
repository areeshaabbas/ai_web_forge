import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AudioLines, BriefcaseBusiness, FlaskConical, Globe2, Search } from 'lucide-react';
import Home from './Home';
import Discovery from './Discovery';
import Onboard from './Onboard';
import Worker from './Worker';
import { Booking, Dashboard } from './Bookings';
import { makeApi, Session } from './ui';
import './style.css';

const navLabels={en:['Find workers','Worker hub','Dashboard'],ur:['کاریگر ڈھونڈیں','کاریگر کا صفحہ','ڈیش بورڈ'],roman:['Karigar dhoondein','Kaam ka markaz','Mera dashboard']};
function Brand() {
  return <Link className="brand" to="/" aria-label="Roshan Rozgar home"><span className="brand-icon"><AudioLines size={23}/></span><span>Roshan <b>Rozgar</b><small lang="ur">روشن روزگار</small></span></Link>;
}
function App() {
  const location=useLocation();
  const [userId,setUserId]=useState(()=>Number(localStorage.getItem('rr-demo-user'))||1);
  const [lang,setLang]=useState(()=>localStorage.getItem('rr-language')||'en');
  const [users,setUsers]=useState([]);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const api=useMemo(()=>makeApi(userId),[userId]);
  const user=users.find(u=>u.id===userId)??users[0];
  const nav=navLabels[lang]??navLabels.en;
  useEffect(()=>{window.scrollTo(0,0);},[location.pathname]);
  useEffect(()=>{document.documentElement.lang=lang==='ur'?'ur':'en';},[lang]);
  useEffect(()=>{
    setError('');
    makeApi(1)('/demo-users').then(setUsers).catch(e=>setError(e.message));
  },[retry,location.pathname,userId]);
  function choose(id) {
    setUserId(id);localStorage.setItem('rr-demo-user',String(id));
  }
  return <Session.Provider value={{user,api,choose,lang}}>
    <a className="skip" href="#main">Skip to content</a>
    <header><div className="container topbar"><Brand/>
      <nav aria-label="Main navigation">
        <NavLink to="/find" onClick={()=>choose(1)}><Search size={16}/> {nav[0]}</NavLink>
        <NavLink to="/onboard" onClick={()=>{if(user?.role!=='worker')choose(2);}}><BriefcaseBusiness size={16}/> {nav[1]}</NavLink>
        <NavLink to="/dashboard">{nav[2]}</NavLink>
      </nav>
      <div className="header-actions"><label className="lang-control"><Globe2 size={17}/><select aria-label="Interface language" value={lang} onChange={e=>{setLang(e.target.value);localStorage.setItem('rr-language',e.target.value);}}><option value="en">English</option><option value="ur">اردو</option><option value="roman">Roman Urdu</option></select></label>
      <label className="demo-control"><FlaskConical size={16}/><select aria-label="Demo role" value={user?.id??''} disabled={!user} onChange={e=>choose(Number(e.target.value))}>
        {!user&&<option value="">Demo mode</option>}
        {users.map(u=><option key={u.id} value={u.id}>{u.role==='customer'?'Customer · ':'Worker · '}{u.name}</option>)}
      </select></label></div>
    </div></header>
    <main id="main">
      {!user?<div className="container page">{error?<><p className="error" role="alert">Could not reach the demo server. {error}</p><button className="btn primary" onClick={()=>setRetry(v=>v+1)}>Try again</button></>:<p role="status">Loading Roshan Rozgar…</p>}</div>:
        <Routes key={user.id}>
          <Route path="/" element={<Home/>}/>
          <Route path="/onboard" element={<Onboard/>}/>
          <Route path="/find" element={<Discovery key={location.search}/>}/>
          <Route path="/dashboard" element={<Dashboard/>}/>
          <Route path="/workers/:id" element={<Worker key={location.pathname}/>}/>
          <Route path="/bookings/:id" element={<Booking key={location.pathname}/>}/>
          <Route path="*" element={<div className="container page"><h1>Page not found</h1><Link className="btn primary" to="/">Go home</Link></div>}/>
        </Routes>}
    </main>
    <footer><div className="container footer-inner"><Brand/><p>Bolo, Kaam Ho Gaya. <span>·</span> Built for the Twin Cities.</p><span>Fictional demo · COMSATS AI Web Forge</span></div></footer>
  </Session.Provider>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
