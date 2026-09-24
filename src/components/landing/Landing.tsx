'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { Tier } from '@/lib/db/types'
import { formatCount } from '@/content/formats'
import { toggleTheme } from '@/lib/theme'
import { PassCards } from './PassCards'
import { SessionCards } from './SessionCards'
import { mountLanding } from './mount'

/**
 * The landing page, ported from the design handoff's Landing Bitmap.dc.html.
 *
 * The markup is the handoff's markup: every inline value is kept as written,
 * including the literal fill colours, and the hover and active states its
 * runtime compiled from style-hover and style-active are the lp-hv-* and
 * lp-ac-* classes in globals.css. Font families resolve through the tokens
 * because next/font owns the face names. Behaviour lives in mount.ts.
 *
 * #FF9900 is a fill colour only, never text. Text on an orange fill is
 * var(--on-fill).
 *
 * Two departures from the handoff markup, both required by the handoff's
 * own rules rather than its rendering: the eleven pure-number elements
 * (date, doors, seats, track indices, prices, the venue day) render in the
 * mono face because numbers never render in Pixelify, and the copy carries
 * no em dashes, per SPEC.md section 2 rule 2.
 */
type Props = {
  registrationOpen: boolean
  /** Doors, "09:30", from content/event.ts. */
  doors: string
  /** Formatted prices per tier, null while a tier is unpriced. The page reads them from content/passes.ts. early is set only while the pool has places. */
  prices: Record<Tier, { list: string | null; early: string | null }>
  /** The early bird pool, read from the counter on this request. Null once it is empty: nothing of it is drawn then. */
  earlyBird: { left: number; total: number } | null
}

export function Landing({ registrationOpen, doors, prices, earlyBird }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    return mountLanding(el)
  }, [])

  return (
    <div ref={rootRef} data-landing="1" style={{ position: 'relative', '--g1': '0', '--g2': '0', '--prog': '0', '--hue': '0' } as CSSProperties}>

      <div style={{position:'fixed',inset:'0',zIndex:'0',pointerEvents:'none',overflow:'hidden',background:'var(--bg)'}}>
        <div style={{position:'absolute',inset:'0',background:'radial-gradient(110% 80% at 50% 0%,var(--surface) 0%,var(--bg2) 42%,var(--bg3) 80%)'}}></div>
        <div style={{position:'absolute',inset:'0',background:'radial-gradient(70% 50% at 82% 88%,rgba(196,174,242,.2) 0%,rgba(196,174,242,0) 70%)'}}></div>

        <div style={{position:'absolute',top:'5vh',left:'-460px',opacity:'.85',animation:'bm-cloud 84s linear infinite'}}>
          <div style={{position:'relative',width:'420px',height:'132px'}}>
            <span style={{position:'absolute',left:'96px',top:'0',width:'168px',height:'33px',background:'var(--cloud-a)'}}></span>
            <span style={{position:'absolute',left:'36px',top:'33px',width:'312px',height:'33px',background:'var(--cloud-b)'}}></span>
            <span style={{position:'absolute',left:'0',top:'66px',width:'420px',height:'33px',background:'var(--cloud-c)'}}></span>
            <span style={{position:'absolute',left:'24px',top:'99px',width:'360px',height:'33px',background:'var(--cloud-d)'}}></span>
            <span style={{position:'absolute',left:'120px',top:'16px',width:'33px',height:'17px',background:'var(--cloud-e)'}}></span>
          </div>
        </div>
        <div style={{position:'absolute',top:'18vh',left:'-460px',opacity:'.7',animation:'bm-cloud 118s linear 12s infinite'}}>
          <div style={{position:'relative',width:'330px',height:'104px'}}>
            <span style={{position:'absolute',left:'78px',top:'0',width:'130px',height:'26px',background:'var(--cloud-b)'}}></span>
            <span style={{position:'absolute',left:'26px',top:'26px',width:'247px',height:'26px',background:'var(--cloud-c)'}}></span>
            <span style={{position:'absolute',left:'0',top:'52px',width:'330px',height:'26px',background:'var(--cloud-c)'}}></span>
            <span style={{position:'absolute',left:'18px',top:'78px',width:'286px',height:'26px',background:'var(--cloud-d)'}}></span>
          </div>
        </div>
        <div style={{position:'absolute',top:'33vh',left:'-460px',opacity:'.55',animation:'bm-cloud 152s linear 34s infinite'}}>
          <div style={{position:'relative',width:'250px',height:'80px'}}>
            <span style={{position:'absolute',left:'60px',top:'0',width:'100px',height:'20px',background:'var(--cloud-b)'}}></span>
            <span style={{position:'absolute',left:'20px',top:'20px',width:'190px',height:'20px',background:'var(--cloud-c)'}}></span>
            <span style={{position:'absolute',left:'0',top:'40px',width:'250px',height:'20px',background:'var(--cloud-c)'}}></span>
            <span style={{position:'absolute',left:'14px',top:'60px',width:'216px',height:'20px',background:'var(--cloud-d)'}}></span>
          </div>
        </div>
        <div style={{position:'absolute',top:'48vh',left:'-460px',opacity:'.4',animation:'bm-cloud 196s linear 62s infinite'}}>
          <div style={{position:'relative',width:'190px',height:'60px'}}>
            <span style={{position:'absolute',left:'44px',top:'0',width:'76px',height:'20px',background:'var(--cloud-d)'}}></span>
            <span style={{position:'absolute',left:'14px',top:'20px',width:'148px',height:'20px',background:'var(--cloud-b)'}}></span>
            <span style={{position:'absolute',left:'0',top:'40px',width:'190px',height:'20px',background:'var(--cloud-d)'}}></span>
          </div>
        </div>

        <div style={{position:'absolute',left:'12%',right:'12%',top:'0',height:'100vh',display:'flex',justifyContent:'space-between',alignItems:'flex-start',opacity:'.42'}}>
          <span style={{display:'grid',gridTemplateColumns:'repeat(2,30px)',gap:'4px',animation:'bm-drop 12s steps(14) infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#9FE3B6'}}></span><span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span><span style={{height:'30px',background:'#9FE3B6'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(3,30px)',gap:'4px',animation:'bm-drop 17s steps(18) 3.5s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#FF9900'}}></span><span style={{height:'30px',background:'#FF9900'}}></span><span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span><span style={{height:'30px',background:'#FF9900'}}></span><span style={{height:'30px',background:'transparent'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(1,30px)',gap:'4px',animation:'bm-drop 14s steps(16) 7s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#C4AEF2'}}></span><span style={{height:'30px',background:'#C4AEF2'}}></span><span style={{height:'30px',background:'#C4AEF2'}}></span><span style={{height:'30px',background:'#C4AEF2'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(2,30px)',gap:'4px',animation:'bm-drop 20s steps(22) 10.5s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#9FE3B6'}}></span><span style={{height:'30px',background:'transparent'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span><span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span><span style={{height:'30px',background:'#9FE3B6'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(3,30px)',gap:'4px',animation:'bm-drop 15s steps(17) 14s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#FF9900'}}></span><span style={{height:'30px',background:'transparent'}}></span><span style={{height:'30px',background:'transparent'}}></span>
            <span style={{height:'30px',background:'#FF9900'}}></span><span style={{height:'30px',background:'#FF9900'}}></span><span style={{height:'30px',background:'#FF9900'}}></span>
          </span>
        </div>
        <div style={{position:'absolute',inset:'-8%',transform:'translate3d(0,calc(var(--g1) * 1px),0)'}}>
          <div style={{position:'absolute',inset:'-40px',backgroundImage:'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px)',backgroundSize:'34px 34px',animation:'bm-slide 9s linear infinite'}}></div>
        </div>
        <div style={{position:'absolute',inset:'-8%',transform:'translate3d(0,calc(var(--g2) * 1px),0)',backgroundImage:'linear-gradient(var(--grid2) 1px,transparent 1px),linear-gradient(90deg,var(--grid2) 1px,transparent 1px)',backgroundSize:'136px 136px'}}></div>
        <div style={{position:'absolute',inset:'0',overflow:'hidden'}}>
          <span style={{position:'absolute',bottom:'-10px',left:'9%',width:'7px',height:'7px',background:'#9FE3B6',opacity:'.5',animation:'bm-float 15s steps(20) infinite'}}></span>
          <span style={{position:'absolute',bottom:'-10px',left:'26%',width:'5px',height:'5px',background:'#FF9900',opacity:'.45',animation:'bm-float 21s steps(20) 2.5s infinite'}}></span>
          <span style={{position:'absolute',bottom:'-10px',left:'44%',width:'6px',height:'6px',background:'#C4AEF2',opacity:'.5',animation:'bm-float 18s steps(20) 5s infinite'}}></span>
          <span style={{position:'absolute',bottom:'-10px',left:'63%',width:'5px',height:'5px',background:'#9FE3B6',opacity:'.4',animation:'bm-float 24s steps(20) 1.2s infinite'}}></span>
          <span style={{position:'absolute',bottom:'-10px',left:'79%',width:'7px',height:'7px',background:'#FF9900',opacity:'.4',animation:'bm-float 17s steps(20) 7s infinite'}}></span>
          <span style={{position:'absolute',bottom:'-10px',left:'92%',width:'5px',height:'5px',background:'#C4AEF2',opacity:'.45',animation:'bm-float 20s steps(20) 3.6s infinite'}}></span>
        </div>
        <div style={{position:'absolute',inset:'0',backgroundImage:'repeating-linear-gradient(rgba(20,22,28,0) 0px,rgba(20,22,28,0) 2px,var(--scan) 3px,var(--scan) 4px)',animation:'bm-scan 1.1s steps(2) infinite'}}></div>
        <div style={{position:'absolute',inset:'0',background:'radial-gradient(130% 100% at 50% 50%,rgba(20,22,28,0) 40%,rgba(11,13,18,.85) 100%)'}}></div>
      </div>

      <div style={{position:'fixed',top:'0',left:'0',right:'0',height:'8px',background:'var(--bar)',zIndex:'50',display:'flex'}}><div style={{height:'100%',background:'#FF9900',transformOrigin:'0 50%',transform:'scaleX(calc(var(--prog)))',boxShadow:'0 0 0 0 #FF9900'}}></div></div>

      {/* The handoff also set backdrop-filter:blur(10px) here. Behind an opaque
        --surface it draws nothing, but it makes the GPU re-blur the animated
        background every frame, which cost frames on the transition. Dropped. */}
    <header style={{position:'sticky',top:'8px',zIndex:'40',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',flexWrap:'wrap',padding:'12px clamp(14px,5vw,56px)',background:'var(--surface)',borderBottom:'3px solid var(--line)'}}>
        <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.4vw,23px)',fontWeight:'700',letterSpacing:'.02em',color:'var(--ink)'}}>SCD<span style={{color:'var(--amber-ink)'}}>.</span>HYD<span style={{color:'var(--mint-ink)'}}>26</span></span>
        <nav style={{display:'flex',alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end',gap:'clamp(7px,2vw,20px)',minWidth:'0',fontFamily:'var(--font-display)',fontSize:'clamp(13px,3.2vw,16px)'}}>
          <button type="button" onClick={toggleTheme} aria-label="Toggle dark mode" style={{display:'inline-flex',alignItems:'center',gap:'7px',height:'38px',padding:'0 12px',background:'transparent',border:'3px solid var(--line)',color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'14px',cursor:'pointer',transition:'transform .1s steps(2)'}} className="lp-hv-lift2">
            <span data-theme-dot="1" style={{width:'10px',height:'10px',display:'block'}}></span><span data-theme-label="dark">DARK</span><span data-theme-label="light">LIGHT</span>
          </button>
          <a href="#what" style={{color:'var(--ink)',transition:'color .12s steps(2)'}} className="lp-hv-mint-text">ABOUT</a>
          <a href="#prog" style={{color:'var(--ink)',transition:'color .12s steps(2)'}} className="lp-hv-mint-text">SESSIONS</a>
          <a href="#passes" style={{color:'var(--ink)',transition:'color .12s steps(2)'}} className="lp-hv-mint-text">PASSES</a>
          <Link href="/register" style={{display:'inline-flex',alignItems:'center',minHeight:'44px',padding:'0 16px',background:'#FF9900',color:'var(--on-fill)',fontWeight:'700',boxShadow:'4px 4px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}} className="lp-hv-nav-cta lp-ac-press">REGISTER</Link>
        </nav>
      </header>

      <main id="main">
      <section style={{position:'relative',zIndex:'10',padding:'clamp(28px,7vh,80px) clamp(14px,4vw,40px) clamp(30px,7vh,70px)',maxWidth:'1240px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'clamp(22px,4vh,40px)'}}>
        <div data-in="1" style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px',fontFamily:'var(--font-mono)',fontSize:'clamp(9.5px,2.5vw,11.5px)',letterSpacing:'.2em',textTransform:'uppercase'}}>
          <span style={{background:'#9FE3B6',color:'var(--on-fill)',padding:'5px 8px',fontWeight:'600'}}>LOADED: /EVENT/SCD-HYD-2026</span>
          <span style={{color:'var(--muted)'}}>READY<span style={{animation:'bm-blink 1s steps(1) infinite',color:'var(--mint-ink)'}}>_</span></span>
          <span style={{display:'inline-flex',alignItems:'center',gap:'6px',color:'var(--muted)'}}>LIVE<span style={{width:'8px',height:'8px',background:'#FF9900',animation:'bm-pulse 2.2s steps(3) infinite'}}></span></span>
        </div>

        <h1 data-in="1" data-type="1" style={{margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(36px,9.4vw,88px)',lineHeight:'.92',letterSpacing:'.01em',wordSpacing:'.06em',color:'var(--ink)',maxWidth:'15ch',textShadow:'4px 4px 0 var(--h-sh1)',animation:'bm-glitch 7s steps(1) 2s infinite'}}>
          <span data-t1="1">AWS STUDENT</span><br /><span data-t2="1"><span style={{color:'var(--amber-ink)'}}>COMMUNITY</span> DAY</span><span data-caret="1" style={{display:'inline-block',width:'.34em',height:'.62em',background:'var(--ink-fill)',verticalAlign:'baseline',marginLeft:'.12em',animation:'bm-caret 1s steps(1) infinite'}}></span>
        </h1>
        <div data-in="1" data-rot="1" style={{display:'flex',alignItems:'center',gap:'10px',minHeight:'30px',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.6vw,26px)',color:'var(--mint-ink)'}}>
          <span style={{color:'var(--muted)'}}>&gt;</span><span data-rotw="1">for the ones who build</span>
        </div>

        <div data-in="1" style={{display:'grid',gap:'clamp(14px,2.2vw,22px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,190px),1fr))'}}>
          <div style={{border:'3px solid #9FE3B6',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',boxShadow:'6px 6px 0 var(--sh)',transition:'transform .12s steps(2),box-shadow .12s steps(2)'}} className="lp-hv-date-card">
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>DATE</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'clamp(20px,5vw,26px)',color:'var(--ink)'}}>30.10.2026</span>
          </div>
          <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',transition:'transform .12s steps(2),border-color .12s steps(2),box-shadow .12s steps(2)'}} className="lp-hv-stat-card">
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>DOORS</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'clamp(20px,5vw,26px)',color:'var(--ink)'}}>{doors} IST</span>
          </div>
          <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',transition:'transform .12s steps(2),border-color .12s steps(2),box-shadow .12s steps(2)'}} className="lp-hv-stat-card">
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>SESSIONS</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'clamp(20px,5vw,26px)',color:'var(--ink)'}}>{formatCount} FORMATS</span>
          </div>
          <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',transition:'transform .12s steps(2),border-color .12s steps(2),box-shadow .12s steps(2)'}} className="lp-hv-stat-card">
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>PLACE</span>
            <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(20px,5vw,26px)',color:'var(--ink)'}}>VJIT HYD</span>
          </div>
        </div>

        <p data-in="1" style={{margin:'0',maxWidth:'50ch',fontSize:'clamp(15px,4vw,18.5px)',lineHeight:'1.6',color:'var(--body)'}}>Keynote, technical sessions, hands-on workshops and a panel, one Friday. Open to students from any college in Hyderabad, lunch included on every pass.</p>

        <div data-in="1" style={{display:'flex',flexWrap:'wrap',gap:'16px',alignItems:'stretch'}}>
          <Link href="/register" style={{boxSizing:'border-box',display:'inline-flex',alignItems:'center',justifyContent:'center',height:'56px',padding:'0 24px',border:'3px solid #FF9900',background:'#FF9900',color:'var(--on-fill)',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.4vw,21px)',fontWeight:'700',boxShadow:'6px 6px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2),background .1s steps(2)'}} className="lp-hv-hero-btn lp-ac-press">&gt; GET NOTIFIED</Link>
          <a href="#prog" style={{boxSizing:'border-box',display:'inline-flex',alignItems:'center',justifyContent:'center',height:'56px',padding:'0 24px',border:'3px solid #9FE3B6',background:'transparent',color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.4vw,21px)',boxShadow:'6px 6px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2),background .12s steps(2),color .12s steps(2)'}} className="lp-hv-hero-btn lp-ac-press">VIEW PROGRAMME</a>
        </div>

        <div data-in="1" style={{display:'flex',alignItems:'center',gap:'10px',fontFamily:'var(--font-mono)',fontSize:'clamp(9.5px,2.6vw,11px)',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>
          <span style={{display:'flex',gap:'3px'}}>
            <span style={{width:'9px',height:'9px',background:'#FF9900'}}></span>
            <span style={{width:'9px',height:'9px',background:'#FF9900',opacity:'.6'}}></span>
            <span style={{width:'9px',height:'9px',background:'#D6CFC5'}}></span>
            <span style={{width:'9px',height:'9px',background:'#D6CFC5'}}></span>
          </span>
          {registrationOpen ? 'Registration is open' : 'Registrations open soon · Get notified'}
        </div>
      </section>

      <div style={{position:'relative',zIndex:'10',overflow:'hidden',background:'#FF9900',borderTop:'4px solid var(--line)',borderBottom:'4px solid var(--line)'}}>
        <div style={{display:'flex',width:'max-content',fontFamily:'var(--font-display)',fontSize:'clamp(16px,4vw,21px)',color:'var(--on-fill)',padding:'8px 0',animation:'bm-march 22s linear infinite'}}>
          <span style={{display:'flex',gap:'22px',paddingRight:'22px'}}><span>KEYNOTE</span><span>◆</span><span>CLOUD ENGINEERING</span><span>◆</span><span>AI</span><span>◆</span><span>HANDS-ON WORKSHOPS</span><span>◆</span><span>Q AND A</span><span>◆</span><span>PANEL DISCUSSION</span><span>◆</span></span>
          <span style={{display:'flex',gap:'22px',paddingRight:'22px'}}><span>KEYNOTE</span><span>◆</span><span>CLOUD ENGINEERING</span><span>◆</span><span>AI</span><span>◆</span><span>HANDS-ON WORKSHOPS</span><span>◆</span><span>Q AND A</span><span>◆</span><span>PANEL DISCUSSION</span><span>◆</span></span>
        </div>
      </div>

      <section id="what" style={{position:'relative',zIndex:'10',borderTop:'4px solid var(--line)',background:'var(--panel)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'flex',flexDirection:'column',gap:'clamp(28px,5vh,52px)'}}>
          <div data-rv="1" style={{display:'grid',gap:'clamp(26px,4.4vw,68px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',alignItems:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// WHAT IS SCD'}</span>
              <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(30px,7.6vw,62px)',lineHeight:'.94',color:'var(--ink)'}}>STUDENT<br />COMMUNITY DAY</h2>
              <span style={{alignSelf:'flex-start',fontFamily:'var(--font-display)',fontSize:'19px',background:'#FF9900',color:'var(--on-fill)',padding:'5px 10px'}}>SCD = S · C · D</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'14px',fontSize:'clamp(15px,3.8vw,17.5px)',lineHeight:'1.65',color:'var(--body)'}}>
              <p style={{margin:'0'}}>A Student Community Day is a one-day technical conference run by an AWS Student Builders Group: by students, for students. Real speakers, real sessions, real certificates, at a price a college student can actually pay.</p>
              <p style={{margin:'0'}}>It is not a workshop series and not a fest. You come in the morning, sit in on a keynote and technical sessions, get hands-on in workshops, eat lunch with people building the same things as you, and leave with something you did not know that morning.</p>
            </div>
          </div>

          <div data-rv="1" style={{display:'grid',gap:'clamp(16px,2.2vw,24px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))'}}>
            <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-mint-edge">
              <span style={{fontFamily:'var(--font-display)',fontSize:'40px',lineHeight:'.9',color:'var(--mint-ink)'}}>S</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--ink)'}}>STUDENT</span>
              <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>Built and run by the AWS Student Builders Group at VJIT. Open to any college in Hyderabad.</p>
            </div>
            <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-amber-edge">
              <span style={{fontFamily:'var(--font-display)',fontSize:'40px',lineHeight:'.9',color:'var(--amber-ink)'}}>C</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--ink)'}}>COMMUNITY</span>
              <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>Volunteer-run, not corporate. The people speaking are the people who show up to these things anyway.</p>
            </div>
            <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-pink-edge">
              <span style={{fontFamily:'var(--font-display)',fontSize:'40px',lineHeight:'.9',color:'var(--pink-ink)'}}>D</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--ink)'}}>DAY</span>
              <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>One Friday, 30 October. Doors at {doors}, sessions all day, lunch in the middle.</p>
            </div>
            <div style={{border:'3px solid #9FE3B6',background:'var(--panel-mint)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',justifyContent:'center',transition:'transform .14s steps(3),box-shadow .14s steps(3)'}} className="lp-hv-lift3-sh">
              <span style={{fontFamily:'var(--font-display)',fontSize:'22px',lineHeight:'1.1',color:'var(--ink)'}}>FIRST ONE?</span>
              <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>Most people here will be at their first conference. Come alone, leave with contacts.</p>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mint-ink)'}}>No experience needed</span>
            </div>
          </div>
        </div>
      </section>

      <div id="prog" data-hstage="1" style={{position:'relative',zIndex:'10',height:'500vh'}}>
        <div style={{position:'sticky',top:'0',height:'100vh',overflow:'hidden',display:'flex',flexDirection:'column',justifyContent:'center',gap:'clamp(12px,2.6vh,24px)',padding:'clamp(64px,11vh,96px) 0 clamp(28px,5vh,48px)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',padding:'0 clamp(18px,5vw,56px)',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--muted)'}}>
            <span style={{color:'var(--mint-ink)'}}>{'// THE SESSIONS'}</span><span data-hcount="1">SESSION 01 / 05</span>
          </div>
          <div data-htrack="1" style={{display:'flex',gap:'clamp(16px,2.6vw,32px)',padding:'0 clamp(18px,5vw,56px)',willChange:'transform'}}>
            <SessionCards />
          </div>
          <div style={{display:'flex',gap:'6px',padding:'0 clamp(18px,5vw,56px)'}}>
            <span data-hbar="0" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}><span style={{display:'block',height:'100%',background:'var(--fmt-keynote)',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span></span>
            <span data-hbar="1" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}><span style={{display:'block',height:'100%',background:'var(--fmt-technical)',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span></span>
            <span data-hbar="2" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}><span style={{display:'block',height:'100%',background:'var(--fmt-workshop)',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span></span>
            <span data-hbar="3" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}><span style={{display:'block',height:'100%',background:'var(--fmt-panel)',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span></span>
            <span data-hbar="4" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}><span style={{display:'block',height:'100%',background:'var(--fmt-qa)',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span></span>
          </div>
        </div>
      </div>
      <section style={{position:'relative',zIndex:'10',borderTop:'4px solid var(--line)',background:'var(--panel)'}}>
        <div data-rv="1" style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'grid',gap:'clamp(26px,4.4vw,68px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,290px),1fr))'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// THE PREMISE'}</span>
            <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(30px,7.6vw,62px)',lineHeight:'.94',color:'var(--ink)'}}>PUT ON BY STUDENTS, FOR STUDENTS</h2>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'14px',fontSize:'clamp(15px,3.8vw,17.5px)',lineHeight:'1.65',color:'var(--body)'}}>
            <p style={{margin:'0'}}>A keynote to open, technical sessions on Cloud Engineering and AI, hands-on workshops and a panel to close. Your pass decides which of these you get.</p>
            <p style={{margin:'0'}}>Run by volunteers from the AWS Student Builders Group at VJIT. Not an AWS event, and we are not pretending otherwise.</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:'8px',paddingTop:'4px',fontFamily:'var(--font-display)',fontSize:'15px',color:'var(--on-fill)'}}>
              <span style={{background:'#9FE3B6',padding:'6px 10px'}}>LUNCH, EVERY TIER</span>
              <span style={{background:'#F6C899',padding:'6px 10px'}}>VEG / NON-VEG</span>
              <span style={{background:'#C4AEF2',padding:'6px 10px'}}>ANY COLLEGE</span>
            </div>
          </div>
        </div>
      </section>

      <section id="passes" style={{position:'relative',zIndex:'10',borderTop:'3px solid var(--line)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)'}}>
          <div data-rv="1" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'14px',flexWrap:'wrap',paddingBottom:'20px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// THE PASSES'}</span>
              <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(30px,7.6vw,62px)',lineHeight:'.94',color:'var(--ink)'}}>FOUR WAYS IN</h2>
            </div>
            <span style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>
              <span>LUNCH ON EVERY ONE</span>
              {earlyBird ? <span style={{background:'#9FE3B6',color:'var(--on-fill)',padding:'6px 10px'}}>{earlyBird.left} OF {earlyBird.total} EARLY BIRD PLACES LEFT</span> : null}
            </span>
          </div>
          <PassCards prices={prices} cta={registrationOpen ? 'REGISTER' : 'NOTIFY ME'} />
          <div data-rv="1" style={{display:'flex',alignItems:'center',gap:'12px',paddingTop:'20px'}}>
            <span style={{display:'grid',gridTemplateColumns:'repeat(3,8px)',gap:'2px',flex:'none'}} aria-hidden="true">
              <span style={{height:'8px',background:'#FF9900'}}></span><span style={{height:'8px',background:'#FF9900'}}></span><span style={{height:'8px',background:'#FF9900'}}></span>
              <span style={{height:'8px',background:'#FF9900'}}></span><span style={{height:'8px',background:'var(--bg)'}}></span><span style={{height:'8px',background:'#FF9900'}}></span>
              <span style={{height:'8px',background:'#FF9900'}}></span><span style={{height:'8px',background:'#FF9900'}}></span><span style={{height:'8px',background:'#FF9900'}}></span>
            </span>
            <p style={{margin:'0',fontSize:'13.5px',lineHeight:'1.6',color:'var(--muted)',maxWidth:'58ch'}}>Swag levels tier 1 to tier 4 are not declared yet. What is inside stays sealed until the day.</p>
          </div>
        </div>
      </section>

      <section id="speakers" style={{position:'relative',zIndex:'10',borderTop:'4px solid var(--line)',background:'var(--panel)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)'}}>
          <div data-rv="1" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'14px',flexWrap:'wrap',paddingBottom:'20px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// THE LINE-UP'}</span>
              <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(30px,7.6vw,62px)',lineHeight:'.94',color:'var(--ink)'}}>NOT ANNOUNCED YET</h2>
            </div>
            <span style={{fontFamily:'var(--font-display)',fontSize:'17px',background:'#FF9900',color:'var(--on-fill)',padding:'6px 10px'}}>FIRST NAMES DROP SOON</span>
          </div>
          <div data-rv="1" data-grid4="1" style={{display:'grid',gap:'clamp(16px,2.2vw,24px)'}}>
            <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-mint-edge">
              <div data-px="1" tabIndex={0} role="button" aria-label="Reveal the track" style={{aspectRatio:'3/4',background:'var(--slot)',position:'relative',overflow:'hidden'}}>
                <div data-px-front="1" style={{position:'absolute',inset:'0',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                <div style={{width:'52%',height:'44%',background:'var(--slot2)',clipPath:'polygon(20% 100%,20% 30%,35% 30%,35% 15%,65% 15%,65% 30%,80% 30%,80% 100%)'}}></div>
                <span style={{position:'absolute',inset:'0',backgroundImage:'radial-gradient(rgba(159,227,182,.18) 1px,transparent 1px)',backgroundSize:'6px 6px',animation:'bm-flick 4s steps(2) infinite'}}></span>
                <span style={{position:'absolute',top:'10px',left:'10px',fontFamily:'var(--font-display)',fontSize:'14px',color:'var(--mint-ink)'}}>???</span>
              </div>
                <div data-px-back="1" style={{position:'absolute',inset:'0',display:'none',flexDirection:'column',justifyContent:'center',gap:'8px',padding:'14px',background:'#9FE3B6'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.18em',color:'#14161C'}}>KEYNOTE</span>
                  <span style={{fontFamily:'var(--font-display)',fontSize:'20px',lineHeight:'1.05',color:'#14161C'}}>OPENING TALK</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'.16em',color:'#14161C',opacity:'.75'}}>SPEAKER SOON</span>
                </div>
                <div data-px-grid="1" style={{position:'absolute',inset:'0',pointerEvents:'none'}}></div></div>
              <div style={{height:'12px',width:'72%',background:'var(--slot2)'}}></div>
              <div style={{height:'9px',width:'44%',background:'var(--bar)'}}></div>
            </div>
            <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-mint-edge">
              <div data-px="1" tabIndex={0} role="button" aria-label="Reveal the track" style={{aspectRatio:'3/4',background:'var(--slot)',position:'relative',overflow:'hidden'}}>
                <div data-px-front="1" style={{position:'absolute',inset:'0',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                <div style={{width:'52%',height:'44%',background:'var(--slot2)',clipPath:'polygon(20% 100%,20% 30%,35% 30%,35% 15%,65% 15%,65% 30%,80% 30%,80% 100%)'}}></div>
                <span style={{position:'absolute',inset:'0',backgroundImage:'radial-gradient(rgba(255,153,0,.16) 1px,transparent 1px)',backgroundSize:'6px 6px',animation:'bm-flick 5.5s steps(2) infinite'}}></span>
                <span style={{position:'absolute',top:'10px',left:'10px',fontFamily:'var(--font-display)',fontSize:'14px',color:'var(--amber-ink)'}}>???</span>
              </div>
                <div data-px-back="1" style={{position:'absolute',inset:'0',display:'none',flexDirection:'column',justifyContent:'center',gap:'8px',padding:'14px',background:'#FF9900'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.18em',color:'#14161C'}}>TECHNICAL</span>
                  <span style={{fontFamily:'var(--font-display)',fontSize:'20px',lineHeight:'1.05',color:'#14161C'}}>CLOUD</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'.16em',color:'#14161C',opacity:'.75'}}>SPEAKER SOON</span>
                </div>
                <div data-px-grid="1" style={{position:'absolute',inset:'0',pointerEvents:'none'}}></div></div>
              <div style={{height:'12px',width:'56%',background:'var(--slot2)'}}></div>
              <div style={{height:'9px',width:'60%',background:'var(--bar)'}}></div>
            </div>
            <div style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-mint-edge">
              <div data-px="1" tabIndex={0} role="button" aria-label="Reveal the track" style={{aspectRatio:'3/4',background:'var(--slot)',position:'relative',overflow:'hidden'}}>
                <div data-px-front="1" style={{position:'absolute',inset:'0',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                <div style={{width:'52%',height:'44%',background:'var(--slot2)',clipPath:'polygon(20% 100%,20% 30%,35% 30%,35% 15%,65% 15%,65% 30%,80% 30%,80% 100%)'}}></div>
                <span style={{position:'absolute',inset:'0',backgroundImage:'radial-gradient(rgba(154,141,255,.18) 1px,transparent 1px)',backgroundSize:'6px 6px',animation:'bm-flick 4.8s steps(2) infinite'}}></span>
                <span style={{position:'absolute',top:'10px',left:'10px',fontFamily:'var(--font-display)',fontSize:'14px',color:'var(--violet-ink)'}}>???</span>
              </div>
                <div data-px-back="1" style={{position:'absolute',inset:'0',display:'none',flexDirection:'column',justifyContent:'center',gap:'8px',padding:'14px',background:'#C4AEF2'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.18em',color:'#14161C'}}>PANEL</span>
                  <span style={{fontFamily:'var(--font-display)',fontSize:'20px',lineHeight:'1.05',color:'#14161C'}}>PANEL DISCUSSION</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'.16em',color:'#14161C',opacity:'.75'}}>SPEAKER SOON</span>
                </div>
                <div data-px-grid="1" style={{position:'absolute',inset:'0',pointerEvents:'none'}}></div></div>
              <div style={{height:'12px',width:'64%',background:'var(--slot2)'}}></div>
              <div style={{height:'9px',width:'38%',background:'var(--bar)'}}></div>
            </div>
            <div style={{border:'3px solid #9FE3B6',background:'var(--panel-mint)',padding:'16px',display:'flex',flexDirection:'column',gap:'12px',justifyContent:'center',transition:'transform .14s steps(3),box-shadow .14s steps(3)'}} className="lp-hv-lift3-sh">
              <div style={{fontFamily:'var(--font-display)',fontSize:'25px',lineHeight:'1.05',color:'var(--ink)'}}>WANT TO SPEAK?</div>
              <p style={{margin:'0',fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Call for speakers is open: students and working engineers both.</p>
              {/* /speak and /sponsor are handoff screens not yet ported. Until they
              are, these CTAs open a mail with a fixed subject, so the two most
              time sensitive audiences never hit a 404. Swap the hrefs back when
              the screens land; the buttons themselves are unchanged. */}
          <a href="mailto:awssbgvjit@gmail.com?subject=Speaker%20-%20AWS%20SCD%20Hyderabad" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'48px',background:'#9FE3B6',color:'var(--on-fill)',fontFamily:'var(--font-display)',fontSize:'18px',boxShadow:'5px 5px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}} className="lp-hv-mint-btn lp-ac-press">APPLY TO SPEAK</a>
            </div>
          </div>
        </div>
      </section>

      <section id="sponsors" style={{position:'relative',zIndex:'10',borderTop:'3px solid var(--line)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'flex',flexDirection:'column',gap:'clamp(18px,3.4vh,32px)'}}>

          <div data-rv="1" style={{border:'4px solid #FF9900',background:'var(--surface)',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:'clamp(14px,2.6vh,26px)',padding:'clamp(34px,6vw,72px) clamp(20px,5vw,56px)',boxShadow:'8px 8px 0 var(--sh)'}}>
            <span style={{position:'absolute',inset:'0',backgroundImage:'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px)',backgroundSize:'20px 20px',pointerEvents:'none'}}></span>
            <span style={{position:'relative',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.24em',textTransform:'uppercase',background:'#FF9900',color:'var(--on-fill)',padding:'6px 11px'}}>Title sponsor</span>
            <h2 data-aws="1" style={{position:'relative',margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(30px,7.6vw,78px)',lineHeight:'1',letterSpacing:'.01em',color:'var(--amber-ink)',textShadow:'4px 4px 0 var(--line-soft)',display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'0 .5em',whiteSpace:'nowrap'}}>
              <span style={{display:'inline-flex'}}>A<span data-exp="1" style={{display:'inline-block',maxWidth:'0',overflow:'hidden',color:'var(--gold2)'}}>mazon</span></span>
              <span style={{display:'inline-flex'}}>W<span data-exp="1" style={{display:'inline-block',maxWidth:'0',overflow:'hidden',color:'var(--gold2)'}}>eb</span></span>
              <span style={{display:'inline-flex'}}>S<span data-exp="1" style={{display:'inline-block',maxWidth:'0',overflow:'hidden',color:'var(--gold2)'}}>ervices</span></span>
            </h2>

            <p style={{position:'relative',margin:'0',maxWidth:'52ch',fontSize:'clamp(15px,3.8vw,18px)',lineHeight:'1.62',color:'var(--body)'}}>This day exists because AWS funds community events run by students. The programme, the halls, the swag and the lunch are all paid for out of that support.</p>

          </div>

          <div data-rv="1" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'14px',flexWrap:'wrap',paddingTop:'6px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// COMMUNITY SPONSORS'}</span>
              <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(28px,7vw,56px)',lineHeight:'.94',color:'var(--ink)'}}>WHO ELSE IS BEHIND IT</h2>
            </div>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Food · event · swag</span>
          </div>

          <div data-rv="1" style={{display:'grid',gap:'clamp(18px,2.6vw,28px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,330px),1fr))',alignItems:'stretch'}}>
            <a href="https://www.linkedin.com/company/csxia/" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'14px',color:'var(--ink)',transition:'transform .14s steps(3),border-color .14s steps(2),box-shadow .14s steps(3)'}} className="lp-hv-card">
              <span style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mint-ink)'}}>Community partner</span>
                <span style={{display:'flex',gap:'3px'}} aria-hidden="true"><span style={{width:'8px',height:'8px',background:'#9FE3B6'}}></span><span style={{width:'8px',height:'8px',background:'#9FE3B6'}}></span><span style={{width:'8px',height:'8px',background:'var(--bar)'}}></span></span>
              </span>
              <span style={{background:'var(--bg)',border:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',minHeight:'200px'}}>
                <Image src="/assets/csxia-logo.jpeg" alt="CSXIA" width={200} height={200} sizes="220px" style={{width:'100%',maxWidth:'220px',height:'auto',display:'block',imageRendering:'auto'}} />
              </span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'26px',color:'var(--ink)'}}>CSXIA</span>
              <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Engage. Learn. Build. Level up.</span>
              <span style={{marginTop:'auto',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mint-ink)'}}>View on LinkedIn →</span>
            </a>

            <div style={{border:'3px dashed var(--line-dash)',background:'var(--surface)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-violet-edge">
              <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--muted)'}}>Slot open</span>
              <span aria-hidden="true" style={{background:'var(--panel)',border:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'200px',fontFamily:'var(--font-display)',fontSize:'56px',color:'#D6CFC5'}}>?</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'20px',color:'var(--ink)'}}>FOOD SPONSOR</span>
              <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Feed 300 students and get your name on every table.</span>
            </div>

            <div style={{border:'3px dashed var(--line-dash)',background:'var(--surface)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}} className="lp-hv-violet-edge">
              <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--muted)'}}>Slot open</span>
              <span aria-hidden="true" style={{background:'var(--panel)',border:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'200px',fontFamily:'var(--font-display)',fontSize:'56px',color:'#D6CFC5'}}>?</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'20px',color:'var(--ink)'}}>SWAG SPONSOR</span>
              <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Your thing in every swag kit, tier 1 to tier 4.</span>
            </div>

            <div style={{border:'3px solid #9FE3B6',background:'var(--panel-mint)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'12px',justifyContent:'center',transition:'transform .14s steps(3),box-shadow .14s steps(3)'}} className="lp-hv-lift4-sh">
              <span style={{fontFamily:'var(--font-display)',fontSize:'25px',lineHeight:'1.05',color:'var(--ink)'}}>BACK THE DAY</span>
              <p style={{margin:'0',fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Food, event and swag sponsorships are all open. Tell us which one fits.</p>
              <a href="mailto:awssbgvjit@gmail.com?subject=Sponsor%20-%20AWS%20SCD%20Hyderabad" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'48px',background:'#9FE3B6',color:'var(--on-fill)',fontFamily:'var(--font-display)',fontSize:'18px',boxShadow:'5px 5px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}} className="lp-hv-mint-btn lp-ac-press">BECOME A SPONSOR</a>
            </div>
          </div>
        </div>
      </section>

      <section id="venue" style={{position:'relative',zIndex:'10',borderTop:'3px solid var(--line)'}}>
        <div data-rv="1" style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'grid',gap:'clamp(26px,4.4vw,68px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,290px),1fr))',alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// THE PLACE'}</span>
            <div style={{display:'flex',alignItems:'flex-start',gap:'12px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'clamp(76px,20vw,180px)',lineHeight:'.78',color:'var(--ink)',textShadow:'5px 5px 0 #F6C899'}}>30</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'clamp(11px,2.6vw,13px)',letterSpacing:'.18em',textTransform:'uppercase',paddingTop:'10px',color:'var(--body)'}}>OCT<br />2026<br />{doors}</span>
            </div>
            <p style={{margin:'0',maxWidth:'40ch',fontSize:'clamp(15px,3.8vw,17px)',lineHeight:'1.65',color:'var(--body)'}}>Vidya Jyothi Institute of Technology, Aziznagar Village Road, Aziznagar, Hyderabad, Telangana 500075.</p>
            <a href="https://maps.app.goo.gl/PAPnu2YHVdWE2pvQ6" style={{display:'inline-flex',alignSelf:'flex-start',alignItems:'center',minHeight:'52px',padding:'0 22px',background:'var(--ink-fill)',color:'var(--bg)',fontFamily:'var(--font-display)',fontSize:'18px',boxShadow:'5px 5px 0 #9FE3B6',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}} className="lp-hv-pin">OPEN THE GATE PIN</a>
          </div>
          <div style={{display:'flex',flexDirection:'column',border:'3px solid var(--line)',background:'var(--surface)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',borderBottom:'2px solid var(--line-soft)',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}><span style={{color:'var(--muted)'}}>Session types</span><span style={{color:'var(--mint-ink)'}}>{formatCount}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',borderBottom:'2px solid var(--line-soft)',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}><span style={{color:'var(--muted)'}}>Keynote</span><span>Every pass</span></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',borderBottom:'2px solid var(--line-soft)',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}><span style={{color:'var(--muted)'}}>Workshops · panel</span><span>By pass tier</span></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}><span style={{color:'var(--muted)'}}>Timings</span><span>Announced soon</span></div>
          </div>
        </div>
      </section>

      <section id="faq" style={{position:'relative',zIndex:'10',borderTop:'3px solid var(--line)',background:'var(--panel)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'flex',flexDirection:'column',gap:'clamp(24px,4vh,42px)'}}>
          <div data-rv="1" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'14px',flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// BEFORE YOU ASK'}</span>
              <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontWeight:'700',fontSize:'clamp(30px,7.6vw,62px)',lineHeight:'.94',color:'var(--ink)'}}>QUESTIONS</h2>
            </div>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Still stuck? Mail us</span>
          </div>

          <div data-rv="1" style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>Who can attend?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Any student, from any college in Hyderabad. You do not have to be from VJIT. Attendees must be 18 or older.</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>Do I need experience with AWS?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>No. Most people in the room will be at their first conference. The talks run from introductory to deeper technical ones, and the workshops start from scratch.</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>How do sessions and seats work?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>There are four kinds of session: a keynote, technical sessions on Cloud Engineering and AI, hands-on workshops and a panel discussion, plus an open Q and A. Every pass gets the keynote and one technical session. Premium adds the Q and A and a hands-on workshop, Platinum adds the panel, and VIP adds front-row seating, a speaker group photo, networking with speakers and dedicated assistance. Timings are announced closer to the day.</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>What time does it start?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Doors open at {doors}. Session timings are announced closer to the day.</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>Is food included?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Yes, on every tier. You choose veg or non-veg when you register, and that choice goes straight to the caterer, so pick it carefully.</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>What is in the swag?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Not declared. Swag level rises with the tier, tier 1 through tier 4, and what is actually inside stays sealed until you collect it on the day.</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>How do I register?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>{registrationOpen
                ? 'Registration is open now. Pick a tier, fill in your details, and pay by UPI. Your pass link arrives by email once the payment is checked.'
                : 'Registrations are not open yet. Leave your email on the register page and we will write to you the moment they open.'}</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>Is this run by AWS?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>No. It is organised by volunteers from the AWS Student Builders Group at VJIT. AWS funds it as a community event, which is why the tickets cost what they do, but the day is ours to run.</div>
            </details>
            <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
              <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(17px,4.2vw,21px)',color:'var(--ink)'}}>Can I speak or sponsor?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
              <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Both are open. Students and working engineers can apply to speak, and food, event and swag sponsorships are available. Mail <a href="mailto:awssbgvjit@gmail.com">awssbgvjit@gmail.com</a> and say which one.</div>
            </details>
          </div>
        </div>
      </section>
      </main>

      <footer style={{position:'relative',zIndex:'10',borderTop:'6px solid var(--line)',background:'var(--panel)',padding:'clamp(44px,8vh,92px) clamp(18px,5vw,56px)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'clamp(20px,4vh,40px)'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(28px,8vw,80px)',lineHeight:'.92',color:'var(--ink)'}}>AWS STUDENT COMMUNITY DAY <span style={{color:'var(--amber-ink)'}}>HYDERABAD</span></span>
          <div style={{display:'grid',gap:'20px',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',borderTop:'3px solid #D6CFC5',paddingTop:'22px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'11px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>The day</span>
              <a href="#what" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>ABOUT</a>
              <a href="#prog" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>SESSIONS</a>
              <a href="#speakers" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>SPEAKERS</a>
              <a href="#venue" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>VENUE</a>
              <a href="#faq" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>FAQ</a>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'11px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Take part</span>
              <Link href="/register" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>REGISTER</Link>
              <a href="#passes" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>PASSES</a>
              <a href="mailto:awssbgvjit@gmail.com?subject=Speaker%20-%20AWS%20SCD%20Hyderabad" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>APPLY TO SPEAK</a>
              <a href="mailto:awssbgvjit@gmail.com?subject=Sponsor%20-%20AWS%20SCD%20Hyderabad" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>SPONSOR US</a>
              <a href="#sponsors" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>OUR SPONSORS</a>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'11px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Help</span>
              <Link href="/code-of-conduct" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>CODE OF CONDUCT</Link>
              <Link href="/code-of-conduct#report" style={{display:'inline-flex',alignItems:'center',gap:'8px',alignSelf:'flex-start',minHeight:'44px',padding:'0 14px',border:'3px solid #FF9900',color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'16px',transition:'background .12s steps(2),color .12s steps(2)'}} className="lp-hv-orange-fill"><span style={{width:'9px',height:'9px',background:'#FF9900',display:'block'}}></span>REPORT AN ISSUE</Link>
              <a href="mailto:awssbgvjit@gmail.com" style={{fontSize:'14px',lineHeight:'1.6',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>awssbgvjit@gmail.com</a>
              <span style={{fontSize:'14px',lineHeight:'1.6',color:'var(--body)'}}>Hosted by AWS Student Builders Group, VJIT</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)'}}>awsscdhyd.in</span>
              <Link href="/admin" style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>Crew sign in</Link>
            </div>
            <p style={{margin:'0',fontSize:'12.5px',lineHeight:'1.65',color:'var(--muted)',maxWidth:'44ch'}}>AWS User Groups are run by independent volunteers and are not organized by AWS.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
