import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AudioLines, BriefcaseBusiness, FlaskConical, Globe2, LogIn, LogOut, Search, UserPlus, UserRound } from 'lucide-react';
import Home from './Home';
import Discovery from './Discovery';
import Onboard from './Onboard';
import Worker from './Worker';
import { Booking, Dashboard } from './Bookings';
import { SignIn, SignUp } from './Auth';
import { makeApi, Session } from './ui';
import '@fontsource-variable/manrope';
import './style.css';
import './figma.css';

const navLabels={en:['Find workers','Worker hub','Bookings & chat'],ur:['کاریگر ڈھونڈیں','کاریگر کا صفحہ','ڈیش بورڈ'],roman:['Karigar dhoondein','Kaam ka markaz','Bookings aur chat']};
function Brand() {
  return <Link className="brand" to="/" aria-label="Roshan Rozgar home"><span className="brand-icon"><AudioLines size={23}/></span><span>Roshan <b>Rozgar</b><small lang="ur">روشن روزگار</small></span></Link>;
}
const store={
  get(key){try{return localStorage.getItem(key);}catch{return null;}},
  set(key,value){try{value==null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{/* storage unavailable */}}
};
function App() {
  const location=useLocation();
  const navigate=useNavigate();
  const [userId,setUserId]=useState(()=>Number(store.get('rr-demo-user'))||1);
  const [token,setToken]=useState(()=>store.get('rr-token')||'');
  const [account,setAccount]=useState(null);
  const [authReady,setAuthReady]=useState(()=>!store.get('rr-token'));
  const [lang,setLang]=useState(()=>store.get('rr-language')||'en');
  const [users,setUsers]=useState([]);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const api=useMemo(()=>makeApi(userId,token),[userId,token]);
  const user=account??users.find(u=>u.id===userId)??users[0];
  const nav=navLabels[lang]??navLabels.en;
  useEffect(()=>{window.scrollTo(0,0);},[location.pathname]);
  // Restore a saved sign-in. An expired or invalid token is discarded.
  useEffect(()=>{
    if (!token||account) return;
    let live=true;
    makeApi(0,token)('/auth/me').then(me=>{if(live)setAccount({id:me.id,name:me.name,role:me.role,email:me.email});})
      .catch(e=>{if(live&&e.status===401){store.set('rr-token',null);setToken('');}})
      .finally(()=>{if(live)setAuthReady(true);});
    return ()=>{live=false;};
  },[token]);
  function onAuth({token:next,user:me}) {
    store.set('rr-token',next);
    setToken(next);setAccount({id:me.id,name:me.name,role:me.role,email:me.email});setAuthReady(true);
  }
  function signOut() {
    store.set('rr-token',null);setToken('');setAccount(null);navigate('/');
  }
  useEffect(()=>{document.documentElement.lang=lang==='ur'?'ur':'en';},[lang]);
  useEffect(()=>{
    setError('');
    makeApi(1)('/demo-users').then(setUsers).catch(e=>setError(e.message));
  },[retry,location.pathname,userId]);
  const signedIn=Boolean(account);
  function choose(id) {
    if (token) return; // a real account never switches into the demo personas
    setUserId(id);store.set('rr-demo-user',String(id));
  }
  return <Session.Provider value={{user,api,choose,lang,token,account,onAuth}}>
    <a className="skip" href="#main">Skip to content</a>
    <header><div className="container topbar"><Brand/>
      <nav aria-label="Main navigation">
        <NavLink to="/find" onClick={()=>choose(1)}><Search size={16}/> {nav[0]}</NavLink>
        <NavLink to="/onboard" onClick={()=>{if(user?.role!=='worker')choose(2);}}><BriefcaseBusiness size={16}/> {nav[1]}</NavLink>
        <NavLink to="/dashboard">{nav[2]}</NavLink>
      </nav>
      <div className="header-actions"><label className="lang-control"><Globe2 size={17}/><select aria-label="Interface language" value={lang} onChange={e=>{setLang(e.target.value);store.set('rr-language',e.target.value);}}><option value="en">English</option><option value="ur">اردو</option><option value="roman">Roman Urdu</option></select></label>
      {signedIn?<div className="account-chip" title={account.email}><UserRound size={16}/><span><strong>{account.name.split(' ')[0]}</strong><small>{account.role==='worker'?'Worker':'Customer'}</small></span></div>
        :<label className="demo-control"><FlaskConical size={16}/><select aria-label="Demo role" value={user?.id??''} disabled={!user} onChange={e=>choose(Number(e.target.value))}>
          {!user&&<option value="">Demo mode</option>}
          {users.map(u=><option key={u.id} value={u.id}>{u.role==='customer'?'Customer · ':'Worker · '}{u.name}</option>)}
        </select></label>}
      {signedIn?<button type="button" className="btn outline mini" onClick={signOut}><LogOut size={16}/> Sign out</button>
        :<><Link className="btn outline mini" to="/signin"><LogIn size={16}/> Sign in</Link><Link className="btn primary mini" to="/signup"><UserPlus size={16}/> Sign up</Link></>}
      </div>
    </div></header>
    <main id="main">
      {!authReady||!user?<div className="container page">{error&&!signedIn?<><p className="error" role="alert">Could not reach the demo server. {error}</p><button className="btn primary" onClick={()=>setRetry(v=>v+1)}>Try again</button></>:<p role="status">Loading Roshan Rozgar…</p>}</div>:
        <Routes key={user.id}>
          <Route path="/" element={<Home/>}/>
          <Route path="/onboard" element={<Onboard/>}/>
          <Route path="/find" element={<Discovery key={location.search}/>}/>
          <Route path="/signin" element={<SignIn/>}/>
          <Route path="/signup" element={<SignUp/>}/>
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
