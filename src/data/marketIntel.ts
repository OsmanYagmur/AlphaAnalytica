/**
 * Piyasa İstihbaratı (statik veri).
 *
 * Uygulama çevrimdışı çalışır; içerik çalışma zamanında internetten çekilmez.
 * Maddeler 25 Eylül 2026'da yapılan web araştırmasıyla derlenmiştir. Özetler
 * kaynakların kendi cümleleriyle değil, özetleyici ifadelerle yazılmıştır;
 * her rakamın kaynağı ve bağlantısı maddede yer alır.
 *
 * Bu içerik kredi skorunu, notu veya limiti ETKİLEMEZ; yalnızca bilgi amaçlıdır.
 * Model Yöneticisi panelinden düzenlenebilir (değişiklikler localStorage'da tutulur).
 */

import type { SectorId } from '../engine/modelConfig'

export type IntelImpact = 'positive' | 'neutral' | 'negative'

export const INTEL_IMPACT_LABELS: Record<IntelImpact, string> = {
  positive: 'Olumlu',
  neutral: 'Nötr',
  negative: 'Olumsuz',
}

export interface MarketIntelItem {
  id: string
  /** Kısa başlık */
  title: string
  /** 1–2 cümle özet */
  summary: string
  impact: IntelImpact
  /** Kaynak adı (ör. "TÜİK", "Ticaret Bakanlığı (AA haberi)") */
  source: string
  /** Doğrulama için kaynak bağlantısı */
  sourceUrl: string
  /** Haberin / verinin yayın tarihi, 'YYYY-MM-DD' */
  date: string
}

export interface SectorIntel {
  /** 'YYYY-MM-DD' */
  lastUpdated: string
  items: MarketIntelItem[]
  /** "Kredi açısından ne anlama geliyor" yorumu (1–2 cümle) */
  creditImplication: string
}

export type MarketIntel = Record<SectorId, SectorIntel>

const RESEARCHED = '2026-09-25'

export const DEFAULT_MARKET_INTEL: MarketIntel = {
  ecommerce: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'ecom-volume-2025',
        title: 'E-ticaret hacmi 2025’te %52,2 büyüdü',
        summary:
          'Ticaret Bakanlığı verilerine göre e-ticaret hacmi 2025’te yıllık %52,2 artışla yaklaşık 4,57 trilyon TL’ye ulaştı; e-ticaretin genel ticaret içindeki payı yaklaşık %19,5 oldu.',
        impact: 'positive',
        source: 'Ticaret Bakanlığı',
        sourceUrl: 'https://ticaret.gov.tr/haberler/turkiyede-e-ticaret-hacmi-2025te-4-6-trilyon-liraya-ulasti',
        date: '2026-05-12',
      },
      {
        id: 'ecom-parcels-h1',
        title: 'Kargo gönderileri ilk yarıda %5 arttı',
        summary:
          'BTK’nın 2026-1 Posta Sektörü Pazar Verileri’ne göre ilk yarıda kargo ve posta kolisi gönderileri yıllık yaklaşık %5 artışla 728,3 milyona ulaştı; artış e-ticaretin yaygınlaşmasına bağlanıyor.',
        impact: 'positive',
        source: 'BTK (EKOTÜRK haberi)',
        sourceUrl: 'https://www.ekoturk.com/haberler/turkiyenin-kargo-trafigi-aciklandi-6-ayda-728-milyon-gonderi/',
        date: '2026-09-22',
      },
      {
        id: 'ecom-regulation-draft',
        title: 'Pazaryerleri için yeni yükümlülükler gündemde',
        summary:
          'Ticaret Bakanlığı’nın e-ticaret düzenleme taslağı; kargo hasarlarında tazmin mekanizmasını, tescilli markaların izinsiz reklam kullanımına sınırlamayı ve satıcı verilerinin başka platformlara bedelsiz taşınabilmesini öngörüyor.',
        impact: 'neutral',
        source: 'Türkiye Günlüğü',
        sourceUrl: 'https://www.turkiyegunlugu.net/ticaret-bakanligindan-e-ticarette-yeni-doenem-kargo-reklam-ve-veri-kurallari-degisiyor',
        date: '2026-08-18',
      },
    ],
    creditImplication:
      'Nominal hacim güçlü büyüse de gönderi adedindeki tek haneli artış reel büyümenin yavaşladığına işaret ediyor. Değerlendirmede iade oranı ve pazaryeri puanı gibi operasyonel göstergeler öne çıkmalı.',
  },

  autoDealer: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'auto-odmd-august',
        title: 'Sıfır araç pazarı ağustosta %20 daraldı',
        summary:
          'ODMD verilerine göre otomobil ve hafif ticari araç pazarı ağustosta yıllık %20,28 daralarak 81.031 adede geriledi; Ocak–Ağustos dönemindeki daralma %11,91 oldu.',
        impact: 'negative',
        source: 'ODMD (Alomaliye haberi)',
        sourceUrl: 'https://www.alomaliye.com/2026/09/02/otomotiv-pazari-sekiz-ayda-yuzde-11-91-daraldi/',
        date: '2026-09-02',
      },
      {
        id: 'auto-used-prices',
        title: 'İkinci el fiyatları beş aydır geriliyor',
        summary:
          'Cardata’ya göre ikinci el araç fiyatları üst üste beş aydır düşüyor ve temmuzda aylık gerileme %1,6 oldu; şirket yıl sonuna kadar nominal %7–12 ilave düşüş bekliyor.',
        impact: 'negative',
        source: 'Cardata (motobilim.com haberi)',
        sourceUrl: 'https://www.motobilim.com/2026/08/ikinci-el-arac-fiyatlarnda-yl-sonuna.html',
        date: '2026-08-24',
      },
      {
        id: 'auto-loan-rates',
        title: 'Taşıt kredisi faizleri %47 civarında',
        summary:
          'Cardata, taşıt kredisi faizlerinin %47 seviyesinde seyrettiğini; kredi limitleri, vadeler ve erişim koşullarının alıcıların hareket alanını daralttığını belirtiyor.',
        impact: 'negative',
        source: 'Cardata (motobilim.com haberi)',
        sourceUrl: 'https://www.motobilim.com/2026/08/ikinci-el-arac-fiyatlarnda-yl-sonuna.html',
        date: '2026-08-24',
      },
      {
        id: 'auto-policy-rate',
        title: 'Politika faizi %37’de sabit',
        summary:
          'TCMB Para Politikası Kurulu politika faizini %37’de sabit tuttu ve sıkı duruşun fiyat istikrarı sağlanana kadar süreceğini vurguladı; stok finansmanı maliyetinde kısa vadede gevşeme sinyali yok.',
        impact: 'neutral',
        source: 'TCMB',
        sourceUrl: 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Duyurular/Basin/2026/DUY2026-38',
        date: '2026-09-10',
      },
    ],
    creditImplication:
      'Stok değer kaybı ve uzayan satış süreleri galerilerin işletme sermayesini zorluyor. Stok finansmanında teminat değeri muhafazakâr hesaplanmalı, ilanda kalma süresi yakından izlenmeli.',
  },

  stationery: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'stat-market-size',
        title: 'Kırtasiye pazarının 100 milyar TL’yi aşması bekleniyor',
        summary:
          'Tüm Kırtasiyeciler Derneği (TÜKİD), 2025’te 80 milyar TL olan kırtasiye pazarının 2026’da 100 milyar TL’nin üzerine çıkmasını bekliyor.',
        impact: 'positive',
        source: 'TÜKİD (Ekonomist haberi)',
        sourceUrl: 'https://www.ekonomist.com.tr/makale/kirtasiye-urunleri-pazari-100-milyar-tl-yi-asacak-78898',
        date: '2026-09-18',
      },
      {
        id: 'stat-basket-cost',
        title: 'Temel okul çantası maliyeti 2.500 TL',
        summary:
          'TÜKİD’e göre temel ihtiyaçlardan oluşan okul çantasının ortalama maliyeti geçen yılki 1.980 TL’den 2.500 TL’ye yükseldi; nominal ciro artarken velilerin bütçe hassasiyeti artıyor.',
        impact: 'neutral',
        source: 'TÜKİD (Ekonomist haberi)',
        sourceUrl: 'https://www.ekonomist.com.tr/makale/kirtasiye-urunleri-pazari-100-milyar-tl-yi-asacak-78898',
        date: '2026-09-18',
      },
      {
        id: 'stat-school-calendar',
        title: 'Okullar 14 Eylül’de açıldı',
        summary:
          'MEB takvimine göre 2026-2027 eğitim-öğretim yılı 14 Eylül’de başladı; yarıyıl tatili 25 Ocak–5 Şubat 2027 arasında. Şubat’taki ikinci sezon piki bu takvime göre oluşacak.',
        impact: 'positive',
        source: 'Milli Eğitim Bakanlığı',
        sourceUrl: 'https://www.meb.gov.tr/2026-2027-egitim-ogretim-yili-takvimi-aciklandi/haber/41057/tr',
        date: '2026-09-14',
      },
      {
        id: 'stat-digital-shift',
        title: 'Dijital ürünlere talep artıyor',
        summary:
          'TÜKİD, okul alışverişinde tablet ve dizüstü bilgisayar talebinin arttığını, yapay zekâ destekli defter talebinin ise geçen yılın iki katına çıktığını belirtiyor.',
        impact: 'neutral',
        source: 'TÜKİD (Ekonomist haberi)',
        sourceUrl: 'https://www.ekonomist.com.tr/makale/kirtasiye-urunleri-pazari-100-milyar-tl-yi-asacak-78898',
        date: '2026-09-18',
      },
    ],
    creditImplication:
      'Sezon cirosu nominal olarak güçlü görünüyor. Eylül yoğunluğunun ardından stok eritme hızı ve tedarikçi ödemeleri izlenmeli; sezon sonrası kalan stok nakit akışını sıkıştırabilir.',
  },

  tourism: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'tour-q2-revenue',
        title: 'İkinci çeyrekte turizm geliri %2,6 azaldı',
        summary:
          'TÜİK verilerine göre 2026’nın ikinci çeyreğinde turizm geliri yıllık %2,6 azalarak yaklaşık 15,87 milyar dolara geriledi; ziyaretçi sayısı %5,1 düştü.',
        impact: 'negative',
        source: 'TÜİK (BirGün haberi)',
        sourceUrl: 'https://www.birgun.net/haber/tuik-verileri-acikladi-turizm-geliri-ikinci-ceyrekte-yuzde-2-6-azaldi-726682',
        date: '2026-07-31',
      },
      {
        id: 'tour-july-visitors',
        title: 'Temmuzda yabancı ziyaretçi sayısı yatay',
        summary:
          'Kültür ve Turizm Bakanlığı verilerine göre temmuzda yabancı ziyaretçi sayısı yıllık %0,27 azalışla yaklaşık 7,1 milyon oldu; Ocak–Temmuz dönemindeki düşüş %2,29.',
        impact: 'neutral',
        source: 'Kültür ve Turizm Bakanlığı (Turizm Ekonomi haberi)',
        sourceUrl: 'https://www.turizmekonomi.com/iste-temmuz-2026da-ve-7-ayda-turkiyeye-gelen-turist-sayisi',
        date: '2026-08-21',
      },
      {
        id: 'tour-war-bookings',
        title: 'Ortadoğu’daki savaş rezervasyonları vurdu',
        summary:
          'TÜRSAB Başkanı’na göre savaşın başlamasıyla erken rezervasyonlarda %15 iptal yaşandı, Avrupa’dan rezervasyon akışı %20–25 azaldı; acenteler nakit ve yakıt farkı desteği talep etti.',
        impact: 'negative',
        source: 'TÜRSAB (Cumhuriyet haberi)',
        sourceUrl:
          'https://www.cumhuriyet.com.tr/ekonomi/seyahat-acenteleri-nakit-ve-yakit-destegi-otelciler-kdv-indirimi-istiyor-turizme-savas-ayari-2493276',
        date: '2026-04-08',
      },
      {
        id: 'tour-last-minute',
        title: 'Alman operatörler son dakika satışına güveniyor',
        summary:
          'TUI ve Dertour yöneticileri güçlü bir son dakika talebi beklediklerini, ancak erken rezervasyonun değerini korumak için agresif indirime gitmeyeceklerini açıkladı.',
        impact: 'neutral',
        source: 'Turizm Günlüğü',
        sourceUrl: 'https://www.turizmgunlugu.com/2026/05/10/tui-ve-dertour-kararli-son-dakika-indirimleri-erken-rezervasyonu-ezmemeli/',
        date: '2026-05-10',
      },
    ],
    creditImplication:
      'Talep zayıflığı ve son dakikaya kayan satışlar acentelerin nakit girişini geciktiriyor. Erken rezervasyon ve iptal oranları ile TÜRSAB belge durumu yakından izlenmeli; kış turizmi ayrı değerlendirilmeli.',
  },

  restaurant: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'rest-cpi-services',
        title: 'Lokanta fiyatları enflasyonun gerisinde',
        summary:
          'TÜİK verilerine göre ağustosta lokanta ve konaklama grubunda yıllık fiyat artışı %31,16 ile genel enflasyonun (%31,51) altında kaldı.',
        impact: 'neutral',
        source: 'TÜİK (Turizm Güncel haberi)',
        sourceUrl: 'https://www.turizmguncel.com/haber/agustos-2026da-otel-fiyatlari-ne-kadar-artti-tuik-acikladi',
        date: '2026-09-03',
      },
      {
        id: 'rest-food-inflation',
        title: 'Gıda fiyatları yıllık %33,8 arttı',
        summary:
          'Ağustosta gıda ve alkolsüz içeceklerde yıllık fiyat artışı %33,79 oldu; girdi fiyatları lokanta fiyatlarındaki artışın üzerinde seyrediyor.',
        impact: 'negative',
        source: 'TÜİK (Bigpara haberi)',
        sourceUrl: 'https://bigpara.hurriyet.com.tr/haberler/emtia-haberleri/agustos-ayi-enflasyonu-belli-oldu_ID102241364/',
        date: '2026-09-03',
      },
      {
        id: 'rest-energy',
        title: 'Enerji fiyatları yeniden yükseldi',
        summary:
          'TCMB’ye göre jeopolitik gelişmelerle enerji fiyatları ağustosta akaryakıt öncülüğünde %5,46 arttı; kira ve lokanta-oteller gibi bazı hizmet kalemlerinde ise fiyat artışları yavaşlıyor.',
        impact: 'negative',
        source: 'TCMB Ağustos Ayı Fiyat Gelişmeleri',
        sourceUrl: 'https://www.tcmb.gov.tr/wps/wcm/connect/3331cabe-45d7-409a-8cd6-2bcd1774ec33/afiyatagustos26.pdf?MOD=AJPERES',
        date: '2026-09-04',
      },
      {
        id: 'rest-minimum-wage',
        title: 'Asgari ücrete ara zam yapılmadı',
        summary:
          'Temmuzda asgari ücrete ara zam yapılmadı; net asgari ücret 28.075,50 TL’de kaldı. Personel maliyeti yıl sonuna kadar öngörülebilir kalırken hane gelirlerindeki reel erime talebi baskılayabilir.',
        impact: 'neutral',
        source: 'Karar',
        sourceUrl: 'https://www.karar.com/ekonomi-haberleri/2026-asgari-ucrete-temmuz-ayinda-ara-zam-var-mi-bakanligin-karari-2057700',
        date: '2026-07-03',
      },
    ],
    creditImplication:
      'Maliyet artışı fiyatlama gücünün önünde gidiyor; marjların daralması ve nakit tamponunun incelmesi beklenebilir. POS işlem adedi ile ortalama adisyon birlikte izlenmeli.',
  },

  buildingMaterials: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'build-permits-q2',
        title: 'Yeni yapı ruhsatları geriledi',
        summary:
          'TÜİK’e göre 2026’nın ikinci çeyreğinde yapı ruhsatı verilen daire sayısı yıllık %9,5, yüzölçüm %7,4 azaldı; yapı kullanma izinlerinde ise yüzölçüm %5,8 arttı.',
        impact: 'negative',
        source: 'TÜİK (Emlak Pencerem haberi)',
        sourceUrl: 'https://www.emlakpencerem.com.tr/yapi-ruhsati-verilen-bina-sayisinda-dusus/116881',
        date: '2026-08-21',
      },
      {
        id: 'build-cost-index',
        title: 'İnşaat maliyetleri yıllık %28 arttı',
        summary:
          'TÜİK’e göre temmuzda inşaat maliyet endeksi yıllık %28,33 arttı; malzeme endeksi %27,13, işçilik endeksi %30,51 yükseldi.',
        impact: 'neutral',
        source: 'TÜİK (Forbes Türkiye haberi)',
        sourceUrl: 'https://www.forbes.com.tr/ekonomi/insaat-maliyet-endeksi-temmuz-ayinda-yuzde-28-33-artti',
        date: '2026-09-09',
      },
      {
        id: 'build-housing-sales',
        title: 'Konut satışları ağustosta %14,7 düştü',
        summary:
          'TÜİK’e göre ağustosta konut satışları yıllık %14,7 azalarak 127.410’a geriledi; ipotekli satışlar ise %7,2 artışla 22.131 oldu.',
        impact: 'negative',
        source: 'TÜİK (Alomaliye haberi)',
        sourceUrl: 'https://www.alomaliye.com/2026/09/17/konut-satislarinda-agustos-freni/',
        date: '2026-09-17',
      },
    ],
    creditImplication:
      'Yeni ruhsatlardaki düşüş önümüzdeki dönemde malzeme talebini zayıflatabilir. Çek ödeme performansı ve e-irsaliye hacmi erken uyarı olarak izlenmeli, vadeli satışlardan doğan alacak riski dikkate alınmalı.',
  },

  textileExport: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'tex-pmi-august',
        title: 'Tekstil PMI ağustosta 44,1’e geriledi',
        summary:
          'İSO verilerine göre Tekstil Ürünleri PMI temmuzdaki 48,0’dan ağustosta 44,1’e düştü; yeni siparişler endeksi 40,5’e geriledi.',
        impact: 'negative',
        source: 'İSO (ŞehirMedya haberi)',
        sourceUrl: 'https://www.sehirmedya.com/ozel-haber/tekstilde-siparis-daralmasi-uretimden-istihdama-yayildi-559004',
        date: '2026-09-16',
      },
      {
        id: 'tex-exports-h1',
        title: 'Hazır giyim ihracatı ilk yarıda %1,6 geriledi',
        summary:
          'İHKİB’e göre hazır giyim ihracatı ilk yarıda %1,6 azalışla 7,98 milyar dolar oldu, haziranda ise %15,1 arttı. Sektör yılı yaklaşık 17 milyar dolarla kapatmayı öngörüyor.',
        impact: 'neutral',
        source: 'İHKİB (AA haberi)',
        sourceUrl: 'https://www.aa.com.tr/tr/ekonomi/hazir-giyim-ve-konfeksiyon-sektoru-yili-yaklasik-17-milyar-dolar-ihracatla-kapatmayi-ongoruyor/3999958',
        date: '2026-07-16',
      },
      {
        id: 'tex-employment',
        title: 'Sektörde istihdam kaybı sürüyor',
        summary:
          'SGK verilerine göre tekstil ve hazır giyimde Şubat 2026 itibarıyla yıllık yaklaşık 103.600 kişilik istihdam kaybı yaşandı; İSO istihdam endeksi ağustosta 47,1’e indi.',
        impact: 'negative',
        source: 'SGK / İHKİB / İSO (ŞehirMedya haberi)',
        sourceUrl: 'https://www.sehirmedya.com/ozel-haber/tekstilde-siparis-daralmasi-uretimden-istihdama-yayildi-559004',
        date: '2026-09-16',
      },
    ],
    creditImplication:
      'Sipariş daralması ve maliyet baskısı nakit döngüsünü uzatıyor. Sipariş birikimi, müşteri yoğunlaşması ve döviz pozisyonu yakından izlenmeli; ihracat alacakları için sigorta veya teminat değerlendirilmeli.',
  },

  agriFood: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'agri-crop-forecast',
        title: 'Buğday üretiminde güçlü artış bekleniyor',
        summary:
          'Bitkisel Üretim 1. Tahmini’ne göre 2026’da buğday üretiminin %26,7 artışla yaklaşık 22,8 milyon ton, tahıllar ve diğer bitkisel ürünlerin %12,6 artışla 75,4 milyon ton olması bekleniyor.',
        impact: 'positive',
        source: 'Tarım ve Orman Bakanlığı / TÜİK',
        sourceUrl: 'https://istatistik.tarimorman.gov.tr/Sayfa/Detay/2347',
        date: '2026-06-03',
      },
      {
        id: 'agri-tmo-prices',
        title: 'TMO hububat alım fiyatları açıklandı',
        summary:
          'TMO ekmeklik ve makarnalık buğday alım fiyatını ton başına 16.500 TL, arpayı 12.750 TL olarak belirledi; desteklerle üreticinin eline buğdayda 19.514 TL geçiyor ve ödemeler teslimattan sonra 45 gün içinde yapılıyor.',
        impact: 'neutral',
        source: 'Tarım ve Orman Bakanlığı',
        sourceUrl: 'https://www.tarimorman.gov.tr/Haber/7092/2026-Yili-Hububat-Alim-Ve-Satis-Fiyatlari-Belirlendi',
        date: '2026-06-02',
      },
      {
        id: 'agri-wheat-quality',
        title: 'Kaliteli buğday bulmak zorlaştı',
        summary:
          'Türkiye Un Sanayicileri Federasyonu Başkanı rekoltenin 24 milyon ton civarında olacağını ancak kaliteli buğday bulmanın zorlaştığını, un fiyatlarına %10–15 zam yapıldığını ve ağustosta un ihracatının yaklaşık yarıya düşmesinin beklendiğini söyledi.',
        impact: 'negative',
        source: 'TUSAF (Doğuş Haber Ajansı)',
        sourceUrl:
          'https://www.dogushaberajansi.com/ekonomi/turkiye-un-sanayicileri-federasyonu-baskani-mesut-cakmak-tan-bugday-uyarisi-kalite-sorunu-ve-ihracat-engelleri-sektoru-zorluyor-36131',
        date: '2026-08-05',
      },
      {
        id: 'agri-food-inflation',
        title: 'Gıda fiyatları yıllık %33,8 arttı',
        summary:
          'Ağustosta gıda ve alkolsüz içeceklerde yıllık fiyat artışı %33,79 oldu; bu durum toptancıların nominal cirosunu desteklerken stok ve işletme sermayesi ihtiyacını da büyütüyor.',
        impact: 'neutral',
        source: 'TÜİK (Bigpara haberi)',
        sourceUrl: 'https://bigpara.hurriyet.com.tr/haberler/emtia-haberleri/agustos-ayi-enflasyonu-belli-oldu_ID102241364/',
        date: '2026-09-03',
      },
    ],
    creditImplication:
      'Bol hasat alım hacmini artırıyor; ancak kalite sorunu ve ihracat zorlukları stok birikimi riskini büyütüyor. Hasat dönemi finansman ihtiyacı ile depo doluluğu birlikte değerlendirilmeli.',
  },

  logistics: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'log-diesel',
        title: 'Motorin fiyatlarında sert artış',
        summary: '1–4 Eylül arasında motorinin litre fiyatı ortalama 7,83 TL arttı; İstanbul’da litre fiyatı 88,75 TL’ye çıktı.',
        impact: 'negative',
        source: 'Motor1 Türkiye (Petrol Ofisi fiyatları)',
        sourceUrl: 'https://tr.motor1.com/news/807146/akaryakit-fiyatlari-4-eylul-2026/',
        date: '2026-09-04',
      },
      {
        id: 'log-energy-cpi',
        title: 'Akaryakıt artışı taşıma fiyatlarına yansıyor',
        summary:
          'TCMB, enerji fiyatlarının ağustosta akaryakıt öncülüğünde %5,46 arttığını ve bu artışın ulaştırma hizmetlerine yansımalarının sürdüğünü belirtti.',
        impact: 'negative',
        source: 'TCMB Ağustos Ayı Fiyat Gelişmeleri',
        sourceUrl: 'https://www.tcmb.gov.tr/wps/wcm/connect/3331cabe-45d7-409a-8cd6-2bcd1774ec33/afiyatagustos26.pdf?MOD=AJPERES',
        date: '2026-09-04',
      },
      {
        id: 'log-exports-august',
        title: 'İhracat ağustosta %8,1 arttı',
        summary:
          'Ticaret Bakanlığı’na göre ihracat ağustosta %8,1 artışla 23,5 milyar dolara, Ocak–Ağustos döneminde %4 artışla 185 milyar dolara ulaştı.',
        impact: 'positive',
        source: 'Ticaret Bakanlığı (ANKA haberi)',
        sourceUrl:
          'https://ankahaber.net/haber/ticaret-bakanligi-2026-yili-ocak-agustos-doneminde-ihracatin-yuzde-4-oraninda-artisla-185-milyar-dolar-oldugunu-duyurdu-1818dd00',
        date: '2026-09-08',
      },
      {
        id: 'log-transport-cpi',
        title: 'Ulaştırma fiyatları yıllık %35 arttı',
        summary:
          'TÜİK verilerine göre ağustosta ulaştırma grubunda yıllık fiyat artışı %35,08 oldu; taşımacıların maliyet artışını navlun fiyatlarına ne ölçüde yansıtabildiği marjları belirleyecek.',
        impact: 'neutral',
        source: 'TÜİK (Bigpara haberi)',
        sourceUrl: 'https://bigpara.hurriyet.com.tr/haberler/emtia-haberleri/agustos-ayi-enflasyonu-belli-oldu_ID102241364/',
        date: '2026-09-03',
      },
    ],
    creditImplication:
      'Yakıt maliyetindeki ani artışlar sabit fiyatlı navlun sözleşmelerinde marjı eritiyor. Tahsilat süresi ve yakıt farkını fiyata yansıtabilme kabiliyeti değerlendirmede öne çıkmalı.',
  },

  pharmacy: {
    lastUpdated: RESEARCHED,
    items: [
      {
        id: 'pharm-protocol',
        title: 'SGK–TEB ek protokolüyle hizmet bedelleri iyileşti',
        summary:
          'SGK ile Türk Eczacıları Birliği arasında 12 Mart 2026’da imzalanan 2026-1 Ek Protokol ile eczanelerin satış hasılatı oranları ve reçete hizmet bedelleri iyileştirildi.',
        impact: 'positive',
        source: 'Erzurum Eczacı Odası (TEB duyurusu)',
        sourceUrl: 'https://www.erzurumeo.org.tr/duyuru/sgk-ile-imzalanan-2026-1-ek-protokol-hakkinda-3621',
        date: '2026-03-12',
      },
      {
        id: 'pharm-euro-value',
        title: 'İlaç fiyatlarında avro değeri güncellendi',
        summary:
          'İlaç fiyatlandırmasında kullanılan avro değeri 13 Mart’ta 26,87 TL’ye, 1 Nisan 2026’dan itibaren 29,11 TL’ye çıkarıldı; hesaplamada esas alınan oran %60’tan %65’e yükseltildi.',
        impact: 'positive',
        source: 'Anadolu Ajansı',
        sourceUrl: 'https://www.aa.com.tr/tr/saglik/ilac-fiyatlandirmasinda-kullanilan-avro-kurunda-degisiklige-gidildi/3861456',
        date: '2026-03-12',
      },
      {
        id: 'pharm-sgk-payments',
        title: 'SGK ödemeleri takvime uygun yapılıyor',
        summary:
          'TEB duyurularına göre Haziran dönemine ait eczane katılım payı ve kan ürünü bedelleri 31 Temmuz’da, Temmuz dönemine ait olanlar 31 Ağustos’ta ödendi.',
        impact: 'neutral',
        source: 'TEB (Eczacı Dergisi haberi)',
        sourceUrl: 'https://eczacidergisi.com.tr/haberler/2026-yili-temmuz-ayi-odeme-bildirimi-hakkinda/',
        date: '2026-08-28',
      },
      {
        id: 'pharm-discount-dispute',
        title: 'Kamu kurum iskontosu ve aşı tedariki sorunu',
        summary:
          'Tüm Eczacı İşverenler Sendikası, bazı ilaçların depodan kamu kurum iskontosu uygulanmadan geldiğini ve grip aşısının yeterli miktarda temin edilemediğini açıkladı; aradaki fark eczacı ve hasta üzerinde kalıyor.',
        impact: 'negative',
        source: 'TEİS',
        sourceUrl:
          'https://www.teis.org.tr/post/tei-s-i-laca-ve-a%C5%9F%C4%B1ya-eri%C5%9Fimde-ya%C5%9Fanan-sorunlar%C4%B1n-bedeli-eczac%C4%B1ya-ve-vatanda%C5%9Fa-%C3%B6detilmemeli',
        date: '2026-09-25',
      },
    ],
    creditImplication:
      'Eczanelerin nakit döngüsü SGK ödeme takvimine bağlı ve son aylarda ödemeler düzenli. Protokol ve fiyat güncellemesi marjları destekliyor; iskonto uyuşmazlıkları ise işletme sermayesi ihtiyacını artırabilir.',
  },
}

/** Sektördeki olumsuz madde sayısı. */
export function negativeSignalCount(intel: SectorIntel): number {
  return intel.items.filter((i) => i.impact === 'negative').length
}

/** Yapı doğrulaması (localStorage'dan okunan veriyi kabul etmeden önce). */
export function isValidMarketIntel(value: unknown, sectorIds: readonly string[]): value is MarketIntel {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return sectorIds.every((id) => {
    const s = v[id] as SectorIntel | undefined
    return (
      !!s &&
      typeof s.lastUpdated === 'string' &&
      typeof s.creditImplication === 'string' &&
      Array.isArray(s.items) &&
      s.items.every(
        (i) =>
          i &&
          typeof i.id === 'string' &&
          typeof i.title === 'string' &&
          typeof i.summary === 'string' &&
          (i.impact === 'positive' || i.impact === 'neutral' || i.impact === 'negative') &&
          typeof i.source === 'string' &&
          typeof i.sourceUrl === 'string' &&
          typeof i.date === 'string',
      )
    )
  })
}
