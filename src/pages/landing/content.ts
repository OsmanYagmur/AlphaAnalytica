/**
 * Tanıtım sayfasının metin içeriği. Skorlar, notlar ve limitler burada yazılmaz;
 * sayfa bunları motordan canlı hesaplar. Ekip bölümü `TEAM` doldurulunca görünür.
 */

import alpPhoto from '../../assets/team/alp-hatipoglu.jpg'
import osmanPhoto from '../../assets/team/osman-yagmur.jpg'
import type { Role } from '../../store/types'

// ---------------------------------------------------------------------------
// Ekip
// ---------------------------------------------------------------------------

export interface TeamMember {
  name: string
  /** Takımdaki unvanı (ör. "Team Lead & System Architect") */
  role: string
  /** Kartta unvanın üstünde küçük etiket (ör. "Takım Kaptanı") */
  badge?: string
  /** Sorumluluk alanı; boş bırakılabilir */
  responsibility?: string
  /** İsteğe bağlı eğitim bilgisi (ör. "Üniversite · Bölüm, Sınıf") */
  education?: string
  /** İsteğe bağlı fotoğraf (src/assets/team altında, kare); yoksa baş harfler gösterilir */
  photo?: string
  /** İsteğe bağlı bağlantılar (tam adres, https:// ile) */
  links?: { linkedin?: string; website?: string }
}

/** Danışman da bu listeye eklenebilir (role: 'Danışman'). */
export const TEAM: TeamMember[] = [
  {
    name: 'Osman Yağmur',
    photo: osmanPhoto,
    badge: 'Takım Kaptanı',
    role: 'Team Lead & System Architect',
    responsibility: 'Takım koordinasyonu, sistemin iskeleti ve iki teknik alanın birleştirilmesi',
    links: { linkedin: 'https://www.linkedin.com/in/osmanymr/', website: 'https://osmanyagmur.com' },
  },
  {
    name: 'Alp Hatipoğlu',
    photo: alpPhoto,
    role: 'Data Engineering & Integration Lead',
    responsibility: 'Veri kaynakları, API entegrasyonları, veri toplama ve veri hattı',
    links: { linkedin: 'https://www.linkedin.com/in/alp-hatipoglu' },
  },
  {
    name: 'Muhammed Mustafa Kaymaz',
    role: 'AI & Algorithm Lead',
    responsibility: 'Algoritma ve yapay zekâ modelinin tasarımı',
  },
  {
    name: 'Aziz Mert Kayalar',
    role: 'Data Analyst',
  },
]

// ---------------------------------------------------------------------------
// Problem
// ---------------------------------------------------------------------------

export const PROBLEMS = [
  {
    title: 'Bilanço geçmişe bakar',
    text: 'Kredi kararları çoğunlukla yılda bir kez kapanan mizan ve beyannameye dayanır. Firmanın bugün ne durumda olduğu, aylar önceki verinin arkasında kalır.',
  },
  {
    title: 'Sezonsallık risk sanılır',
    text: 'Kırtasiyecinin eylül zirvesi ya da kış turizmcisinin yaz durgunluğu işin doğasıdır. Aylık ciroya sezon bilgisi olmadan bakıldığında sağlıklı bir firma riskli görünebilir.',
  },
  {
    title: 'Zayıf bilanço, güçlü işletme',
    text: 'Kaldıraçlı ya da likiditesi düşük görünen pek çok KOBİ; düzenli POS cirosu, sadık müşterisi ve zamanında ödediği tedarikçileriyle aslında kredi alabilecek durumdadır.',
  },
  {
    title: 'Erken uyarılar gecikir',
    text: 'Yorum puanındaki düşüş, uzayan stok süresi ya da başka bir bankadaki gecikme, bilançoya yansıyana kadar kredi kararı çoktan verilmiş olur.',
  },
] as const

// ---------------------------------------------------------------------------
// Çözüm
// ---------------------------------------------------------------------------

export const PILLARS = [
  {
    title: 'Geleneksel analiz',
    text: 'Hesap kodlu mizan ve kurumlar vergisi beyannamesinden likidite, kaldıraç, kârlılık, faaliyet etkinliği, borç ödeme gücü ve beyan tutarlılığı.',
  },
  {
    title: 'Sektöre özgü alternatif veri',
    text: 'Her sektör için seçilmiş göstergeler: POS ve e-fatura hacmi, pazaryeri puanı, ilan süreleri, rezervasyonlar, SGK reçeteleri, e-irsaliye ve daha fazlası.',
  },
  {
    title: 'Sezonsallık düzeltmesi',
    text: 'Aylık ciro, sektörün beklenen sezon profiliyle karşılaştırılır; beklenen dalgalanma cezalandırılmaz, gerçek eğilim sezondan arındırılarak ölçülür.',
  },
  {
    title: 'Erken uyarı ve KKB',
    text: 'Beyan tutarsızlığı, karşılıksız çek, vergi/SGK borcu, zayıflayan göstergeler ve diğer bankalardaki gecikme ya da hızlı risk artışı notu anında etkiler.',
  },
] as const

export const COMPARISON: { topic: string; classic: string; ours: string }[] = [
  { topic: 'Veri', classic: 'Yıllık mizan ve beyanname', ours: 'Mizan ve beyanname + aylık, sektöre özgü alternatif veri' },
  { topic: 'Sezonsallık', classic: 'Dalgalanma risk olarak okunur', ours: 'Sektörün sezon profiline göre değerlendirilir' },
  { topic: 'Güncellik', classic: 'Karar anındaki bilançoyla sabit', ours: 'Portföy aylık veriyle izlenir, not değişimi görünür' },
  { topic: 'Diğer bankalar', classic: 'Ayrı raporlarda, elle incelenir', ours: 'KKB riski limit ve erken uyarıya doğrudan girer' },
  { topic: 'Model yönetimi', classic: 'Kurallar kodun içinde, değişiklik uzun sürer', ours: 'Tüm parametreler panelden, etkisi kaydetmeden önce görülür' },
  { topic: 'Açıklanabilirlik', classic: 'Tek bir skor', ours: 'Skoru etkileyen faktörler ve alt kategori puanları' },
]

/** Değerlendirme akışının adımları; her adım demoda ilgili sekmeye götürür. */
export const FLOW_FIRM_ID = 'defne-kirtasiye'

export const FLOW_STEPS: { id: 'mizan' | 'alternatif' | 'kkb' | 'skor' | 'limit'; title: string; text: string; detail: string; tab: string }[] = [
  {
    id: 'mizan',
    title: 'Mizan ve beyanname',
    text: 'Hesap kodlu mizandan finansal tablo ve oranlar; beyanname tutarlılığı',
    detail: 'Mizan hesap kodlarından bilanço ve gelir tablosu kurulur; likidite, kaldıraç, kârlılık, faaliyet etkinliği, borç ödeme gücü ve beyan tutarlılığı ayrı ayrı puanlanır.',
    tab: 'geleneksel',
  },
  {
    id: 'alternatif',
    title: 'Alternatif veri',
    text: 'Sektöre özgü aylık göstergeler, sezon uyumu ve arındırılmış trend',
    detail: 'Sektöre özgü aylık göstergeler okunur. Aylık ciro sektörün sezon profiliyle karşılaştırılır; beklenen dalgalanma cezalandırılmaz, eğilim sezondan arındırılarak ölçülür.',
    tab: 'alternatif',
  },
  {
    id: 'kkb',
    title: 'KKB risk raporu',
    text: 'Diğer bankalardaki limit, risk, gecikme ve sorgular',
    detail: 'Firmanın diğer bankalardaki limit ve riskleri, gecikmeleri ve kredi sorguları izlenir. Gecikme ya da hızlı risk artışı erken uyarı olarak nota, mevcut riskler limite yansır.',
    tab: 'kkb',
  },
  {
    id: 'skor',
    title: 'Nihai skor, not ve temerrüt olasılığı',
    text: 'Erken uyarılar notu sınırlar; faktörler kararı açıklar',
    detail: 'Geleneksel analiz ve alternatif veri tek bir skorda birleşir; skor harf notuna ve temerrüt olasılığına çevrilir. Kararı en çok etkileyen faktörler düz bir dille yazılır.',
    tab: 'geleneksel',
  },
  {
    id: 'limit',
    title: 'Limit ve kredi şartları',
    text: 'Limit, teminat, vade, fiyat ve ürün kırılımı önerisi',
    detail: 'Borç servis ve özkaynak kapasitesinden limit hesaplanır, diğer bankalardaki işletme kredisi riski düşülür. Nota göre teminat, vade, fiyat ve ürün kırılımı önerilir.',
    tab: 'geleneksel',
  },
]

// ---------------------------------------------------------------------------
// Ürün
// ---------------------------------------------------------------------------

export const INTERFACES = [
  {
    title: 'Tahsis Yöneticisi',
    text: 'Başvuru kuyruğu, firma değerlendirmesi ve kredi kararı.',
    points: ['Nihai skor, harf notu ve temerrüt olasılığı', 'Geleneksel, alternatif veri, KKB ve piyasa istihbaratı sekmeleri', 'Sistem önerisi: limit, teminat, vade, fiyat, ürün kırılımı', 'Onay, red ve gerekçeli revize; karar geçmişi'],
  },
  {
    title: 'Portföy Yöneticisi',
    text: 'Onaylanan kredilerin güncel veriyle izlenmesi.',
    points: ['Not ve sektör dağılımı, kullandırılan risk', 'Erken uyarıdaki ve diğer bankalarda riski artan firmalar', '12 aylık skor trendi', 'Sistem görüşü ile tahsis kararının karşılaştırması'],
  },
  {
    title: 'Model Yöneticisi',
    text: 'Modelin tüm parametrelerinin yönetildiği panel.',
    points: ['Ağırlıklar, eşikler, sektör göstergeleri ve sezon endeksleri', 'Kaydetmeden önce tüm portföyde etki önizlemesi', 'Şelale grafiği ve duyarlılık analizi', 'Sürümleme, denetim izi ve JSON içe/dışa aktarma'],
  },
] as const

export const CAPABILITIES = [
  { title: 'Parametreyle yönetilen motor', text: 'Hesaplama motorunda sabit kural yoktur; her ağırlık ve eşik tipli bir konfigürasyondan okunur.' },
  { title: 'Sürümleme ve denetim izi', text: 'Her model değişikliği sürüm olarak kaydedilir; kararlar verildiği sürümle sabit kalır.' },
  { title: 'Kaydetmeden önce etki', text: 'Bir parametre değiştiğinde hangi firmanın notunun ve limitinin nasıl değişeceği anında görülür.' },
  { title: 'Küçük işletmeden holdinge', text: 'Aynı model, mahalledeki bir kırtasiyeden milyarlarca liralık ciroya sahip holdinglere kadar ölçekten bağımsız çalışır.' },
  { title: 'Kurum içinde çalışır', text: 'Tamamen tarayıcıda çalışır, internet bağlantısı gerektirmez; veri kurumun dışına çıkmaz.' },
  { title: 'Test edilmiş hesaplama', text: 'Motorun her fonksiyonu ve her örnek firmanın sonucu otomatik testlerle doğrulanır.' },
] as const

// ---------------------------------------------------------------------------
// Demo senaryoları — firmanın notu ve limiti sayfada motordan hesaplanır
// ---------------------------------------------------------------------------

export interface Scenario {
  firmId: string
  role: Extract<Role, 'tahsis' | 'portfoy'>
  /** Demo içindeki yol */
  path: string
  title: string
  text: string
}

export const SCENARIOS: Scenario[] = [
  {
    firmId: 'defne-kirtasiye',
    role: 'tahsis',
    path: '/tahsis/firma/defne-kirtasiye/alternatif',
    title: 'Zayıf bilanço, güçlü alternatif veri',
    text: 'Yalnız bilançoyla reddedilecek bir kırtasiye; POS cirosu, okul sezonu performansı ve düzenli tedarikçi ödemeleriyle kredi alabilir hale geliyor.',
  },
  {
    firmId: 'kuzey-oto',
    role: 'tahsis',
    path: '/tahsis/firma/kuzey-oto/alternatif',
    title: 'Güçlü bilanço, bozulan bugün',
    text: 'Bilançosu sağlam bir oto galeride ilanda kalma süresi uzuyor, satışlar düşüyor, stok finansmanı hızla büyüyor. Sistem erken uyarı veriyor.',
  },
  {
    firmId: 'palandoken-turizm',
    role: 'tahsis',
    path: '/tahsis/firma/palandoken-turizm/alternatif',
    title: 'Sezonsallık cezalandırılmıyor',
    text: 'Kış turizmi acentesinin yaz aylarındaki düşük cirosu, sezon profiliyle beklenen desen olarak okunuyor.',
  },
  {
    firmId: 'denizli-dokuma',
    role: 'tahsis',
    path: '/tahsis/firma/denizli-dokuma/kkb',
    title: 'Başka bankada gecikme',
    text: 'Bilançosu ve alternatif verisi güçlü bir tekstil ihracatçısı; KKB raporundaki gecikme notunu sınırlıyor.',
  },
  {
    firmId: 'mavi-sepet',
    role: 'portfoy',
    path: '/portfoy/firma/mavi-sepet',
    title: 'Portföyde not düşüşü',
    text: 'Onaylanmış bir e-ticaret firmasında yorum puanı düşüyor, iadeler artıyor, başka bankalardan yeni kredi kullanılıyor. Portföy yöneticisi uyarıyı görüyor.',
  },
]

// ---------------------------------------------------------------------------
// Ticari potansiyel
// ---------------------------------------------------------------------------

export const AUDIENCES = [
  { title: 'Bankalar ve katılım bankaları', text: 'KOBİ ve ticari kredi tahsisi, portföy izleme ve erken uyarı.' },
  { title: 'Finansman kuruluşları', text: 'Faktoring, leasing ve finansman şirketlerinde hızlı ve açıklanabilir risk değerlendirmesi.' },
  { title: 'Tedarikçi ve bayi ağı olan şirketler', text: 'Vadeli satış yapılan müşterilerin ve bayilerin risklerinin izlenmesi.' },
  { title: 'Risk analizine ihtiyaç duyan kurumlar', text: 'Karşı taraf riskini ölçmek isteyen her firma ve kurum için uyarlanabilir model.' },
] as const

export const SALES_STEPS = [
  { title: 'Tanışma ve demo', text: 'Kurumun ihtiyaçları ve portföy yapısı üzerinden canlı gösterim.' },
  { title: 'Pilot', text: 'Sınırlı bir portföyde, kurumun kendi verisiyle karşılaştırmalı deneme.' },
  { title: 'Uyarlama ve entegrasyon', text: 'Sektör göstergeleri, eşikler ve sezon profillerinin kuruma göre ayarlanması.' },
  { title: 'Kurumsal kullanım', text: 'Kurum içi kurulum, model yönetimi eğitimi ve sürekli destek.' },
] as const

// ---------------------------------------------------------------------------
// Riskler ve önlemler
// ---------------------------------------------------------------------------

export const RISKS: { risk: string; measure: string }[] = [
  {
    risk: 'Alternatif veriye erişim ve kişisel verilerin korunması',
    measure: 'Veri yalnızca firmanın açık rızasıyla ve amaçla sınırlı işlenir; kurum içinde çalışan mimari sayesinde veri dışarı çıkmaz.',
  },
  {
    risk: 'Eksik veya kalitesiz alternatif veri',
    measure: 'Veri kapsama düzeltmesi eksik göstergeyi nötr değere çeker; tek bir gösterge skoru tek başına belirleyemez.',
  },
  {
    risk: 'Modelin yanlış sınıflandırması',
    measure: 'Şeffaf parametreler, sürümleme, kaydetmeden önce etki simülasyonu; nihai karar her zaman tahsis yöneticisinde.',
  },
  {
    risk: 'Sektörler arası farklılıklar',
    measure: 'Her sektörün kendi göstergeleri, ağırlıkları ve sezon profili; yeni sektör kod değişikliği olmadan eklenir.',
  },
  {
    risk: 'Kurum sistemleriyle entegrasyon',
    measure: 'Bağımsız ve test edilmiş hesaplama motoru; kurumun veri kaynaklarına göre uyarlanabilir girdi yapısı.',
  },
  {
    risk: 'Mevzuat ve denetlenebilirlik',
    measure: 'Karar destek sistemi olarak konumlanır; her karar ve model değişikliği denetim izine yazılır.',
  },
]

export const SLOGAN = 'Bilançonun ötesini görün.'
