// VARIATION 3: EDITORIAL BOLD
// Dark mode, magazine-style layout, vertical kanji, dramatic typography.
// Feels like a design publication meets premium brand.

const editorialStyles = {
  root: {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "#0d0b09",
    color: "#f5efe4",
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '0 48px',
  },
};

function EditorialNav() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(13,11,9,0.85)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(245,239,228,0.08)',
    }}>
      <div style={{ ...editorialStyles.container, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 48px' }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="assets/logo-white.png" alt="EzNihongo" style={{ width: 80 }} />
        </a>
        <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
          {SHARED_CONTENT.nav.map(n => (
            <a key={n.label} href={n.href} style={{ fontSize: 13, fontWeight: 500, color: '#a09a8e', letterSpacing: '0.02em' }}
               onMouseOver={e => e.target.style.color = '#f5efe4'}
               onMouseOut={e => e.target.style.color = '#a09a8e'}>
              {n.label}
            </a>
          ))}
          <button style={{
            background: '#C8102E', color: '#fff',
            padding: '11px 22px', borderRadius: 0, fontSize: 13, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => { e.target.style.background = '#f5efe4'; e.target.style.color = '#0d0b09'; }}
          onMouseOut={e => { e.target.style.background = '#C8102E'; e.target.style.color = '#fff'; }}>
            Mulai → 
          </button>
        </div>
      </div>
    </nav>
  );
}

function EditorialHero() {
  return (
    <section style={{ position: 'relative', paddingTop: 60, paddingBottom: 0, overflow: 'hidden' }}>
      {/* Vertical Japanese text columns on the side */}
      <div style={{
        position: 'absolute', left: 20, top: 100,
        writingMode: 'vertical-rl', fontFamily: "'Shippori Mincho', serif",
        fontSize: 13, letterSpacing: '0.3em', color: '#6a6459',
        height: 400,
      }}>
        日本への扉 — GATEWAY TO JAPAN · EST. 2024
      </div>
      <div style={{
        position: 'absolute', right: 20, top: 100,
        writingMode: 'vertical-rl', fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, letterSpacing: '0.25em', color: '#6a6459',
        height: 400,
      }}>
        VOL.01 / ISSUE 04 / APRIL MMXXVI
      </div>

      <div style={{ ...editorialStyles.container, position: 'relative', zIndex: 2, paddingLeft: 100, paddingRight: 100 }}>
        {/* Top meta row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          paddingBottom: 24, marginBottom: 48,
          borderBottom: '1px solid rgba(245,239,228,0.15)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, letterSpacing: '0.2em', color: '#a09a8e', textTransform: 'uppercase',
        }}>
          <span>◆ Platform Belajar Bahasa Jepang</span>
          <span>— Untuk Pejuang Karier ke Jepang —</span>
          <span style={{ color: '#C8102E' }}>● LIVE NOW</span>
        </div>

        {/* Headline */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 60 }}>
          <h1 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(56px, 9vw, 160px)',
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: '-0.04em',
            textWrap: 'balance',
          }}>
            Bahasa Jepang,<br/>
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: '#C8102E' }}>menembus</em><br/>
            batas mimpimu.
          </h1>
        </div>

        {/* Subhead + CTA in two columns */}
        <div className="reveal" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 80, marginBottom: 80, maxWidth: 1100, margin: '0 auto 80px',
        }}>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, letterSpacing: '0.2em', color: '#C8102E',
              marginBottom: 14, textTransform: 'uppercase',
            }}>
              → Perkenalan
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgb(0, 0, 0)', textWrap: 'pretty' }}>
              EzNihongo adalah platform belajar bahasa Jepang online pertama di Indonesia yang merancang kurikulumnya khusus untuk pelajar, pencari kerja, dan profesional yang ingin membangun kariernya di Jepang. Biaya sepersekian dari LPK konvensional, fleksibilitas penuh untuk yang belajar sambil bekerja.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
            <button style={{
              background: '#C8102E', color: '#fff',
              padding: '20px 28px', borderRadius: 0,
              fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.target.style.background = '#f5efe4'; e.target.style.color = '#0d0b09'; }}
            onMouseOut={e => { e.target.style.background = '#C8102E'; e.target.style.color = '#fff'; }}>
              <span>Mulai Kelas Sekarang</span>
              <span>↗</span>
            </button>
            <button style={{
              background: 'transparent', color: '#f5efe4',
              padding: '20px 28px', borderRadius: 0,
              fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: '1px solid rgba(245,239,228,0.25)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.target.style.borderColor = '#f5efe4'; }}
            onMouseOut={e => { e.target.style.borderColor = 'rgba(245,239,228,0.25)'; }}>
              <span>Lihat Kurikulum</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Hero image + overlay stats */}
        <div className="reveal" style={{ position: 'relative', marginBottom: 0 }}>
          <div style={{ position: 'relative', aspectRatio: '21/9', overflow: 'hidden' }}>
            <PhotoPlaceholder caption="hero photo: neon Tokyo street at night, cinematic" aspectRatio="auto" tone="dark" style={{ height: '100%', borderRadius: 0 }} />
            {/* Red vertical bar overlay */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: '#C8102E' }}></div>
            {/* Giant kanji overlay */}
            <div style={{
              position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)',
              fontFamily: "'Shippori Mincho', serif",
              fontSize: 280, lineHeight: 0.85,
              color: '#C8102E', opacity: 0.85,
              writingMode: 'vertical-rl',
            }}>
              夢路
            </div>
            {/* Caption bottom left */}
            <div style={{
              position: 'absolute', bottom: 24, left: 24,
              background: '#0d0b09', color: '#f5efe4',
              padding: '10px 16px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              [ Photo: Shibuya · 22:47 · Ken Shimizu ]
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid rgba(245,239,228,0.15)',
          borderBottom: '1px solid rgba(245,239,228,0.15)',
          marginTop: 0, padding: '32px 0',
        }}>
          {[
            { value: '2.400+', label: 'Siswa Aktif', num: '01' },
            { value: 'N5—N2', label: 'Level Kurikulum', num: '02' },
            { value: '60%', label: 'Lebih Hemat', num: '03' },
            { value: '4.9★', label: 'Rating Siswa', num: '04' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '8px 24px',
              borderRight: i < 3 ? '1px solid rgba(245,239,228,0.15)' : 'none',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: '#C8102E', letterSpacing: '0.2em', marginBottom: 8,
              }}>— {s.num}</div>
              <div style={{
                fontFamily: "'Shippori Mincho', serif",
                fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
              }}>{s.value}</div>
              <div style={{
                marginTop: 8, fontSize: 11, color: '#a09a8e',
                letterSpacing: '0.15em', textTransform: 'uppercase',
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditorialFeatures() {
  const f = SHARED_CONTENT.features;
  return (
    <section id="features" style={{ padding: '140px 0', position: 'relative' }}>
      <div style={{ ...editorialStyles.container, paddingLeft: 100, paddingRight: 100 }}>
        <div className="reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, marginBottom: 80, alignItems: 'end' }}>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: '#C8102E', letterSpacing: '0.2em', marginBottom: 20, textTransform: 'uppercase',
            }}>
              § 01 — Kurikulum
            </div>
            <div style={{
              fontFamily: "'Shippori Mincho', serif", fontSize: 100, color: '#C8102E',
              lineHeight: 0.9, writingMode: 'vertical-rl',
            }}>
              四柱
            </div>
          </div>
          <div>
            <h2 style={{
              fontFamily: "'Shippori Mincho', serif",
              fontSize: 'clamp(40px, 5.5vw, 76px)',
              fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.03em',
              marginBottom: 20, textWrap: 'balance',
            }}>
              Empat pilar belajar<br/>yang <em style={{ fontWeight: 500, color: '#C8102E' }}>membuktikan</em> progresmu.
            </h2>
            <p style={{ fontSize: 17, color: '#a09a8e', lineHeight: 1.6, maxWidth: 620, textWrap: 'pretty' }}>
              {f.subtitle}
            </p>
          </div>
        </div>

        {/* Editorial list - big numbered rows */}
        <div>
          {f.items.map((item, i) => (
            <div key={i} className="reveal" style={{
              display: 'grid',
              gridTemplateColumns: '0.5fr 1fr 1.5fr 0.8fr',
              gap: 40, alignItems: 'flex-start',
              padding: '48px 0',
              borderTop: '1px solid rgba(245,239,228,0.15)',
              borderBottom: i === f.items.length - 1 ? '1px solid rgba(245,239,228,0.15)' : 'none',
              transition: 'all 0.3s',
              cursor: 'default',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(200,16,46,0.04)'; e.currentTarget.style.paddingLeft = '20px'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '0'; }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13, color: '#C8102E', letterSpacing: '0.1em', fontWeight: 600,
              }}>
                — {item.num}
              </div>
              <div>
                <div style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 120, color: '#C8102E', lineHeight: 0.85,
                  fontWeight: 700,
                }}>
                  {item.kanji}
                </div>
              </div>
              <div>
                <h3 style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 36, fontWeight: 700, marginBottom: 14,
                  letterSpacing: '-0.02em', lineHeight: 1.1,
                }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 16, color: '#a09a8e', lineHeight: 1.65, textWrap: 'pretty' }}>
                  {item.body}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                  padding: '5px 10px', border: '1px solid rgba(245,239,228,0.3)',
                  letterSpacing: '0.1em', color: '#f5efe4',
                }}>{item.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditorialAudience() {
  const a = SHARED_CONTENT.audience;
  return (
    <section id="audience" style={{ padding: '140px 0', background: '#f5efe4', color: '#0d0b09' }}>
      <div style={{ ...editorialStyles.container, paddingLeft: 100, paddingRight: 100 }}>
        <div className="reveal" style={{ marginBottom: 72 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: '#C8102E', letterSpacing: '0.2em', marginBottom: 20, textTransform: 'uppercase',
          }}>
            § 02 — Untuk Siapa
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(44px, 6vw, 88px)',
            fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.03em',
            marginBottom: 20, textWrap: 'balance', maxWidth: 1100,
          }}>
            Membantu mewujudkan<br/>mimpimu di <em style={{ fontWeight: 500 }}>negeri sakura</em>.
          </h2>
          <p style={{ fontSize: 18, color: '#4a4238', lineHeight: 1.55, maxWidth: 640, textWrap: 'pretty' }}>
            {a.subtitle}
          </p>
        </div>

        {/* Magazine-style layout: 2x2 with alternating image position */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 40 }}>
          {a.cards.map((c, i) => (
            <div key={i} className="reveal" style={{
              display: 'flex', flexDirection: 'column', gap: 24,
              paddingBottom: 40,
              borderBottom: '1px solid rgba(13,11,9,0.2)',
            }}>
              <div style={{ position: 'relative' }}>
                <PhotoPlaceholder caption={c.photoCaption} aspectRatio="16/10" tone="warm" style={{ borderRadius: 0 }} />
                <div style={{
                  position: 'absolute', top: 16, left: 16,
                  background: '#C8102E', color: '#fff',
                  padding: '6px 12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                }}>
                  0{i + 1} / {c.tag.toUpperCase()}
                </div>
              </div>
              <div>
                <h3 style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 32, fontWeight: 700, lineHeight: 1.1,
                  marginBottom: 14, letterSpacing: '-0.02em', textWrap: 'balance',
                }}>
                  {c.title}
                </h3>
                <p style={{ fontSize: 15, color: '#4a4238', lineHeight: 1.65, textWrap: 'pretty' }}>
                  {c.body}
                </p>
                <a href="#pricing" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  marginTop: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12, fontWeight: 700, color: '#C8102E',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  borderBottom: '1px solid #C8102E', paddingBottom: 2,
                }}>
                  Baca lebih lanjut →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditorialSensei() {
  const s = SHARED_CONTENT.sensei;
  return (
    <section id="sensei" style={{ padding: '140px 0' }}>
      <div style={{ ...editorialStyles.container, paddingLeft: 100, paddingRight: 100 }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: '#C8102E', letterSpacing: '0.2em', marginBottom: 20, textTransform: 'uppercase',
          }}>
            § 03 — Sensei · 先生
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(40px, 5.5vw, 80px)',
            fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.03em',
            marginBottom: 20, textWrap: 'balance', maxWidth: 1100, margin: '0 auto 20px',
          }}>
            Diajar oleh mereka yang<br/><em style={{ fontWeight: 500, color: '#C8102E' }}>sudah melewatinya</em>.
          </h2>
          <p style={{ fontSize: 17, color: '#a09a8e', lineHeight: 1.6, maxWidth: 640, margin: '0 auto', textWrap: 'pretty' }}>
            {s.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {s.people.map((p, i) => (
            <div key={i} className="reveal" style={{
              transition: 'all 0.3s', cursor: 'default',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-8px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <PhotoPlaceholder caption={`portrait: ${p.name}`} aspectRatio="3/4" tone="dark" style={{ borderRadius: 0 }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0,
                  background: '#C8102E', color: '#fff',
                  padding: '6px 10px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                }}>
                  先生 #{String(i + 1).padStart(2, '0')}
                </div>
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: '#C8102E', letterSpacing: '0.15em', marginBottom: 8,
              }}>
                — {p.title}
              </div>
              <h3 style={{
                fontFamily: "'Shippori Mincho', serif",
                fontSize: 24, fontWeight: 700, marginBottom: 12,
                letterSpacing: '-0.02em', lineHeight: 1.15,
              }}>
                {p.name}
              </h3>
              <p style={{ fontSize: 13, color: '#a09a8e', lineHeight: 1.6, marginBottom: 14 }}>
                {p.bio}
              </p>
              <div style={{
                fontSize: 11, color: '#6a6459',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.1em',
                borderTop: '1px solid rgba(245,239,228,0.1)',
                paddingTop: 12,
              }}>
                📍 {p.location.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditorialPricing() {
  const p = SHARED_CONTENT.pricing;
  return (
    <section id="pricing" style={{ padding: '140px 0', background: '#f5efe4', color: '#0d0b09' }}>
      <div style={{ ...editorialStyles.container, paddingLeft: 100, paddingRight: 100 }}>
        <div className="reveal" style={{ marginBottom: 80 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: '#C8102E', letterSpacing: '0.2em', marginBottom: 20, textTransform: 'uppercase',
          }}>
            § 04 — Investasi
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(44px, 6vw, 88px)',
            fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.03em',
            marginBottom: 20, textWrap: 'balance', maxWidth: 1100,
          }}>
            Biaya <em style={{ fontWeight: 500, color: '#C8102E' }}>sepersekian</em> dari LPK.<br/>Hasil yang serius.
          </h2>
          <p style={{ fontSize: 17, color: '#4a4238', lineHeight: 1.6, maxWidth: 640, textWrap: 'pretty' }}>
            {p.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: '1px solid #0d0b09', background: '#0d0b09' }}>
          {p.plans.map((plan, i) => (
            <div key={i} className="reveal" style={{
              background: plan.featured ? '#0d0b09' : '#f5efe4',
              color: plan.featured ? '#f5efe4' : '#0d0b09',
              padding: 28,
              position: 'relative',
              borderRight: i < 4 ? '1px solid #0d0b09' : 'none',
            }}>
              {plan.featured && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  background: '#C8102E', color: '#fff',
                  padding: '8px 14px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                }}>
                  ★ POPULER
                </div>
              )}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, letterSpacing: '0.2em', fontWeight: 700,
                color: '#C8102E', marginBottom: 12, textTransform: 'uppercase',
              }}>
                0{i + 1} / {plan.level}
              </div>
              <h3 style={{
                fontFamily: "'Shippori Mincho', serif",
                fontSize: 28, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.03em',
              }}>{plan.name}</h3>
              <div style={{ fontSize: 12, color: plan.featured ? '#a09a8e' : '#4a4238', marginBottom: 20, fontStyle: 'italic', lineHeight: 1.4 }}>
                — {plan.tagline}
              </div>
              <div style={{
                marginBottom: 22, paddingBottom: 18,
                borderBottom: plan.featured ? '1px solid rgba(245,239,228,0.2)' : '1px solid rgba(13,11,9,0.2)',
              }}>
                <span style={{
                  fontFamily: "'Shippori Mincho', serif",
                  fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em',
                }}>{plan.price}</span>
                <span style={{ fontSize: 12, color: plan.featured ? '#a09a8e' : '#4a4238', marginLeft: 4, display: 'block', marginTop: 2 }}>
                  {plan.period}
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                {plan.features.map((ft, j) => (
                  <li key={j} style={{
                    fontSize: 12.5, display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '6px 0', color: plan.featured ? '#d0c9ba' : '#2a2620',
                    lineHeight: 1.45,
                  }}>
                    <span style={{ color: '#C8102E', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>✕</span>
                    {ft}
                  </li>
                ))}
              </ul>
              <button style={{
                width: '100%',
                padding: '14px 16px',
                background: '#C8102E',
                color: '#fff',
                borderRadius: 0,
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                transition: 'all 0.2s',
                display: 'inline-flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onMouseOver={e => { e.target.style.background = plan.featured ? '#f5efe4' : '#0d0b09'; e.target.style.color = plan.featured ? '#0d0b09' : '#f5efe4'; }}
              onMouseOut={e => { e.target.style.background = '#C8102E'; e.target.style.color = '#fff'; }}>
                <span>{plan.cta}</span>
                <span>→</span>
              </button>
            </div>
          ))}
        </div>

        <p style={{
          marginTop: 40, fontSize: 14, color: '#4a4238',
          maxWidth: 780, lineHeight: 1.6, fontStyle: 'italic',
          borderLeft: '3px solid #C8102E', paddingLeft: 20,
        }}>
          {p.note}
        </p>
      </div>
    </section>
  );
}

function EditorialFAQ() {
  const f = SHARED_CONTENT.faq;
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" style={{ padding: '140px 0' }}>
      <div style={{ ...editorialStyles.container, paddingLeft: 100, paddingRight: 100 }}>
        <div className="reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 80, alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: '#C8102E', letterSpacing: '0.2em', marginBottom: 20, textTransform: 'uppercase',
            }}>
              § 05 — {f.eyebrow}
            </div>
            <h2 style={{
              fontFamily: "'Shippori Mincho', serif",
              fontSize: 'clamp(40px, 5vw, 64px)',
              fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.03em',
              marginBottom: 24, textWrap: 'balance',
            }}>
              Pertanyaan yang sering ditanyakan.
            </h2>
            <p style={{ fontSize: 15, color: '#a09a8e', lineHeight: 1.65, marginBottom: 24 }}>
              Tidak menemukan jawabannya? Tim kami siap membantu dalam 24 jam.
            </p>
            <a href="#" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#C8102E',
              borderBottom: '1px solid #C8102E', paddingBottom: 2,
            }}>
              Hubungi Tim →
            </a>
          </div>

          <div>
            {f.items.map((item, i) => (
              <div key={i} style={{
                borderTop: '1px solid rgba(245,239,228,0.15)',
                borderBottom: i === f.items.length - 1 ? '1px solid rgba(245,239,228,0.15)' : 'none',
              }}>
                <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                  width: '100%', textAlign: 'left',
                  padding: '28px 0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  gap: 24, color: '#f5efe4',
                }}>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flex: 1 }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, color: '#C8102E', letterSpacing: '0.1em', marginTop: 7,
                    }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{
                      fontFamily: "'Shippori Mincho', serif",
                      fontSize: 22, fontWeight: 500, lineHeight: 1.3, letterSpacing: '-0.01em',
                    }}>{item.q}</span>
                  </div>
                  <span style={{
                    width: 36, height: 36,
                    border: '1px solid rgba(245,239,228,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 400, flexShrink: 0,
                    background: open === i ? '#C8102E' : 'transparent',
                    borderColor: open === i ? '#C8102E' : 'rgba(245,239,228,0.3)',
                    transition: 'all 0.2s',
                  }}>
                    {open === i ? '−' : '+'}
                  </span>
                </button>
                <div style={{
                  maxHeight: open === i ? 300 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.4s ease',
                }}>
                  <p style={{
                    padding: '0 0 28px 50px',
                    fontSize: 15, color: '#a09a8e', lineHeight: 1.75,
                    maxWidth: 720,
                  }}>
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

function EditorialFinalCTA() {
  const c = SHARED_CONTENT.finalCTA;
  return (
    <section style={{
      padding: '140px 0', background: '#C8102E', color: '#fff',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 40, top: '50%', transform: 'translateY(-50%)',
        fontFamily: "'Shippori Mincho', serif", fontSize: 640,
        color: 'rgba(13,11,9,0.1)', lineHeight: 0.85,
        writingMode: 'vertical-rl',
      }}>
        {c.kanji}
      </div>
      <div style={{ ...editorialStyles.container, position: 'relative', zIndex: 2, paddingLeft: 100, paddingRight: 100 }}>
        <div className="reveal" style={{ maxWidth: 900, marginLeft: 'auto' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, letterSpacing: '0.2em', marginBottom: 24, textTransform: 'uppercase',
          }}>
            § 06 — Langkah Pertamamu
          </div>
          <h2 style={{
            fontFamily: "'Shippori Mincho', serif",
            fontSize: 'clamp(44px, 6vw, 88px)',
            fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.03em',
            marginBottom: 24, textWrap: 'balance',
          }}>
            {c.title}
          </h2>
          <p style={{ fontSize: 19, opacity: 0.9, lineHeight: 1.55, marginBottom: 44, maxWidth: 620, textWrap: 'pretty' }}>
            {c.subtitle}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <button style={{
              background: '#0d0b09', color: '#fff',
              padding: '22px 32px', borderRadius: 0,
              fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center', gap: 14,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.target.style.background = '#f5efe4'; e.target.style.color = '#0d0b09'; }}
            onMouseOut={e => { e.target.style.background = '#0d0b09'; e.target.style.color = '#fff'; }}>
              {c.cta} <span>↗</span>
            </button>
            <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
              // {c.note}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorialFooter() {
  const f = SHARED_CONTENT.footer;
  return (
    <footer style={{ background: '#0d0b09', color: '#a09a8e', padding: '72px 0 32px', borderTop: '1px solid rgba(245,239,228,0.15)' }}>
      <div style={{ ...editorialStyles.container, paddingLeft: 100, paddingRight: 100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr repeat(3, 1fr)', gap: 60, marginBottom: 60 }}>
          <div>
            <img src="assets/logo-white.png" alt="EzNihongo" style={{ width: 180, marginBottom: 20 }} />
            <p style={{ fontSize: 14, lineHeight: 1.65, maxWidth: 360, marginBottom: 24 }}>
              {f.tagline}
            </p>
            <div style={{
              fontFamily: "'Shippori Mincho', serif", fontSize: 18, color: '#f5efe4',
              letterSpacing: '0.05em',
            }}>
              日本への道
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#6a6459', letterSpacing: '0.15em', marginTop: 4 }}>
              NIHON E NO MICHI — THE PATH TO JAPAN
            </div>
          </div>
          {f.columns.map((col, i) => (
            <div key={i}>
              <h4 style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#C8102E', fontWeight: 700, marginBottom: 20,
              }}>
                § 0{i + 1} — {col.title}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {col.links.map(l => (
                  <li key={l} style={{ marginBottom: 10 }}>
                    <a href="#" style={{ fontSize: 14, color: '#a09a8e' }}
                       onMouseOver={e => e.target.style.color = '#f5efe4'}
                       onMouseOut={e => e.target.style.color = '#a09a8e'}>
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{
          paddingTop: 24, borderTop: '1px solid rgba(245,239,228,0.15)',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, letterSpacing: '0.08em', color: '#6a6459',
        }}>
          <span>{f.copyright.toUpperCase()}</span>
          <span>VOL.01 / ISSUE 04 / MMXXVI</span>
        </div>
      </div>
    </footer>
  );
}

function EditorialVariation() {
  useReveal();
  return (
    <div style={editorialStyles.root} data-screen-label="Editorial Bold">
      <EditorialNav />
      <EditorialHero />
      <EditorialFeatures />
      <EditorialAudience />
      <EditorialSensei />
      <EditorialPricing />
      <EditorialFAQ />
      <EditorialFinalCTA />
      <EditorialFooter />
    </div>
  );
}

Object.assign(window, { EditorialVariation });
