// VARIATION 2: MODERN EDTECH
// Crisp white, bold geometric sans, minimal red accents, stat-forward, corporate.
// Feels like a professional SaaS — think Linear meets Duolingo Business.

const modernStyles = {
  root: {
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    background: "#ffffff",
    color: "#0a0a0a",
  },
  container: {
    maxWidth: 1320,
    margin: '0 auto',
    padding: '0 40px',
  },
};

function ModernNav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: scrolled ? 'rgba(255,255,255,0.9)' : '#fff',
      backdropFilter: 'blur(14px)',
      borderBottom: scrolled ? '1px solid #eeeeee' : '1px solid transparent',
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        ...modernStyles.container,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px',
      }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="logo.png" alt="EzNihongo" style={{ height: 38 }} />
        </a>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {SHARED_CONTENT.nav.map(n => (
            <a key={n.label} href={n.href} style={{ fontSize: 14, fontWeight: 500, color: '#404040' }}
               onMouseOver={e => e.target.style.color = '#C8102E'}
               onMouseOut={e => e.target.style.color = '#404040'}>
              {n.label}
            </a>
          ))}
          <button style={{
            fontSize: 14, color: '#404040', fontWeight: 500, padding: '10px 16px',
          }}>Login</button>
          <button style={{
            background: '#C8102E', color: '#fff',
            padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            boxShadow: '0 2px 0 #8a0b20',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.target.style.transform = 'translateY(1px)'; e.target.style.boxShadow = '0 1px 0 #8a0b20'; }}
          onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 2px 0 #8a0b20'; }}>
            Daftar Sekarang →
          </button>
        </div>
      </div>
    </nav>
  );
}

function ModernHero() {
  const h = SHARED_CONTENT.hero;
  return (
    <section style={{
      paddingTop: 80, paddingBottom: 100, position: 'relative',
      background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
    }}>
      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(#0a0a0a08 1px, transparent 1px), linear-gradient(90deg, #0a0a0a08 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 70% 50% at 50% 30%, black 30%, transparent 80%)',
        pointerEvents: 'none',
      }} />

      <div style={{ ...modernStyles.container, position: 'relative', zIndex: 2 }}>
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 920, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1px solid #e5e5e5',
            padding: '6px 14px 6px 6px', borderRadius: 999,
            fontSize: 13, fontWeight: 500, color: '#404040',
            marginBottom: 32,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <span style={{
              background: '#C8102E', color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '3px 8px', borderRadius: 999, letterSpacing: '0.05em',
            }}>BARU</span>
            Kurikulum SSW/Tokutei Ginou 2026 sudah tersedia
            <span style={{ color: '#C8102E' }}>→</span>
          </div>
          <h1 style={{
            fontSize: 'clamp(44px, 6vw, 84px)',
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
            marginBottom: 24,
            textWrap: 'balance',
          }}>
            Kuasai bahasa Jepang.<br/>
            <span style={{
              background: 'linear-gradient(135deg, #C8102E 0%, #E8414F 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Bangun karier di Jepang.</span>
          </h1>
          <p style={{
            fontSize: 19, lineHeight: 1.55, color: '#525252', marginBottom: 36,
            maxWidth: 680, margin: '0 auto 36px', textWrap: 'pretty',
          }}>
            Platform belajar bahasa Jepang yang dirancang untuk pelajar Indonesia yang serius ingin bekerja, kuliah, atau pindah ke Jepang. Online, fleksibel, dan 60% lebih hemat dari LPK konvensional.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button style={{
              background: '#0a0a0a', color: '#fff',
              padding: '15px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: '0 3px 0 #000, 0 10px 30px rgba(0,0,0,0.15)',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
              {h.ctaPrimary} <span>→</span>
            </button>
            <button style={{
              background: '#fff', color: '#0a0a0a', border: '1.5px solid #e5e5e5',
              padding: '15px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 10,
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.target.style.borderColor = '#0a0a0a'; }}
            onMouseOut={e => { e.target.style.borderColor = '#e5e5e5'; }}>
              ▶ Tonton Demo (2 mnt)
            </button>
          </div>
          <div style={{ fontSize: 13, color: '#a0a0a0', fontWeight: 500 }}>
            Konsultasi gratis · Bimbingan personal · Fleksibel
          </div>
        </div>

        {/* Product Screenshot Mockup */}
        <div className="reveal" style={{
          marginTop: 80, position: 'relative',
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: 16,
          boxShadow: '0 40px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}>
          {/* Browser chrome */}
          <div style={{
            background: '#f5f5f5', padding: '12px 16px',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <div style={{
              flex: 1, maxWidth: 420, margin: '0 auto',
              background: '#fff', border: '1px solid #e0e0e0',
              padding: '5px 14px', borderRadius: 8,
              fontSize: 12, color: '#808080',
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: 'center',
            }}>
              🔒 eznihongo.com/belajar/n4-unit-3
            </div>
          </div>
          {/* App body */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 440 }}>
            <div style={{ background: '#fafafa', borderRight: '1px solid #e5e5e5', padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a0a0a0', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Kursus</div>
              {[
                { label: 'N5 · Dasar', done: true },
                { label: 'N4 · Intermediate', active: true },
                { label: 'N3 · Advanced', locked: true },
                { label: 'SSW Prep', locked: true },
                { label: 'Kaiwa Sessions', locked: false },
                { label: 'JLPT Try-Out', locked: false },
              ].map((it, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', marginBottom: 3, borderRadius: 8,
                  background: it.active ? '#C8102E' : 'transparent',
                  color: it.active ? '#fff' : (it.locked ? '#c0c0c0' : '#404040'),
                  fontSize: 13, fontWeight: it.active ? 600 : 500,
                }}>
                  <span style={{ fontSize: 11 }}>{it.done ? '✓' : (it.locked ? '🔒' : '●')}</span>
                  {it.label}
                </div>
              ))}
            </div>
            <div style={{ padding: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', marginBottom: 6 }}>UNIT 3 · 8 MIN TERSISA</div>
              <h3 style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>Te-form Verbs (て形)</h3>
              <div style={{ background: '#f5f5f5', height: 6, borderRadius: 999, marginBottom: 28, overflow: 'hidden' }}>
                <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg, #C8102E, #E8414F)', borderRadius: 999 }} />
              </div>
              <div style={{
                background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: 12,
                padding: 24, marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, color: '#808080', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  Translate this sentence:
                </div>
                <div style={{ fontSize: 22, fontFamily: "'Noto Serif JP', serif", marginBottom: 18, fontWeight: 500 }}>
                  毎朝コーヒーを<span style={{ color: '#C8102E', borderBottom: '2px solid #C8102E' }}>飲んで</span>、新聞を読みます。
                </div>
                <div style={{
                  background: '#fff', border: '2px dashed #e5e5e5',
                  padding: 14, borderRadius: 8, fontSize: 14, color: '#a0a0a0',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Ketik jawabanmu...
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>💡 Hint</div>
                <div style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>🔊 Listen</div>
                <div style={{ padding: '6px 12px', background: '#0a0a0a', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, marginLeft: 'auto' }}>Check →</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar under mockup */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 40, marginTop: 60, paddingTop: 40,
          borderTop: '1px solid #e5e5e5',
        }}>
          {[
            { value: '2.400+', label: 'Siswa aktif' },
            { value: 'N5 — N2', label: 'Level kurikulum' },
            { value: '60%', label: 'Lebih hemat' },
            { value: '4.9 / 5', label: 'Rating siswa' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: '#0a0a0a', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#808080', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModernFeatures() {
  const f = SHARED_CONTENT.features;
  return (
    <section id="features" style={{ padding: '120px 0', background: '#0a0a0a', color: '#fff' }}>
      <div style={modernStyles.container}>
        <div className="reveal" style={{ maxWidth: 780, marginBottom: 72 }}>
          <div style={{ display: 'inline-block', padding: '5px 12px', background: 'rgba(200,16,46,0.15)', color: '#E8414F', borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 20 }}>
            {f.eyebrow.toUpperCase()}
          </div>
          <h2 style={{ fontSize: 'clamp(36px, 4.5vw, 56px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 20, textWrap: 'balance' }}>
            {f.title}
          </h2>
          <p style={{ fontSize: 18, color: '#a0a0a0', lineHeight: 1.6, maxWidth: 640, textWrap: 'pretty' }}>
            {f.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {f.items.map((item, i) => (
            <div key={i} className="reveal" style={{
              background: '#141414',
              border: '1px solid #262626',
              borderRadius: 16,
              padding: 36,
              transition: 'all 0.25s',
              cursor: 'default',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#C8102E'; e.currentTarget.style.background = '#1a1a1a'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.background = '#141414'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: 'linear-gradient(135deg, #C8102E, #E8414F)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Noto Serif JP', serif", fontSize: 26, fontWeight: 700, color: '#fff',
                }}>
                  {item.kanji}
                </div>
                <div style={{
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  padding: '5px 10px', background: '#0a0a0a', color: '#a0a0a0',
                  borderRadius: 4, letterSpacing: '0.06em', fontWeight: 600,
                  border: '1px solid #262626',
                }}>
                  {item.tag}
                </div>
              </div>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#E8414F', fontWeight: 600, marginBottom: 10 }}>
                {item.num}
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 15, color: '#a0a0a0', lineHeight: 1.65, textWrap: 'pretty' }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModernAudience() {
  const a = SHARED_CONTENT.audience;
  return (
    <section id="audience" style={{ padding: '120px 0' }}>
      <div style={modernStyles.container}>
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto 72px' }}>
          <div style={{ display: 'inline-block', padding: '5px 12px', background: '#fff0f2', color: '#C8102E', borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 20 }}>
            {a.eyebrow.toUpperCase()}
          </div>
          <h2 style={{ fontSize: 'clamp(36px, 4.5vw, 56px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 20, textWrap: 'balance' }}>
            {a.title}
          </h2>
          <p style={{ fontSize: 18, color: '#525252', lineHeight: 1.6, textWrap: 'pretty' }}>
            {a.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {a.cards.map((c, i) => (
            <div key={i} className="reveal" style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 16,
              overflow: 'hidden',
              transition: 'all 0.25s',
              cursor: 'pointer',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#C8102E'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,0.08)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#e5e5e5'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <PhotoPlaceholder caption={c.photoCaption} aspectRatio="5/4" tone="warm" style={{ borderRadius: 0 }} />
              <div style={{ padding: 24 }}>
                <div style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', background: '#f5f5f5', color: '#525252',
                  borderRadius: 4, letterSpacing: '0.04em', marginBottom: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {c.tag}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  {c.title}
                </h3>
                <p style={{ fontSize: 14, color: '#525252', lineHeight: 1.6 }}>
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

function ModernSensei() {
  const s = SHARED_CONTENT.sensei;
  return (
    <section id="sensei" style={{ padding: '120px 0', background: '#fafafa' }}>
      <div style={modernStyles.container}>
        <div className="reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 32 }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'inline-block', padding: '5px 12px', background: '#fff0f2', color: '#C8102E', borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 20 }}>
              {s.eyebrow.toUpperCase()}
            </div>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 16, textWrap: 'balance' }}>
              {s.title}
            </h2>
            <p style={{ fontSize: 17, color: '#525252', lineHeight: 1.6 }}>
              {s.subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {s.people.map((p, i) => (
            <div key={i} className="reveal" style={{
              background: '#fff', borderRadius: 14, overflow: 'hidden',
              border: '1px solid #e5e5e5',
              transition: 'all 0.25s',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.08)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ position: 'relative' }}>
                <PhotoPlaceholder caption={`photo: ${p.name.split(' ')[0]}-sensei headshot`} aspectRatio="1/1" tone="warm" style={{ borderRadius: 0 }} />
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.01em' }}>{p.name}</h3>
                <div style={{ fontSize: 12, color: '#C8102E', fontWeight: 600, marginBottom: 12 }}>
                  {p.title}
                </div>
                <p style={{ fontSize: 13, color: '#525252', lineHeight: 1.55, marginBottom: 14 }}>
                  {p.bio}
                </p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {p.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '3px 8px',
                      background: '#f5f5f5', color: '#404040',
                      borderRadius: 4, fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModernPricing() {
  const p = SHARED_CONTENT.pricing;
  return (
    <section id="pricing" style={{ padding: '120px 0' }}>
      <div style={modernStyles.container}>
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 64px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', background: '#fff0f2', color: '#C8102E',
            borderRadius: 999, fontSize: 12, fontWeight: 600,
            letterSpacing: '0.06em', marginBottom: 24, textTransform: 'uppercase',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8102E' }} />
            {p.eyebrow}
          </div>
          <h2 style={{
            fontSize: 'clamp(36px, 4.5vw, 56px)', fontWeight: 800,
            lineHeight: 1.1, letterSpacing: '-0.035em',
            marginBottom: 18, textWrap: 'balance', color: '#0a0a0a',
          }}>
            {p.title}
          </h2>
          <p style={{
            fontSize: 18, color: '#525252', lineHeight: 1.6,
            textWrap: 'pretty', maxWidth: 620, margin: '0 auto',
          }}>
            {p.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, margin: '0 auto', alignItems: 'stretch' }}>
          {p.plans.map((plan, i) => (
            <div key={i} className="reveal" style={{
              background: plan.featured ? '#0a0a0a' : '#fff',
              color: plan.featured ? '#fff' : '#0a0a0a',
              border: plan.featured ? '1px solid #0a0a0a' : '1px solid #e5e5e5',
              borderRadius: plan.featured ? 14 : 0,
              borderTopLeftRadius: i === 0 && !plan.featured ? 14 : (plan.featured ? 14 : 0),
              borderBottomLeftRadius: i === 0 && !plan.featured ? 14 : (plan.featured ? 14 : 0),
              borderTopRightRadius: i === 4 && !plan.featured ? 14 : (plan.featured ? 14 : 0),
              borderBottomRightRadius: i === 4 && !plan.featured ? 14 : (plan.featured ? 14 : 0),
              padding: 22,
              position: 'relative',
              transform: plan.featured ? 'scale(1.04)' : 'scale(1)',
              boxShadow: plan.featured ? '0 30px 60px rgba(0,0,0,0.2)' : 'none',
              zIndex: plan.featured ? 2 : 1,
            }}>
              {plan.featured && (
                <div style={{
                  position: 'absolute', top: -12, right: 20,
                  background: '#C8102E', color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  padding: '5px 12px', borderRadius: 999,
                  textTransform: 'uppercase',
                }}>
                  ⭐ Paling Populer
                </div>
              )}
              <div style={{
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600, color: plan.featured ? '#E8414F' : '#C8102E',
                letterSpacing: '0.1em', marginBottom: 10,
              }}>
                {plan.level}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>{plan.name}</h3>
              <div style={{ fontSize: 11.5, color: plan.featured ? '#a0a0a0' : '#808080', marginBottom: 18, lineHeight: 1.4 }}>
                {plan.tagline}
              </div>
              <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: plan.featured ? '1px solid #262626' : '1px solid #e5e5e5' }}>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>{plan.price}</span>
                <span style={{ fontSize: 12, color: plan.featured ? '#a0a0a0' : '#808080', marginLeft: 3, display: 'block', marginTop: 2 }}>
                  {plan.period}
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
                {plan.features.map((ft, j) => (
                  <li key={j} style={{
                    fontSize: 12.5, display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '5px 0', color: plan.featured ? '#d0d0d0' : '#404040', lineHeight: 1.4,
                  }}>
                    <span style={{ color: plan.featured ? '#E8414F' : '#C8102E', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {ft}
                  </li>
                ))}
              </ul>
              <button style={{
                width: '100%',
                padding: '11px 14px',
                background: plan.featured ? '#C8102E' : '#0a0a0a',
                color: '#fff',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                boxShadow: plan.featured ? '0 3px 0 #8a0b20' : '0 3px 0 #000',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.target.style.transform = 'translateY(1px)'; }}
              onMouseOut={e => { e.target.style.transform = 'translateY(0)'; }}>
                {plan.cta} →
              </button>
            </div>
          ))}
        </div>

        <p style={{
          textAlign: 'center', marginTop: 48, fontSize: 14,
          color: '#808080', maxWidth: 720, margin: '48px auto 0',
          lineHeight: 1.6,
        }}>
          {p.note}
        </p>
      </div>
    </section>
  );
}

function ModernFAQ() {
  const f = SHARED_CONTENT.faq;
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" style={{ padding: '120px 0', background: '#fafafa' }}>
      <div style={{ ...modernStyles.container, maxWidth: 920 }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', padding: '5px 12px', background: '#fff0f2', color: '#C8102E', borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 20 }}>
            {f.eyebrow}
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', textWrap: 'balance' }}>
            {f.title}
          </h2>
        </div>

        <div className="reveal">
          {f.items.map((item, i) => (
            <div key={i} style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              marginBottom: 10,
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                width: '100%', textAlign: 'left',
                padding: '20px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 20, fontSize: 16, fontWeight: 600, color: '#0a0a0a',
              }}>
                <span>{item.q}</span>
                <span style={{
                  fontSize: 22, fontWeight: 300,
                  transform: open === i ? 'rotate(45deg)' : 'rotate(0)',
                  transition: 'transform 0.3s', color: '#C8102E',
                  flexShrink: 0,
                }}>+</span>
              </button>
              <div style={{
                maxHeight: open === i ? 260 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.4s ease',
              }}>
                <p style={{ padding: '0 24px 22px', fontSize: 15, color: '#525252', lineHeight: 1.7 }}>
                  {item.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModernFinalCTA() {
  const c = SHARED_CONTENT.finalCTA;
  return (
    <section style={{ padding: '100px 0', background: '#0a0a0a', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* Grid bg */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 40%, transparent 80%)',
      }} />
      <div style={{ ...modernStyles.container, position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 820 }}>
        <div className="reveal">
          <h2 style={{
            fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 800,
            lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 20, textWrap: 'balance',
          }}>
            {c.title}
          </h2>
          <p style={{ fontSize: 18, color: '#a0a0a0', lineHeight: 1.6, marginBottom: 36, maxWidth: 560, margin: '0 auto 36px', textWrap: 'pretty' }}>
            {c.subtitle}
          </p>
          <button style={{
            background: '#C8102E', color: '#fff',
            padding: '17px 32px', borderRadius: 10, fontSize: 16, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 10,
            boxShadow: '0 3px 0 #8a0b20, 0 20px 40px rgba(200,16,46,0.3)',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(1px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
            {c.cta} <span>→</span>
          </button>
          <div style={{ marginTop: 20, fontSize: 13, color: '#606060', fontFamily: "'JetBrains Mono', monospace" }}>
            {c.note}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModernFooter() {
  const f = SHARED_CONTENT.footer;
  return (
    <footer style={{ background: '#fff', borderTop: '1px solid #e5e5e5', padding: '64px 0 32px' }}>
      <div style={modernStyles.container}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: 60, marginBottom: 48 }}>
          <div>
            <img src="logo.png" alt="EzNihongo" style={{ height: 40, marginBottom: 16 }} />
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#525252', maxWidth: 320 }}>
              {f.tagline}
            </p>
          </div>
          {f.columns.map((col, i) => (
            <div key={i}>
              <h4 style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0a0a0a', fontWeight: 700, marginBottom: 16 }}>
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {col.links.map(l => (
                  <li key={l} style={{ marginBottom: 8 }}>
                    <a href="#" style={{ fontSize: 14, color: '#525252' }}
                       onMouseOver={e => e.target.style.color = '#C8102E'}
                       onMouseOut={e => e.target.style.color = '#525252'}>
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{
          paddingTop: 24, borderTop: '1px solid #e5e5e5',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          fontSize: 13, color: '#808080',
        }}>
          <span>{f.copyright}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>v2026.04 · Made in Jakarta ↔ Tokyo</span>
        </div>
      </div>
    </footer>
  );
}

function ModernVariation() {
  useReveal();
  return (
    <div style={modernStyles.root} data-screen-label="Modern Edtech">
      <ModernNav />
      <ModernHero />
      <ModernFeatures />
      <ModernAudience />
      <ModernSensei />
      <ModernPricing />
      <ModernFAQ />
      <ModernFinalCTA />
      <ModernFooter />
    </div>
  );
}

Object.assign(window, { ModernVariation });
