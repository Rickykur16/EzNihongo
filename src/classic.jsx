// VARIATION 1: CLASSIC NIHON
// Warm washi/paper tones, serif headlines, traditional motifs.
// Premium, trustworthy, feels like a Japanese cultural institute.

const classicStyles = {
  root: {
    fontFamily: "'Inter', 'Noto Sans JP', system-ui, sans-serif",
    background: "#faf7f2",
    color: "#1a1611",
    position: 'relative',
    overflow: 'hidden',
  },
  // Washi paper background texture
  washiBg: `
    radial-gradient(ellipse 800px 400px at 20% 0%, #f0e6d3 0%, transparent 60%),
    radial-gradient(ellipse 600px 300px at 90% 30%, #f5ede0 0%, transparent 70%),
    repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(139,90,43,0.012) 3px, rgba(139,90,43,0.012) 4px),
    #faf7f2
  `,
  container: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '0 40px',
  },
};

function ClassicNav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: scrolled ? 'rgba(250,247,242,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(26,22,17,0.08)' : '1px solid transparent',
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        ...classicStyles.container,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 40px',
      }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="assets/logo.png" alt="EzNihongo" style={{ height: 42, width: 'auto' }} />
        </a>
        <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
          {SHARED_CONTENT.nav.map(n => (
            <a key={n.label} href={n.href} style={{
              fontSize: 14, fontWeight: 500, color: '#4a3d2c',
              transition: 'color 0.2s',
            }}
            onMouseOver={e => e.target.style.color = '#C8102E'}
            onMouseOut={e => e.target.style.color = '#4a3d2c'}>
              {n.label}
            </a>
          ))}
          <button style={{
            background: '#1a1611',
            color: '#faf7f2',
            padding: '11px 22px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.01em',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => { e.target.style.background = '#C8102E'; }}
          onMouseOut={e => { e.target.style.background = '#1a1611'; }}>
            Mulai Sekarang
          </button>
        </div>
      </div>
    </nav>
  );
}

function ClassicHero() {
  const h = SHARED_CONTENT.hero;
  return (
    <section style={{ position: 'relative', paddingTop: 60, paddingBottom: 100 }}>
      {/* Giant vertical kanji background flourish */}
      <div style={{
        position: 'absolute',
        top: 40,
        right: -80,
        fontFamily: "'Shippori Mincho', 'Noto Serif JP', serif",
        fontSize: 520,
        fontWeight: 700,
        color: 'rgba(200,16,46,0.04)',
        lineHeight: 0.85,
        writingMode: 'vertical-rl',
        userSelect: 'none',
        zIndex: 0,
      }}>
        日本語
      </div>

      <div style={{ ...classicStyles.container, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 80, alignItems: 'center' }}>
          <div className="reveal">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '8px 16px',
              background: 'rgba(200,16,46,0.08)',
              border: '1px solid rgba(200,16,46,0.2)',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              color: '#C8102E',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 28,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8102E' }}></span>
              {h.eyebrow}
            </div>
            <h1 style={{
              fontFamily: "'Shippori Mincho', 'Noto Serif JP', serif",
              fontSize: 'clamp(40px, 5.2vw, 72px)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: 28,
              textWrap: 'balance',
            }}>
              Bahasa Jepang.<br/>
              Jalan Karier<br/>
              ke <span style={{ color: '#C8102E', position: 'relative', whiteSpace: 'nowrap' }}>
                Negeri Sakura
                <svg style={{ position: 'absolute', bottom: -8, left: 0, width: '100%' }} viewBox="0 0 400 20" preserveAspectRatio="none" height="14">
                  <path d="M5,12 Q100,3 200,8 T395,10 Q300,15 150,13 T5,12 Z" fill="#C8102E" opacity="0.85" />
                </svg>
              </span>.
            </h1>
            <p style={{
              fontSize: 18, lineHeight: 1.6, color: '#5a4a35', marginBottom: 40,
              maxWidth: 540, textWrap: 'pretty',
            }}>
              {h.subhead}
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 48 }}>
              <button style={{
                background: '#C8102E',
                color: '#fff',
                padding: '16px 28px',
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.25s',
                boxShadow: '0 8px 28px rgba(200,16,46,0.28)',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(200,16,46,0.38)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(200,16,46,0.28)'; }}>
                {h.ctaPrimary}
                <span style={{ fontSize: 18 }}>→</span>
              </button>
              <button style={{
                background: 'transparent',
                color: '#1a1611',
                padding: '16px 28px',
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 600,
                border: '1.5px solid rgba(26,22,17,0.25)',
                transition: 'all 0.25s',
              }}
              onMouseOver={e => { e.target.style.background = '#1a1611'; e.target.style.color = '#faf7f2'; e.target.style.borderColor = '#1a1611'; }}
              onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = '#1a1611'; e.target.style.borderColor = 'rgba(26,22,17,0.25)'; }}>
                {h.ctaSecondary}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, paddingTop: 32, borderTop: '1px solid rgba(26,22,17,0.1)' }}>
              {h.stats.map((s, i) => (
                <div key={i}>
                  <div style={{
                    fontFamily: "'Shippori Mincho', serif",
                    fontSize: 34, fontWeight: 700, color: '#1a1611',
                    lineHeight: 1, marginBottom: 6,
                  }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8a7a60', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Layered photo collage */}
          <div className="reveal" style={{ position: 'relative', height: 580 }}>
            {/* Main photo */}
            <div style={{
              position: 'absolute', top: 20, right: 20, width: '78%', height: '70%',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(26,22,17,0.18)',
              border: '10px solid #fff',
            }}>
              <PhotoPlaceholder caption="photo: Shibuya crossing, salaryman walking" aspectRatio="auto" tone="warm" style={{ height: '100%' }} />
            </div>
            {/* Smaller accent photo */}
            <div style={{
              position: 'absolute', bottom: 40, left: 0, width: '48%', height: '38%',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(26,22,17,0.22)',
              border: '8px solid #fff',
              transform: 'rotate(-4deg)',
              zIndex: 2,
            }}>
              <PhotoPlaceholder caption="photo: Indonesian student at desk" aspectRatio="auto" tone="cool" style={{ height: '100%' }} />
            </div>
            {/* Hanko stamp */}
            <div style={{ position: 'absolute', top: 0, left: 40, zIndex: 3, animation: 'float 4s ease-in-out infinite' }}>
              <Hanko size={96} text="本気" />
            </div>
            {/* Decorative kanji */}
            <div style={{
              position: 'absolute', bottom: 0, right: 60,
              fontFamily: "'Shippori Mincho', serif",
              fontSize: 80, color: '#C8102E', opacity: 0.9, lineHeight: 1,
              writingMode: 'vertical-rl',
              zIndex: 3,
            }}>
              夢
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClassicMarquee() {
  return (
    <div style={{
      background: '#1a1611',
      color: '#faf7f2',
      padding: '22px 0',
      overflow: 'hidden',
      borderTop: '1px solid rgba(250,247,242,0.1)',
      borderBottom: '1px solid rgba(250,247,242,0.1)',
    }}>
      <div style={{
        display: 'flex',
        gap: 48,
        whiteSpace: 'nowrap',
        animation: 'marqueeClassic 40s linear infinite',
        fontFamily: "'Shippori Mincho', 'Noto Serif JP', serif",
        fontSize: 18,
        fontWeight: 500,
        letterSpacing: '0.08em',
      }}>
        {[...SHARED_CONTENT.marquee, ...SHARED_CONTENT.marquee, ...SHARED_CONTENT.marquee].map((m, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 48 }}>
            {m}
            <span style={{ color: '#C8102E', fontSize: 10 }}>◆</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marqueeClassic {
          from { transform: translateX(0); }
          to { transform: translateX(-33.33%); }
        }
      `}</style>
    </div>
  );
}

function ClassicFeatures() {
  const f = SHARED_CONTENT.features;
  return (
    <section id="features" style={{ padding: '120px 0', position: 'relative' }}>
      <div style={classicStyles.container}>
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 72px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            — {f.eyebrow} —
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 20,
            textWrap: 'balance',
          }}>
            {f.title}
          </h2>
          <p style={{ fontSize: 17, color: '#5a4a35', lineHeight: 1.6, textWrap: 'pretty' }}>
            {f.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          {f.items.map((item, i) => (
            <div key={i} className="reveal" style={{
              background: '#fff',
              border: '1px solid rgba(26,22,17,0.08)',
              borderRadius: 16,
              padding: 36,
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              cursor: 'default',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 50px rgba(26,22,17,0.1)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              {/* Large faded kanji */}
              <div style={{
                position: 'absolute',
                right: -10, top: -30,
                fontFamily: "'Shippori Mincho', serif",
                fontSize: 200,
                fontWeight: 700,
                color: 'rgba(200,16,46,0.07)',
                lineHeight: 1,
                userSelect: 'none',
              }}>
                {item.kanji}
              </div>
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12, color: '#C8102E', fontWeight: 600,
                  }}>
                    {item.num} / 04
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '5px 10px',
                    background: '#1a1611',
                    color: '#faf7f2',
                    borderRadius: 4,
                    letterSpacing: '0.06em',
                  }}>
                    {item.tag}
                  </div>
                </div>
                <h3 style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 26, fontWeight: 700,
                  marginBottom: 14, lineHeight: 1.2,
                }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 15, color: '#5a4a35', lineHeight: 1.65, textWrap: 'pretty' }}>
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClassicAudience() {
  const a = SHARED_CONTENT.audience;
  return (
    <section id="audience" style={{
      padding: '120px 0',
      background: '#1a1611',
      color: '#faf7f2',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative torii silhouette */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.04,
      }}>
        <ToriiIcon size={800} color="#C8102E" />
      </div>

      <div style={{ ...classicStyles.container, position: 'relative', zIndex: 2 }}>
        <div className="reveal" style={{ maxWidth: 680, marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            — {a.eyebrow} —
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(32px, 4vw, 54px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 18,
            textWrap: 'balance',
          }}>
            {a.title}
          </h2>
          <p style={{ fontSize: 17, color: '#c8b99e', lineHeight: 1.6, textWrap: 'pretty' }}>
            {a.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          {a.cards.map((c, i) => (
            <div key={i} className="reveal" style={{
              background: '#24201a',
              border: '1px solid rgba(250,247,242,0.08)',
              borderRadius: 16,
              overflow: 'hidden',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = '#C8102E';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = 'rgba(250,247,242,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{ height: 200, position: 'relative' }}>
                <PhotoPlaceholder caption={c.photoCaption} aspectRatio="auto" tone="dark" style={{ height: '100%', borderRadius: 0 }} />
              </div>
              <div style={{ padding: 32 }}>
                <div style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '5px 12px',
                  background: 'rgba(200,16,46,0.15)',
                  color: '#e85a72',
                  borderRadius: 4,
                  letterSpacing: '0.06em',
                  marginBottom: 16,
                }}>
                  {c.tag}
                </div>
                <h3 style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 22, fontWeight: 600,
                  marginBottom: 12, lineHeight: 1.3,
                }}>
                  {c.title}
                </h3>
                <p style={{ fontSize: 14.5, color: '#c8b99e', lineHeight: 1.65 }}>
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClassicSensei() {
  const s = SHARED_CONTENT.sensei;
  return (
    <section id="sensei" style={{ padding: '120px 0' }}>
      <div style={classicStyles.container}>
        <div className="reveal" style={{ maxWidth: 680, marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            — {s.eyebrow} · 先生 —
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(32px, 4vw, 54px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 18,
            textWrap: 'balance',
          }}>
            {s.title}
          </h2>
          <p style={{ fontSize: 17, color: '#5a4a35', lineHeight: 1.6, textWrap: 'pretty' }}>
            {s.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {s.people.map((p, i) => (
            <div key={i} className="reveal" style={{
              background: '#fff',
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid rgba(26,22,17,0.08)',
              transition: 'all 0.3s',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-6px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ aspectRatio: '1/1', position: 'relative' }}>
                <PhotoPlaceholder caption={`photo: ${p.name.split(' ')[0]}-sensei`} aspectRatio="1/1" tone="warm" style={{ height: '100%', borderRadius: 0 }} />
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: '#C8102E', color: '#fff',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  padding: '4px 8px', borderRadius: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  先生
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
                <div style={{ fontSize: 12, color: '#C8102E', fontWeight: 600, marginBottom: 10, letterSpacing: '0.02em' }}>
                  {p.title}
                </div>
                <p style={{ fontSize: 13, color: '#5a4a35', lineHeight: 1.55, marginBottom: 14 }}>
                  {p.bio}
                </p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                  {p.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '3px 8px',
                      background: '#f0ebe0', color: '#5a4a35',
                      borderRadius: 4, fontWeight: 500,
                    }}>{t}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#8a7a60', fontFamily: "'JetBrains Mono', monospace" }}>
                  📍 {p.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClassicPricing() {
  const p = SHARED_CONTENT.pricing;
  return (
    <section id="pricing" style={{
      padding: '120px 0',
      background: 'linear-gradient(180deg, #faf7f2 0%, #f0ebe0 100%)',
      position: 'relative',
    }}>
      <div style={classicStyles.container}>
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 72px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            — {p.eyebrow} —
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 20,
            textWrap: 'balance',
          }}>
            {p.title}
          </h2>
          <p style={{ fontSize: 17, color: '#5a4a35', lineHeight: 1.6, textWrap: 'pretty' }}>
            {p.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, alignItems: 'stretch' }}>
          {p.plans.map((plan, i) => (
            <div key={i} className="reveal" style={{
              background: plan.featured ? '#1a1611' : '#fff',
              color: plan.featured ? '#faf7f2' : '#1a1611',
              border: plan.featured ? '2px solid #C8102E' : '1px solid rgba(26,22,17,0.1)',
              borderRadius: 14,
              padding: 22,
              position: 'relative',
              transform: plan.featured ? 'scale(1.04)' : 'scale(1)',
              boxShadow: plan.featured ? '0 20px 50px rgba(26,22,17,0.25)' : 'none',
              transition: 'all 0.3s',
            }}>
              {plan.featured && (
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: '#C8102E', color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  padding: '6px 14px', borderRadius: 999,
                  textTransform: 'uppercase',
                }}>
                  ⭐ Populer
                </div>
              )}
              <div style={{
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                color: plan.featured ? '#e85a72' : '#C8102E',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}>
                {plan.level}
              </div>
              <h3 style={{
                fontFamily: "'Shippori Mincho', serif",
                fontSize: 22, fontWeight: 700, marginBottom: 4,
              }}>{plan.name}</h3>
              <div style={{ fontSize: 11.5, color: plan.featured ? '#c8b99e' : '#8a7a60', marginBottom: 16, lineHeight: 1.4 }}>
                {plan.tagline}
              </div>
              <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: plan.featured ? '1px solid rgba(250,247,242,0.1)' : '1px solid rgba(26,22,17,0.08)' }}>
                <span style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em',
                }}>{plan.price}</span>
                <span style={{ fontSize: 12, color: plan.featured ? '#c8b99e' : '#8a7a60', marginLeft: 3, display: 'block', marginTop: 2 }}>
                  {plan.period}
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{
                    fontSize: 12.5, display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '5px 0', color: plan.featured ? '#d8cab0' : '#4a3d2c', lineHeight: 1.45,
                  }}>
                    <span style={{ color: '#C8102E', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button style={{
                width: '100%',
                padding: '11px 14px',
                background: plan.featured ? '#C8102E' : 'transparent',
                color: plan.featured ? '#fff' : '#1a1611',
                border: plan.featured ? 'none' : '1.5px solid #1a1611',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseOver={e => {
                if (!plan.featured) { e.target.style.background = '#1a1611'; e.target.style.color = '#faf7f2'; }
                else { e.target.style.background = '#a00d25'; }
              }}
              onMouseOut={e => {
                if (!plan.featured) { e.target.style.background = 'transparent'; e.target.style.color = '#1a1611'; }
                else { e.target.style.background = '#C8102E'; }
              }}>
                {plan.cta} →
              </button>
            </div>
          ))}
        </div>

        <p style={{
          textAlign: 'center', marginTop: 48, fontSize: 13,
          color: '#8a7a60', maxWidth: 700, margin: '48px auto 0',
          fontStyle: 'italic', lineHeight: 1.6,
        }}>
          {p.note}
        </p>
      </div>
    </section>
  );
}

function ClassicFAQ() {
  const f = SHARED_CONTENT.faq;
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" style={{ padding: '120px 0' }}>
      <div style={classicStyles.container}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, alignItems: 'flex-start' }}>
          <div className="reveal">
            <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
              — {f.eyebrow} —
            </div>
            <h2 style={{
              fontFamily: "'Shippori Mincho', serif",
              fontSize: 'clamp(32px, 3.5vw, 48px)',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              marginBottom: 20,
              textWrap: 'balance',
            }}>
              {f.title}
            </h2>
            <p style={{ fontSize: 15, color: '#5a4a35', lineHeight: 1.6, marginBottom: 24 }}>
              Tidak menemukan jawabannya? Tim kami siap membantu dalam 24 jam.
            </p>
            <a href="#" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 14, fontWeight: 600, color: '#C8102E',
              borderBottom: '1px solid #C8102E',
              paddingBottom: 2,
            }}>
              Hubungi Tim EzNihongo →
            </a>
          </div>

          <div className="reveal">
            {f.items.map((item, i) => (
              <div key={i} style={{
                borderBottom: '1px solid rgba(26,22,17,0.1)',
                padding: '4px 0',
              }}>
                <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '22px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 20,
                  fontSize: 17,
                  fontWeight: 600,
                  color: '#1a1611',
                  fontFamily: "'Shippori Mincho', serif",
                }}>
                  <span style={{ flex: 1 }}>{item.q}</span>
                  <span style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: open === i ? '#C8102E' : 'transparent',
                    color: open === i ? '#fff' : '#1a1611',
                    border: open === i ? 'none' : '1px solid rgba(26,22,17,0.2)',
                    fontSize: 20, fontWeight: 400,
                    transition: 'all 0.3s',
                    flexShrink: 0,
                  }}>
                    {open === i ? '−' : '+'}
                  </span>
                </button>
                <div style={{
                  maxHeight: open === i ? 300 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.4s ease, padding 0.4s ease',
                  paddingBottom: open === i ? 24 : 0,
                }}>
                  <p style={{ fontSize: 15, color: '#5a4a35', lineHeight: 1.7, maxWidth: 640 }}>
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClassicFinalCTA() {
  const c = SHARED_CONTENT.finalCTA;
  return (
    <section style={{
      padding: '100px 0',
      background: '#C8102E',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Giant kanji background */}
      <div style={{
        position: 'absolute',
        right: -60, top: '50%', transform: 'translateY(-50%)',
        fontFamily: "'Shippori Mincho', serif",
        fontSize: 600, fontWeight: 900,
        color: 'rgba(255,255,255,0.06)',
        lineHeight: 0.8,
        userSelect: 'none',
      }}>
        {c.kanji}
      </div>
      <div style={{ ...classicStyles.container, position: 'relative', zIndex: 2 }}>
        <div className="reveal" style={{ maxWidth: 780 }}>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(36px, 4.5vw, 60px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 20,
            textWrap: 'balance',
          }}>
            {c.title}
          </h2>
          <p style={{ fontSize: 18, opacity: 0.92, lineHeight: 1.6, marginBottom: 36, maxWidth: 620, textWrap: 'pretty' }}>
            {c.subtitle}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={{
              background: '#1a1611',
              color: '#fff',
              padding: '18px 32px',
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.25s',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#000'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#1a1611'; }}>
              {c.cta}
              <span style={{ fontSize: 18 }}>→</span>
            </button>
            <span style={{ fontSize: 13, opacity: 0.85, fontFamily: "'JetBrains Mono', monospace" }}>
              {c.note}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClassicFooter() {
  const f = SHARED_CONTENT.footer;
  return (
    <footer style={{ background: '#1a1611', color: '#c8b99e', padding: '72px 0 32px' }}>
      <div style={classicStyles.container}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: 60, marginBottom: 56 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <img src="assets/logo-white.png" alt="EzNihongo" style={{ height: 42 }} />
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 320, marginBottom: 20 }}>
              {f.tagline}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {['IG', 'TT', 'YT', 'FB'].map(s => (
                <div key={s} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1px solid rgba(200,185,158,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#C8102E'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#C8102E'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c8b99e'; e.currentTarget.style.borderColor = 'rgba(200,185,158,0.3)'; }}>
                  {s}
                </div>
              ))}
            </div>
          </div>
          {f.columns.map((col, i) => (
            <div key={i}>
              <h4 style={{
                fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#faf7f2', fontWeight: 700, marginBottom: 18,
              }}>
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {col.links.map(l => (
                  <li key={l} style={{ marginBottom: 10 }}>
                    <a href="#" style={{ fontSize: 14, color: '#c8b99e', transition: 'color 0.2s' }}
                       onMouseOver={e => e.target.style.color = '#C8102E'}
                       onMouseOut={e => e.target.style.color = '#c8b99e'}>
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{
          paddingTop: 24,
          borderTop: '1px solid rgba(200,185,158,0.15)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <span style={{ fontSize: 13 }}>{f.copyright}</span>
          <span style={{ fontSize: 12, fontFamily: "'Shippori Mincho', serif", color: '#8a7a60' }}>
            日本への道 — Jalan ke Jepang
          </span>
        </div>
      </div>
    </footer>
  );
}

function ClassicVariation() {
  useReveal();
  return (
    <div style={{ ...classicStyles.root, background: classicStyles.washiBg }} data-screen-label="Classic Nihon">
      <SakuraPetals count={10} />
      <ClassicNav />
      <ClassicHero />
      <ClassicMarquee />
      <ClassicFeatures />
      <ClassicAudience />
      <ClassicSensei />
      <ClassicPricing />
      <ClassicFAQ />
      <ClassicFinalCTA />
      <ClassicFooter />
    </div>
  );
}

Object.assign(window, { ClassicVariation });
