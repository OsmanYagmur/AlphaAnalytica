# GÖREV
TEKNOFEST 2026 Finansal Teknolojiler Yarışması finalinde büyük ekranda sunulacak, tamamen çevrimdışı çalışan bir DEMO web uygulaması geliştir. Takım adı: AlphaAnalytica. Proje adı: "Dinamik Bilançolar ile Risk Analizi".

Uygulama, KOBİ'ler için ticari kredi tahsis sürecini simüle eder. Geleneksel finansal analizi (mizan + kurumlar vergisi beyannamesi) sektöre özgü alternatif veri analiziyle varsayılan olarak %50–%50 birleştirir; kredi skoru, limit ve teminat önerisi üretir.

Üç arayüz olacak:
1. Tahsis Yöneticisi
2. Portföy Yöneticisi
3. Model Yöneticisi (Master)

Tüm arayüz Türkçe olacak. Para birimi TL, sayı formatı tr-TR (1.250.000 ₺).

# TEKNİK ALTYAPI
- Vite + React + TypeScript + Tailwind CSS + Recharts + lucide-react ikonları.
- Backend yok. Tüm firma verisi /src/data altında JSON/TS mock dosyalarında.
- Tüm hesaplama /src/engine altında saf TypeScript fonksiyonlarında: traditionalScore.ts, alternativeScore.ts, seasonality.ts, limit.ts, collateral.ts. UI yalnızca sonuçları okur.
- Motor hiçbir ağırlığı, eşiği veya katsayıyı sabit kod olarak içermez. Tüm parametreler tek bir tipli model konfigürasyon nesnesinden okunur (/src/engine/modelConfig.ts). Aşağıdaki formül bölümündeki değerler bu konfigürasyonun varsayılanlarıdır (Model v1.0).
- Aktif model konfigürasyonu, model sürümleri ve tahsis kararları localStorage'da tutulur. Bir arayüzde yapılan değişiklik diğerlerine anında yansır.
- Uygulama internet OLMADAN çalışmalı. Fontlar @fontsource ile yerel paketlenir, CDN kullanılmaz.
- Gizli "Demo'yu sıfırla" kısayolu: Ctrl+Shift+R. Tüm kararları ve model konfigürasyonunu başlangıç durumuna (v1.0) döndürür. Ekranda bunun için buton olmaz.
- Responsive tasarım: öncelik 1920x1080 sunum ekranı, ayrıca 1366x768, tablet ve mobilde düzgün görünür.
- `npm run build` ile statik dist klasörü üretilir. README'de kurulum ve çalıştırma adımları yer alır.

# FORMÜLLERİN GÖRÜNÜRLÜĞÜ
- Tahsis Yöneticisi ve Portföy Yöneticisi arayüzlerinde hiçbir formül, ağırlık, katsayı veya eşik değeri görünmez. Bu ekranlar yalnızca skorları, harf notlarını, alt kategori çubuklarını ve niteliksel açıklamaları gösterir (ör. "Skoru en çok yükselten 3 faktör").
- Formüller ve parametreler YALNIZCA Model Yöneticisi panelinde görünür ve düzenlenebilir.
- Tüm formüller ayrıca proje kökündeki METODOLOJI.md dosyasında belgelenir.

# FORMÜLLER (varsayılan değerler = Model v1.0)
Normalizasyon: her gösterge, kırılım noktaları arasında parçalı doğrusal interpolasyonla 0–100 puana çevrilir. Uç değerler kırpılır.

## 1) Geleneksel Skor (G, 0–100)
Kaynak: mizan (hesap kodlarıyla) + Kurumlar Vergisi Beyannamesi (KVB).
- Likidite %20: Cari Oran (0,8→0; 1,0→40; 1,5→80; ≥2,0→100) ve Asit-Test Oranı (0,5→0; 1,0→80; ≥1,3→100), eşit ağırlık.
- Kaldıraç %25: Toplam Borç/Özkaynak (≤0,5→100; 1→80; 2→50; ≥4→0) ve Net Finansal Borç/FAVÖK (≤1→100; 3→50; ≥5→0), eşit ağırlık.
- Kârlılık %20: FAVÖK Marjı (≤0→0; %10→70; ≥%20→100), Net Kâr Marjı (≤0→0; %5→70; ≥%12→100), Aktif Kârlılığı (≤0→0; %5→70; ≥%10→100), eşit ağırlık.
- Faaliyet Etkinliği %15: Nakit Dönüşüm Süresi = Alacak Devir Günü + Stok Devir Günü − Borç Devir Günü. Sektör medyanına göre puanlanır: medyan→70; medyanın yarısı veya altı→100; medyanın 2 katı veya üstü→0.
- Borç Ödeme Gücü %10: Faiz Karşılama = FAVÖK / Finansman Giderleri (≤1→0; 3→70; ≥5→100).
- Beyan Tutarlılığı %10: |Mizan Net Satış − KVB Net Satış| / KVB Net Satış (≤%2→100; %10→40; ≥%20→0). KVB matrahı negatifse bu kategori en fazla 50 alabilir.

G = Σ (kategori puanı × kategori ağırlığı)

## 2) Alternatif Skor (A, 0–100)
A_ham = 0,55 × SP + 0,25 × SU + 0,20 × TR

- SP (Sektörel Performans): sektöre özgü 4–6 alternatif göstergenin ağırlıklı ortalaması. Her sektör için varsayılan ağırlıkları sen belirle; toplamları 1 olsun ve METODOLOJI.md'ye yazılsın.
- Sezonsallık: her sektörün 12 aylık beklenen sezon endeksi S_m vardır (ortalaması 1,00).
  - Beklenen_m = (Yıllık Ciro / 12) × S_m
  - Sapma_m = Gerçekleşen_m / Beklenen_m − 1
  - SU (Sezon Uyumu) = 100 × max(0; 1 − ortalama|Sapma_m| / 0,5)
  - Bu sayede kırtasiyenin eylül piki veya kış turizminin yaz düşüşü risk olarak cezalandırılmaz.
- TR (Arındırılmış Trend): SA_m = Gerçekleşen_m / S_m. Son 12 aylık SA_m serisine doğrusal regresyon uygulanır, eğim yıllık % büyümeye çevrilir (−%20→0; %0→50; +%20→100).
- Veri Kapsama Düzeltmesi: c = mevcut alternatif gösterge sayısı / toplam gösterge sayısı.
  A = c × A_ham + (1 − c) × 50. Veri eksikse skor nötr değere çekilir.

## 3) Nihai Skor ve Not
S = w_G × G + w_A × A (varsayılan w_G = 0,5; w_A = 0,5)

Harf notu: 90+ AAA | 80–89 AA | 70–79 A | 60–69 BBB | 50–59 BB | 40–49 B | <40 C (limit verilmez)

Temerrüt Olasılığı: PD = 1 / (1 + e^((S − 30) / 9))

Erken uyarı override: kritik sinyal varsa (beyan tutarsızlığı >%20, karşılıksız çek kaydı, vergi/SGK borcu) not en fazla BB olabilir. UI'da uyarı rozeti olarak gösterilir.

## 4) Limit
- K1 (İşletme Sermayesi İhtiyacı) = Net Satış × max(Nakit Dönüşüm Süresi; 30) / 365 × 1,2
- K2 (Özkaynak Kapasitesi) = Özkaynak × 1,5
- K3 (Borç Servis Kapasitesi) = max(0; FAVÖK × 0,6 − Mevcut Yıllık Kredi Ödemeleri) × 2
- Kapasite = min(K1; K2; K3)
- Not çarpanı f: AAA 1,00 | AA 0,90 | A 0,80 | BBB 0,65 | BB 0,50 | B 0,30 | C 0
- Sektör Risk Katsayısı (SRK): sektöre göre 0,85–1,05 (sektör tablosunda).
- Önerilen Limit = Kapasite × f × SRK, 50.000 TL'ye aşağı yuvarlanır.

## 5) Teminat, Vade, Fiyatlama, Ürün Kırılımı
- Teminat oranı (limitin yüzdesi): AAA %0 (müşterek kefalet) | AA %25 | A %50 | BBB %75 | BB %100 | B %125
- BBB ve altında ipotek zorunludur.
  - İpotek Tutarı = Limit × Teminat Oranı
  - Gerekli Ekspertiz Değeri = İpotek Tutarı / 0,70
- Vade: AAA–A 24 ay rotatif | BBB 12 ay | BB–B 6 ay
- Fiyatlama: TLREF + not bazlı spread (AAA +150 bp … B +650 bp, aradakiler doğrusal)
- Ürün kırılımı: varsayılan %50 rotatif kredi, %30 spot kredi, %20 gayrinakdi (teminat mektubu). Sektöre göre uyarlanır: turizmde sezon öncesi spot ağırlıklı, oto galeride stok finansmanı ağırlıklı.

# SEKTÖRLER (10 adet)
Her sektörün sezon profili ve alternatif göstergeleri:

1. E-ticaret: ürün yorum puanı ve trendi, yorum duygu skoru (olumsuz yorum oranı), sipariş adedi ve ortalama sepet tutarı, iade oranı, kargo teslim süresi ve zamanında teslim oranı, pazaryeri satıcı puanı. Sezon: Kasım–Aralık pik. SRK 0,95
2. Oto Galeri: aylık yeni ilan sayısı, satılan/kaldırılan ilan sayısı, ortalama ilanda kalma süresi (stok devir), stok değeri, fiyat indirimi sıklığı. Sezon: ilkbahar-yaz yüksek, yıl sonu kampanya. SRK 0,90
3. Kırtasiye: POS ciro ve işlem adedi, okul sezonu performansı (Ağustos sonu–Eylül ana pik, Şubat ikinci pik), stok devir hızı, tedarikçi ödeme düzeni. SRK 1,00
4. Turizm Acentesi (iki alt profil): rezervasyon hacmi, iptal oranı, erken rezervasyon oranı, müşteri yorum puanı, TÜRSAB belge durumu. Yaz profili Haziran–Eylül pik, kış profili Aralık–Mart pik; firmanın alt profiline göre endeks seçilir. SRK 0,85
5. Restoran/Kafe: harita ve yemek platformu puanları, online sipariş adedi, POS işlem sayısı, ortalama adisyon, SGK çalışan sayısı trendi. Sezon: hafif dalgalı, Ramazan ve yaz etkisi. SRK 0,90
6. Yapı Malzemesi: bölgesel yapı ruhsatı verisi, e-irsaliye hacmi, çek ödeme performansı, kamu ihale kazanımları. Sezon: ilkbahar–sonbahar yüksek, kış düşük. SRK 0,90
7. Tekstil/Hazır Giyim İhracatçısı: e-fatura/e-ihracat hacmi, ihracat beyannamesi sayısı, sipariş birikimi, müşteri yoğunlaşması, döviz pozisyonu. Sezon: koleksiyon öncesi sipariş dönemleri. SRK 0,95
8. Tarım/Gıda Toptan: hasat dönemi hacmi, ürün borsası fiyat trendi, depo doluluk oranı, e-irsaliye hacmi. Sezon: hasat ayları. SRK 0,90
9. Lojistik/Nakliye: filo kullanım oranı (telematik), sefer sayısı, yakıt harcaması/km, tahsilat süresi. Sezon: 4. çeyrek pik. SRK 1,00
10. Eczane: SGK reçete hacmi, SGK ödeme gecikmesi, stok devir hızı. Sezon: kış (grip dönemi) yüksek. SRK 1,05

# DEMO VERİSİ
Her sektörden en az 1, toplam 14 hayali firma olsun. Adlar gerçekçi ama hayali olsun ("Defne Kırtasiye Ltd. Şti.", "Kuzey Oto Galeri A.Ş." gibi). Gerçek marka veya pazaryeri adı kullanma, "Pazaryeri A" gibi genel ifadeler kullan.

Her firma için şunlar üretilecek:
- Künye: VKN (hayali), il, kuruluş yılı, çalışan sayısı
- Mizan özeti, gerçek hesap kodlarıyla: 100 Kasa, 102 Bankalar, 120 Alıcılar, 153 Ticari Mallar, 300 Banka Kredileri, 320 Satıcılar, 500 Sermaye, 600 Yurtiçi Satışlar, 621 SMM, 780 Finansman Giderleri vb.
- KVB özeti: net satış, matrah, ödenen vergi
- 24 aylık ciro serisi
- Sektöre özgü alternatif gösterge serileri

Veriyi, v1.0 modeliyle hesaplanan sonuçlar şu hikâyeleri anlatacak şekilde kalibre et:
- Kırtasiye: zayıf bilanço (G≈52) ama güçlü alternatif veri (A≈78). Geleneksel yöntemle reddedilecek firma, sistemde BBB alıyor. Demonun ana mesajı bu.
- Oto galeri: güçlü bilanço (G≈80) ama ilanda kalma süresi artıyor, satışlar düşüyor (A≈45). Erken uyarı çıkıyor, limit düşürülüyor.
- Kış turizmi acentesi: yaz aylarındaki düşük ciro sezonsallık sayesinde cezalandırılmıyor.
- E-ticaret: yorum puanı düşüyor, iade oranı artıyor, not bir kademe düşüyor.
- En az 1 firma C notu alıyor (red senaryosu), en az 1 firma AAA/AA alıyor.
- Başlangıçta 8 firma "Tahsis Bekliyor", diğerleri önceden karara bağlanmış olsun.

# GİRİŞ EKRANI
- Sade bir rol seçimi ekranı, üstte büyük AlphaAnalytica logosu.
- Üç kart: "Tahsis Yöneticisi", "Portföy Yöneticisi" ve "Model Yöneticisi".
- İlk ikisi şifresiz demo girişi.
- Model Yöneticisi kartı görsel olarak ayrışır (koyu zemin, kilit ikonu) ve demo PIN'i (1946) ister.

# A) TAHSİS YÖNETİCİSİ ARAYÜZÜ

## 1. Başvuru Kuyruğu
- Tablo: firma, sektör, talep tutarı, sistem notu, önerilen limit, bekleme süresi, durum.
- Sektör ve not filtresi, arama.

## 2. Firma Değerlendirme Ekranı
- Üst şerit: firma künyesi, nihai skor göstergesi (gauge), harf notu, PD, erken uyarı rozetleri, küçük bir aktif model sürümü etiketi (ör. "Model v1.2").
- Geleneksel Analiz sekmesi: mizan özet tablosu, KVB karşılaştırması, 6 alt kategori puan çubukları (yalnızca puan ve "Güçlü / Orta / Zayıf" etiketi).
- Alternatif Veri sekmesi: sektöre özgü gösterge kartları ve mini grafikler. Sezonsallık grafiği: beklenen ve gerçekleşen aylık ciro, iki çizgi.
- "Skoru etkileyen faktörler": pozitif ve negatif ilk 3, düz cümlelerle.
- Sistem Önerisi kartı: "AlphaAnalytica sistemi tarafından X TL limit uygun görülmüştür". Altında ürün kırılımı, teminat türü ve oranı, ipotek tutarı, gerekli ekspertiz değeri, vade, fiyatlama bandı.

## 3. Karar Paneli
- Onayla: sistem önerisiyle aynen onaylar.
- Reddet: red gerekçesi seçimi (açılır liste) ve açıklama zorunlu.
- Revize Et: limit, teminat oranı/türü, vade, ürün kırılımı ve özel şartlar (kovenant) düzenlenebilir. Sistem önerisinden sapma yüzdesi canlı gösterilir. Sapma %20'yi aşarsa gerekçe zorunlu olur.
- Karar sonrası kısa ve şık bir onay bildirimi.
- Firma bazında karar geçmişi (audit log: kim, ne zaman, ne değişti).

## 4. Analiz animasyonu
Analiz tetiklendiğinde 1–1,5 saniyelik adım adım yükleme animasyonu:
"Mizan okunuyor → Beyanname eşleştiriliyor → Alternatif veriler toplanıyor → Sezonsallık arındırılıyor → Skor hesaplanıyor"
Formül yok, yalnızca adım isimleri.

# B) PORTFÖY YÖNETİCİSİ ARAYÜZÜ

## 1. Portföy Özeti
Toplam limit, kullandırılan risk, not dağılımı grafiği, sektör dağılımı, erken uyarıdaki firmalar.

## 2. Firma Listesi
Durum rozetleri: Onaylandı / Revize Onay / Reddedildi / Beklemede.

## 3. Firma Detay Ekranı
- Mevcut skor ve not, 12 aylık skor trendi, aktif model sürümü etiketi.
- Yan yana iki sütun: "Sistem Görüşü" ve "Tahsis Yöneticisi Kararı". Farklılıklar vurgulanır (ör. limit 2.000.000 → 1.600.000 ₺).
- Onaylanan limit detayı: ürün bazında kırılım, teminat yapısı (ipotek yüzdesi, ipotek tutarı, gerekli ekspertiz değeri, kefalet), vade, fiyatlama, özel şartlar.
- Tahsisçinin gerekçe notu.
- Erken uyarı sinyalleri ve izlenmesi gereken göstergeler.
- Karar eski bir model sürümüyle verildiyse küçük bir bilgi satırı: "Karar v1.0 modeliyle verildi, güncel model önerisi: …"

# C) MODEL YÖNETİCİSİ (MASTER) ARAYÜZÜ
Tüm formüllerin, ağırlıkların ve eşiklerin görülebildiği ve düzenlenebildiği tek ekran. Sol kenar çubuğunda kendi menüsü olur.

## 1. Model Genel Bakış
- Aktif model sürümü, son değişiklik tarihi, değiştiren kişi.
- Portföy geneli: ortalama skor, not dağılımı, toplam önerilen limit, ortalama PD.
- Aktif modelle v1.0 arasındaki farkların özeti.

## 2. Ana Denge
- Geleneksel / Alternatif ağırlığı tek bir kaydırıcıyla (varsayılan %50 / %50). İki değer toplamı %100 olacak şekilde birlikte hareket eder.
- Nihai skor formülü okunabilir biçimde gösterilir: S = w_G × G + w_A × A

## 3. Geleneksel Skor Parametreleri
- 6 kategorinin ağırlıkları ve her kategorinin içindeki alt oranların ağırlıkları.
- Her oranın normalizasyon kırılım noktaları, düzenlenebilir tablo olarak (değer → puan). Yanında kırılımlardan çizilen küçük bir eğri grafiği; tablo değişince eğri anında güncellenir.
- Beyan tutarlılığı eşikleri ve negatif matrah tavanı.

## 4. Alternatif Skor Parametreleri
- SP / SU / TR ağırlıkları.
- SU toleransı (varsayılan 0,5) ve TR büyüme kırılım noktaları.
- Veri kapsama düzeltmesinin açık/kapalı anahtarı ve nötr değer (varsayılan 50).

## 5. Sektör Ayarları (10 sektör, sekmeli veya açılır liste)
Her sektör için:
- Alternatif gösterge ağırlıkları ve her göstergenin normalizasyon kırılımları.
- 12 aylık sezon endeksi: düzenlenebilir çubuk grafik (sürükle veya sayı gir). Ortalama otomatik olarak 1,00'e normalize edilir.
- Turizmde yaz ve kış alt profillerinin ayrı endeksleri.
- SRK ve sektörel nakit dönüşüm süresi medyanı.
- Sektörel ürün kırılımı varsayılanları.

## 6. Not, PD ve Limit Parametreleri
- Harf notu eşikleri (sıralı olmalı, çakışamaz).
- PD parametreleri (merkez 30, ölçek 9) ve yanında skor–PD eğrisi.
- K1 çarpanı (1,2) ve minimum gün (30), K2 çarpanı (1,5), K3 FAVÖK oranı (0,6) ve çarpanı (2).
- Not çarpanları (f) ve yuvarlama birimi (50.000 TL).
- Erken uyarı override kuralları: hangi sinyal aktif, not tavanı ne olacak.

## 7. Teminat ve Fiyatlama
- Nota göre teminat oranları, ipotek zorunluluğunun başladığı not, ekspertiz LTV oranı (0,70).
- Nota göre vade ve spread (bp) tablosu.

## Doğrulama kuralları
- Toplamı %100 olması gereken her ağırlık grubunun yanında canlı toplam göstergesi. %100 değilse gösterge kırmızı olur ve kaydetme kapanır. Yanında "Orantılı olarak normalize et" butonu bulunur.
- Negatif, mantıksız veya sırası bozuk değerler satır içinde hata mesajıyla engellenir.
- Kaydedilmemiş değişiklik varken sayfadan çıkılırsa uyarı verilir.

## Etki Simülasyonu (en önemli özellik)
- Parametreler değiştikçe, kaydetmeden önce sağda canlı bir "Etki Önizleme" paneli gösterilir.
- Tablo: tüm firmalar için mevcut skor → yeni skor, mevcut not → yeni not, mevcut limit → yeni limit, değişim yüzdesi. Not değişen satırlar vurgulanır.
- Özet kartları: not yükselen, düşen ve değişmeyen firma sayısı; toplam limit değişimi; ortalama PD değişimi.
- Tek firma odak modu: seçilen firmanın skor değişimi kategori bazında şelale (waterfall) grafiğiyle gösterilir.
- Duyarlılık analizi: seçilen bir parametre min–max arasında kaydırıldığında seçili firmanın skorunun değişimini gösteren çizgi grafik.

## Sürümleme ve denetim izi
- "Yeni sürüm olarak kaydet": sürüm numarası otomatik artar (v1.1, v1.2 …), değişiklik notu zorunludur.
- Sürüm listesi: tarih, not ve bir önceki sürümle parametre farkları (diff görünümü: eski → yeni).
- Herhangi bir sürümü aktif yapma ve v1.0 varsayılanlarına geri dönme. Her ikisi de onay penceresi ister.
- Konfigürasyonu JSON olarak dışa ve içe aktarma. İçe aktarımda şema doğrulaması yapılır.

## Diğer arayüzlere etkisi
- Karara bağlanmış firmalarda karar, verildiği andaki model sürümüyle birlikte saklanır ve değişmez.
- Beklemedeki başvurular her zaman aktif modelle yeniden hesaplanır.
- Tahsis ve Portföy ekranlarında yalnızca aktif model sürüm numarası görünür, parametreler görünmez.

# TASARIM (ÇOK ÖNEMLİ)
Görünüm bir bankanın iç kurumsal yazılımı gibi olmalı. "Yapay zekâ yapmış" görüntüsünden kesinlikle kaçın:
- Mor/pembe gradyan, neon renk, glassmorphism, parlama efekti, emoji ve "✨" tarzı ikon YOK.
- Renk paleti:
  - Zemin #F6F5F1 (sıcak kırık beyaz), kart zemini #FFFFFF
  - Ana renk lacivert #12233D, kenar çubuğu #0E1B2E
  - Metin #1D2433, ikincil metin #5B6475, çizgiler #E3E1DA
  - Vurgu rengi koyu petrol yeşili #1F6F6B
  - Durum renkleri: olumlu #1E7B4F, uyarı #B7791F, olumsuz #B42318. Doygunlukları düşük tut.
- Tipografi: IBM Plex Sans (metin), IBM Plex Mono (tutarlar, skorlar ve sayısal girişler için tabular rakamlar). Başlıklar ölçülü boyutta; dev hero başlık yok.
- Düzen: solda sabit koyu lacivert kenar çubuğu, sağda içerik. 8px ızgara, ince 1px çizgiler, köşe yuvarlama en fazla 6px, çok hafif gölge.
- Grafikler: tek renk ailesi (lacivert/petrol tonları), soluk gridline'lar, gereksiz animasyon yok.
- Model Yöneticisi paneli: yoğun ama düzenli tablolar ve form alanları, teknik bir kontrol merkezi hissi. Sayısal girişler sağa hizalı, ± adım butonlu. Değiştirilmiş ama kaydedilmemiş alanlar hafif bir vurgu rengiyle işaretlenir.
- Logo: SVG olarak kendin tasarla. Lacivert kare içinde stilize bir "α" harfi ve sağ üste doğru ince yükselen bir çizgi (analitik büyümeyi ima eden). Yanında "AlphaAnalytica" yazısı; "Alpha" kalın, "Analytica" normal ağırlıkta.
- Logo yerleşimi: kenar çubuğunun üstünde tam logo, giriş ekranında büyük logo.
- Tüm sayfaların sağ alt köşesinde küçük ve soluk bir etiket: "AlphaAnalytica · TEKNOFEST 2026 Finansal Teknolojiler". Bir köşede küçük bir "Demo Verisi" etiketi.
- Kenar çubuğunun altında "Sunum Modu" anahtarı: açılınca yazı tipi %15 büyür, yan paneller sadeleşir (projektör için).

# KALİTE KONTROL
- Tüm hesaplamalar motor fonksiyonlarından gelir; hiçbir skor veya limit UI'a elle yazılmaz.
- Her firma için v1.0 motor çıktısını doğrulayan bir test dosyası yaz (engine.test.ts).
- 1920x1080 ve 1366x768'de taşma veya kırık düzen olmadığını kontrol et.
- Konsolda hata olmasın.

# METODOLOJİ.md
Bitirdiğinde proje kökünde METODOLOJI.md oluştur. İçinde şunlar olsun:
- Tüm formüller.
- Model konfigürasyon şeması: her parametrenin anlamı ve varsayılan değeri, tablo halinde.
- Sektör gösterge ağırlıkları ve sezon endeksleri.
- Demo senaryoları.
- 5–6 dakikalık sunum akışı önerisi: hangi firmayı hangi sırayla açmalı. Son adım: Model Yöneticisi panelinde alternatif veri ağırlığını %50'den %30'a düşürüp kırtasiye firmasının notunun ve limitinin nasıl değiştiğini canlı göstermek.

Önce motor ve demo verisini kur, testleri çalıştır, sonra sırasıyla Tahsis, Portföy ve Model Yöneticisi arayüzlerini yap. Her aşamadan sonra dur ve bana özet ver.

# REVİZYONLAR
Bu bölüm, ilk şartnameden sonra onaylanan değişikliklerin kaydıdır. Yukarıdaki bölümlerle çelişen bir madde varsa revizyon geçerlidir; aynı konudaki daha yeni revizyon eskisini geçersiz kılar. Her yeni revizyon bir sonraki numarayla bu listenin sonuna eklenir; ardından testler ve build çalıştırılır ve commit atılır.

## R1 — Holding ölçeğinde demo firmaları (Eylül 2026)
- "DEMO VERİSİ"ndeki 14 KOBİ'ye ek olarak büyük hacimli 2 holding firması eklenir; toplam **16 firma**. Kuzeyhan Tekstil Holding A.Ş. (tekstil, İstanbul, 2.400 çalışan, 7 grup şirketi, onaylanmış) ve Çağlayan Gıda ve Tarım Holding A.Ş. (tarım/gıda, Konya, 1.150 çalışan, 5 grup şirketi, tahsis bekliyor). Başlangıç durumu: 9 bekleyen (8 KOBİ + Çağlayan), 7 karara bağlanmış.
- Her firmanın ölçeği (segment) vardır: çalışan sayısından <10 mikro, <50 küçük, <250 orta, diğerleri büyük işletme; holdinglerde "Holding" ve grup şirketi sayısı. Ölçek künyede ve listelerde rozet olarak gösterilir.
- Tahsis kuyruğunda ve Portföy özetinde ölçek filtresi vardır: Tümü / KOBİ / Holding.
- Formüller ölçekten bağımsızdır; holdingler için ayrı parametre yoktur. Milyar TL tutarları kısa gösterimde "mr ₺" ile yazılır; limit revize adımı tutara göre ölçeklenir.

## R2 — Kuruş hassasiyeti ve mizan PDF'leri (Eylül 2026)
- Demo verisindeki tüm TL tutarları yuvarlak değil, kuruş hassasiyetindedir (ör. 1.500 ₺ yerine 1.457,43 ₺). Mizan, borç/alacak hareket toplamları ve bakiyeleriyle kuruşu kuruşuna denktir; alt hesap bölüşümleri firmaya özgü sapmalar içerir.
- Mizan tablosu Borç, Alacak, Borç Bakiye, Alacak Bakiye sütunlarıyla ve iki ondalıkla gösterilir.
- Her firmanın 2025 mizanı gerçek bir muhasebe programı çıktısı biçiminde `docs/mizanlar/` altında PDF olarak bulunur (firma başına bir dosya + hepsini içeren `00_tum_firmalar_mizan_2025.pdf`). Üretici: `scripts/mizan_pdf.py`.

## R3 — Metodolojinin PDF sürümü (Eylül 2026)
- METODOLOJI.md'nin baskıya hazır PDF sürümü `docs/METODOLOJI.pdf` olarak tutulur (kapak, içindekiler, akış şeması, tablolar). Üretici: `scripts/metodoloji_pdf.py`. METODOLOJI.md değiştiğinde PDF yeniden üretilir.

## R4 — Gösterge açıklamaları (Eylül 2026)
- modelConfig'teki her sektör göstergesinde iki metin alanı vardır: `aciklama` (göstergenin neyi ölçtüğü; tek cümle, sade Türkçe; formül, ağırlık, eşik veya rakam içermez) ve `birimAciklamasi` (aylık verinin neyi hangi birimde ifade ettiği, ör. "Aylık ortalama kazanılan kamu ihalesi sayısı."). 10 sektörün 48 göstergesinin tamamı doldurulur. Bu alanlar yalnızca gösterim içindir: skoru etkilemez, sürüm farkında parametre değişikliği sayılmaz; alanlar eklenmeden önce kaydedilmiş sürümler ve JSON dosyaları yüklenirken eksik metinler v1.0'dan tamamlanır.
- Tahsis Yöneticisi Alternatif Veri sekmesindeki gösterge kartlarında ve Portföy Yöneticisi firma detayındaki "Erken uyarı ve izleme" kartında gösterge adının yanında küçük bir bilgi ikonu (lucide Info) bulunur; üzerine gelince, odaklanınca veya tıklayınca açıklama ve aylık veri birimi ipucu olarak görünür. Sunum Modu açıkken açıklama ipucu yerine gösterge adının altında soluk ikincil metin olarak sürekli görünür.
- Gösterge değerinin altında değerin ne olduğu yazar; metin ölçüm yönteminden türetilir (ör. "Geçen yılın aynı dönemine göre değişim · son 3 ay", "Son 3 ayın ortalaması", "Son durum").

## R5 — Gösterge dönem seçici (Eylül 2026)
- Portföy Yöneticisi firma detayındaki "Erken uyarı ve izleme" kartında ve Tahsis Yöneticisi Alternatif Veri sekmesinde (gösterge kartları "Sektör göstergeleri" kartında toplanır) segment kontrol görünümünde zaman aralığı seçici vardır: 1 ay | 3 ay | 6 ay | 12 ay, varsayılan 3 ay.
- Seçilen aralıkta her gösterge için dönem ortalaması (aylık verinin, `seriesUnit` biriminde), bir önceki eşit uzunluktaki döneme göre değişim yüzdesi ve küçük bir sparkline (önceki + seçili dönem, en az 6 ay, seçili dönem vurgulu) gösterilir. Veri 24 aylık serilerden okunur. Değişimin rengi göstergenin yönüne göredir.
- Kartın alt başlığında seçili dönem tarihleriyle yazar (ör. "Haz 26 – Ağu 26, önceki 3 aya göre").
- Güçlü / Orta / Zayıf etiketi seçili döneme göre yeniden hesaplanır: ölçüm yöntemi döneme uyarlanır (ortalama → dönem ortalaması; değişim → dönem uzunluğunda aynı karşılaştırma aralığı; eğilimli seviye → dönem uzunluğunda, en az 3 ay; son gözlem ve sezon dönemi değişmez), kırılımlar ve `presentation.strengthBands` sınırları modelConfig'ten gelir. Yeterli geçmiş yoksa "Yetersiz veri".
- Bu seçim yalnızca görüntülemeyi etkiler; kredi skoru, not ve limit motorun kendi pencereleriyle hesaplanmaya devam eder. Kartta "Dönem seçimi skoru etkilemez." notu bulunur; Tahsis kartlarında skora giren değer ve puanı ayrıca yazılır.
- Portföy kartında göstergeler seçili döneme göre zayıftan güçlüye sıralanır.
- Her göstergede aylık verinin birimi `seriesUnit` alanıyla tanımlıdır (yalnızca gösterim; eski kayıtlarda v1.0'dan tamamlanır). Hesaplama `src/engine/indicatorPeriod.ts` içinde saf fonksiyondur ve testlidir.

## R6 — Piyasa İstihbaratı modülü (Eylül 2026)
- 10 sektörün her biri için Türkiye'deki son 3–6 ayın gelişmeleri web araştırmasıyla derlenir ve `src/data/marketIntel.ts` dosyasına statik veri olarak yazılır (çalışma zamanında internetten çekilmez). Her sektörde 3–5 madde; her madde kısa başlık, 1–2 cümle özet (kendi cümlelerle), etki yönü (Olumlu / Nötr / Olumsuz), kaynak adı, kaynak bağlantısı ve tarih içerir. Sektör başına "Kredi açısından ne anlama geliyor" başlıklı 1–2 cümlelik yorum ve "Son güncelleme: [tarih]" bulunur. Yalnızca gerçek ve doğrulanabilir bilgi kullanılır; rakamların kaynağı mutlaka verilir.
- Görünüm: Tahsis Yöneticisi firma değerlendirme ekranında ayrı "Piyasa İstihbaratı" sekmesi; Portföy Yöneticisi firma detayında sağ sütunda kompakt kart; Portföy Özeti'nde sektör bazında olumsuz sinyal sayısını gösteren küçük özet.
- İçerik skoru etkilemez, yalnızca bilgi amaçlıdır; ekranlarda bu not yer alır.
- Model Yöneticisi'nde "Piyasa İstihbaratı" ekranı: madde ekleme, düzenleme, silme (onaylı), kredi yorumunu düzenleme ve sektör bazında araştırma verisine dönme. Değişiklikler localStorage'da tutulur, model denetim izine yazılır, model sürümlerine dahil değildir; demo sıfırlaması başlangıç verisini geri yükler.

## R7 — KKB Risk Raporu modülü (Eylül 2026)
- Firmaların diğer bankalardaki riskleri KKB risk raporu olarak gösterilir. Gerçek API bağlantısı yoktur, demo verisiyle simüle edilir; ekranlarda "KKB entegrasyonu – simülasyon verisi" etiketi bulunur.
- Veri (`src/data/kkb.ts`, 16 firmanın tamamı): banka bazında satırlar ("Banka A" …; gerçek banka adı kullanılmaz) — nakdi limit, nakdi risk, gayrinakdi limit, gayrinakdi risk, kredi türü, son 12 ay en yüksek gecikme günü, takip durumu; Findeks kredi notu (1–1900), son 3 ay kredi sorgu sayısı, karşılıksız çek ve protestolu senet sayısı, 24 aylık toplam risk serisi. Mizan ayında işletme sermayesi kredileri 300, taksitli krediler 303 + 400 bakiyesiyle tutarlıdır; hikâyelerle uyumludur (bilinçli tutarsızlık: Anadolu Yapı).
- Yeni erken uyarı sinyalleri: diğer bankada ciddi gecikme (30+ gün), yasal takip kaydı, son 3 ayda yoğun kredi sorgusu, toplam riskte hızlı artış, KKB toplam riski ile mizan banka kredileri arasında belirgin tutarsızlık, düşük Findeks. Her sinyalin not tavanı konfigüre edilir (v1.0: gecikme BB, yasal takip B, diğerleri izleme).
- Limit: K1 = max(0; brüt işletme sermayesi ihtiyacı − diğer bankalardaki işletme sermayesi (rotatif, spot, kart) nakdi riski × düşüm oranı). K3'teki mevcut yıllık kredi ödemeleri KKB'deki taksitli kredilerin önümüzdeki 12 aydaki anapara ödemelerinden türetilir. K2 değişmez. Formül ve gerekçe METODOLOJI.md Bölüm 6 ve 15'tedir.
- Findeks notu doğrudan skora eklenmez; bilgi ve erken uyarı eşiği olarak kullanılır. Model Yöneticisi'nde "skora dahil et" anahtarı (varsayılan kapalı) ve ağırlığı bulunur.
- Arayüz: Tahsis değerlendirme ekranında "KKB / Diğer Bankalar" sekmesi (banka tablosu, toplam limit, toplam risk, doluluk, gecikme geçmişi, risk trendi); üst şeritte Findeks notu ve KKB uyarı rozetleri. Portföy firma detayında kompakt KKB özeti; Portföy Özeti'nde "diğer bankalarda riski artan firmalar" listesi. Model Yöneticisi'nde "KKB Parametreleri" ekranı; etki simülasyonu bu parametreleri kapsar.
- KKB hikâyesi: Denizli Dokuma Tekstil — bilanço ve alternatif veri güçlü (skor notu A), başka bankada 47 güne varan gecikme nedeniyle not BB. Diğer hikâyelerin notları korunur; limit değişiklikleri önce/sonra tablosuyla METODOLOJI.md 10.1'de belgelenir.
- Başlangıç kararlarında Şifa Eczanesi revize limiti yeni sistem önerisine göre 1.250.000 ₺'dir. Demo verisi sürümü değiştiğinde tarayıcıda kayıtlı kararlar başlangıç durumuna döner (model sürümleri korunur).

## R8 — Giriş ekranı alt başlığı (Eylül 2026)
- Giriş ekranında logonun altında yalnızca "Dinamik Bilançolar ile Risk Analizi" yazar; "KOBİ ticari kredi tahsis platformu · rol seçin" satırı kaldırılmıştır (R1'den beri holdingler de değerlendirildiği için "KOBİ" ifadesi kapsamı yansıtmıyordu).

## R9 — Giriş ekranı: alt başlık ve büyük logo (Eylül 2026)
- R8'i günceller: logonun altında iki satır yer alır — "Dinamik Bilançolar ile Risk Analizi" ve daha soluk ikinci satırda "Alternatif veriyle desteklenen risk değerlendirme platformu".
- Giriş ekranındaki logo ve "AlphaAnalytica" yazısı ekrana göre büyütülür (mobilde daha küçük, geniş ekranlarda daha büyük; 1366×768'de kaydırma olmadan tek ekrana sığar).

## R10 — Taşma ve çakışma düzeltmeleri (Eylül 2026)
- Sayılar, etiketler ve seçim kutuları hiçbir ekran genişliğinde ve Sunum Modu'nda kutusundan taşmaz, kırpılmaz veya üst üste binmez (1920×1080, 1366×768, 1024 tablet ve 375 mobil; normal ve Sunum Modu'nda otomatik taramayla doğrulanır).
- Sayı giriş kutuları kendi genişliklerine göre uyarlanır: dar alanda ± düğmeleri gizlenir, değer tam görünür (klavyeyle girilir). Kırılım tablosu ile eğri yer yoksa alt alta; parametre satırlarında etiket yer yoksa girişin üstüne geçer.
- Kart ve sayfa başlıklarında eylemler sığmazsa alt satıra geçer; başlıklar kesilmez. Formül kutuları yatay kaydırma yerine satır kaydırır. Künye ve KPI ızgaraları hücre genişliğini içeriğe göre ayarlar; puan çubuklarında etiket ile puan gerektiğinde iki satıra ayrılır.

## R11 — Girişim tanıtım sayfası (Eylül 2026)
- Sitenin ana adresi (`#/`) girişim tanıtım sayfasıdır; rol seçimi ekranı `#/demo` adresine taşınır. Arayüz sayfalarına rol olmadan girilirse `#/demo`'ya yönlendirilir; "Rol değiştir" `#/demo`'ya döner; kenar çubuğundaki logo ve rol seçimindeki "Tanıtım sayfası" bağlantısı tanıtım sayfasına götürür.
- Sayfa TEKNOFEST final sunum şablonunun başlık sırasına sadıktır ama girişim tanıtımı dilindedir; puanlar, takım ID ve başvuru ID gösterilmez: Giriş (proje adı, açıklama, öne çıkan rakamlar, canlı örnek değerlendirme), Problem, Çözüm (dört temel yetenek, değerlendirme akışı, mevcut yaklaşımla karşılaştırma), Ürün (üç arayüz, altyapı özellikleri), Demo (senaryo kartları), Ticari potansiyel (hedef kitle: finans kuruluşları ve risk analizine ihtiyaç duyan her firma ve kurum; B2B satış süreci), Risk analizi (risk ve önlem tablosu), Ekip, Kapanış (slogan).
- Sayfadaki skor, not, limit ve sayılar motordan ve demo verisinden canlı hesaplanır, elle yazılmaz. Tasarım uygulamanın tasarım diliyle aynıdır; köşe etiketi (TEKNOFEST) bu sayfada gösterilmez.
- Demo senaryo kartları "Bu senaryoyu aç" ile ilgili rolü seçip doğrudan ilgili ekrana (gerekirse sekmeye) götürür. Firma değerlendirmesi adresinde sekme belirtilebilir: `#/tahsis/firma/:id/:sekme` (geleneksel, alternatif, kkb, piyasa).
- Ekip bölümü `src/pages/landing/content.ts` içindeki `TEAM` listesinden beslenir; liste boşken "yakında" notu gösterilir.

## R12 — Tanıtım sayfasında ölçek ifadesi (Eylül 2026)
- Tanıtım sayfasında ölçek aralığı "KOBİ’den holdinge" yerine "küçük işletmeden holdinge" olarak ifade edilir (öne çıkan rakamlar ve Ürün bölümündeki özellik kartı).

## R13 — Ziyaretçi istatistikleri (Eylül 2026)
- Yayındaki sitede (Vercel) Vercel Web Analytics kullanılır. Çevrimdışı çalışma kuralına tek istisnadır ve yalnızca Vercel'in derlemesinde (`VERCEL=1`) etkindir; yerel geliştirme, yerel derleme ve çevrimdışı sunumda analitik kodu pakete girmez, dışarıya istek gitmez, konsolda hata oluşmaz.
- Hash tabanlı sayfa geçişleri ayrı sayfa görüntülemesi olarak sayılır (otomatik takip kapalı, rota ve yol uygulama tarafından verilir); firma kimlikleri raporda `/tahsis/firma/[firma]` gibi kalıplarda toplanır.
- Derleme, uygulama kodu ve kütüphaneler olmak üzere iki pakete ayrılır (paket boyutu uyarısı olmadan).

## R14 — Dönem görünümünde mini grafik (Eylül 2026)
- R5'teki mini grafik tanımının yerine geçer: gösterge kartlarındaki mini grafiğin ekseni yalnızca seçili dönemin aylarından oluşur (3 ay seçilince 3 ay, 12 ay seçilince 12 ay). Önceki dönem grafikte gösterilmez; seçili dönem vurgusu (arka plandaki renkli bölge) kaldırılır.
- 1 ay seçildiğinde çizgi çizilebilmesi için grafik bir önceki ayı da içerir (2 nokta); bu, karttaki "önceki 1 aya göre" değişimle tutarlıdır.
- Tahsis (Alternatif Veri sekmesi) ve Portföy (firma detayı) ekranlarında aynı şekilde uygulanır. Skor, not ve limit etkilenmez.

## R15 — Tanıtım sayfası: tıklanabilir değerlendirme akışı ve tasarım rötuşu (Eylül 2026)
- Çözüm bölümündeki "Değerlendirme akışı" etkileşimli hale gelir. Beş adım (mizan ve beyanname, alternatif veri, KKB risk raporu, nihai skor/not/temerrüt olasılığı, limit ve kredi şartları) tıklanabilir sekmelerdir; lacivert renk yalnızca seçili adımı gösterir. Yanındaki panelde örnek firmanın (Defne Kırtasiye) o adımdaki sonucu motordan canlı hesaplanarak gösterilir: alt kategori çubukları, gösterge güç etiketleri, KKB özeti, skor/not/temerrüt olasılığı ve faktörler, limit ve kredi şartları. Formül, ağırlık veya eşik gösterilmez. "Bu adımı demoda aç" ilgili firma sekmesini açar; klavyeyle ok tuşları adımlar arasında gezer. Dar ekranda adım seçilince panele kaydırılır.
- "Mevcut yaklaşımdan farkı" tablosu akışın altında tam genişlikte yer alır; AlphaAnalytica sütunu açık vurgu rengiyle ayrılır.
- Farklı renkteki ya da kart görünümündeki bütün öğeler tıklanabilir: Ürün bölümündeki üç arayüz kartı ilgili arayüzü açar (Model Yöneticisi PIN gerektirdiği için rol seçimine gider); demo senaryo kartlarının tamamı tıklanabilir.
- Tasarım rötuşu (tasarım dili korunur): bölüm başlıkları numaralı (01 Problem … 07 Ekip); üst menüde bulunulan bölüm işaretlenir; bölümler görünür alana girerken hafifçe belirir (hareket azaltma tercihinde animasyon yok); giriş bölümünde soluk teknik ızgara zemini; Problem bölümü liste + örnek grafik yan yana; Çözüm'ün dört temel yeteneği tek çerçevede bölmeli şerit; B2B satış süreci bağlantılı adım çizgisi.

## R16 — Tanıtım sayfasında ekip bilgileri (Eylül 2026)
- R11'deki ekip tanımının yerine geçer: `TEAM` kaydında ad ve unvan zorunlu; etiket (ör. "Takım Kaptanı"), sorumluluk, eğitim ve bağlantılar (LinkedIn, kişisel web sitesi) isteğe bağlıdır. Unvanlar sunumda kullanılan İngilizce hâliyle yazılır.
- Ekip: Osman Yağmur (Takım Kaptanı · Team Lead & System Architect), Alp Hatipoğlu (Data Engineering & Integration Lead), Muhammed Mustafa Kaymaz (AI & Algorithm Lead), Aziz Mert Kayalar (Data Analyst). Kartlarda baş harfler, unvan, sorumluluk ve bağlantılar gösterilir; bağlantılar yeni sekmede açılır.

## R17 — Ekip bölümü alt alta ve fotoğraflı (Eylül 2026)
- Ekip üyeleri yan yana kartlar yerine tek çerçeve içinde alt alta satırlar olarak listelenir: solda kare fotoğraf (yoksa baş harfler), ortada ad, etiket, unvan ve sorumluluk, sağda bağlantılar. Dar ekranda satır içeriği dikey dizilir.
- Fotoğraflar `src/assets/team` altında kare (400×400) JPEG olarak tutulur, meta verisi (konum vb.) temizlenmiştir; `TEAM` kaydındaki isteğe bağlı `photo` alanıyla bağlanır. Osman Yağmur ve Alp Hatipoğlu'nun fotoğrafları eklendi.
- Fotoğrafı olmayan üyelerde ad ve soyadın baş harfleri gösterilir (ör. Muhammed Mustafa Kaymaz → MK).

## R18 — Resmî logo (Alpha Loop) (Eylül 2026)
- TASARIM bölümündeki "Logo: SVG olarak kendin tasarla…" maddesinin yerine geçer: sitede takımın resmî logo paketindeki **Alpha Loop** logosu (ana renk #12233D; "Alpha" kalın + "Analytica" ince, vektör kontur) kullanılır. Kılavuz gereği renk değiştirilmez; koyu zeminde (kenar çubuğu, tanıtım sayfası üst menüsü) beyaz, açık zeminde (rol seçimi) lacivert yatay logo kullanılır. Yatay logo en az 200 px genişliktedir.
- Logo dosyaları `src/assets/brand/` altındadır (paketteki SVG'lerin güvenli alan boşluğu kırpılmış kopyaları). Favicon paketteki lacivert kare ikon, iOS ana ekran ikonu 180 px uygulama ikonudur.

## R19 — Ekip kartlarında CV indirme (Eylül 2026)
- Tanıtım sayfasının Ekip bölümünde, CV'si eklenen üyenin kartında "CV indir" butonu yer alır; buton PDF'i "Ad Soyad - CV.pdf" adıyla indirir. CV'si olmayan üyede buton görünmez.
- CV dosyaları `public/cv/` altında PDF olarak tutulur; `TEAM` kaydındaki isteğe bağlı `cv` alanı dosya adını verir. Test, tanımlı her CV dosyasının var olduğunu doğrular.
- Osman Yağmur'un CV'si eklendi (`public/cv/osman-yagmur.pdf`). Sitede yayımlanan sürümde referansların ad, unvan ve telefon bilgileri PDF'ten kalıcı olarak silinmiş, yerine "Talep üzerine paylaşılır." yazılmıştır; kişisel telefon numarası da (simgesiyle birlikte) çıkarılmıştır; belge meta verisi sadeleştirilmiştir.

## R20 — Ekip görselleri (Eylül 2026)
- Muhammed Mustafa Kaymaz'ın fotoğrafı eklendi (kare, 400×400, meta verisi temizlenmiş). Fotoğrafı olmayan üyelerde baş harfler yerine nötr bir insan silueti gösterilir (şu an Aziz Mert Kayalar). R16'daki baş harf kuralının yerine geçer.
