const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>'Rp '+new Intl.NumberFormat('id-ID').format(BigInt(value||0));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jayapura',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const labels={draft:'Draf',approved:'Disetujui',paid:'Lunas',void:'Dibatalkan',opening:'Saldo awal',course:'Penerimaan kursus',receipt:'Masuk rekening',bill:'Tagihan',payment:'Pembayaran',transfer:'Transfer internal',recognition:'Pengakuan pendapatan',reversal:'Koreksi'};
const errors={finance_setup_required:'Tentukan tanggal mulai pembukuan terlebih dahulu.',finance_period_closed:'Tanggal berada di luar periode buku yang terbuka.',
  finance_duplicate_reference:'Kode atau referensi sudah digunakan. Periksa data sebelum mengulangi.',finance_invalid_amount:'Nominal harus berupa rupiah bulat, lebih dari nol, maksimal Rp1 triliun.',
  finance_receipt_exceeds_order:'Nominal melebihi sisa penerimaan kursus.',finance_payment_exceeds_bill:'Nominal melebihi sisa tagihan.',
  finance_match_exceeds_balance:'Nominal melebihi sisa mutasi atau transaksi.',finance_match_account_or_direction:'Rekening atau arah uang masuk/keluar tidak cocok.',
  finance_close_has_pending_items:'Selesaikan pencatatan kursus, draf tagihan dan rekonsiliasi bank sebelum menutup periode.',
  finance_owner_required:'Tindakan ini memerlukan akses owner.',finance_course_not_imported:'Sinkronkan pembayaran kursus terlebih dahulu.',
  finance_attachment_max_5mb:'Ukuran bukti maksimal 5 MB.',finance_attachment_type:'Gunakan foto PNG/JPEG atau PDF.',finance_unmatch_before_reversal:'Lepaskan pencocokan mutasi terlebih dahulu.',
  finance_reverse_payments_first:'Koreksi pembayaran tagihan terlebih dahulu.',finance_close_completed_days_only:'Pilih tanggal sebelum hari ini.',finance_recognition_exceeds_order:'Nominal melebihi pendapatan kursus yang belum diakui.'};

// CSV supports quoted separators/newlines and CRLF. No spreadsheet evaluation.
export function parseCSV(source){
  const input=source.replace(/^\uFEFF/,''),first=input.split(/\r?\n/)[0],delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Tanda kutip CSV belum ditutup.');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length<2||rows.length>501)throw new Error('CSV memerlukan judul kolom dan 1–500 baris transaksi.');
  if(rows.some(r=>r.length!==rows[0].length))throw new Error('Jumlah kolom CSV tidak konsisten.');
  return rows;
}
export function bankAmount(raw,format){
  let value=String(raw).trim().replace(/^Rp\s*/i,'').replace(/\s/g,'');
  if(format==='id'){if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,00)?$/.test(value))throw new Error('Nominal IDR tidak valid: '+raw);value=value.replace(/\./g,'').replace(/,00$/,'');}
  else if(!/^-?\d+$/.test(value))throw new Error('Gunakan rupiah bulat tanpa pemisah: '+raw);
  if(!Number.isSafeInteger(Number(value))||Number(value)===0||Math.abs(Number(value))>1e12)throw new Error('Nominal harus bukan nol dan maksimal Rp1 triliun.');
  return Number(value);
}
export function bankDate(raw,format){
  const s=String(raw).trim(),v=format==='dmy'?s.split(/[/-]/).reverse().map((x,i)=>i?x.padStart(2,'0'):x).join('-'):s;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw new Error('Tanggal tidak valid: '+raw);
  return v;
}
export function splitBankAmount(debit,credit,format){
  const part=value=>{const s=String(value??'').trim();return !s||/^0(?:[,.]00)?$/.test(s)?0:bankAmount(s,format);};
  const out=part(debit),incoming=part(credit);
  if(out<0||incoming<0||(out>0&&incoming>0)||(!out&&!incoming))throw new Error('Isi tepat satu nominal debit atau kredit positif per baris.');
  return incoming-out;
}

const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export function calculateAmount(quantity,unitPrice,discount='0'){
  const q=String(quantity).trim(),p=String(unitPrice).trim(),d=String(discount).trim()||'0';
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(q)||!/^\d{1,13}$/.test(p)||!/^\d{1,13}$/.test(d))throw new Error('Isi jumlah maksimal 2 angka desimal; tarif dan potongan dalam rupiah bulat.');
  const [whole,fraction='']=q.split('.'),units=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  const price=BigInt(p),cut=BigInt(d),max=1000000000000n;
  if(units<=0n||units>100000000n||price<=0n||price>max||cut>max)throw new Error('Jumlah harus lebih dari nol, maksimal 1 juta; tarif maksimal Rp1 triliun.');
  const subtotal=(units*price+50n)/100n,total=subtotal-cut;
  if(subtotal>max||total<=0n)throw new Error('Total harus lebih dari nol, subtotal maksimal Rp1 triliun, dan potongan harus lebih kecil dari subtotal.');
  return{subtotal:String(subtotal),discount:String(cut),total:String(total)};
}
export function financialPeriod(mode,year,part=1){
  year=Number(year);part=Number(part);
  const width={month:1,quarter:3,annual:12}[mode];
  if(!width||!Number.isInteger(year)||year<1901||year>9998||!Number.isInteger(part)||part<1||part>12/width)throw new Error('Periode laporan tidak valid.');
  const start=(part-1)*width,iso=(y,m,d)=>new Date(Date.UTC(y,m,d)).toISOString().slice(0,10);
  const previous=new Date(Date.UTC(year,start-width,1)),py=previous.getUTCFullYear(),pm=previous.getUTCMonth();
  const label=(y,m)=>mode==='month'?months[m]+' '+y:mode==='quarter'?'Q'+(Math.floor(m/3)+1)+' '+y:String(y);
  return{from:iso(year,start,1),to:iso(year,start+width,0),compareFrom:iso(py,pm,1),compareTo:iso(py,pm+width,0),label:label(year,start),previousLabel:label(py,pm)};
}

// One ordered model feeds the screen, print view and CSV.
export function companyStatements(report){
  const accounts=report.balances,s=report.summary;
  const sum=(filter,key)=>accounts.filter(filter).reduce((n,a)=>n+BigInt(a[key]),0n);
  const kind=k=>a=>a.kind===k,earnings=a=>['income','expense'].includes(a.kind);
  const assets=sum(kind('asset'),'balance'),liabilities=-sum(kind('liability'),'balance');
  const capital=-sum(kind('equity'),'balance'),retained=-sum(earnings,'balance');
  const equity=capital+retained,openingEquity=-sum(kind('equity'),'opening')-sum(earnings,'opening');
  const capitalMovement=capital+sum(kind('equity'),'opening');
  const cashOpening=sum(a=>a.is_bank,'opening'),cashClosing=sum(a=>a.is_bank,'balance');
  const row=(label,value,total=false)=>({label,value:String(value),total});
  const group=label=>({label,value:null,total:true});
  const detail=(k,period=false)=>accounts.filter(kind(k)).map(a=>({...row(a.code+' · '+a.name,period?(k==='income'?BigInt(a.credit)-BigInt(a.debit):BigInt(a.debit)-BigInt(a.credit)):(k==='asset'?BigInt(a.balance):-BigInt(a.balance))),accountId:a.id}));
  return[
    {title:'2. Laporan laba rugi',note:'Untuk periode '+report.from+' sampai '+report.to+'. Biaya disajikan menurut jenis. Laba/rugi berdasarkan akun yang telah dibukukan.',rows:[
      group('Pendapatan'),...detail('income',true),row('Total pendapatan',s.income,true),group('Beban usaha'),...detail('expense',true),row('Total beban usaha',s.expenses,true),row('Laba / rugi periode berjalan',s.profit,true)]},
    {title:'3. Laporan posisi keuangan (Neraca)',note:'Posisi per '+report.to+'. Akumulasi hasil usaha mencakup laba/rugi sejak mulai pembukuan, termasuk periode berjalan.',rows:[
      group('Aset'),...detail('asset'),row('Total aset',assets,true),group('Liabilitas'),...detail('liability'),row('Total liabilitas',liabilities,true),
      group('Ekuitas'),...detail('equity'),row('Akumulasi hasil usaha',retained),row('Total ekuitas',equity,true),row('Total liabilitas dan ekuitas',liabilities+equity,true),row('Selisih pemeriksaan neraca',assets-liabilities-equity,true)]},
    {title:'4. Laporan perubahan ekuitas',note:'Perubahan saldo ekuitas selama periode. Saldo awal/modal mengikuti akun yang tercatat; belum ada pemisahan setoran pemilik dan dividen.',rows:[
      row('Ekuitas awal periode',openingEquity),row('Perubahan akun saldo awal / modal',capitalMovement),row('Laba / rugi periode berjalan',s.profit),row('Ekuitas akhir periode',equity,true),row('Selisih pemeriksaan ekuitas',equity-openingEquity-capitalMovement-BigInt(s.profit),true)]},
    {title:'5. Laporan arus kas',note:'Arus operasional menggunakan penerimaan dan pembayaran setelah koreksi. Transfer antar-rekening tidak menambah arus kas bersih. Saldo awal yang dimasukkan dalam periode ditampilkan terpisah dalam rekonsiliasi saldo.',rows:[
      group('Aktivitas operasi'),row('Penerimaan kas dari kursus',s.received),row('Pembayaran kas untuk biaya',-BigInt(s.payments)),row('Arus kas bersih operasional',s.net,true),
      group('Rekonsiliasi saldo kas dan bank'),row('Saldo awal periode',cashOpening),row('Arus kas bersih operasional',s.net),row('Penyesuaian saldo / mutasi di luar arus operasional',cashClosing-cashOpening-BigInt(s.net)),row('Saldo akhir periode',cashClosing,true)]},
  ];
}

export function mountFinance(host,{api,access}){
  if(!document.querySelector('link[data-finance-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='styles/finance.css?v=company-report-20260912';link.dataset.financeStyle='true';document.head.append(link);}
  const controller=new AbortController(),urls=new Set();let closed=false,dirty=false,busy=false,request=0,tab='overview',offset=0,ledgerId='';
  let from=today().slice(0,7)+'-01',to=today(),cfg=access.settings,accounts=[],data={entries:[],bills:[],courses:[],bankLines:[]},report=null,message='';
  let reportMode='month',reportYear=Number(today().slice(0,4)),reportMonth=Number(today().slice(5,7)),reportQuarter=Math.ceil(reportMonth/3);
  const selectedPeriod=()=>financialPeriod(reportMode,reportYear,reportMode==='month'?reportMonth:reportMode==='quarter'?reportQuarter:1);
  const manage=access.canManage===true;
  async function call(path,body,method=body?'POST':'GET'){
    const opts={method,signal:controller.signal,cache:'no-store'};
    if(body instanceof FormData)opts.body=body;
    else if(body){opts.headers={'Content-Type':'application/json'};opts.body=JSON.stringify(body);}
    const res=await api('/finance'+path,opts),result=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(errors[result.error]||result.error||'Finance gagal merespons. Coba lagi.');return result;
  }
  function hint(text){return`<p class="fin-hint">${esc(text)}</p>`;}
  const button=(action,label,id='',extra='')=>`<button type="button" data-action="${action}" data-id="${esc(id)}" ${extra}>${esc(label)}</button>`;
  const table=(headers,body)=>`<div class="fin-table-scroll"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${headers.length}" class="fin-empty">Belum ada transaksi pada periode ini.</td></tr>`}</tbody></table></div>`;
  const badge=status=>`<span class="fin-badge fin-${esc(status)}">${esc(labels[status]||status)}</span>`;
  const bankOptions=()=>accounts.filter(a=>a.is_bank).map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  const options=(items)=>items.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  const field=(label,name,type='text',value='',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" required ${extra}></label>`;
  const amountField=(value='')=>`<section class="fin-calculator"><label>Cara mengisi nominal<select data-amount-mode aria-label="Cara mengisi nominal"><option value="manual">Masukkan total langsung</option><option value="calculate">Hitung jumlah × tarif</option></select></label><div data-calculation hidden>`+
    field('Jumlah (sesi / jam / unit)','calcQuantity','number','1','min="0.01" max="1000000" step="0.01" disabled')+
    field('Tarif per unit (Rp)','calcPrice','number',value,'min="1" max="1000000000000" step="1" disabled')+
    field('Potongan (Rp)','calcDiscount','number','0','min="0" max="1000000000000" step="1" disabled')+
    `<p class="fin-hint">Jumlah × tarif − potongan. Pecahan rupiah dibulatkan ke rupiah terdekat.</p></div>`+
    field('Nominal (rupiah bulat)','amount','number',value,'min="1" max="1000000000000" step="1"')+
    `<output data-amount-preview aria-live="polite"></output></section>`;
  const select=(label,name,opts)=>`<label>${esc(label)}<select name="${name}" aria-label="${esc(label)}" required>${opts}</select></label>`;
  const dateField=()=>field('Tanggal transaksi','date','date',today());
  async function refresh(){
    const current=++request;busy=true;report=null;
    const period=tab==='reports'?selectedPeriod():null;
    if(period){from=period.from;to=period.to;}
    render();
    try{
      const query=new URLSearchParams({from,to,offset:String(offset),...(ledgerId?{accountId:ledgerId}:{})});
      const [a,d,r]=await Promise.all([call('/accounts'),call('/transactions?'+query),call('/report?'+new URLSearchParams({from,to,...(period?{compareFrom:period.compareFrom,compareTo:period.compareTo}:{})}))]);
      if(closed||current!==request)return;accounts=a.accounts;data=d;report=r;
    }catch(e){if(!closed&&current===request&&e.name!=='AbortError')message=e.message;}
    finally{if(!closed&&current===request){busy=false;render();}}
  }
  function render(){
    if(closed)return;
    if(!access.ready){host.innerHTML='<div class="fin"><h1>Finance</h1><p role="alert">Penyimpanan Finance belum disiapkan. Hubungi pengelola untuk menyelesaikan pengaturan.</p></div>';return;}
    if(!cfg){host.innerHTML=`<div class="fin"><p class="fin-eyebrow">EZNIHONGO / FINANCE</p><h1>Mulai pembukuan</h1><p>Pilih tanggal awal pencatatan. Pembayaran kursus yang disetujui sejak tanggal ini dapat disinkronkan.</p>${message?`<p role="alert">${esc(message)}</p>`:''}${manage?`<form id="fin-setup">${field('Mulai pembukuan','startDate','date',today())}<button>Mulai Finance</button></form>`:'<p>Owner perlu menentukan tanggal awal pembukuan.</p>'}</div>`;
      const form=host.querySelector('form');if(form)form.onsubmit=async event=>{event.preventDefault();const b=form.querySelector('button');b.disabled=true;try{cfg=await call('/setup',Object.fromEntries(new FormData(form)));from=cfg.start_date;await refresh();}catch(e){message=e.message;render();}};return;
    }
    const tabs=[['overview','Ringkasan'],['courses','Penerimaan'],['bills','Pengeluaran & Tagihan'],['bank','Kas & Bank'],['ledger','Buku Transaksi'],['reports','Laporan']];
    let content='';
    if(tab==='overview'&&report){
      const banks=report.balances.filter(a=>a.is_bank),sum=(key)=>banks.reduce((n,a)=>n+BigInt(a[key]),0n);
      content=`<div class="fin-metrics"><article><span>Saldo buku kas & bank · ${esc(to)}</span><strong>${money(sum('balance'))}</strong><small>Termasuk saldo awal dan transfer internal</small></article><article><span>Penerimaan kursus masuk bank</span><strong>${money(report.cashFlow.received)}</strong><small>Setelah koreksi; transfer internal tidak dihitung</small></article><article><span>Pengeluaran dibayar</span><strong>${money(report.cashFlow.payments)}</strong><small>Setelah koreksi; rincian di buku transaksi</small></article></div>
      <div class="fin-grid"><section class="fin-card"><h2>Perlu ditangani</h2><div class="fin-task">${button('tab','Penerimaan belum dibukukan','courses')}<strong>${report.unpostedCourses}</strong></div><div class="fin-task">${button('tab','Mutasi belum cocok','bank')}<strong>${report.unmatchedBankLines}</strong></div><div class="fin-task">${button('tab','Tagihan jatuh tempo','bills')}<strong>${money(report.dueBills.amount)}</strong></div></section><section class="fin-card"><h2>Rekening</h2>${banks.length?banks.map(a=>`<div class="fin-task">${button('account-ledger',a.name,a.id)}<strong>${money(a.balance)}</strong></div>`).join(''):hint('Tambahkan rekening pertama untuk mencatat penerimaan dan pengeluaran.')}${manage?button('account','Tambah rekening / kategori'):''}</section></div>`;
    }
    if(tab==='courses')content=`<div class="fin-toolbar">${manage?button('sync','Sinkronkan pembayaran kursus'):''}</div>${hint('Sinkronisasi mencatat pembayaran yang sudah disetujui. Alokasikan ke rekening penerima, lalu cocokkan dengan mutasi bank. Pengakuan pendapatan dilakukan sesuai layanan yang telah diberikan.')}`+table(['Tanggal','Pesanan / kursus','Nilai','Masuk rekening','Pendapatan diakui','Tindakan'],data.courses.map(o=>`<tr><td>${esc(o.date)}</td><td><strong>${esc(o.number)}</strong><br>${esc(o.title)}</td><td>${money(o.amount)}</td><td>${money(o.allocated)}</td><td>${money(o.recognized)}</td><td class="fin-actions">${manage&&o.imported&&o.allocated<o.amount?button('receive','Alokasikan',o.id):''}${manage&&o.imported&&o.recognized<o.amount?button('recognize','Akui pendapatan',o.id):''}${button('document',o.status==='approved'?'Kuitansi':'Tagihan',o.id)}${!o.imported?badge(o.status==='approved'?'Belum dibukukan':o.status):''}</td></tr>`).join(''));
    if(tab==='bills')content=`<div class="fin-toolbar">${button('bill','Tambah pengeluaran / tagihan')}</div>`+table(['Tanggal / jatuh tempo','Vendor / kebutuhan','Nominal','Terbayar','Status','Tindakan'],data.bills.map(b=>`<tr><td>${esc(b.bill_date)}<br><small>${esc(b.due_date)}</small></td><td><strong>${esc(b.vendor)}</strong><br>${esc(b.description)}<br><small>${esc(b.account_name)}</small></td><td>${money(b.amount)}</td><td>${money(b.paid)}</td><td>${badge(b.status)}</td><td class="fin-actions">${b.has_attachment?button('attachment','Lihat bukti',b.id):''}${b.status==='draft'?button('attach','Unggah bukti',b.id):''}${manage&&b.status==='draft'?button('approve','Setujui',b.id):''}${manage&&b.status==='approved'?button('pay','Catat pembayaran',b.id):''}${manage&&['draft','approved'].includes(b.status)&&!b.paid?button('void','Batalkan',b.id):''}</td></tr>`).join(''));
    if(tab==='bank')content=`<div class="fin-toolbar">${manage?button('import','Impor mutasi CSV')+button('transfer','Transfer antar-rekening')+button('account','Tambah rekening / kategori'):''}</div>${hint('Nominal positif berarti uang masuk, negatif berarti uang keluar. Pencocokan menghubungkan mutasi dengan pembukuan; tidak membuat penerimaan atau pengeluaran kedua.')}`+table(['Tanggal','Rekening / uraian','Referensi','Mutasi','Sudah cocok','Tindakan'],data.bankLines.map(b=>`<tr><td>${esc(b.transaction_date)}</td><td><strong>${esc(b.bank_name)}</strong><br>${esc(b.description)}</td><td>${esc(b.reference||'—')}</td><td>${money(b.amount)}</td><td>${money(b.matched)}</td><td class="fin-actions">${manage&&b.matched<Math.abs(b.amount)?button('match','Cocokkan',b.id):badge('Cocok')}${manage?b.matches.map(m=>button('unmatch','Lepas '+money(m.amount),m.id)).join('')+button('void-import','Batalkan impor',b.import_id):''}</td></tr>`).join(''));
    if(tab==='ledger')content=`<div class="fin-toolbar">${select('Akun','ledgerAccount','<option value="">Semua akun</option>'+options(accounts))}${button('export','Unduh CSV transaksi')}</div>`+table(['Tanggal','Jenis / uraian','Debit','Kredit','Nominal','Tindakan'],data.entries.map(e=>`<tr><td>${esc(e.entry_date)}</td><td>${badge(e.kind)}<br>${esc(e.description)}${e.order_number?`<br><small>${esc(e.order_number)}</small>`:''}</td><td>${esc(e.debit_name)}</td><td>${esc(e.credit_name)}</td><td>${money(e.amount)}</td><td>${e.reversed?badge('Dikoreksi'):manage&&['receipt','payment','transfer','recognition'].includes(e.kind)?button('reverse','Koreksi',e.id):''}</td></tr>`).join(''));
    if(tab==='reports'&&report){
      content=`<div class="fin-toolbar">${button('print-report','Cetak / Simpan PDF')}${button('export-report','Unduh laporan CSV')}${manage?button('close-period','Tutup periode')+(cfg.closed_through?button('reopen-period','Buka periode'):''):''}</div>`+reportContent(true);
    }
    const collection=tab==='bank'?data.bankLines:tab==='ledger'?data.entries:tab==='courses'?data.courses:tab==='bills'?data.bills:null;
    host.innerHTML=`<div class="fin"><header class="fin-header"><div><p class="fin-eyebrow">EZNIHONGO / FINANCE</p><h1>Kelola keuangan kursus.</h1><p>Transaksi, rekening, dan laporan dalam satu ruang kerja.</p></div><span class="fin-period">${cfg.closed_through?'Ditutup s.d. '+esc(cfg.closed_through):'Mulai '+esc(cfg.start_date)}</span></header>
    <nav class="fin-tabs" aria-label="Menu Finance">${tabs.map(([id,name])=>`<button data-action="tab" data-id="${id}" aria-current="${tab===id?'page':'false'}">${name}</button>`).join('')}</nav>
    <form class="fin-filters" id="fin-period">${tab==='reports'?reportFilters():field('Dari','from','date',from)+field('Sampai','to','date',to)}<button ${busy?'disabled':''}>Tampilkan</button>${button('refresh','Muat ulang','','')}${busy?'<span role="status">Memuat…</span>':''}</form>
    ${message?`<p class="fin-message" role="status">${esc(message)}</p>`:''}${content}${collection?`<div class="fin-pagination">${button('previous','Sebelumnya','',offset===0||busy?'disabled':'')}<span>Halaman ${offset/100+1} · maks. 100 baris per halaman</span>${button('next','Berikutnya','',collection.length<100||busy?'disabled':'')}</div>`:''}<dialog class="fin-dialog"></dialog></div>`;
    host.querySelector('#fin-period').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);
      if(tab==='reports'){reportMode=f.get('reportMode');reportYear=Number(f.get('reportYear'));reportMonth=Number(f.get('reportMonth'));reportQuarter=Number(f.get('reportQuarter'));}
      else{from=f.get('from');to=f.get('to');}offset=0;message='';refresh();};
    const mode=host.querySelector('[name=reportMode]');if(mode)mode.onchange=()=>{host.querySelector('[name=reportMonth]').parentElement.parentElement.hidden=mode.value!=='month';host.querySelector('[name=reportQuarter]').parentElement.parentElement.hidden=mode.value!=='quarter';};
    const ledger=host.querySelector('[name=ledgerAccount]');if(ledger){ledger.value=ledgerId;ledger.onchange=()=>{ledgerId=ledger.value;offset=0;refresh();};}
    host.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(busy)return;act(b.dataset.action,b.dataset.id).catch(e=>{message=e.message;render();});});
  }
  function reportFilters(){
    const opts=(items,value)=>items.map(([v,label])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
    return select('Jenis laporan','reportMode',opts([['month','Bulanan'],['quarter','Kuartalan'],['annual','Tahunan']],reportMode))+
      field('Tahun','reportYear','number',reportYear,'min="1901" max="9998" step="1"')+
      `<div ${reportMode!=='month'?'hidden':''}>${select('Bulan','reportMonth',opts(months.map((m,i)=>[i+1,m]),reportMonth))}</div>`+
      `<div ${reportMode!=='quarter'?'hidden':''}>${select('Kuartal','reportQuarter',opts([[1,'Q1 · Jan–Mar'],[2,'Q2 · Apr–Jun'],[3,'Q3 · Jul–Sep'],[4,'Q4 · Okt–Des']],reportQuarter))}</div>`;
  }
  const summaryRows=()=>[['Pendapatan diakui','income'],['Biaya dibukukan','expenses'],['Laba / rugi','profit'],['Kas masuk operasional','received'],['Kas keluar operasional','payments'],['Arus kas bersih','net']];
  function reportNotes(){
    const p=selectedPeriod(),notes=['Periode '+p.from+' sampai '+p.to+'. Perbandingan dengan '+p.previousLabel+' ('+p.compareFrom+' sampai '+p.compareTo+').'];
    if(from<=today()&&to>=today())notes.push('Periode masih berjalan. Pembanding menggunakan periode sebelumnya penuh; hasil belum setara durasinya.');
    if(from>today())notes.push('Periode mendatang. Angka hanya mencakup transaksi yang sudah dibukukan dengan tanggal dalam periode ini.');
    if(!report.coverage.complete)notes.push('Data periode ini belum lengkap: pembukuan dimulai '+report.coverage.startDate+'.');
    if(!report.comparison.coverage.complete)notes.push('Data pembanding belum lengkap; selisih tidak ditampilkan.');
    notes.push('Pendapatan mengikuti pengakuan layanan; biaya mengikuti pembukuan tagihan. Arus kas mengikuti penerimaan dan pembayaran, setelah koreksi, tanpa saldo awal atau transfer internal.');
    return notes;
  }
  function reportContent(interactive){
    const p=selectedPeriod(),s=report.summary,previous=report.comparison,comparable=report.coverage.complete&&previous.coverage.complete;
    const accountName=a=>interactive?button('account-ledger',a.code+' · '+a.name,a.id):esc(a.code+' · '+a.name);
    const statements=companyStatements(report);
    const contents=['1. Ringkasan manajemen',...statements.map(section=>section.title),'6. Catatan laporan','7. Lampiran — Neraca saldo'];
    return `<section class="fin-report-heading"><p class="fin-eyebrow">FINANCIAL REPORT</p><h2>${esc(p.label)}</h2>${reportNotes().map(hint).join('')}</section>`+
      `<nav class="fin-report-index" aria-label="Urutan laporan">${contents.map(esc).join(' · ')}</nav><section class="fin-statement"><h2 data-report-section>1. Ringkasan manajemen</h2>`+
      `<div class="fin-metrics"><article><span>Pendapatan diakui</span><strong>${money(s.income)}</strong></article><article><span>Biaya dibukukan</span><strong>${money(s.expenses)}</strong></article><article><span>Laba / rugi</span><strong>${money(s.profit)}</strong></article></div>`+
      `<h3>Perbandingan periode</h3>`+table(['Ringkasan',p.label,p.previousLabel,'Selisih nominal'],summaryRows().map(([label,key])=>`<tr><td>${label}</td><td>${money(s[key])}</td><td>${previous.coverage.complete?money(previous.summary[key]):'Data belum lengkap'}</td><td>${comparable?money(BigInt(s[key])-BigInt(previous.summary[key])):'—'}</td></tr>`).join(''))+'</section>'+
      statements.map(section=>`<section class="fin-statement"><h2 data-report-section>${esc(section.title)}</h2>${hint(section.note)}`+table(['Uraian','Nilai (IDR)'],section.rows.map(row=>`<tr class="${row.value===null?'fin-statement-group':row.total?'fin-statement-total':''}"><td>${interactive&&row.accountId?button('account-ledger',row.label,row.accountId):esc(row.label)}</td><td>${row.value===null?'':money(row.value)}</td></tr>`).join(''))+'</section>').join('')+
      `<section class="fin-statement"><h2 data-report-section>6. Catatan laporan</h2>${companyNotes().map(hint).join('')}</section>`+
      `<section class="fin-statement"><h2 data-report-section>7. Lampiran — Neraca saldo</h2>`+table(['Kode / akun','Saldo awal (D−K)','Debit periode','Kredit periode','Saldo akhir (D−K)'],report.balances.map(a=>`<tr><td>${accountName(a)}</td><td>${money(a.opening)}</td><td>${money(a.debit)}</td><td>${money(a.credit)}</td><td>${money(a.balance)}</td></tr>`).join(''))+hint('Saldo negatif berarti posisi kredit. Lampiran ini mendukung penelusuran angka laporan.')+'</section>';
  }
  function companyNotes(){return[
    'Dasar penyusunan: laporan internal dalam rupiah dari transaksi yang dibukukan. Pendapatan diakui mengikuti layanan; draf tagihan belum menjadi beban. Ini belum merupakan pernyataan kepatuhan terhadap standar pelaporan keuangan.',
    'Cakupan pencatatan: dimulai '+report.coverage.startDate+'. Selisih neraca dan ekuitas seharusnya nol; selisih bukan nol perlu ditelusuri pada buku transaksi.',
    'Akun saat ini belum memisahkan biaya langsung/HPP, pajak, penyusutan, penghasilan komprehensif lain, aset/liabilitas lancar dan tidak lancar. Karena itu laba kotor dan laba bersih setelah pajak belum disajikan.',
    'Arus kas investasi dan pendanaan belum memiliki klasifikasi tersendiri. Ketiadaan bagian tersebut tidak menyatakan nilainya nol. Penyesuaian saldo di luar operasi perlu ditinjau sebelum laporan dipakai sebagai laporan formal.',
    ...reportNotes(),
  ];}
  function modal(title,html,submit){
    const d=host.querySelector('dialog');d.innerHTML=`<form><div class="fin-dialog-header"><h2>${esc(title)}</h2><button type="button" data-cancel aria-label="Tutup">×</button></div><div class="fin-form-body">${html}</div><p class="fin-form-error" role="alert"></p><div class="fin-dialog-footer"><button type="button" data-cancel>Batal</button>${submit?'<button type="submit">Simpan</button>':''}</div></form>`;
    d.showModal();dirty=false;
    const cancel=()=>{if(!dirty||confirm('Buang isian yang belum disimpan?')){dirty=false;d.close();}};
    d.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=cancel);d.oncancel=e=>{e.preventDefault();cancel();};
    d.querySelector('form').oninput=()=>{dirty=true;};
    const calculator=d.querySelector('.fin-calculator');
    const updateAmount=()=>{
      if(!calculator)return true;
      const active=calculator.querySelector('[data-amount-mode]').value==='calculate',value=calculator.querySelector('[name=amount]'),preview=calculator.querySelector('[data-amount-preview]');
      const inputs=[...calculator.querySelectorAll('[data-calculation] input')];
      calculator.querySelector('[data-calculation]').hidden=!active;inputs.forEach(input=>{input.disabled=!active;input.setCustomValidity('');});value.readOnly=active;
      if(!active){preview.textContent=/^[1-9]\d{0,12}$/.test(value.value)?'Total: '+money(value.value):'';return true;}
      try{const result=calculateAmount(...inputs.map(input=>input.value));value.value=result.total;preview.textContent=money(result.subtotal)+' − '+money(result.discount)+' = '+money(result.total);return true;}
      catch(error){value.value='';preview.textContent=error.message;inputs[0].setCustomValidity(error.message);return false;}
    };
    if(calculator){calculator.oninput=updateAmount;calculator.querySelector('[data-amount-mode]').onchange=()=>{dirty=true;updateAmount();};updateAmount();}
    const key=crypto.randomUUID();
    d.querySelector('form').onsubmit=async event=>{
      event.preventDefault();if(!submit)return;
      if(!updateAmount()){event.target.reportValidity();return;}
      const buttons=[...d.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
      try{const values=Object.fromEntries(new FormData(event.target));for(const name of ['calcQuantity','calcPrice','calcDiscount'])delete values[name];const result=await submit(values,key);dirty=false;d.close();message=typeof result==='string'?result:'Tersimpan.';await refresh();}
      catch(e){d.querySelector('[role=alert]').textContent=e.message;buttons.forEach(b=>b.disabled=false);}
    };
    return d;
  }
  function printView(title,html){
    const d=modal(title,`<iframe class="fin-document" title="${esc(title)}"></iframe><button type="button" data-print>Cetak / Simpan PDF</button>`);
    const frame=d.querySelector('iframe');frame.srcdoc=`<!doctype html><html lang="id"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px system-ui;padding:32px;color:#17212b}h1{font-size:26px}table{border-collapse:collapse;width:100%}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}small{color:#555}@media print{body{padding:0}}</style><h1>EzNihongo</h1><h2>${esc(title)}</h2>${html}</html>`;
    d.querySelector('[data-print]').onclick=()=>frame.contentWindow.print();
  }
  function download(name,lines){
    const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));urls.add(url);
    const a=document.createElement('a');a.href=url;a.download=name;a.click();
  }
  async function act(action,id){
    if(action==='tab'){tab=id;offset=0;ledgerId='';message='';await refresh();return;}
    if(action==='refresh'){message='';return refresh();}
    if(action==='previous'||action==='next'){offset+=action==='next'?100:-100;return refresh();}
    if(action==='account-ledger'){tab='ledger';ledgerId=id;offset=0;return refresh();}
    if(action==='sync'){busy=true;try{const r=await call('/sync-courses',{});message=`${r.imported} pembayaran dicatat.${r.imported===200?' Tekan sinkronkan lagi untuk melanjutkan.':''}`;}finally{busy=false;}return refresh();}
    if(action==='account')return modal('Tambah rekening atau kategori',field('Kode unik','code','text','','maxlength="20"')+field('Nama','name','text','','maxlength="100"')+select('Jenis','kind','<option value="bank">Kas / rekening bank</option><option value="expense">Kategori biaya</option>')+field('Saldo awal rekening (0 bila kosong)','openingAmount','number','0','min="0" max="1000000000000"')+hint('Saldo awal dicatat pada tanggal mulai pembukuan. Jangan memasukkan penerimaan yang akan disinkronkan sebagai saldo awal.'),f=>call('/accounts',f).then(()=> 'Rekening / kategori ditambahkan.'));
    if(action==='bill')return modal('Pengeluaran / tagihan baru',field('Vendor / penerima','vendor','text','','maxlength="120"')+field('Keperluan','description','text','','maxlength="240"')+amountField()+select('Kategori biaya','accountId',options(accounts.filter(a=>a.kind==='expense')))+dateField()+field('Jatuh tempo','dueDate','date',today())+hint('Simpan sebagai draf. Bukti dapat diunggah sebelum owner menyetujui.'),(f,key)=>call('/bills',{...f,requestKey:key}).then(()=> 'Draf tagihan tersimpan.'));
    if(action==='attach')return modal('Unggah bukti',`<label>Foto atau PDF<input type="file" name="file" accept="image/png,image/jpeg,application/pdf" required></label>`+hint('Maksimal 5 MB. Bukti hanya dapat diubah selama tagihan masih draf.'),async f=>{const form=new FormData();form.append('file',f.file);await call('/bills/'+id+'/attachment',form);});
    if(action==='attachment'){
      const res=await api('/finance/bills/'+id+'/attachment',{signal:controller.signal,cache:'no-store'});if(!res.ok)throw new Error('Bukti gagal dibuka.');
      const url=URL.createObjectURL(await res.blob());urls.add(url);return modal('Bukti pengeluaran',`<iframe class="fin-document" title="Bukti pengeluaran" src="${esc(url)}" sandbox></iframe>`);
    }
    if(action==='approve'){if(!confirm('Setujui dan bukukan tagihan ini?'))return;await call('/bills/'+id+'/approve',{});message='Tagihan disetujui dan dibukukan.';return refresh();}
    if(action==='receive'||action==='recognize'){
      const o=data.courses.find(o=>o.id===id),receive=action==='receive';
      return modal(receive?'Alokasikan penerimaan ke rekening':'Akui pendapatan kursus',hint(o.number+' · '+o.title)+(receive?select('Rekening penerima','bankId',bankOptions()):hint('Isi bagian pendapatan untuk layanan yang sudah diberikan, sesuai kebijakan pembukuan.'))+amountField(o.amount-(receive?o.allocated:o.recognized))+dateField()+field(receive?'Keterangan':'Dasar pengakuan / periode layanan','description','text',receive?'Penerimaan '+o.number:'','maxlength="240"'),(f,key)=>call(receive?'/receipts':'/recognitions',{...f,orderId:id,requestKey:key}));
    }
    if(action==='pay'){
      const b=data.bills.find(b=>b.id===id);return modal('Catat pembayaran tagihan',hint(b.vendor+' · '+b.description)+select('Rekening sumber','bankId',bankOptions())+amountField(b.amount-b.paid)+dateField()+field('Referensi / keterangan','description','text','','maxlength="240"')+hint('Catat setelah pembayaran benar-benar dilakukan. Tombol ini tidak mengirim uang dari bank.'),(f,key)=>call('/bills/'+id+'/pay',{...f,requestKey:key}));
    }
    if(action==='transfer')return modal('Catat transfer antar-rekening',select('Dari rekening','fromBankId',bankOptions())+select('Ke rekening','toBankId',bankOptions())+amountField()+dateField()+field('Referensi / keperluan','description','text','','maxlength="240"'),(f,key)=>call('/transfers',{...f,requestKey:key}));
    if(action==='reverse'||action==='void')return modal(action==='reverse'?'Koreksi transaksi':'Batalkan tagihan',dateField()+field('Alasan koreksi','reason','text','','maxlength="240"')+hint('Transaksi yang sudah dibukukan dikoreksi dengan catatan pembalik, sehingga riwayat tetap dapat ditelusuri.'),f=>call(action==='reverse'?'/entries/'+id+'/reverse':'/bills/'+id+'/void',f));
    if(action==='import')return importDialog();
    if(action==='match'){
      const line=data.bankLines.find(b=>b.id===id);
      const result=await call('/match-candidates?'+new URLSearchParams({bankLineId:id}));
      return modal('Cocokkan mutasi',hint(line.transaction_date+' · '+line.description+' · '+money(line.amount))+select('Transaksi pembukuan','entryId',result.entries.map(e=>`<option value="${e.id}">${esc(e.entry_date+' · '+e.description+' · sisa '+money(e.remaining))}</option>`).join(''))+amountField(Math.abs(line.amount)-line.matched)+hint('Pilih transaksi dengan rekening dan arah yang sama. Pencocokan sebagian diperbolehkan.'),f=>call('/matches',{...f,bankLineId:id}));
    }
    if(action==='unmatch'){if(!confirm('Lepaskan hubungan mutasi dengan transaksi ini?'))return;await call('/matches/'+id,null,'DELETE');return refresh();}
    if(action==='void-import'){if(!confirm('Batalkan seluruh baris dari file impor ini? Semua pencocokan dalam file harus dilepas terlebih dahulu.'))return;await call('/bank-imports/'+id+'/void',{});message='Impor dibatalkan. Riwayat tetap tersimpan.';return refresh();}
    if(action==='document'){
      const {document:o}=await call('/orders/'+id+'/document');
      return printView(o.status==='approved'?'Kuitansi pembayaran kursus':'Tagihan kursus',`<p>Nomor: <strong>${esc(o.order_number)}</strong></p><p>Kursus: ${esc(o.course_title_snapshot)}</p><p>Nilai: <strong>${money(o.amount_idr)}</strong></p><p>Status: ${o.status==='approved'?'Pembayaran disetujui':'Belum lunas'}</p><p>Tanggal: ${esc((o.approved_at||o.created_at||'').slice(0,10))}</p><small>Dokumen administrasi kursus. Referensi pembayaran mengikuti nomor pesanan.</small>`);
    }
    if(action==='close-period')return modal('Tutup periode buku',field('Tutup sampai tanggal','date','date',to)+hint('Tanggal yang ditutup tidak dapat menerima transaksi baru. Selesaikan draf, sinkronisasi dan rekonsiliasi lebih dahulu.'),async f=>{cfg=await call('/close-period',f);});
    if(action==='reopen-period')return modal('Buka kembali periode buku',field('Buka mulai tanggal','date','date',cfg.closed_through)+field('Alasan pembukaan kembali','reason','text','','maxlength="240"')+hint('Periode sejak tanggal ini dapat dikoreksi kembali. Perubahan dan alasan dicatat dalam riwayat Finance.'),async f=>{cfg=await call('/reopen-period',f);});
    if(action==='print-report')return printView('Laporan Finance','<style>.fin-statement{margin-top:32px}h2,h3{break-after:avoid}tr{break-inside:avoid}.fin-statement-total{font-weight:bold;background:#f1f6ee}.fin-statement-group{font-weight:bold;background:#e6efe6}.fin-metrics{display:flex;gap:24px;margin:20px 0}.fin-metrics article{flex:1}.fin-metrics span,.fin-metrics strong{display:block}.fin-hint,.fin-report-index{font-size:12px;line-height:1.6}td:last-child{font-variant-numeric:tabular-nums}@media print{body{font-size:11px}th,td{padding:7px}}</style>'+reportContent(false));
    if(action==='export-report'){
      const p=selectedPeriod(),previous=report.comparison,comparable=report.coverage.complete&&previous.coverage.complete;
      return download('finance-laporan-'+reportMode+'-'+from+'.csv',[
        ['Laporan Finance',p.label],...reportNotes().map(note=>[note]),[],['1. Ringkasan manajemen'],['Ringkasan',p.label,p.previousLabel,'Selisih nominal'],
        ...summaryRows().map(([label,key])=>[label,report.summary[key],previous.coverage.complete?previous.summary[key]:'Data belum lengkap',comparable?(BigInt(report.summary[key])-BigInt(previous.summary[key])).toString():'']),
        ...companyStatements(report).flatMap(section=>[[],[section.title],[section.note],['Uraian','Nilai (IDR)'],...section.rows.map(row=>[row.label,row.value??''])]),
        [],['6. Catatan laporan'],...companyNotes().map(note=>[note]),
        [],['7. Lampiran — Neraca saldo'],['Kode','Akun','Saldo awal','Debit','Kredit','Saldo akhir'],...report.balances.map(a=>[a.code,a.name,a.opening,a.debit,a.credit,a.balance])]);
    }
    if(action==='export'){
      // Export every page of the selected ledger, not just the current table.
      const {entries}=await call('/ledger-export?'+new URLSearchParams({from,to,...(ledgerId?{accountId:ledgerId}:{})}));
      return download('finance-transaksi-'+to+'.csv',[['Tanggal','Jenis','Keterangan','Debit','Kredit','Nominal'],...entries.map(e=>[e.entry_date,e.kind,e.description,e.debit_name,e.credit_name,e.amount])]);
    }
  }
  function importDialog(){
    let parsed=null,normalized=null;
    const d=modal('Impor mutasi bank',select('Rekening','bankId',bankOptions())+`<label>File CSV<input name="csv" type="file" accept=".csv,text/csv" required></label><div data-mapping></div><div data-preview></div>`+hint('Gunakan ekspor CSV bank. Pratinjau dan periksa kolom sebelum mengimpor. Maksimal 500 baris / 1 MB.'),async f=>{if(!normalized)throw new Error('Buat pratinjau terlebih dahulu.');const r=await call('/bank-imports',{bankId:f.bankId,rows:normalized});return r.duplicate?'File yang sama sudah diimpor. Tidak ada transaksi tambahan.':`${r.imported} mutasi diimpor.`;});
    d.querySelector('[type=submit]').disabled=true;
    d.querySelector('[name=csv]').onchange=async event=>{
      normalized=null;d.querySelector('[type=submit]').disabled=true;
      try{
        const file=event.target.files[0];if(!file||file.size>1048576)throw new Error('File maksimal 1 MB.');parsed=parseCSV(await file.text());
        const columns=parsed[0].map((h,i)=>`<option value="${i}">${esc(h)}</option>`).join('');
        d.querySelector('[data-mapping]').innerHTML=select('Kolom tanggal','dateColumn',columns)+select('Kolom uraian','descriptionColumn',columns)+select('Susunan nominal','amountMode','<option value="signed">Satu kolom bertanda + / −</option><option value="split">Kolom debit dan kredit terpisah</option>')+select('Kolom nominal bertanda (+ masuk / − keluar)','amountColumn',columns)+select('Kolom debit bank (uang keluar)','debitColumn',columns)+select('Kolom kredit bank (uang masuk)','creditColumn',columns)+select('Kolom referensi unik bank','referenceColumn','<option value="">Tidak tersedia</option>'+columns)+select('Format tanggal','dateFormat','<option value="iso">YYYY-MM-DD</option><option value="dmy">DD/MM/YYYY</option>')+select('Format nominal','amountFormat','<option value="plain">300000 / -300000</option><option value="id">300.000,00 / -300.000,00</option>')+'<button type="button" data-preview-button>Pratinjau impor</button>';
        d.querySelector('[name=descriptionColumn]').value=String(Math.min(1,parsed[0].length-1));d.querySelector('[name=amountColumn]').value=String(Math.min(2,parsed[0].length-1));
        const mode=()=>{const split=d.querySelector('[name=amountMode]').value==='split';for(const name of ['debitColumn','creditColumn'])d.querySelector('[name='+name+']').parentElement.hidden=!split;d.querySelector('[name=amountColumn]').parentElement.hidden=split;};mode();
        d.querySelector('[data-mapping]').onchange=()=>{normalized=null;d.querySelector('[type=submit]').disabled=true;mode();};
        d.querySelector('[data-preview-button]').onclick=()=>{
          try{const f=Object.fromEntries(new FormData(d.querySelector('form')));normalized=parsed.slice(1).map(r=>({date:bankDate(r[f.dateColumn],f.dateFormat),description:r[f.descriptionColumn],amount:f.amountMode==='split'?splitBankAmount(r[f.debitColumn],r[f.creditColumn],f.amountFormat):bankAmount(r[f.amountColumn],f.amountFormat),reference:f.referenceColumn===''?null:r[f.referenceColumn]}));
            d.querySelector('[data-preview]').innerHTML=hint(`${normalized.length} baris siap diimpor. Berikut 8 baris pertama.`)+table(['Tanggal','Uraian','Nominal'],normalized.slice(0,8).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td>${money(r.amount)}</td></tr>`).join(''));d.querySelector('[type=submit]').disabled=false;d.querySelector('[role=alert]').textContent='';
          }catch(e){normalized=null;d.querySelector('[type=submit]').disabled=true;d.querySelector('[role=alert]').textContent=e.message;}
        };
      }catch(e){d.querySelector('[role=alert]').textContent=e.message;}
    };
  }
  function beforeUnload(e){if(dirty){e.preventDefault();e.returnValue='';}}
  window.addEventListener('beforeunload',beforeUnload);
  render();if(cfg&&access.ready)refresh();
  return{canLeave:()=>!dirty||confirm('Buang isian Finance yang belum disimpan?'),close(){closed=true;controller.abort();dirty=false;window.removeEventListener('beforeunload',beforeUnload);urls.forEach(url=>URL.revokeObjectURL(url));host.querySelector('dialog')?.close();}};
}
