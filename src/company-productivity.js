// Draft helpers only: no storage, requests, role grants or automatic execution.
const templates = [
  {id:'bug',division:'technology',kind:'task',label:'Perbaikan bug',title:'Perbaikan bug',steps:['Catat langkah reproduksi dan hasil yang diharapkan.','Tentukan penyebab dan perubahan paling kecil.','Uji regresi login, materi, kuis, progres dan pembayaran yang terdampak.','Cantumkan PR, hasil tes dan cara rollback.']},
  {id:'feature',division:'technology',kind:'task',label:'Pengembangan fitur',title:'Pengembangan fitur',steps:['Tuliskan masalah pengguna dan kriteria diterima.','Tentukan ruang lingkup, izin dan data yang diperlukan.','Implementasikan beserta pengujian dan review.','Catat hasil evaluasi setelah rilis.']},
  {id:'release',division:'technology',kind:'release',label:'Rilis aman',title:'Rilis aplikasi',steps:['Pastikan PR, CI dan review sudah lengkap.','Catat commit SHA dan tautan bukti rilis.','Periksa kebutuhan backup dan rollback.','Verifikasi deploy, healthcheck dan alur siswa sebelum menandai terverifikasi.']},
  {id:'marketing-review',division:'marketing',kind:'task',label:'Evaluasi pemasaran',title:'Evaluasi pemasaran',steps:['Catat tujuan, periode dan sumber data.','Pisahkan angka terukur dari data yang belum tersedia.','Tentukan satu usulan perbaikan dan ukuran keberhasilan.','Catat keputusan lanjut, revisi atau hentikan.']},
  {id:'campaign',division:'marketing',kind:'campaign',label:'Rencana kampanye',title:'Rencana kampanye',steps:['Tentukan sasaran, penawaran, kanal dan anggaran.','Siapkan pesan, tujuan tautan dan penamaan UTM.','Review isi, jadwal dan penanggung jawab.','Catat hasil dari sumber terverifikasi dan keputusan evaluasi.']},
  {id:'content',division:'marketing',kind:'content',label:'Produksi konten',title:'Produksi konten',steps:['Tentukan audiens, pesan utama dan ajakan bertindak.','Siapkan naskah, aset dan tautan tujuan.','Review lalu atur jadwal publikasi.','Catat URL setelah benar-benar terbit dan evaluasi hasil.']},
  {id:'student-followup',division:'operations',kind:'task',label:'Tindak lanjut layanan siswa',title:'Tindak lanjut layanan siswa',steps:['Periksa kasus melalui sistem asal; gunakan referensi internal.','Tentukan kendala dan tindakan yang diperlukan.','Koordinasikan tindakan dengan pemilik akses yang sesuai.','Periksa hasil penanganan dan tutup pekerjaan setelah terkonfirmasi.']},
  {id:'finance-review',division:'finance',kind:'task',label:'Review operasional keuangan',title:'Review operasional keuangan',steps:['Pilih transaksi terkait pada menu Pesanan.','Cocokkan bukti, nominal, status dan identitas melalui sistem asal.','Lakukan keputusan pada menu transaksi sesuai kewenangan.','Periksa hasil dan catat referensi tindak lanjut tanpa menyalin data rekening.']},
];

export function templatesFor(division,kind){
  return templates.filter(t=>t.division===division&&t.kind===kind).map(t=>({
    id:t.id,label:t.label,title:t.title,
    description:'Tujuan\n\nKriteria selesai\n\nLangkah kerja\n'+t.steps.map(s=>'- [ ] '+s).join('\n')+'\n\nBukti / hasil review\n',
  }));
}

export function canCreateFollowUp(access,division,courseId){
  if(division==='academic'||!courseId||!access.divisions?.some(d=>d.id===division))return false;
  const scope=access.scopes?.[division];
  return access.isAdmin===true||scope==='global'||Array.isArray(scope)&&scope.includes(courseId);
}

const metricNames={activation:'Aktivasi belajar',completion:'Pelajaran aktif yang selesai',retention:'Kembali belajar minggu berikutnya',dataQuality:'Latihan terhubung ke pelajaran'};
export function followUpDraft({division,courseId,courseTitle,report}){
  // Copy only already-authorized aggregate fields, never arbitrary API payloads.
  const findings=Object.entries(metricNames).flatMap(([key,label])=>{
      const value=report[key];
      return value?.status==='available'&&Number.isFinite(value.percent)?[`${label}: ${value.percent}%`]:[];
    });
  const title=('Tindak lanjut Insights: '+courseTitle).slice(0,160);
  const description=[`Kursus: ${courseTitle}`,`Periode UTC: ${report.window.start} — ${report.window.end}`,`Snapshot: ${report.generatedAt}`,'',
    'Observasi',...(findings.length?findings:['Bukti belum cukup; periksa ketercakupan data terlebih dahulu.']),'Angka merupakan snapshot agregat, bukan bukti sebab-akibat. Baca definisi metrik pada Data & Insights.','',
    'Hipotesis yang perlu diperiksa','',
    'Langkah kerja','- [ ] Periksa konteks dan penyebab sebelum mengubah materi atau produk.','- [ ] Tentukan perubahan, penanggung jawab dan kriteria selesai.','- [ ] Review serta uji dampak pada pembelajaran.','- [ ] Catat hasil evaluasi dan keputusan berikutnya.','',
    'Ukuran keberhasilan / batas yang tidak boleh memburuk','',
    'Bukti hasil review',''].join('\n').slice(0,6000);
  return {division,courseId,title,description};
}

export function historyLabel(key){
  return ({created:'Pekerjaan dibuat',updated:'Detail diperbarui',transitioned:'Status diperbarui'})[key]||'Perubahan dicatat';
}
