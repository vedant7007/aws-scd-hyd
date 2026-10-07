'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Tier } from '@/lib/db/types'
import { formatCount } from '@/content/formats'
import { passes } from '@/content/passes'
import { toggleTheme } from '@/lib/theme'
import { mountLanding } from './mount'

/**
 * The landing page, ported from the design handoff's Landing Bitmap.dc.html
 * (v3). Regenerated from the handoff's markup rather than edited by hand, so
 * every inline value is the handoff's own.
 *
 * The hover and active states its runtime compiled from style-hover and
 * style-active are the dh-* classes in globals.css. Behaviour lives in
 * mount.ts. #FF9900 is a fill colour only, never text; text on an orange
 * fill is var(--on-fill).
 *
 * Departures from the handoff markup, each for a reason the handoff's own
 * rules give: no em dashes in the copy (SPEC.md section 2 rule 2); prices and
 * perks come from content/passes.ts so every page agrees; the doors time and
 * the format count come from content; internal links are <Link>; the theme
 * button renders both labels so it is right before any script runs; the
 * header drops backdrop-filter, which blurred nothing behind an opaque
 * surface but cost a re-blur of the animated background every frame; and the
 * speaker tiles are keyboard reachable buttons.
 */

/** A tier's perks, in the order its card lists them. One source, content/passes.ts. */
const perksOf = (tier: Tier) => passes.find((p) => p.id === tier)?.perks ?? []

type Props = {
  registrationOpen: boolean
  /** Doors, "08:30", from content/event.ts. */
  doors: string
  /** Formatted price per tier, null while a tier is unpriced. */
  prices: Record<Tier, string | null>
}

export function Landing({ registrationOpen, doors, prices }: Props) {
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
          <div style={{position:'relative',width:'420px',height:'132px'}}><span style={{position:'absolute',left:'96px',top:'0',width:'168px',height:'33px',background:'var(--cloud-a)'}}></span>{' '}<span style={{position:'absolute',left:'36px',top:'33px',width:'312px',height:'33px',background:'var(--cloud-b)'}}></span>{' '}<span style={{position:'absolute',left:'0',top:'66px',width:'420px',height:'33px',background:'var(--cloud-c)'}}></span>{' '}<span style={{position:'absolute',left:'24px',top:'99px',width:'360px',height:'33px',background:'var(--cloud-d)'}}></span>{' '}<span style={{position:'absolute',left:'120px',top:'16px',width:'33px',height:'17px',background:'var(--cloud-e)'}}></span></div>
        </div>
        <div style={{position:'absolute',top:'18vh',left:'-460px',opacity:'.7',animation:'bm-cloud 118s linear 12s infinite'}}>
          <div style={{position:'relative',width:'330px',height:'104px'}}><span style={{position:'absolute',left:'78px',top:'0',width:'130px',height:'26px',background:'var(--cloud-b)'}}></span>{' '}<span style={{position:'absolute',left:'26px',top:'26px',width:'247px',height:'26px',background:'var(--cloud-c)'}}></span>{' '}<span style={{position:'absolute',left:'0',top:'52px',width:'330px',height:'26px',background:'var(--cloud-c)'}}></span>{' '}<span style={{position:'absolute',left:'18px',top:'78px',width:'286px',height:'26px',background:'var(--cloud-d)'}}></span></div>
        </div>
        <div style={{position:'absolute',top:'33vh',left:'-460px',opacity:'.55',animation:'bm-cloud 152s linear 34s infinite'}}>
          <div style={{position:'relative',width:'250px',height:'80px'}}><span style={{position:'absolute',left:'60px',top:'0',width:'100px',height:'20px',background:'var(--cloud-b)'}}></span>{' '}<span style={{position:'absolute',left:'20px',top:'20px',width:'190px',height:'20px',background:'var(--cloud-c)'}}></span>{' '}<span style={{position:'absolute',left:'0',top:'40px',width:'250px',height:'20px',background:'var(--cloud-c)'}}></span>{' '}<span style={{position:'absolute',left:'14px',top:'60px',width:'216px',height:'20px',background:'var(--cloud-d)'}}></span></div>
        </div>
        <div style={{position:'absolute',top:'48vh',left:'-460px',opacity:'.4',animation:'bm-cloud 196s linear 62s infinite'}}>
          <div style={{position:'relative',width:'190px',height:'60px'}}><span style={{position:'absolute',left:'44px',top:'0',width:'76px',height:'20px',background:'var(--cloud-d)'}}></span>{' '}<span style={{position:'absolute',left:'14px',top:'20px',width:'148px',height:'20px',background:'var(--cloud-b)'}}></span>{' '}<span style={{position:'absolute',left:'0',top:'40px',width:'190px',height:'20px',background:'var(--cloud-d)'}}></span></div>
        </div>
        <div style={{position:'absolute',left:'12%',right:'12%',top:'0',height:'100vh',display:'flex',justifyContent:'space-between',alignItems:'flex-start',opacity:'.42'}}>
          <span style={{display:'grid',gridTemplateColumns:'repeat(2,30px)',gap:'4px',animation:'bm-drop 12s steps(14) infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(3,30px)',gap:'4px',animation:'bm-drop 17s steps(18) 3.5s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span>
            <span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(1,30px)',gap:'4px',animation:'bm-drop 14s steps(16) 7s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#C4AEF2'}}></span>
            <span style={{height:'30px',background:'#C4AEF2'}}></span>
            <span style={{height:'30px',background:'#C4AEF2'}}></span>
            <span style={{height:'30px',background:'#C4AEF2'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(2,30px)',gap:'4px',animation:'bm-drop 20s steps(22) 10.5s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span>
            <span style={{height:'30px',background:'#9FE3B6'}}></span>
          </span>
          <span style={{display:'grid',gridTemplateColumns:'repeat(3,30px)',gap:'4px',animation:'bm-drop 15s steps(17) 14s infinite'}} aria-hidden="true">
            <span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span>
            <span style={{height:'30px',background:'transparent'}}></span>
            <span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'#FF9900'}}></span>
            <span style={{height:'30px',background:'#FF9900'}}></span>
          </span>
        </div>
        <div style={{position:'absolute',inset:'-8%',transform:'translate3d(0,calc(var(--g1) * 1px),0)'}}>
          <div style={{position:'absolute',inset:'-40px',backgroundImage:'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px)',backgroundSize:'34px 34px',animation:'bm-slide 9s linear infinite'}}></div>
        </div>
        <div style={{position:'absolute',inset:'-8%',transform:'translate3d(0,calc(var(--g2) * 1px),0)',backgroundImage:'linear-gradient(var(--grid2) 1px,transparent 1px),linear-gradient(90deg,var(--grid2) 1px,transparent 1px)',backgroundSize:'136px 136px'}}></div>
        <div style={{position:'absolute',inset:'0',overflow:'hidden'}}><span style={{position:'absolute',bottom:'-10px',left:'9%',width:'7px',height:'7px',background:'#9FE3B6',opacity:'.5',animation:'bm-float 15s steps(20) infinite'}}></span>{' '}<span style={{position:'absolute',bottom:'-10px',left:'26%',width:'5px',height:'5px',background:'#FF9900',opacity:'.45',animation:'bm-float 21s steps(20) 2.5s infinite'}}></span>{' '}<span style={{position:'absolute',bottom:'-10px',left:'44%',width:'6px',height:'6px',background:'#C4AEF2',opacity:'.5',animation:'bm-float 18s steps(20) 5s infinite'}}></span>{' '}<span style={{position:'absolute',bottom:'-10px',left:'63%',width:'5px',height:'5px',background:'#9FE3B6',opacity:'.4',animation:'bm-float 24s steps(20) 1.2s infinite'}}></span>{' '}<span style={{position:'absolute',bottom:'-10px',left:'79%',width:'7px',height:'7px',background:'#FF9900',opacity:'.4',animation:'bm-float 17s steps(20) 7s infinite'}}></span>{' '}<span style={{position:'absolute',bottom:'-10px',left:'92%',width:'5px',height:'5px',background:'#C4AEF2',opacity:'.45',animation:'bm-float 20s steps(20) 3.6s infinite'}}></span></div>
        <div style={{position:'absolute',inset:'0',backgroundImage:'repeating-linear-gradient(rgba(20,22,28,0) 0px,rgba(20,22,28,0) 2px,var(--scan) 3px,var(--scan) 4px)',animation:'bm-scan 1.1s steps(2) infinite'}}></div>
        <div style={{position:'absolute',inset:'0',background:'radial-gradient(130% 100% at 50% 50%,rgba(20,22,28,0) 40%,rgba(11,13,18,.85) 100%)'}}></div>
      </div>

      <div style={{position:'fixed',top:'0',left:'0',right:'0',height:'8px',background:'var(--bar)',zIndex:'50',display:'flex'}}>
        <div style={{height:'100%',background:'#FF9900',transformOrigin:'0 50%',transform:'scaleX(calc(var(--prog)))',boxShadow:'0 0 0 0 #FF9900'}}></div>
      </div>

      {registrationOpen ? <GroupPromo /> : null}
      <header style={{position:'sticky',top:'8px',zIndex:'40',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',flexWrap:'wrap',padding:'12px clamp(14px,5vw,56px)',background:'var(--surface)',borderBottom:'3px solid var(--line)'}}>
        <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(24px,6vw,32px)',letterSpacing:'.02em',color:'var(--ink)'}}>SCD<span style={{color:'var(--amber-ink)'}}>.</span>HYD<span style={{color:'var(--mint-ink)'}}>26</span></span>
        <nav style={{display:'flex',alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end',gap:'clamp(7px,2vw,20px)',minWidth:'0',fontFamily:'var(--font-display)',fontSize:'clamp(16.3px,4vw,20px)'}}>
          <button className="dh-h1" type="button" onClick={toggleTheme} aria-label="Toggle dark mode" style={{display:'inline-flex',alignItems:'center',gap:'7px',height:'38px',padding:'0 12px',background:'transparent',border:'3px solid var(--line)',color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'17.5px',cursor:'pointer',transition:'transform .1s steps(2)'}}>
            <span data-theme-dot="1" style={{width:'10px',height:'10px',display:'block'}}></span><span data-theme-label="dark">DARK</span><span data-theme-label="light">LIGHT</span>
          </button>
          <a className="dh-h2" href="#what" style={{color:'var(--ink)',transition:'color .12s steps(2)'}}>ABOUT</a>
          <a className="dh-h2" href="#prog" style={{color:'var(--ink)',transition:'color .12s steps(2)'}}>SESSIONS</a>
          <a className="dh-h2" href="#passes" style={{color:'var(--ink)',transition:'color .12s steps(2)'}}>PASSES</a>
          <Link className="dh-h3 dh-a4" href="/register" style={{display:'inline-flex',alignItems:'center',minHeight:'44px',padding:'0 16px',background:'#FF9900',color:'var(--on-fill)',fontWeight:'700',boxShadow:'4px 4px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>REGISTER</Link>
        </nav>
      </header>

      <main id="main">
        <section style={{position:'relative',zIndex:'10',padding:'clamp(28px,7vh,80px) clamp(14px,4vw,40px) clamp(30px,7vh,70px)',maxWidth:'1240px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'clamp(22px,4vh,40px)'}}>
          <div data-in="1" style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px',fontFamily:'var(--font-mono)',fontSize:'clamp(9.5px,2.5vw,11.5px)',letterSpacing:'.2em',textTransform:'uppercase'}}>
            <span style={{background:'#9FE3B6',color:'var(--on-fill)',padding:'5px 8px',fontWeight:'600'}}>LOADED: /EVENT/SCD-HYD-2026</span>
            <span style={{color:'var(--muted)'}}>READY<span style={{animation:'bm-blink 1s steps(1) infinite',color:'var(--mint-ink)'}}>_</span></span>
            <span style={{display:'inline-flex',alignItems:'center',gap:'6px',color:'var(--muted)'}}>LIVE<span style={{width:'8px',height:'8px',background:'#FF9900',animation:'bm-pulse 2.2s steps(3) infinite'}}></span></span>
          </div>
          <h1 data-in="1" data-type="1" style={{position:'relative',margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(45px,11.8vw,110px)',lineHeight:'.92',letterSpacing:'.01em',wordSpacing:'.06em',color:'var(--ink)',maxWidth:'15ch',textShadow:'4px 4px 0 var(--h-sh1)',animation:'bm-glitch 7s steps(1) 2s infinite'}}><span aria-hidden="true" style={{visibility:'hidden'}}>AWS STUDENT<br />COMMUNITY DAY</span>{' '}<span style={{position:'absolute',inset:'0'}}><span data-t1="1">AWS STUDENT</span><br /><span style={{whiteSpace:'nowrap'}}><span data-t2="1"><span style={{color:'var(--amber-ink)'}}>COMMUNITY</span> DAY</span><span data-caret="1" style={{position:'absolute',display:'inline-block',width:'.34em',height:'.62em',background:'var(--ink-fill)',verticalAlign:'baseline',marginLeft:'.12em',animation:'bm-caret 1s steps(1) infinite'}}></span></span></span></h1>
          <div data-in="1" data-rot="1" style={{display:'flex',alignItems:'center',gap:'10px',minHeight:'30px',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.8vw,32.5px)',color:'var(--mint-ink)'}}>
            <span style={{color:'var(--muted)'}}>{'>'}</span>
            <span data-rotw="1">for the ones who build</span>
          </div>
          <div data-in="1" style={{display:'grid',gap:'clamp(14px,2.2vw,22px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,190px),1fr))'}}>
            <div className="dh-h5" style={{border:'3px solid #9FE3B6',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',boxShadow:'6px 6px 0 var(--sh)',transition:'transform .12s steps(2),box-shadow .12s steps(2)'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>DATE</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(25px,6.3vw,32.5px)',color:'var(--ink)'}}>30.10.2026</span>
            </div>
            <div className="dh-h6" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',transition:'transform .12s steps(2),border-color .12s steps(2),box-shadow .12s steps(2)'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>DOORS</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(25px,6.3vw,32.5px)',color:'var(--ink)'}}>{doors} IST</span>
            </div>
            <div className="dh-h6" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',transition:'transform .12s steps(2),border-color .12s steps(2),box-shadow .12s steps(2)'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>SESSIONS</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(25px,6.3vw,32.5px)',color:'var(--ink)'}}>{formatCount} FORMATS</span>
            </div>
            <div className="dh-h6" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px 20px',display:'flex',flexDirection:'column',gap:'5px',transition:'transform .12s steps(2),border-color .12s steps(2),box-shadow .12s steps(2)'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.2em',color:'var(--muted)'}}>PLACE</span>
              <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(25px,6.3vw,32.5px)',color:'var(--ink)'}}>VJIT HYD</span>
            </div>
          </div>
          <p data-in="1" style={{margin:'0',maxWidth:'50ch',fontSize:'clamp(15px,4vw,18.5px)',lineHeight:'1.6',color:'var(--body)'}}>Keynote, technical sessions, hands-on workshops, a panel and open Q&A, one Friday. Open to students from any college in Hyderabad, lunch included on every pass.</p>
          <div data-in="1" style={{display:'flex',flexWrap:'wrap',gap:'16px',alignItems:'stretch'}}>
            <Link className="dh-h7 dh-a8" href="/register" style={{boxSizing:'border-box',display:'inline-flex',alignItems:'center',justifyContent:'center',height:'56px',padding:'0 24px',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.5vw,26.3px)',lineHeight:'1',boxShadow:'6px 6px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2),background .1s steps(2),color .1s steps(2)',border:'3px solid #FF9900',background:'#FF9900',color:'var(--on-fill)'}}>{registrationOpen ? '> REGISTER' : '> GET NOTIFIED'}</Link>
            <a className="dh-h9 dh-a8" href="#prog" style={{boxSizing:'border-box',display:'inline-flex',alignItems:'center',justifyContent:'center',height:'56px',padding:'0 24px',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.5vw,26.3px)',lineHeight:'1',boxShadow:'6px 6px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2),background .1s steps(2),color .1s steps(2)',border:'3px solid #9FE3B6',background:'var(--surface)',color:'var(--ink)'}}>VIEW PROGRAMME</a>
          </div>
          <div data-in="1" style={{display:'flex',alignItems:'center',gap:'10px',fontFamily:'var(--font-mono)',fontSize:'clamp(9.5px,2.6vw,11px)',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>
            <span style={{display:'flex',gap:'3px'}}>
              <span style={{width:'9px',height:'9px',background:'#FF9900'}}></span>
              <span style={{width:'9px',height:'9px',background:'#FF9900',opacity:'.6'}}></span>
              <span style={{width:'9px',height:'9px',background:'#D6CFC5'}}></span>
              <span style={{width:'9px',height:'9px',background:'#D6CFC5'}}></span>
            </span>
            {registrationOpen ? (<>Registration is open</>) : null}
            {!registrationOpen ? (<>Registrations open soon · <Link href="/register" style={{color:'var(--mint-ink)'}}>Get notified</Link></>) : null}
          </div>
        </section>

        <div style={{position:'relative',zIndex:'10',overflow:'hidden',background:'#FF9900',borderTop:'4px solid var(--line)',borderBottom:'4px solid var(--line)'}}>
          <div style={{display:'flex',width:'max-content',fontFamily:'var(--font-display)',fontSize:'clamp(20px,5vw,26.3px)',color:'var(--on-fill)',padding:'8px 0',animation:'bm-march 22s linear infinite'}}>
            <span style={{display:'flex',gap:'22px',paddingRight:'22px'}}>
              <span>KEYNOTE</span>
              <span>◆</span>
              <span>CLOUD ENGINEERING</span>
              <span>◆</span>
              <span>AI</span>
              <span>◆</span>
              <span>HANDS-ON WORKSHOPS</span>
              <span>◆</span>
              <span>PANEL DISCUSSION</span>
              <span>◆</span>
              <span>Q&A</span>
              <span>◆</span>
            </span>
            <span style={{display:'flex',gap:'22px',paddingRight:'22px'}}>
              <span>KEYNOTE</span>
              <span>◆</span>
              <span>CLOUD ENGINEERING</span>
              <span>◆</span>
              <span>AI</span>
              <span>◆</span>
              <span>HANDS-ON WORKSHOPS</span>
              <span>◆</span>
              <span>PANEL DISCUSSION</span>
              <span>◆</span>
              <span>Q&A</span>
              <span>◆</span>
            </span>
          </div>
        </div>

        <section id="what" style={{position:'relative',zIndex:'10',borderTop:'4px solid var(--line)',background:'var(--panel)'}}>
          <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'flex',flexDirection:'column',gap:'clamp(28px,5vh,52px)'}}>
            <div data-rv="1" style={{display:'grid',gap:'clamp(26px,4.4vw,68px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',alignItems:'start'}}>
              <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// WHAT IS SCD'}</span>
                <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(37.5px,9.5vw,77.5px)',lineHeight:'.94',color:'var(--ink)'}}>STUDENT<br />COMMUNITY DAY</h2>
                <span style={{alignSelf:'flex-start',fontFamily:'var(--font-display)',fontSize:'23.8px',background:'#FF9900',color:'var(--on-fill)',padding:'5px 10px'}}>SCD = S · C · D</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'14px',fontSize:'clamp(15px,3.8vw,17.5px)',lineHeight:'1.65',color:'var(--body)'}}>
                <p style={{margin:'0'}}>A Student Community Day is a one-day technical conference run by an AWS Student Builders Group: by students, for students. Real speakers, real sessions, real certificates, at a price a college student can actually pay.</p>
                <p style={{margin:'0'}}>It is not a workshop series and not a fest. You come in the morning, sit in on a keynote and technical sessions, get hands-on in workshops, eat lunch with people building the same things as you, and leave with something you did not know that morning.</p>
              </div>
            </div>
            <div data-rv="1" style={{display:'grid',gap:'clamp(16px,2.2vw,24px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))'}}>
              <div className="dh-h10" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'50px',lineHeight:'.9',color:'var(--mint-ink)'}}>S</span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'27.5px',color:'var(--ink)'}}>STUDENT</span>
                <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>Built and run by the AWS Student Builders Group at VJIT. Open to any college in Hyderabad.</p>
              </div>
              <div className="dh-h11" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'50px',lineHeight:'.9',color:'var(--amber-ink)'}}>C</span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'27.5px',color:'var(--ink)'}}>COMMUNITY</span>
                <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>Volunteer-run, not corporate. The people speaking are the people who show up to these things anyway.</p>
              </div>
              <div className="dh-h12" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'50px',lineHeight:'.9',color:'var(--pink-ink)'}}>D</span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'27.5px',color:'var(--ink)'}}>DAY</span>
                <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>One Friday, 30 October. Doors at {doors}, sessions all day, lunch in the middle.</p>
              </div>
              <div className="dh-h13" style={{border:'3px solid #9FE3B6',background:'var(--panel-mint)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'11px',justifyContent:'center',transition:'transform .14s steps(3),box-shadow .14s steps(3)'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'27.5px',lineHeight:'1.1',color:'var(--ink)'}}>FIRST ONE?</span>
                <p style={{margin:'0',fontSize:'14px',lineHeight:'1.55',color:'var(--body)'}}>Most people here will be at their first conference. Come alone, leave with contacts.</p>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mint-ink)'}}>No experience needed</span>
              </div>
            </div>
          </div>
        </section>

        <div id="prog" data-hstage="1" style={{position:'relative',zIndex:'10',height:'500vh'}}>
          <div style={{position:'sticky',top:'0',height:'100vh',overflow:'hidden',display:'flex',flexDirection:'column',justifyContent:'center',gap:'clamp(12px,2.6vh,24px)',padding:'clamp(64px,11vh,96px) 0 clamp(28px,5vh,48px)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',padding:'0 clamp(18px,5vw,56px)',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--muted)'}}>
              <span style={{color:'var(--mint-ink)'}}>{'// THE SESSIONS'}<span style={{color:'var(--muted)'}}> · SUBJECT TO CHANGE</span></span>
              <span data-hcount="1">SESSION 01 / 05</span>
            </div>
            <div data-htrack="1" style={{display:'flex',alignItems:'center',gap:'clamp(16px,2.6vw,32px)',padding:'0 clamp(18px,5vw,56px)',willChange:'transform'}}>
              <article data-card="1" style={{flex:'none',width:'min(88vw,960px)',border:'4px solid #9FE3B6',background:'var(--surface)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',minHeight:'clamp(320px,56vh,470px)',boxShadow:'8px 8px 0 var(--sh)',overflow:'hidden',transition:'opacity .3s ease,transform .45s cubic-bezier(.2,.9,.3,1.2)'}}>
                <div data-sc="1" style={{position:'relative',padding:'clamp(22px,3.4vw,44px)',display:'flex',flexDirection:'column',gap:'clamp(10px,1.8vh,18px)',minWidth:'0'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:'14px',flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(52px,9vw,96px)',lineHeight:'.85',color:'var(--mint-ink)',animation:'bm-glitch 5s steps(1) infinite'}}>01</span>
                    <span style={{display:'inline-flex',alignItems:'center',gap:'7px',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}><span style={{width:'8px',height:'8px',background:'#9FE3B6',border:'2px solid var(--line)',animation:'bm-blink 1.4s steps(1) infinite'}}></span>Opening talk</span>
                  </div>
                  <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(36px,7.4vw,66px)',lineHeight:'.92',color:'var(--ink)'}}>KEYNOTE</h3>
                  <p style={{margin:'0',maxWidth:'40ch',fontSize:'clamp(15px,3.6vw,17px)',lineHeight:'1.6',color:'var(--body)',textWrap:'pretty'}}>The opening talk of the day. Everyone in one room, one speaker, the big picture on where cloud and AI are heading.</p>
                  <div style={{marginTop:'auto',display:'flex',gap:'8px',flexWrap:'wrap',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)'}}>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>EVERY PASS</span>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>ONE ROOM, EVERYONE</span>
                  </div>
                </div>
                <div data-sv="1" aria-hidden="true" style={{position:'relative',minHeight:'clamp(170px,26vh,260px)',background:'#9FE3B6',overflow:'hidden'}}><span style={{position:'absolute',inset:'-18px',backgroundImage:'linear-gradient(rgba(20,22,28,.1) 2px,transparent 2px),linear-gradient(90deg,rgba(20,22,28,.1) 2px,transparent 2px)',backgroundSize:'18px 18px',animation:'bm-slide 6s linear infinite'}}></span>{' '}<span style={{position:'absolute',top:'12px',left:'12px',fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:'600',letterSpacing:'.2em',color:'#14161C',background:'#FFFFFF',border:'2px solid #14161C',padding:'4px 7px'}}>MAIN STAGE</span>{' '}<span style={{position:'absolute',top:'0',left:'50%',width:'78%',height:'82%',transformOrigin:'50% 0',background:'linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.08))',clipPath:'polygon(44% 0,56% 0,100% 100%,0 100%)',animation:'bm-cone 5s ease-in-out infinite'}}></span>{' '}<span style={{position:'absolute',left:'50%',bottom:'48%',width:'4px',height:'14%',marginLeft:'-2px',background:'#14161C'}}></span>{' '}<span style={{position:'absolute',left:'50%',bottom:'61%',width:'14px',height:'14px',marginLeft:'-7px',background:'#14161C',boxShadow:'0 0 0 3px #FFFFFF',animation:'bm-talk 1.1s ease-in-out infinite'}}></span>{' '}<span style={{position:'absolute',left:'50%',bottom:'24%',width:'32%',height:'24%',transform:'translateX(-50%)',background:'#14161C',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{width:'26%',height:'30%',background:'#FF9900',animation:'bm-pulse 2s steps(3) infinite'}}></span></span>{' '}<span style={{position:'absolute',left:'14%',top:'40%',width:'10px',height:'10px',background:'#FFFFFF',boxShadow:'0 0 12px 4px #FFFFFF',animation:'bm-flash 3.6s steps(1) 0s infinite'}}></span><span style={{position:'absolute',left:'82%',top:'34%',width:'10px',height:'10px',background:'#FFFFFF',boxShadow:'0 0 12px 4px #FFFFFF',animation:'bm-flash 3.6s steps(1) 1.2s infinite'}}></span><span style={{position:'absolute',left:'70%',top:'58%',width:'10px',height:'10px',background:'#FFFFFF',boxShadow:'0 0 12px 4px #FFFFFF',animation:'bm-flash 3.6s steps(1) 2.3s infinite'}}></span>{' '}<span style={{position:'absolute',left:'0',right:'0',bottom:'0',height:'22%',background:'rgba(20,22,28,.12)',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:'5px',padding:'0 8px'}}><span style={{display:'flex',gap:'6px'}}><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.6s ease-in-out 0.00s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 1.9000000000000001s ease-in-out 0.17s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 2.2s ease-in-out 0.34s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 2.5s ease-in-out 0.51s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 1.6s ease-in-out 0.68s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.9000000000000001s ease-in-out 0.85s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 2.2s ease-in-out 1.02s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 2.5s ease-in-out 1.19s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.6s ease-in-out 1.36s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.9000000000000001s ease-in-out 1.53s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 2.2s ease-in-out 1.70s infinite'}}></span></span><span style={{display:'flex',gap:'6px'}}><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.6s ease-in-out 0.40s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 1.9000000000000001s ease-in-out 0.57s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 2.2s ease-in-out 0.74s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 2.5s ease-in-out 0.91s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 1.6s ease-in-out 1.08s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.9000000000000001s ease-in-out 1.25s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 2.2s ease-in-out 1.42s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 2.5s ease-in-out 1.59s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.6s ease-in-out 1.76s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.9000000000000001s ease-in-out 1.93s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.6',animation:'bm-talk 2.2s ease-in-out 2.10s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 2.5s ease-in-out 2.27s infinite'}}></span><span style={{width:'14px',height:'14px',background:'#14161C',opacity:'.85',animation:'bm-talk 1.6s ease-in-out 2.44s infinite'}}></span></span></span>{' '}<span style={{position:'absolute',top:'0',bottom:'0',left:'0',width:'22%',background:'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0))',animation:'bm-sweepx 4.8s ease-in-out infinite',pointerEvents:'none'}}></span>{' '}<span style={{position:'absolute',right:'10px',bottom:'10px',display:'flex',alignItems:'center',gap:'6px',fontFamily:'var(--font-mono)',fontSize:'9.5px',fontWeight:'600',letterSpacing:'.18em',color:'#FFFFFF',background:'#14161C',padding:'4px 7px'}}><span style={{width:'7px',height:'7px',background:'#FF3B3B',animation:'bm-blink 1s steps(1) infinite'}}></span>LIVE</span></div>
              </article>
              <article data-card="1" style={{flex:'none',width:'min(88vw,960px)',border:'4px solid #FF9900',background:'var(--surface)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',minHeight:'clamp(320px,56vh,470px)',boxShadow:'8px 8px 0 var(--sh)',overflow:'hidden',transition:'opacity .3s ease,transform .45s cubic-bezier(.2,.9,.3,1.2)'}}>
                <div data-sc="1" style={{position:'relative',padding:'clamp(22px,3.4vw,44px)',display:'flex',flexDirection:'column',gap:'clamp(10px,1.8vh,18px)',minWidth:'0'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:'14px',flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(52px,9vw,96px)',lineHeight:'.85',color:'var(--amber-ink)',animation:'bm-glitch 5s steps(1) infinite'}}>02</span>
                    <span style={{display:'inline-flex',alignItems:'center',gap:'7px',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--amber-ink)'}}><span style={{width:'8px',height:'8px',background:'#FF9900',border:'2px solid var(--line)',animation:'bm-blink 1.4s steps(1) infinite'}}></span>Cloud Engineering · AI</span>
                  </div>
                  <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(36px,7.4vw,66px)',lineHeight:'.92',color:'var(--ink)'}}>TECHNICAL SESSIONS</h3>
                  <p style={{margin:'0',maxWidth:'40ch',fontSize:'clamp(15px,3.6vw,17px)',lineHeight:'1.6',color:'var(--body)',textWrap:'pretty'}}>Two topics: <strong style={{color:'var(--ink)'}}>Cloud Engineering</strong> and <strong style={{color:'var(--ink)'}}>AI</strong>. Deep, practical talks. You attend one.</p>
                  <div style={{marginTop:'auto',display:'flex',gap:'8px',flexWrap:'wrap',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)'}}>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>EVERY PASS</span>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>PICK ONE TOPIC</span>
                  </div>
                </div>
                <div data-sv="1" aria-hidden="true" style={{position:'relative',minHeight:'clamp(170px,26vh,260px)',background:'#FF9900',overflow:'hidden'}}><span style={{position:'absolute',inset:'-18px',backgroundImage:'linear-gradient(rgba(20,22,28,.1) 2px,transparent 2px),linear-gradient(90deg,rgba(20,22,28,.1) 2px,transparent 2px)',backgroundSize:'18px 18px',animation:'bm-slide 6s linear infinite'}}></span>{' '}<span style={{position:'absolute',inset:'clamp(14px,2.4vw,24px)',bottom:'clamp(34px,4vw,40px)',background:'#14161C',border:'3px solid #14161C',boxShadow:'6px 6px 0 rgba(20,22,28,.35)',display:'flex',flexDirection:'column'}}><span style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 9px',background:'#232733'}}><span style={{width:'9px',height:'9px',background:'#F2A7C3'}}></span><span style={{width:'9px',height:'9px',background:'#F6C899'}}></span><span style={{width:'9px',height:'9px',background:'#9FE3B6'}}></span><span style={{marginLeft:'auto',display:'flex',gap:'4px',fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.14em',fontWeight:'600'}}><span style={{background:'#FF9900',color:'#14161C',padding:'3px 7px',animation:'bm-tabA 7s steps(1) infinite'}}>CLOUD ENG</span><span style={{background:'#C4AEF2',color:'#14161C',padding:'3px 7px',animation:'bm-tabB 7s steps(1) infinite'}}>AI</span></span></span><span style={{flex:'1',display:'flex',flexDirection:'column',justifyContent:'center',gap:'7px',padding:'12px 14px',fontFamily:'var(--font-mono)',fontSize:'clamp(11px,1.5vw,13px)',lineHeight:'1.3',minWidth:'0'}}><span style={{color:'#FFFFFF',whiteSpace:'nowrap',overflow:'hidden',animation:'bm-typeloop 7s steps(22) 0s infinite both'}}>$ aws cloudformation deploy</span><span style={{color:'#9FE3B6',whiteSpace:'nowrap',overflow:'hidden',animation:'bm-typeloop 7s steps(22) 0.9s infinite both'}}>✓ stack ready</span><span data-sv-x="1" style={{color:'#FFFFFF',whiteSpace:'nowrap',overflow:'hidden',animation:'bm-typeloop 7s steps(22) 1.8s infinite both'}}>$ python agent.py --ask</span><span data-sv-x="1" style={{color:'#C4AEF2',whiteSpace:'nowrap',overflow:'hidden',animation:'bm-typeloop 7s steps(22) 2.7s infinite both'}}>{'> thinking… done'}</span><span style={{color:'#FFFFFF'}}>$ <span style={{display:'inline-block',width:'9px',height:'14px',background:'#FF9900',verticalAlign:'-2px',animation:'bm-blink 1s steps(1) infinite'}}></span></span></span></span>{' '}<span style={{position:'absolute',top:'0',bottom:'0',left:'0',width:'22%',background:'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0))',animation:'bm-sweepx 4.8s ease-in-out infinite',pointerEvents:'none'}}></span>{' '}<span style={{position:'absolute',right:'10px',bottom:'10px',display:'flex',alignItems:'center',gap:'6px',fontFamily:'var(--font-mono)',fontSize:'9.5px',fontWeight:'600',letterSpacing:'.18em',color:'#FFFFFF',background:'#14161C',padding:'4px 7px'}}><span style={{width:'7px',height:'7px',background:'#FF3B3B',animation:'bm-blink 1s steps(1) infinite'}}></span>RUNNING</span></div>
              </article>
              <article data-card="1" style={{flex:'none',width:'min(88vw,960px)',border:'4px solid #C4AEF2',background:'var(--surface)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',minHeight:'clamp(320px,56vh,470px)',boxShadow:'8px 8px 0 var(--sh)',overflow:'hidden',transition:'opacity .3s ease,transform .45s cubic-bezier(.2,.9,.3,1.2)'}}>
                <div data-sc="1" style={{position:'relative',padding:'clamp(22px,3.4vw,44px)',display:'flex',flexDirection:'column',gap:'clamp(10px,1.8vh,18px)',minWidth:'0'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:'14px',flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(52px,9vw,96px)',lineHeight:'.85',color:'var(--violet-ink)',animation:'bm-glitch 5s steps(1) infinite'}}>03</span>
                    <span style={{display:'inline-flex',alignItems:'center',gap:'7px',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--violet-ink)'}}><span style={{width:'8px',height:'8px',background:'#C4AEF2',border:'2px solid var(--line)',animation:'bm-blink 1.4s steps(1) infinite'}}></span>Laptop open</span>
                  </div>
                  <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(36px,7.4vw,66px)',lineHeight:'.92',color:'var(--ink)'}}>HANDS-ON WORKSHOPS</h3>
                  <p style={{margin:'0',maxWidth:'40ch',fontSize:'clamp(15px,3.6vw,17px)',lineHeight:'1.6',color:'var(--body)',textWrap:'pretty'}}>Build along with the speaker, step by step. You leave with something working, not just slides.</p>
                  <div style={{marginTop:'auto',display:'flex',gap:'8px',flexWrap:'wrap',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)'}}>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>PREMIUM AND ABOVE</span>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>BRING A LAPTOP</span>
                  </div>
                </div>
                <div data-sv="1" aria-hidden="true" style={{position:'relative',minHeight:'clamp(170px,26vh,260px)',background:'#C4AEF2',overflow:'hidden'}}><span style={{position:'absolute',inset:'-18px',backgroundImage:'linear-gradient(rgba(20,22,28,.1) 2px,transparent 2px),linear-gradient(90deg,rgba(20,22,28,.1) 2px,transparent 2px)',backgroundSize:'18px 18px',animation:'bm-slide 6s linear infinite'}}></span>{' '}<span style={{position:'absolute',top:'12px',left:'12px',fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:'600',letterSpacing:'.2em',color:'#14161C',background:'#FFFFFF',border:'2px solid #14161C',padding:'4px 7px'}}>BUILD ALONG</span>{' '}<span data-sv-lap="1" style={{position:'absolute',left:'50%',top:'50%',width:'min(70%,280px)',transform:'translate(-50%,-60%)',display:'flex',flexDirection:'column',alignItems:'center'}}><span style={{width:'100%',aspectRatio:'16/10',background:'#14161C',border:'5px solid #14161C',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center',gap:'9px',padding:'0 10%'}}><span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.18em',color:'#9FE3B6'}}>DEPLOYING<span style={{animation:'bm-blink .8s steps(1) infinite'}}>…</span></span><span style={{height:'12px',background:'#2A2F3D',overflow:'hidden'}}><span style={{display:'block',height:'100%',background:'#FF9900',transformOrigin:'0 50%',animation:'bm-fill 4.2s steps(12) infinite'}}></span></span><span style={{display:'flex',gap:'4px'}}><span style={{flex:'3',height:'6px',background:'#C4AEF2',transformOrigin:'0 50%',animation:'bm-fill 4.2s steps(6) .4s infinite both'}}></span><span style={{flex:'2',height:'6px',background:'#3A4052'}}></span><span style={{flex:'4',height:'6px',background:'#3A4052'}}></span></span><span style={{display:'flex',gap:'4px'}}><span style={{flex:'2',height:'6px',background:'#3A4052'}}></span><span style={{flex:'5',height:'6px',background:'#9FE3B6',transformOrigin:'0 50%',animation:'bm-fill 4.2s steps(8) .9s infinite both'}}></span></span></span><span style={{width:'116%',height:'14px',background:'#14161C',clipPath:'polygon(5% 0,95% 0,100% 100%,0 100%)'}}></span></span>{' '}<span style={{position:'absolute',left:'16%',bottom:'30%',fontFamily:'var(--font-display)',fontSize:'18px',color:'#14161C',animation:'bm-rise 3.2s ease-out 0s infinite both'}}>+1</span><span style={{position:'absolute',left:'80%',bottom:'30%',fontFamily:'var(--font-display)',fontSize:'18px',color:'#14161C',animation:'bm-rise 3.2s ease-out 1.1s infinite both'}}>{'</>'}</span><span style={{position:'absolute',left:'70%',bottom:'30%',fontFamily:'var(--font-display)',fontSize:'18px',color:'#14161C',animation:'bm-rise 3.2s ease-out 2.2s infinite both'}}>✓</span>{' '}<span style={{position:'absolute',left:'12px',right:'90px',bottom:'12px',display:'flex',gap:'6px',flexWrap:'wrap',fontFamily:'var(--font-mono)',fontSize:'9.5px',fontWeight:'600',letterSpacing:'.14em'}}><span style={{background:'#14161C',color:'#9FE3B6',padding:'4px 7px',animation:'bm-step 4.2s steps(1) 0s infinite'}}>STEP 1 ✓</span><span style={{background:'#14161C',color:'#9FE3B6',padding:'4px 7px',animation:'bm-step 4.2s steps(1) 1.4s infinite'}}>STEP 2 ✓</span><span style={{background:'#14161C',color:'#9FE3B6',padding:'4px 7px',animation:'bm-step 4.2s steps(1) 2.8s infinite'}}>STEP 3 ✓</span></span>{' '}<span style={{position:'absolute',top:'0',bottom:'0',left:'0',width:'22%',background:'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0))',animation:'bm-sweepx 4.8s ease-in-out infinite',pointerEvents:'none'}}></span>{' '}<span style={{position:'absolute',right:'10px',bottom:'10px',display:'flex',alignItems:'center',gap:'6px',fontFamily:'var(--font-mono)',fontSize:'9.5px',fontWeight:'600',letterSpacing:'.18em',color:'#FFFFFF',background:'#14161C',padding:'4px 7px'}}><span style={{width:'7px',height:'7px',background:'#FF3B3B',animation:'bm-blink 1s steps(1) infinite'}}></span>BUILDING</span></div>
              </article>
              <article data-card="1" style={{flex:'none',width:'min(88vw,960px)',border:'4px solid #F2A7C3',background:'var(--surface)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',minHeight:'clamp(320px,56vh,470px)',boxShadow:'8px 8px 0 var(--sh)',overflow:'hidden',transition:'opacity .3s ease,transform .45s cubic-bezier(.2,.9,.3,1.2)'}}>
                <div data-sc="1" style={{position:'relative',padding:'clamp(22px,3.4vw,44px)',display:'flex',flexDirection:'column',gap:'clamp(10px,1.8vh,18px)',minWidth:'0'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:'14px',flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(52px,9vw,96px)',lineHeight:'.85',color:'var(--pink-ink)',animation:'bm-glitch 5s steps(1) infinite'}}>04</span>
                    <span style={{display:'inline-flex',alignItems:'center',gap:'7px',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--pink-ink)'}}><span style={{width:'8px',height:'8px',background:'#F2A7C3',border:'2px solid var(--line)',animation:'bm-blink 1.4s steps(1) infinite'}}></span>On one stage</span>
                  </div>
                  <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(36px,7.4vw,66px)',lineHeight:'.92',color:'var(--ink)'}}>PANEL DISCUSSION</h3>
                  <p style={{margin:'0',maxWidth:'40ch',fontSize:'clamp(15px,3.6vw,17px)',lineHeight:'1.6',color:'var(--body)',textWrap:'pretty'}}>Engineers and builders on one stage, talking through the questions students actually care about.</p>
                  <div style={{marginTop:'auto',display:'flex',gap:'8px',flexWrap:'wrap',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)'}}>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>PLATINUM AND ABOVE</span>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>MODERATED</span>
                  </div>
                </div>
                <div data-sv="1" aria-hidden="true" style={{position:'relative',minHeight:'clamp(170px,26vh,260px)',background:'#F2A7C3',overflow:'hidden'}}><span style={{position:'absolute',inset:'-18px',backgroundImage:'linear-gradient(rgba(20,22,28,.1) 2px,transparent 2px),linear-gradient(90deg,rgba(20,22,28,.1) 2px,transparent 2px)',backgroundSize:'18px 18px',animation:'bm-slide 6s linear infinite'}}></span>{' '}<span style={{position:'absolute',top:'12px',left:'12px',fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:'600',letterSpacing:'.2em',color:'#14161C',background:'#FFFFFF',border:'2px solid #14161C',padding:'4px 7px'}}>ON STAGE</span>{' '}<span style={{position:'absolute',left:'50%',bottom:'26%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',width:'min(86%,330px)'}}><span style={{display:'flex',justifyContent:'space-around',width:'100%'}}><span style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}><span style={{display:'flex',alignItems:'flex-end',gap:'2px',height:'16px',animation:'bm-speak 6s steps(1) 0s infinite'}}><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.5s ease-in-out 0s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.62s ease-in-out 0.1s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.74s ease-in-out 0.2s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.86s ease-in-out 0.30000000000000004s infinite'}}></span></span><span style={{width:'22px',height:'22px',background:'#14161C',animation:'bm-talk 1.4s ease-in-out 0s infinite'}}></span><span style={{width:'40px',height:'18px',background:'#9FE3B6',border:'3px solid #14161C',boxSizing:'border-box'}}></span></span><span style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}><span style={{display:'flex',alignItems:'flex-end',gap:'2px',height:'16px',animation:'bm-speak 6s steps(1) -1.5s infinite'}}><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.5s ease-in-out 0s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.62s ease-in-out 0.1s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.74s ease-in-out 0.2s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.86s ease-in-out 0.30000000000000004s infinite'}}></span></span><span style={{width:'22px',height:'22px',background:'#14161C',animation:'bm-talk 1.4s ease-in-out -1.5s infinite'}}></span><span style={{width:'40px',height:'18px',background:'#FF9900',border:'3px solid #14161C',boxSizing:'border-box'}}></span></span><span style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}><span style={{display:'flex',alignItems:'flex-end',gap:'2px',height:'16px',animation:'bm-speak 6s steps(1) -3s infinite'}}><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.5s ease-in-out 0s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.62s ease-in-out 0.1s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.74s ease-in-out 0.2s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.86s ease-in-out 0.30000000000000004s infinite'}}></span></span><span style={{width:'22px',height:'22px',background:'#14161C',animation:'bm-talk 1.4s ease-in-out -3s infinite'}}></span><span style={{width:'40px',height:'18px',background:'#C4AEF2',border:'3px solid #14161C',boxSizing:'border-box'}}></span></span><span style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}><span style={{display:'flex',alignItems:'flex-end',gap:'2px',height:'16px',animation:'bm-speak 6s steps(1) -4.5s infinite'}}><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.5s ease-in-out 0s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.62s ease-in-out 0.1s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.74s ease-in-out 0.2s infinite'}}></span><span style={{width:'4px',height:'100%',background:'#14161C',transformOrigin:'50% 100%',animation:'bm-eq 0.86s ease-in-out 0.30000000000000004s infinite'}}></span></span><span style={{width:'22px',height:'22px',background:'#14161C',animation:'bm-talk 1.4s ease-in-out -4.5s infinite'}}></span><span style={{width:'40px',height:'18px',background:'#F6C899',border:'3px solid #14161C',boxSizing:'border-box'}}></span></span></span><span style={{width:'100%',height:'30px',background:'#14161C',display:'flex',justifyContent:'space-around',alignItems:'center'}}><span style={{width:'40px',height:'9px',background:'#FFFFFF'}}></span><span style={{width:'40px',height:'9px',background:'#FFFFFF'}}></span><span style={{width:'40px',height:'9px',background:'#FFFFFF'}}></span><span style={{width:'40px',height:'9px',background:'#FFFFFF'}}></span></span><span style={{display:'flex',justifyContent:'space-between',width:'88%'}}><span style={{width:'8px',height:'22px',background:'#14161C'}}></span><span style={{width:'8px',height:'22px',background:'#14161C'}}></span></span></span>{' '}<span style={{position:'absolute',left:'0',right:'0',bottom:'0',height:'14%',background:'rgba(20,22,28,.14)'}}></span>{' '}<span style={{position:'absolute',top:'0',bottom:'0',left:'0',width:'22%',background:'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0))',animation:'bm-sweepx 4.8s ease-in-out infinite',pointerEvents:'none'}}></span>{' '}<span style={{position:'absolute',right:'10px',bottom:'10px',display:'flex',alignItems:'center',gap:'6px',fontFamily:'var(--font-mono)',fontSize:'9.5px',fontWeight:'600',letterSpacing:'.18em',color:'#FFFFFF',background:'#14161C',padding:'4px 7px'}}><span style={{width:'7px',height:'7px',background:'#FF3B3B',animation:'bm-blink 1s steps(1) infinite'}}></span>LIVE PANEL</span></div>
              </article>
              <article data-card="1" style={{flex:'none',width:'min(88vw,960px)',border:'4px solid #F6C899',background:'var(--surface)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',minHeight:'clamp(320px,56vh,470px)',boxShadow:'8px 8px 0 var(--sh)',overflow:'hidden',transition:'opacity .3s ease,transform .45s cubic-bezier(.2,.9,.3,1.2)'}}>
                <div data-sc="1" style={{position:'relative',padding:'clamp(22px,3.4vw,44px)',display:'flex',flexDirection:'column',gap:'clamp(10px,1.8vh,18px)',minWidth:'0'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:'14px',flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(52px,9vw,96px)',lineHeight:'.85',color:'var(--amber-ink)',animation:'bm-glitch 5s steps(1) infinite'}}>05</span>
                    <span style={{display:'inline-flex',alignItems:'center',gap:'7px',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--amber-ink)'}}><span style={{width:'8px',height:'8px',background:'#F6C899',border:'2px solid var(--line)',animation:'bm-blink 1.4s steps(1) infinite'}}></span>Your turn</span>
                  </div>
                  <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(36px,7.4vw,66px)',lineHeight:'.92',color:'var(--ink)'}}>Q&A SESSION</h3>
                  <p style={{margin:'0',maxWidth:'40ch',fontSize:'clamp(15px,3.6vw,17px)',lineHeight:'1.6',color:'var(--body)',textWrap:'pretty'}}>Open mic with the speakers. Ask anything: careers, code, cloud, AI. No question is too basic.</p>
                  <div style={{marginTop:'auto',display:'flex',gap:'8px',flexWrap:'wrap',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)'}}>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>EVERY PASS</span>
                    <span style={{border:'2px solid #D6CFC5',padding:'7px 10px'}}>OPEN MIC</span>
                  </div>
                </div>
                <div data-sv="1" aria-hidden="true" style={{position:'relative',minHeight:'clamp(170px,26vh,260px)',background:'#F6C899',overflow:'hidden'}}><span style={{position:'absolute',inset:'-18px',backgroundImage:'linear-gradient(rgba(20,22,28,.1) 2px,transparent 2px),linear-gradient(90deg,rgba(20,22,28,.1) 2px,transparent 2px)',backgroundSize:'18px 18px',animation:'bm-slide 6s linear infinite'}}></span>{' '}<span style={{position:'absolute',left:'clamp(14px,4%,30px)',top:'10%',maxWidth:'70%',transformOrigin:'0 100%',background:'#FFFFFF',color:'#14161C',border:'3px solid #14161C',boxShadow:'4px 4px 0 #14161C',padding:'8px 12px',fontFamily:'var(--font-display)',fontSize:'clamp(18px,2.4vw,22px)',lineHeight:'1',animation:'bm-popin 7.5s cubic-bezier(.2,.9,.3,1.3) 0s infinite both'}}>? HOW DO I START<span style={{position:'absolute',left:'14px',bottom:'-11px',width:'12px',height:'12px',background:'#FFFFFF',borderRight:'3px solid #14161C',borderBottom:'3px solid #14161C',transform:'rotate(45deg)'}}></span></span>{' '}<span style={{position:'absolute',right:'clamp(14px,4%,30px)',top:'36%',maxWidth:'70%',transformOrigin:'100% 100%',background:'#14161C',color:'#FFFFFF',border:'3px solid #14161C',boxShadow:'4px 4px 0 #14161C',padding:'8px 12px',fontFamily:'var(--font-display)',fontSize:'clamp(18px,2.4vw,22px)',lineHeight:'1',animation:'bm-popin 7.5s cubic-bezier(.2,.9,.3,1.3) 1.2s infinite both'}}>BUILD ONE THING !<span style={{position:'absolute',right:'14px',bottom:'-11px',width:'12px',height:'12px',background:'#14161C',borderRight:'3px solid #14161C',borderBottom:'3px solid #14161C',transform:'rotate(45deg)'}}></span></span>{' '}<span style={{position:'absolute',left:'clamp(14px,4%,30px)',top:'62%',maxWidth:'70%',transformOrigin:'0 100%',background:'#FFFFFF',color:'#14161C',border:'3px solid #14161C',boxShadow:'4px 4px 0 #14161C',padding:'8px 12px',fontFamily:'var(--font-display)',fontSize:'clamp(18px,2.4vw,22px)',lineHeight:'1',animation:'bm-popin 7.5s cubic-bezier(.2,.9,.3,1.3) 2.4s infinite both'}}>? IS AI TAKING MY JOB<span style={{position:'absolute',left:'14px',bottom:'-11px',width:'12px',height:'12px',background:'#FFFFFF',borderRight:'3px solid #14161C',borderBottom:'3px solid #14161C',transform:'rotate(45deg)'}}></span></span>{' '}<span style={{position:'absolute',left:'8%',bottom:'8%',fontFamily:'var(--font-display)',fontSize:'22px',color:'#14161C',animation:'bm-rise 3.6s ease-out 0.3s infinite both'}}>?</span><span style={{position:'absolute',left:'46%',bottom:'8%',fontFamily:'var(--font-display)',fontSize:'22px',color:'#14161C',animation:'bm-rise 3.6s ease-out 1.6s infinite both'}}>?</span><span style={{position:'absolute',left:'88%',bottom:'8%',fontFamily:'var(--font-display)',fontSize:'22px',color:'#14161C',animation:'bm-rise 3.6s ease-out 2.8s infinite both'}}>?</span>{' '}<span style={{position:'absolute',top:'0',bottom:'0',left:'0',width:'22%',background:'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0))',animation:'bm-sweepx 4.8s ease-in-out infinite',pointerEvents:'none'}}></span>{' '}<span style={{position:'absolute',right:'10px',bottom:'10px',display:'flex',alignItems:'center',gap:'6px',fontFamily:'var(--font-mono)',fontSize:'9.5px',fontWeight:'600',letterSpacing:'.18em',color:'#FFFFFF',background:'#14161C',padding:'4px 7px'}}><span style={{width:'7px',height:'7px',background:'#FF3B3B',animation:'bm-blink 1s steps(1) infinite'}}></span>MIC OPEN</span></div>
              </article>
            </div>
            <div style={{display:'flex',gap:'6px',padding:'0 clamp(18px,5vw,56px)'}}>
              <span data-hbar="0" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}>
                <span style={{display:'block',height:'100%',background:'#9FE3B6',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span>
              </span>
              <span data-hbar="1" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}>
                <span style={{display:'block',height:'100%',background:'#FF9900',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span>
              </span>
              <span data-hbar="2" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}>
                <span style={{display:'block',height:'100%',background:'#C4AEF2',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span>
              </span>
              <span data-hbar="3" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}>
                <span style={{display:'block',height:'100%',background:'#F2A7C3',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span>
              </span>
              <span data-hbar="4" style={{height:'10px',flex:'1',background:'var(--bar)',overflow:'hidden'}}>
                <span style={{display:'block',height:'100%',background:'#F6C899',transformOrigin:'0 50%',transform:'scaleX(0)'}}></span>
              </span>
            </div>
          </div>
        </div>

        <section style={{position:'relative',zIndex:'10',borderTop:'4px solid var(--line)',background:'var(--panel)'}}>
          <div data-rv="1" style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'grid',gap:'clamp(26px,4.4vw,68px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,290px),1fr))'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// THE PREMISE'}</span>
              <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(37.5px,9.5vw,77.5px)',lineHeight:'.94',color:'var(--ink)'}}>PUT ON BY STUDENTS, FOR STUDENTS</h2>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'14px',fontSize:'clamp(15px,3.8vw,17.5px)',lineHeight:'1.65',color:'var(--body)'}}>
              <p style={{margin:'0'}}>A keynote to open, technical sessions on Cloud Engineering and AI, hands-on workshops, a panel and an open Q&A. Your pass decides which of these you get.</p>
              <p style={{margin:'0'}}>Run by volunteers from the AWS Student Builders Group at VJIT. Not an AWS event, and we are not pretending otherwise.</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px',paddingTop:'4px',fontFamily:'var(--font-display)',fontSize:'18.8px',color:'var(--on-fill)'}}>
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
                <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(37.5px,9.5vw,77.5px)',lineHeight:'.94',color:'var(--ink)'}}>FOUR WAYS IN</h2>
              </div>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>LUNCH ON EVERY ONE</span>
            </div>
            <div data-rv="1" style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',paddingBottom:'16px'}}></div>
            <div data-grid4="1" style={{display:'grid',gap:'clamp(16px,2.2vw,24px)',alignItems:'stretch'}}>
              <article className="dh-h14" data-rv="1" data-pass="1" data-spark="#FFE3CF|#C57446|#FFFFFF" style={{position:'relative',overflow:'hidden',border:'4px solid #6B3417',background:'linear-gradient(135deg,#F7D6BF 0%,#E0A07A 26%,#FADFCB 46%,#C57446 70%,#EDB896 100%)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'14px',minHeight:'380px',color:'#14161C',boxShadow:'6px 6px 0 var(--sh)',transition:'transform .2s cubic-bezier(.2,.9,.3,1.2),box-shadow .2s ease',willChange:'transform'}}>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(240px 220px at var(--px,50%) var(--py,50%),rgba(255,255,255,.7),rgba(255,255,255,0) 70%)',mixBlendMode:'soft-light'}}></span>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(120px 110px at var(--px,50%) var(--py,50%),rgba(255,255,255,.45),rgba(255,255,255,0) 70%)'}}></span>
                <span aria-hidden="true" style={{position:'absolute',top:'0',bottom:'0',left:'-50%',width:'200%',pointerEvents:'none',background:'linear-gradient(100deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.7) 49%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.7) 51%,rgba(255,255,255,0) 60%)',animation:'bm-sheen 4.6s ease-in-out 0s infinite'}}></span>
                <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
                  <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:'600',letterSpacing:'.24em',color:'#14161C'}}>COPPER</span>
                    <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'38px',lineHeight:'.95',backgroundImage:'linear-gradient(100deg,#3A1A08 0%,#3A1A08 35%,#FFD9BF 44%,#FFFFFF 50%,#FFD9BF 56%,#3A1A08 65%,#3A1A08 100%)',backgroundSize:'300% 100%',WebkitBackgroundClip:'text',backgroundClip:'text',color:'transparent',WebkitTextFillColor:'transparent',animation:'bm-foil 6.5s cubic-bezier(.45,0,.55,1) infinite',filter:'drop-shadow(2px 2px 0 rgba(255,255,255,.65))'}}>REGULAR</h3>
                  </span>
                  <span style={{display:'flex',gap:'3px'}} role="img" aria-label="Level 1 of 4">
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'transparent'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'transparent'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'transparent'}}></span>
                  </span>
                </div>
                <div style={{position:'relative',display:'flex',flexDirection:'column',gap:'14px'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:'600',fontSize:'26px',color:'#FFFFFF',background:'#14161C',alignSelf:'flex-start',padding:'3px 10px'}}>{prices.basic ?? 'Announced soon'}</span>
                  <ul style={{margin:'0',padding:'0',listStyle:'none',display:'flex',flexDirection:'column',gap:'8px',fontSize:'14.5px',lineHeight:'1.5',color:'#1E1F26'}}>
                    {perksOf('basic').map((p) => (
                      <li key={p}>+ {p}</li>
                    ))}
                  </ul>
                </div>
                <Link className="dh-h15 dh-a16" href="/register" style={{position:'relative',marginTop:'auto',display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'52px',background:'#14161C',color:'#FFFFFF',fontFamily:'var(--font-display)',fontSize:'24px',boxShadow:'4px 4px 0 rgba(255,255,255,.7)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>{registrationOpen ? 'REGISTER' : 'NOTIFY ME'}</Link>
              </article>
              <article className="dh-h17" data-rv="1" data-pass="1" data-spark="#FFF6C8|#E8C052|#FFFFFF" style={{position:'relative',overflow:'hidden',border:'4px solid #5E3F04',background:'linear-gradient(135deg,#FFF2BF 0%,#E8C052 26%,#FFF7D6 46%,#C5921A 70%,#F2D370 100%)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'14px',minHeight:'380px',color:'#14161C',boxShadow:'6px 6px 0 var(--sh)',transition:'transform .2s cubic-bezier(.2,.9,.3,1.2),box-shadow .2s ease',willChange:'transform'}}>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(240px 220px at var(--px,50%) var(--py,50%),rgba(255,255,255,.7),rgba(255,255,255,0) 70%)',mixBlendMode:'soft-light'}}></span>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(120px 110px at var(--px,50%) var(--py,50%),rgba(255,255,255,.45),rgba(255,255,255,0) 70%)'}}></span>
                <span aria-hidden="true" style={{position:'absolute',top:'0',bottom:'0',left:'-50%',width:'200%',pointerEvents:'none',background:'linear-gradient(100deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.7) 49%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.7) 51%,rgba(255,255,255,0) 60%)',animation:'bm-sheen 5.1s ease-in-out 0.7s infinite'}}></span>
                <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
                  <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:'600',letterSpacing:'.24em',color:'#14161C'}}>GOLD</span>
                    <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'38px',lineHeight:'.95',backgroundImage:'linear-gradient(100deg,#3A2600 0%,#3A2600 35%,#FFF0B0 44%,#FFFFFF 50%,#FFF0B0 56%,#3A2600 65%,#3A2600 100%)',backgroundSize:'300% 100%',WebkitBackgroundClip:'text',backgroundClip:'text',color:'transparent',WebkitTextFillColor:'transparent',animation:'bm-foil 6.5s cubic-bezier(.45,0,.55,1) infinite',filter:'drop-shadow(2px 2px 0 rgba(255,255,255,.65))',animationDelay:'-1.6s'}}>PREMIUM</h3>
                  </span>
                  <span style={{display:'flex',gap:'3px'}} role="img" aria-label="Level 2 of 4">
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'transparent'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'transparent'}}></span>
                  </span>
                </div>
                <div style={{position:'relative',display:'flex',flexDirection:'column',gap:'14px'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:'600',fontSize:'26px',color:'#FFFFFF',background:'#14161C',alignSelf:'flex-start',padding:'3px 10px'}}>{prices.premium ?? 'Announced soon'}</span>
                  <ul style={{margin:'0',padding:'0',listStyle:'none',display:'flex',flexDirection:'column',gap:'8px',fontSize:'14.5px',lineHeight:'1.5',color:'#1E1F26'}}>
                    {perksOf('premium').map((p) => (
                      <li key={p}>+ {p}</li>
                    ))}
                  </ul>
                </div>
                <Link className="dh-h15 dh-a16" href="/register" style={{position:'relative',marginTop:'auto',display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'52px',background:'#14161C',color:'#FFFFFF',fontFamily:'var(--font-display)',fontSize:'24px',boxShadow:'4px 4px 0 rgba(255,255,255,.7)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>{registrationOpen ? 'REGISTER' : 'NOTIFY ME'}</Link>
              </article>
              <article className="dh-h18" data-rv="1" data-pass="1" data-spark="#FFFFFF|#A3AFC1|#E8F8FF" style={{position:'relative',overflow:'hidden',border:'4px solid #3E4758',background:'linear-gradient(135deg,#F8FAFD 0%,#CBD3DF 26%,#FFFFFF 46%,#A3AFC1 70%,#E4E9F1 100%)',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'14px',minHeight:'380px',color:'#14161C',boxShadow:'6px 6px 0 var(--sh)',transition:'transform .2s cubic-bezier(.2,.9,.3,1.2),box-shadow .2s ease',willChange:'transform'}}>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(240px 220px at var(--px,50%) var(--py,50%),rgba(255,255,255,.7),rgba(255,255,255,0) 70%)',mixBlendMode:'soft-light'}}></span>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(120px 110px at var(--px,50%) var(--py,50%),rgba(255,255,255,.45),rgba(255,255,255,0) 70%)'}}></span>
                <span aria-hidden="true" style={{position:'absolute',top:'0',bottom:'0',left:'-50%',width:'200%',pointerEvents:'none',background:'linear-gradient(100deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.7) 49%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.7) 51%,rgba(255,255,255,0) 60%)',animation:'bm-sheen 5.6s ease-in-out 1.4s infinite'}}></span>
                <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
                  <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:'600',letterSpacing:'.24em',color:'#14161C'}}>PLATINUM</span>
                    <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'38px',lineHeight:'.95',backgroundImage:'linear-gradient(100deg,#1E2533 0%,#1E2533 35%,#DDE6F5 44%,#FFFFFF 50%,#DDE6F5 56%,#1E2533 65%,#1E2533 100%)',backgroundSize:'300% 100%',WebkitBackgroundClip:'text',backgroundClip:'text',color:'transparent',WebkitTextFillColor:'transparent',animation:'bm-foil 6.5s cubic-bezier(.45,0,.55,1) infinite',filter:'drop-shadow(2px 2px 0 rgba(255,255,255,.7))',animationDelay:'-3.2s'}}>PLATINUM</h3>
                  </span>
                  <span style={{display:'flex',gap:'3px'}} role="img" aria-label="Level 3 of 4">
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'transparent'}}></span>
                  </span>
                </div>
                <div style={{position:'relative',display:'flex',flexDirection:'column',gap:'14px'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:'600',fontSize:'26px',color:'#FFFFFF',background:'#14161C',alignSelf:'flex-start',padding:'3px 10px'}}>{prices.ultra ?? 'Announced soon'}</span>
                  <ul style={{margin:'0',padding:'0',listStyle:'none',display:'flex',flexDirection:'column',gap:'8px',fontSize:'14.5px',lineHeight:'1.5',color:'#1E1F26'}}>
                    {perksOf('ultra').map((p) => (
                      <li key={p}>+ {p}</li>
                    ))}
                  </ul>
                </div>
                <Link className="dh-h15 dh-a16" href="/register" style={{position:'relative',marginTop:'auto',display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'52px',background:'#14161C',color:'#FFFFFF',fontFamily:'var(--font-display)',fontSize:'24px',boxShadow:'4px 4px 0 rgba(255,255,255,.7)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>{registrationOpen ? 'REGISTER' : 'NOTIFY ME'}</Link>
              </article>
              <article className="dh-h19" data-rv="1" data-pass="1" data-spark="#F5B5CF|#A9E3FF|#FFF0B8|#C9B6F5|#FFFFFF" style={{position:'relative',overflow:'hidden',border:'4px solid #14161C',background:'linear-gradient(115deg,#E8F8FF,#C9B6F5 16%,#F5B5CF 30%,#FFF0B8 44%,#A8EBC4 58%,#A9E3FF 72%,#D9C9FF 86%,#E8F8FF)',backgroundSize:'260% 260%',animation:'bm-holo 7s ease-in-out infinite alternate',padding:'26px 24px',display:'flex',flexDirection:'column',gap:'14px',minHeight:'380px',color:'#14161C',boxShadow:'6px 6px 0 var(--sh)',transition:'transform .2s cubic-bezier(.2,.9,.3,1.2),box-shadow .2s ease',willChange:'transform'}}>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(240px 220px at var(--px,50%) var(--py,50%),rgba(255,255,255,.7),rgba(255,255,255,0) 70%)',mixBlendMode:'soft-light'}}></span>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',zIndex:'1',pointerEvents:'none',opacity:'var(--glow,0)',transition:'opacity .25s ease',background:'radial-gradient(120px 110px at var(--px,50%) var(--py,50%),rgba(255,255,255,.45),rgba(255,255,255,0) 70%)'}}></span>
                <span aria-hidden="true" style={{position:'absolute',top:'0',bottom:'0',left:'-50%',width:'200%',pointerEvents:'none',background:'linear-gradient(100deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.7) 49%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.7) 51%,rgba(255,255,255,0) 60%)',animation:'bm-sheen 3.2s ease-in-out 2.1s infinite'}}></span>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',pointerEvents:'none',background:'repeating-conic-gradient(from 20deg at 30% 20%,rgba(255,255,255,.55) 0deg 8deg,rgba(255,255,255,0) 8deg 24deg)',mixBlendMode:'soft-light'}}></span>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',pointerEvents:'none',background:'linear-gradient(135deg,rgba(255,255,255,.0) 0 18%,rgba(255,255,255,.45) 18% 19%,rgba(255,255,255,0) 19% 52%,rgba(255,255,255,.4) 52% 53%,rgba(255,255,255,0) 53% 100%)'}}></span>
                <span aria-hidden="true" style={{position:'absolute',left:'12%',top:'16%',fontSize:'14px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 0s infinite'}}>✦</span>
                <span aria-hidden="true" style={{position:'absolute',left:'78%',top:'28%',fontSize:'10px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 0.8s infinite'}}>✦</span>
                <span aria-hidden="true" style={{position:'absolute',left:'26%',top:'56%',fontSize:'12px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 1.6s infinite'}}>✦</span>
                <span aria-hidden="true" style={{position:'absolute',left:'70%',top:'70%',fontSize:'16px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 2.3s infinite'}}>✦</span>
                <span aria-hidden="true" style={{position:'absolute',left:'46%',top:'86%',fontSize:'9px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 3.1s infinite'}}>✦</span>
                <span aria-hidden="true" style={{position:'absolute',left:'88%',top:'50%',fontSize:'11px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 1.2s infinite'}}>✦</span>
                <span aria-hidden="true" style={{position:'absolute',left:'18%',top:'84%',fontSize:'8px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 2.8s infinite'}}>✦</span>
                <span aria-hidden="true" style={{position:'absolute',left:'56%',top:'38%',fontSize:'7px',lineHeight:'1',color:'#FFFFFF',textShadow:'0 0 6px #FFFFFF,0 0 12px #A9E3FF',pointerEvents:'none',animation:'bm-twinkle 2.6s ease-in-out 0.4s infinite'}}>✦</span>
                <span style={{position:'absolute',top:'-4px',right:'-4px',zIndex:'2',background:'#14161C',color:'#FFFFFF',fontFamily:'var(--font-display)',fontSize:'19px',padding:'4px 10px'}}>◆ TOP TIER</span>
                <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',paddingTop:'16px'}}>
                  <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',fontWeight:'600',letterSpacing:'.24em',color:'#14161C'}}>DIAMOND</span>
                    <h3 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'44px',lineHeight:'.95',backgroundImage:'linear-gradient(100deg,#14161C 0%,#14161C 32%,#F5B5CF 41%,#FFFFFF 47%,#A9E3FF 53%,#C9B6F5 59%,#14161C 68%,#14161C 100%)',backgroundSize:'300% 100%',WebkitBackgroundClip:'text',backgroundClip:'text',color:'transparent',WebkitTextFillColor:'transparent',animation:'bm-foil 6.5s cubic-bezier(.45,0,.55,1) -4.8s infinite',filter:'drop-shadow(2px 2px 0 #FFFFFF) drop-shadow(1px 1px 0 #A9E3FF)'}}>VIP</h3>
                  </span>
                  <span style={{display:'flex',gap:'3px'}} role="img" aria-label="Level 4 of 4">
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                    <span style={{width:'10px',height:'10px',border:'2px solid #14161C',background:'#14161C'}}></span>
                  </span>
                </div>
                <div style={{position:'relative',display:'flex',flexDirection:'column',gap:'14px'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:'600',fontSize:'26px',color:'#FFFFFF',background:'#14161C',alignSelf:'flex-start',padding:'3px 10px'}}>{prices.vip ?? 'Announced soon'}</span>
                  <ul style={{margin:'0',padding:'0',listStyle:'none',display:'flex',flexDirection:'column',gap:'8px',fontSize:'14.5px',lineHeight:'1.5',color:'#1E1F26'}}>
                    {perksOf('vip').map((p) => (
                      <li key={p}>+ {p}</li>
                    ))}
                  </ul>
                </div>
                <Link className="dh-h15 dh-a16" href="/register" style={{position:'relative',marginTop:'auto',display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'52px',background:'#14161C',color:'#FFFFFF',fontFamily:'var(--font-display)',fontSize:'24px',boxShadow:'4px 4px 0 rgba(255,255,255,.7)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>{registrationOpen ? 'REGISTER' : 'NOTIFY ME'}</Link>
              </article>
            </div>
            <div data-rv="1" style={{display:'flex',alignItems:'center',gap:'12px',paddingTop:'20px'}}>
              <span style={{display:'grid',gridTemplateColumns:'repeat(3,8px)',gap:'2px',flex:'none'}} aria-hidden="true">
                <span style={{height:'8px',background:'#FF9900'}}></span>
                <span style={{height:'8px',background:'#FF9900'}}></span>
                <span style={{height:'8px',background:'#FF9900'}}></span>
                <span style={{height:'8px',background:'#FF9900'}}></span>
                <span style={{height:'8px',background:'var(--bg)'}}></span>
                <span style={{height:'8px',background:'#FF9900'}}></span>
                <span style={{height:'8px',background:'#FF9900'}}></span>
                <span style={{height:'8px',background:'#FF9900'}}></span>
                <span style={{height:'8px',background:'#FF9900'}}></span>
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
                <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(37.5px,9.5vw,77.5px)',lineHeight:'.94',color:'var(--ink)'}}>NOT ANNOUNCED YET</h2>
              </div>
              <span style={{fontFamily:'var(--font-display)',fontSize:'21.3px',background:'#FF9900',color:'var(--on-fill)',padding:'6px 10px'}}>FIRST NAMES DROP SOON</span>
            </div>
            <div data-rv="1" data-grid4="1" style={{display:'grid',gap:'clamp(16px,2.2vw,24px)'}}>
              <div className="dh-h10" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <div data-px="1" tabIndex={0} role="button" aria-label="Reveal the session" style={{aspectRatio:'3/4',background:'var(--slot)',position:'relative',overflow:'hidden'}}>
                  <div data-px-front="1" style={{position:'absolute',inset:'0',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <div style={{width:'52%',height:'44%',background:'var(--slot2)',clipPath:'polygon(20% 100%,20% 30%,35% 30%,35% 15%,65% 15%,65% 30%,80% 30%,80% 100%)'}}></div>
                    <span style={{position:'absolute',inset:'0',backgroundImage:'radial-gradient(rgba(159,227,182,.18) 1px,transparent 1px)',backgroundSize:'6px 6px',animation:'bm-flick 4s steps(2) infinite'}}></span>
                    <span style={{position:'absolute',top:'10px',left:'10px',fontFamily:'var(--font-display)',fontSize:'17.5px',color:'var(--mint-ink)'}}>???</span>
                  </div>
                  <div data-px-back="1" style={{position:'absolute',inset:'0',display:'none',flexDirection:'column',justifyContent:'center',gap:'8px',padding:'14px',background:'#9FE3B6'}}><span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.18em',color:'#14161C'}}>KEYNOTE</span>{' '}<span style={{fontFamily:'var(--font-display)',fontSize:'25px',lineHeight:'1.05',color:'#14161C'}}>OPENING TALK</span>{' '}<span style={{fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'.16em',color:'#14161C',opacity:'.75'}}>SPEAKER SOON</span></div>
                  <div data-px-grid="1" style={{position:'absolute',inset:'0',pointerEvents:'none'}}></div>
                </div>
                <div style={{height:'12px',width:'72%',background:'var(--slot2)'}}></div>
                <div style={{height:'9px',width:'44%',background:'var(--bar)'}}></div>
              </div>
              <div className="dh-h10" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <div data-px="1" tabIndex={0} role="button" aria-label="Reveal the session" style={{aspectRatio:'3/4',background:'var(--slot)',position:'relative',overflow:'hidden'}}>
                  <div data-px-front="1" style={{position:'absolute',inset:'0',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <div style={{width:'52%',height:'44%',background:'var(--slot2)',clipPath:'polygon(20% 100%,20% 30%,35% 30%,35% 15%,65% 15%,65% 30%,80% 30%,80% 100%)'}}></div>
                    <span style={{position:'absolute',inset:'0',backgroundImage:'radial-gradient(rgba(255,153,0,.16) 1px,transparent 1px)',backgroundSize:'6px 6px',animation:'bm-flick 5.5s steps(2) infinite'}}></span>
                    <span style={{position:'absolute',top:'10px',left:'10px',fontFamily:'var(--font-display)',fontSize:'17.5px',color:'var(--amber-ink)'}}>???</span>
                  </div>
                  <div data-px-back="1" style={{position:'absolute',inset:'0',display:'none',flexDirection:'column',justifyContent:'center',gap:'8px',padding:'14px',background:'#FF9900'}}><span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.18em',color:'#14161C'}}>TECHNICAL</span>{' '}<span style={{fontFamily:'var(--font-display)',fontSize:'25px',lineHeight:'1.05',color:'#14161C'}}>CLOUD ENGINEERING</span>{' '}<span style={{fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'.16em',color:'#14161C',opacity:'.75'}}>SPEAKER SOON</span></div>
                  <div data-px-grid="1" style={{position:'absolute',inset:'0',pointerEvents:'none'}}></div>
                </div>
                <div style={{height:'12px',width:'56%',background:'var(--slot2)'}}></div>
                <div style={{height:'9px',width:'60%',background:'var(--bar)'}}></div>
              </div>
              <div className="dh-h10" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'18px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <div data-px="1" tabIndex={0} role="button" aria-label="Reveal the session" style={{aspectRatio:'3/4',background:'var(--slot)',position:'relative',overflow:'hidden'}}>
                  <div data-px-front="1" style={{position:'absolute',inset:'0',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                    <div style={{width:'52%',height:'44%',background:'var(--slot2)',clipPath:'polygon(20% 100%,20% 30%,35% 30%,35% 15%,65% 15%,65% 30%,80% 30%,80% 100%)'}}></div>
                    <span style={{position:'absolute',inset:'0',backgroundImage:'radial-gradient(rgba(154,141,255,.18) 1px,transparent 1px)',backgroundSize:'6px 6px',animation:'bm-flick 4.8s steps(2) infinite'}}></span>
                    <span style={{position:'absolute',top:'10px',left:'10px',fontFamily:'var(--font-display)',fontSize:'17.5px',color:'var(--violet-ink)'}}>???</span>
                  </div>
                  <div data-px-back="1" style={{position:'absolute',inset:'0',display:'none',flexDirection:'column',justifyContent:'center',gap:'8px',padding:'14px',background:'#C4AEF2'}}><span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.18em',color:'#14161C'}}>PANEL</span>{' '}<span style={{fontFamily:'var(--font-display)',fontSize:'25px',lineHeight:'1.05',color:'#14161C'}}>PANEL DISCUSSION</span>{' '}<span style={{fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'.16em',color:'#14161C',opacity:'.75'}}>SPEAKER SOON</span></div>
                  <div data-px-grid="1" style={{position:'absolute',inset:'0',pointerEvents:'none'}}></div>
                </div>
                <div style={{height:'12px',width:'64%',background:'var(--slot2)'}}></div>
                <div style={{height:'9px',width:'38%',background:'var(--bar)'}}></div>
              </div>
              <div className="dh-h13" style={{border:'3px solid #9FE3B6',background:'var(--panel-mint)',padding:'16px',display:'flex',flexDirection:'column',gap:'12px',justifyContent:'center',transition:'transform .14s steps(3),box-shadow .14s steps(3)'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:'31.3px',lineHeight:'1.05',color:'var(--ink)'}}>WANT TO SPEAK?</div>
                <p style={{margin:'0',fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Call for speakers is open: students and working engineers both.</p>
                <Link className="dh-h20 dh-a4" href="/speak" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'48px',background:'#9FE3B6',color:'var(--on-fill)',fontFamily:'var(--font-display)',fontSize:'22.5px',boxShadow:'5px 5px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>APPLY TO SPEAK</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="sponsors" style={{position:'relative',zIndex:'10',borderTop:'3px solid var(--line)'}}>
          <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'flex',flexDirection:'column',gap:'clamp(18px,3.4vh,32px)'}}>
            <div data-rv="1" style={{border:'4px solid #FF9900',background:'var(--surface)',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:'clamp(14px,2.6vh,26px)',padding:'clamp(34px,6vw,72px) clamp(20px,5vw,56px)',boxShadow:'8px 8px 0 var(--sh)'}}>
              <span style={{position:'absolute',inset:'0',backgroundImage:'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px)',backgroundSize:'20px 20px',pointerEvents:'none'}}></span>
              <span style={{position:'relative',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.24em',textTransform:'uppercase',background:'#FF9900',color:'var(--on-fill)',padding:'6px 11px'}}>Title sponsor</span>
              <h2 data-aws="1" style={{position:'relative',margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(37.5px,9.5vw,97.5px)',lineHeight:'1',letterSpacing:'.01em',color:'var(--amber-ink)',textShadow:'4px 4px 0 var(--line-soft)',display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'0 .5em',whiteSpace:'nowrap'}}>
                <span style={{display:'inline-flex'}}>A<span data-exp="1" style={{display:'inline-block',maxWidth:'0',overflow:'hidden',color:'var(--gold2)'}}>mazon</span></span>
                <span style={{display:'inline-flex'}}>W<span data-exp="1" style={{display:'inline-block',maxWidth:'0',overflow:'hidden',color:'var(--gold2)'}}>eb</span></span>
                <span style={{display:'inline-flex'}}>S<span data-exp="1" style={{display:'inline-block',maxWidth:'0',overflow:'hidden',color:'var(--gold2)'}}>ervices</span></span>
              </h2>
            </div>
            <a data-rv="1" className="dh-h21" href="https://vjit.ac.in/" style={{position:'relative',border:'3px solid var(--line)',background:'var(--surface)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',boxShadow:'6px 6px 0 var(--sh)',overflow:'hidden',color:'var(--ink)',transition:'transform .14s steps(3),border-color .14s steps(2),box-shadow .14s steps(3)'}}>
              <span style={{background:'#FFFFFF',borderRight:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',padding:'clamp(22px,4vw,36px)',minHeight:'150px'}}>
                <Image src="/assets/vjit-logo.png" alt="Vidya Jyothi Institute of Technology" width={320} height={90} sizes="320px" style={{width:'100%',maxWidth:'320px',height:'auto',display:'block',imageRendering:'auto'}} />
              </span>
              <span style={{padding:'clamp(20px,3.4vw,30px)',display:'flex',flexDirection:'column',justifyContent:'center',gap:'10px'}}>
                <span style={{alignSelf:'flex-start',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.24em',textTransform:'uppercase',background:'#9FE3B6',color:'var(--on-fill)',padding:'6px 11px'}}>Venue sponsor</span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(26px,5vw,34px)',lineHeight:'1',color:'var(--ink)'}}>VIDYA JYOTHI INSTITUTE OF TECHNOLOGY</span>
                <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Aziznagar, Hyderabad. Our host for the day.</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mint-ink)'}}>Visit vjit.ac.in →</span>
              </span>
            </a>
            <div data-rv="1" style={{position:'relative',border:'3px solid var(--line)',background:'var(--surface)',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',boxShadow:'6px 6px 0 var(--sh)',overflow:'hidden'}}>
              <div style={{position:'relative',background:'#14161C',color:'#FFFFFF',padding:'clamp(20px,3.4vw,30px)',display:'flex',flexDirection:'column',justifyContent:'center',gap:'10px',overflow:'hidden'}}>
                <span aria-hidden="true" style={{position:'absolute',inset:'0',backgroundImage:'linear-gradient(rgba(159,227,182,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(159,227,182,.12) 1px,transparent 1px)',backgroundSize:'16px 16px'}}></span>
                <span style={{position:'relative',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.24em',textTransform:'uppercase',color:'#9FE3B6'}}>Organised by</span>
                <span style={{position:'relative',fontFamily:'var(--font-display)',fontSize:'clamp(40px,9vw,64px)',lineHeight:'.88',letterSpacing:'.01em'}}>AWS SBG<br /><span style={{color:'#FF9900'}}>VJIT</span></span>
                <span style={{position:'relative',display:'flex',gap:'4px'}} aria-hidden="true">
                  <span style={{width:'10px',height:'10px',background:'#9FE3B6'}}></span>
                  <span style={{width:'10px',height:'10px',background:'#C4AEF2'}}></span>
                  <span style={{width:'10px',height:'10px',background:'#F2A7C3'}}></span>
                  <span style={{width:'10px',height:'10px',background:'#F6C899'}}></span>
                </span>
              </div>
              <div style={{padding:'clamp(20px,3.4vw,30px)',display:'flex',flexDirection:'column',justifyContent:'center',gap:'12px'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(26px,5vw,34px)',lineHeight:'1',color:'var(--ink)'}}>BY STUDENTS, FOR STUDENTS</span>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px',fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.14em',textTransform:'uppercase'}}>
                  <span style={{border:'2px solid var(--line)',padding:'6px 9px',color:'var(--ink)'}}>Student-run</span>
                  <span style={{border:'2px solid var(--line)',padding:'6px 9px',color:'var(--ink)'}}>VJIT · Hyderabad</span>
                  <span style={{border:'2px solid var(--line)',padding:'6px 9px',color:'var(--ink)'}}>First edition</span>
                </div>
              </div>
            </div>
            <div data-rv="1" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'14px',flexWrap:'wrap',paddingTop:'6px'}}>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// COMMUNITY SPONSORS'}</span>
                <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(35px,8.8vw,70px)',lineHeight:'.94',color:'var(--ink)'}}>WHO ELSE IS BEHIND IT</h2>
              </div>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Food · event · swag</span>
            </div>
            <div data-rv="1" style={{display:'grid',gap:'clamp(18px,2.6vw,28px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,330px),1fr))',alignItems:'stretch'}}>
              <a className="dh-h21" href="https://www.linkedin.com/company/csxia/" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'14px',color:'var(--ink)',transition:'transform .14s steps(3),border-color .14s steps(2),box-shadow .14s steps(3)'}}>
                <span style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mint-ink)'}}>Community partner</span>
                  <span style={{display:'flex',gap:'3px'}} aria-hidden="true">
                    <span style={{width:'8px',height:'8px',background:'#9FE3B6'}}></span>
                    <span style={{width:'8px',height:'8px',background:'#9FE3B6'}}></span>
                    <span style={{width:'8px',height:'8px',background:'var(--bar)'}}></span>
                  </span>
                </span>
                <span style={{background:'var(--bg)',border:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',minHeight:'200px'}}>
                  <Image src="/assets/csxia-logo.jpeg" alt="CSXIA" width={1150} height={912} sizes="220px" style={{width:'100%',maxWidth:'220px',height:'auto',display:'block',imageRendering:'auto'}} />
                </span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'32.5px',color:'var(--ink)'}}>CSXIA</span>
                <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Engage. Learn. Build. Level up.</span>
                <span style={{marginTop:'auto',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mint-ink)'}}>View on LinkedIn →</span>
              </a>
              <a className="dh-h21" href="https://awsughyd.com/" style={{border:'3px solid var(--line)',background:'var(--surface)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'14px',color:'var(--ink)',transition:'transform .14s steps(3),border-color .14s steps(2),box-shadow .14s steps(3)'}}>
                <span style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mint-ink)'}}>Community partner</span>
                  <span style={{display:'flex',gap:'3px'}} aria-hidden="true">
                    <span style={{width:'8px',height:'8px',background:'#9FE3B6'}}></span>
                    <span style={{width:'8px',height:'8px',background:'#9FE3B6'}}></span>
                    <span style={{width:'8px',height:'8px',background:'var(--bar)'}}></span>
                  </span>
                </span>
                <span style={{background:'#FFFFFF',border:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',minHeight:'200px'}}>
                  <Image src="/assets/ug-hyderabad.jpeg" alt="User Groups Hyderabad" width={200} height={200} sizes="220px" style={{width:'100%',maxWidth:'200px',height:'auto',display:'block',imageRendering:'auto'}} />
                </span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'32.5px',color:'var(--ink)'}}>USER GROUPS HYDERABAD</span>
                <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>The AWS community in Hyderabad.</span>
                <span style={{marginTop:'auto',fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mint-ink)'}}>Visit awsughyd.com →</span>
              </a>
              <div className="dh-h22" style={{border:'3px dashed var(--line-dash)',background:'var(--surface)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--muted)'}}>Slot open</span>
                <span style={{background:'var(--panel)',border:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'200px',fontFamily:'var(--font-display)',fontSize:'70px',color:'#D6CFC5'}}>?</span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'25px',color:'var(--ink)'}}>FOOD SPONSOR</span>
                <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Feed every attendee and get your name on every table.</span>
              </div>
              <div className="dh-h22" style={{border:'3px dashed var(--line-dash)',background:'var(--surface)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'12px',transition:'transform .14s steps(3),border-color .14s steps(2)'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'9.5px',letterSpacing:'.2em',textTransform:'uppercase',color:'var(--muted)'}}>Slot open</span>
                <span style={{background:'var(--panel)',border:'2px solid var(--line-soft)',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'200px',fontFamily:'var(--font-display)',fontSize:'70px',color:'#D6CFC5'}}>?</span>
                <span style={{fontFamily:'var(--font-display)',fontSize:'25px',color:'var(--ink)'}}>SWAG SPONSOR</span>
                <span style={{fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Your thing in every swag kit, tier 1 to tier 4.</span>
              </div>
              <div className="dh-h23" style={{border:'3px solid #9FE3B6',background:'var(--panel-mint)',padding:'24px 22px',display:'flex',flexDirection:'column',gap:'12px',justifyContent:'center',transition:'transform .14s steps(3),box-shadow .14s steps(3)'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'31.3px',lineHeight:'1.05',color:'var(--ink)'}}>BACK THE DAY</span>
                <p style={{margin:'0',fontSize:'13.5px',lineHeight:'1.55',color:'var(--body)'}}>Food, event and swag sponsorships are all open. Tell us which one fits.</p>
                <Link className="dh-h20 dh-a4" href="/sponsor" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:'48px',background:'#9FE3B6',color:'var(--on-fill)',fontFamily:'var(--font-display)',fontSize:'22.5px',boxShadow:'5px 5px 0 var(--line)',cursor:'pointer',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>BECOME A SPONSOR</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="venue" style={{position:'relative',zIndex:'10',borderTop:'3px solid var(--line)'}}>
          <div data-rv="1" style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'grid',gap:'clamp(26px,4.4vw,68px)',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,290px),1fr))',alignItems:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// THE PLACE'}</span>
              <div style={{display:'flex',alignItems:'flex-start',gap:'12px'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(95px,25vw,225px)',lineHeight:'.78',color:'var(--ink)',textShadow:'5px 5px 0 #F6C899'}}>30</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'clamp(11px,2.6vw,13px)',letterSpacing:'.18em',textTransform:'uppercase',paddingTop:'10px',color:'var(--body)'}}>OCT<br />2026<br />{doors}</span>
              </div>
              <p style={{margin:'0',maxWidth:'40ch',fontSize:'clamp(15px,3.8vw,17px)',lineHeight:'1.65',color:'var(--body)'}}>Vidya Jyothi Institute of Technology, Aziznagar Village Road, Aziznagar, Hyderabad, Telangana 500075.</p>
              <a className="dh-h24" href="https://maps.app.goo.gl/PAPnu2YHVdWE2pvQ6" style={{display:'inline-flex',alignSelf:'flex-start',alignItems:'center',minHeight:'52px',padding:'0 22px',background:'var(--ink-fill)',color:'var(--bg)',fontFamily:'var(--font-display)',fontSize:'22.5px',boxShadow:'5px 5px 0 #9FE3B6',transition:'transform .1s steps(2),box-shadow .1s steps(2)'}}>OPEN THE GATE PIN</a>
            </div>
            <div style={{display:'flex',flexDirection:'column',border:'3px solid var(--line)',background:'var(--surface)'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'12px',borderBottom:'2px solid var(--line-soft)',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}>
                <span style={{color:'var(--muted)'}}>Session types</span>
                <span style={{color:'var(--mint-ink)'}}>5</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',gap:'12px',borderBottom:'2px solid var(--line-soft)',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}>
                <span style={{color:'var(--muted)'}}>Keynote · Q&A</span>
                <span>Every pass</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',gap:'12px',borderBottom:'2px solid var(--line-soft)',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}>
                <span style={{color:'var(--muted)'}}>Workshops · panel</span>
                <span>By pass tier</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',gap:'12px',padding:'14px 16px',fontFamily:'var(--font-mono)',fontSize:'11.5px',letterSpacing:'.14em',textTransform:'uppercase'}}>
                <span style={{color:'var(--muted)'}}>Timings</span>
                <span>Announced soon</span>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" style={{position:'relative',zIndex:'10',borderTop:'3px solid var(--line)',background:'var(--panel)'}}>
          <div style={{maxWidth:'1240px',margin:'0 auto',padding:'clamp(52px,10vh,124px) clamp(18px,5vw,56px)',display:'flex',flexDirection:'column',gap:'clamp(24px,4vh,42px)'}}>
            <div data-rv="1" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:'14px',flexWrap:'wrap'}}>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mint-ink)'}}>{'// BEFORE YOU ASK'}</span>
                <h2 style={{margin:'0',fontFamily:'var(--font-display)',fontSize:'clamp(37.5px,9.5vw,77.5px)',lineHeight:'.94',color:'var(--ink)'}}>QUESTIONS</h2>
              </div>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Still stuck? Mail us</span>
            </div>
            <div data-rv="1" style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>Who can attend?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Any student, from any college in Hyderabad. You do not have to be from VJIT. Attendees must be 18 or older.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>Do I need experience with AWS?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>No. Most people in the room will be at their first conference. Sessions run from introductory talks to deeper technical ones, and you choose which to sit in.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>How do sessions and seats work?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>There are five kinds of session: a keynote, technical sessions (Cloud Engineering and AI), hands-on workshops, a panel discussion and an open Q&A. Every pass gets the keynote, one technical session and the Q&A. Premium adds a hands-on workshop, Platinum adds the panel and a reserved seat, and VIP adds front-row seating, networking with speakers and dedicated assistance. Sessions are subject to change, and timings are announced closer to the day.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>Is food included?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Yes, on every tier. Everyone gets the same lunch, so there is nothing to pick when you register.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>What is in the swag?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Not declared. Swag level rises with the tier, tier 1 through tier 4, and what is actually inside stays sealed until you collect it on the day.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>How do I register?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Registrations are not open yet. Leave your email on the register page and we will write to you the moment they open.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>What time does it start?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Doors open at {doors}. Session timings are announced closer to the day.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>Is this run by AWS?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>No. It is organised by volunteers from the AWS Student Builders Group at VJIT. AWS funds it as a community event, which is why the tickets cost what they do, but the day is ours to run.</div>
              </details>
              <details style={{border:'3px solid var(--line)',background:'var(--surface)'}}>
                <summary style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'14px',padding:'20px 22px',cursor:'pointer',fontFamily:'var(--font-display)',fontSize:'clamp(21.3px,5.3vw,26.3px)',color:'var(--ink)'}}>Can I speak or sponsor?<span data-faq-plus="1" style={{flex:'none',fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber-ink)',transition:'transform .16s steps(3)'}}>+</span></summary>
                <div style={{padding:'0 22px 22px',fontSize:'15px',lineHeight:'1.65',color:'var(--body)',maxWidth:'68ch'}}>Both are open. Students and working engineers can apply to speak, and food, event and swag sponsorships are available. Mail <a href="mailto:awssbgvjit@gmail.com">awssbgvjit@gmail.com</a> and say which one.</div>
              </details>
            </div>
          </div>
        </section>
      </main>

      <footer style={{position:'relative',zIndex:'10',borderTop:'6px solid var(--line)',background:'var(--panel)',padding:'clamp(44px,8vh,92px) clamp(18px,5vw,56px)'}}>
        <div style={{maxWidth:'1240px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'clamp(20px,4vh,40px)'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:'clamp(35px,10vw,100px)',lineHeight:'.92',color:'var(--ink)'}}>AWS STUDENT COMMUNITY DAY <span style={{color:'var(--amber-ink)'}}>HYDERABAD</span></span>
          <div style={{display:'grid',gap:'20px',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',borderTop:'3px solid #D6CFC5',paddingTop:'22px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'11px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>The day</span>
              <a href="#what" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>ABOUT</a>
              <a href="#prog" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>SESSIONS</a>
              <a href="#speakers" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>SPEAKERS</a>
              <a href="#venue" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>VENUE</a>
              <a href="#faq" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>FAQ</a>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'11px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Take part</span>
              <Link href="/register" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>REGISTER</Link>
              <a href="#passes" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>PASSES</a>
              <Link href="/speak" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>APPLY TO SPEAK</Link>
              <Link href="/sponsor" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>SPONSOR US</Link>
              <a href="#sponsors" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>OUR SPONSORS</a>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'11px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'.18em',textTransform:'uppercase',color:'var(--muted)'}}>Help</span>
              <Link href="/code-of-conduct" style={{color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'21.3px',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>CODE OF CONDUCT</Link>
              <Link className="dh-h25" href="/code-of-conduct#report" style={{display:'inline-flex',alignItems:'center',gap:'8px',alignSelf:'flex-start',minHeight:'44px',padding:'0 14px',border:'3px solid #FF9900',color:'var(--ink)',fontFamily:'var(--font-display)',fontSize:'20px',transition:'background .12s steps(2),color .12s steps(2)'}}><span style={{width:'9px',height:'9px',background:'#FF9900',display:'block'}}></span>REPORT AN ISSUE</Link>
              <a href="mailto:awssbgvjit@gmail.com" style={{fontSize:'14px',lineHeight:'1.6',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>awssbgvjit@gmail.com</a>
              <span style={{fontSize:'14px',lineHeight:'1.6',color:'var(--body)'}}>Hosted by AWS Student Builders Group, VJIT</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)'}}>awsscdhyd.in</span>
              <Link href="/admin/login" style={{fontFamily:'var(--font-mono)',fontSize:'10.5px',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)',minHeight:'30px',display:'inline-flex',alignItems:'center'}}>Crew sign in</Link>
            </div>
            <p style={{margin:'0',fontSize:'12.5px',lineHeight:'1.65',color:'var(--muted)',maxWidth:'44ch'}}>AWS User Groups are run by independent volunteers and are not organized by AWS.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * The group pass pop-up: once per visit, a moment after the page loads.
 * Closes on the cross, Escape or a click outside; sessionStorage remembers,
 * so it never comes back while someone browses.
 */
const PROMO_SEEN = 'scd-group-promo'

function GroupPromo() {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(PROMO_SEEN) === '1'
    } catch {
      // Storage blocked: show it, it still closes.
    }
    if (seen) return
    const t = setTimeout(() => setOpen(true), 900)
    return () => clearTimeout(t)
  }, [])

  const close = () => {
    setOpen(false)
    try {
      sessionStorage.setItem(PROMO_SEEN, '1')
    } catch {
      // Storage blocked: it may show again on the next load, which is fine.
    }
  }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <div className="gp-overlay" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="gp-title" className="gp-banner gp-pop" onClick={(e) => e.stopPropagation()}>
        <div className="gp-banner-in gp-pop-in">
          <button ref={closeRef} type="button" className="gp-close" onClick={close} aria-label="Close">✕</button>
          <span className="gp-banner-tag"><span className="gp-dot" aria-hidden="true"></span>NEW</span>
          <span id="gp-title" className="gp-banner-title">GROUP PASSES ARE LIVE</span>
          <span className="gp-banner-sub">Come as 4 or 5 and pay one total with a group discount. One person fills in everyone, and everyone gets their own pass.</span>
          <Link href="/register?group=4" className="gp-banner-cta" onClick={close}>{'REGISTER NOW >'}</Link>
        </div>
      </div>
    </div>
  )
}
