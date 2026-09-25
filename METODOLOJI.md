# AlphaAnalytica — Metodoloji

**Dinamik Bilançolar ile Risk Analizi** · TEKNOFEST 2026 Finansal Teknolojiler Yarışması

Bu belge, AlphaAnalytica demo uygulamasındaki kredi değerlendirme modelinin (Model v1.0) tüm formüllerini, parametrelerini, sektör göstergelerini, demo senaryolarını ve önerilen sunum akışını açıklar. Belgedeki tüm varsayılan değerler `src/engine/modelConfig.ts` dosyasındaki `DEFAULT_MODEL_CONFIG` nesnesinden alınmıştır. Motor (`src/engine`) hiçbir ağırlık, eşik veya katsayıyı sabit kod olarak içermez; her parametre bu tipli konfigürasyondan okunur ve Model Yöneticisi panelinden düzenlenebilir.

> Görünürlük kuralı: Formüller, ağırlıklar, katsayılar ve eşikler yalnızca Model Yöneticisi panelinde ve bu belgede yer alır. Tahsis Yöneticisi ve Portföy Yöneticisi ekranları yalnızca skorları, harf notlarını, alt kategori çubuklarını ve niteliksel açıklamaları gösterir.

---

## 1. Değerlendirme akışı

```
Mizan + KVB ──► Geleneksel Skor (G) ─┐
                                     ├─► S = w_G·G + w_A·A ─► Harf notu ─► Erken uyarı override ─► PD
Alternatif veri ─► Alternatif Skor (A)┘                                          │
                                                                                 ▼
                                   Limit = min(K1; K2; K3) × f(not) × SRK ─► Teminat · Vade · Fiyat · Ürün kırılımı
```

Hattın tamamı `evaluateFirm()` (`src/engine/evaluate.ts`) fonksiyonundadır. UI yalnızca bu çıktıyı okur.

**Birim kuralı:** Oranlar ondalık kesir olarak tutulur (%20 → 0,20); puanlar 0–100 aralığındadır; tutarlar TL'dir.

## 2. Normalizasyon

Her gösterge, kırılım noktaları `(değer₁ → puan₁), (değer₂ → puan₂), …` arasında **parçalı doğrusal interpolasyonla** 0–100 puana çevrilir:

```
puan(x) = puanᵢ + (x − değerᵢ) / (değerᵢ₊₁ − değerᵢ) × (puanᵢ₊₁ − puanᵢ)      değerᵢ ≤ x ≤ değerᵢ₊₁
```

Uç değerler kırpılır: ilk noktanın solunda ilk puan, son noktanın sağında son puan kullanılır. Puanların monoton olması gerekmez (ör. depo doluluğunda ters U). Tanımsız oranlar (negatif özkaynak, negatif FAVÖK vb.) ±∞ kabul edilir ve eğrinin ilgili ucuna kırpılır.

## 3. Geleneksel Skor (G, 0–100)

Kaynak: hesap kodlu mizan (Tekdüzen Hesap Planı) ve Kurumlar Vergisi Beyannamesi (KVB) özeti.

```
G = Σ (kategori puanı × kategori ağırlığı)
Kategori puanı = Σ (oran puanı × oran ağırlığı)
```

### 3.1 Mizan eşlemesi

Varlık ve gider hesapları borç − alacak, kaynak ve gelir hesapları alacak − borç yönünde toplanır; düzenleyici (−) hesaplar (103, 122, 257, 610 vb.) böylece kendiliğinden düşülür.

| Kalem | Hesap kodları |
|---|---|
| Hazır değerler | 100–119 (10 Hazır Değerler + 11 Menkul Kıymetler) |
| Ticari alacaklar | 120–129 |
| Stoklar | 150–159 |
| Dönen varlıklar | 100–199 |
| Duran varlıklar | 200–299 |
| Kısa vadeli yabancı kaynaklar | 300–399 |
| Ticari borçlar | 320–329 |
| Uzun vadeli yabancı kaynaklar | 400–499 |
| Finansal borçlar | 300–309 + 400–409 |
| Özkaynaklar | 500–599 (590/591 yoksa dönem net kârı eklenir: kapanış öncesi mizan) |
| Net satışlar | 600–612 (60 Brüt Satışlar − 61 Satış İndirimleri) |
| Satışların maliyeti | 620–623 |
| Faaliyet giderleri | 630–632 |
| Finansman giderleri | 660–661 ve 780 (7/A) |
| Diğer / olağandışı gelir-gider | 640–649, 650–659, 670–679, 680–689 |
| Vergi karşılığı | 691 |

Mizanda yer almayan iki kalem firma verisinde ayrıca tutulur: **amortisman gideri** (FAVÖK için) ve **mevcut yıllık kredi ödemeleri** (K3 için).

### 3.2 Oran tanımları

| Oran | Formül |
|---|---|
| Cari Oran | Dönen Varlıklar / KVYK |
| Asit-Test Oranı | (Dönen Varlıklar − Stoklar) / KVYK |
| Toplam Borç / Özkaynak | (KVYK + UVYK) / Özkaynaklar |
| Net Finansal Borç / FAVÖK | (Finansal Borçlar − Hazır Değerler) / FAVÖK |
| FAVÖK | Net Satışlar − SMM − Faaliyet Giderleri + Amortisman |
| FAVÖK Marjı | FAVÖK / Net Satışlar |
| Net Kâr Marjı | Net Dönem Kârı / Net Satışlar |
| Aktif Kârlılığı | Net Dönem Kârı / Toplam Aktifler |
| Nakit Dönüşüm Süresi (NDS) | Alacak Devir Günü + Stok Devir Günü − Borç Devir Günü; alacak günü = Ticari Alacaklar / Net Satış × 365, stok ve borç günü SMM'ye göre |
| Faiz Karşılama | FAVÖK / Finansman Giderleri |
| Beyan sapması | \|Mizan Net Satış − KVB Net Satış\| / KVB Net Satış |

### 3.3 Kategoriler, ağırlıklar ve kırılımlar (v1.0)

| Kategori | Ağırlık | Oran (kategori içi ağırlık) | Kırılımlar (değer → puan) |
|---|---:|---|---|
| Likidite | %20 | Cari Oran (%50) | 0,8→0; 1,0→40; 1,5→80; ≥2,0→100 |
| | | Asit-Test Oranı (%50) | 0,5→0; 1,0→80; ≥1,3→100 |
| Kaldıraç | %25 | Toplam Borç / Özkaynak (%50) | ≤0,5→100; 1→80; 2→50; ≥4→0 |
| | | Net Finansal Borç / FAVÖK (%50) | ≤1→100; 3→50; ≥5→0 |
| Kârlılık | %20 | FAVÖK Marjı (1/3) | ≤%0→0; %10→70; ≥%20→100 |
| | | Net Kâr Marjı (1/3) | ≤%0→0; %5→70; ≥%12→100 |
| | | Aktif Kârlılığı (1/3) | ≤%0→0; %5→70; ≥%10→100 |
| Faaliyet Etkinliği | %15 | NDS / sektör medyanı | ≤0,5 (medyanın yarısı)→100; 1 (medyan)→70; ≥2 (2 katı)→0 |
| Borç Ödeme Gücü | %10 | Faiz Karşılama | ≤1→0; 3→70; ≥5→100 |
| Beyan Tutarlılığı | %10 | Beyan sapması | ≤%2→100; %10→40; ≥%20→0 |

**Negatif matrah tavanı:** KVB matrahı negatifse Beyan Tutarlılığı kategorisi en fazla **50** puan alabilir.

## 4. Alternatif Skor (A, 0–100)

```
A_ham = 0,55 × SP + 0,25 × SU + 0,20 × TR
A     = c × A_ham + (1 − c) × 50            (veri kapsama düzeltmesi açıkken)
c     = mevcut alternatif gösterge sayısı / toplam gösterge sayısı
```

### 4.1 Sektörel Performans (SP)

Sektöre özgü 4–6 göstergenin ağırlıklı ortalamasıdır. Her gösterge, firmanın aylık serisinden aşağıdaki **ölçüm yöntemlerinden** biriyle tek bir değere indirgenir, sonra normalize edilir. Eksik göstergeler SP'de ağırlık toplamından çıkarılır ve kapsama oranı `c` düşer.

| Ölçüm | Tanım |
|---|---|
| Son N ay ortalaması | Serinin son N değerinin ortalaması |
| Son gözlem | Son ayın değeri (ör. TÜRSAB belgesi geçerli = 1) |
| Yıllık / dönemsel değişim | Son N ay ortalaması / `lag` ay önceki aynı uzunluktaki dönem ortalaması − 1 (lag = 12 → geçen yılın aynı dönemi; sezonsallıktan etkilenmez) |
| Eğilimli seviye | Son N aya doğrusal regresyon; H ay sonrası için tahmin edilen değer. Seviye ve trendi birlikte yansıtır (ör. "yorum puanı ve trendi") |
| Sezon dönemi değişimi | Belirli takvim aylarının son 12 aydaki toplamının, önceki 12 aydaki aynı ayların toplamına göre değişimi (ör. okul sezonu, hasat dönemi) |

Kaynak seri tek bir seri, iki serinin çarpımı (sipariş adedi × ortalama sepet) veya oranı (stok değeri / ciro) olabilir. Sektör bazında göstergeler, ağırlıklar ve kırılımlar Bölüm 9'dadır.

### 4.2 Sezon Uyumu (SU)

Her sektörün 12 aylık beklenen sezon endeksi `S_m` vardır (ortalaması 1,00; turizmde yaz ve kış alt profilleri ayrı).

```
Yıllık Ciro = son 12 ayın cirosu
Beklenen_m  = (Yıllık Ciro / 12) × S_m
Sapma_m     = Gerçekleşen_m / Beklenen_m − 1
SU          = 100 × max(0; 1 − ortalama|Sapma_m| / 0,5)       (son 12 ay)
```

Kırtasiyenin eylül piki veya kış turizminin yaz düşüşü beklenen desenle uyumlu olduğu için risk olarak cezalandırılmaz.

### 4.3 Arındırılmış Trend (TR)

```
SA_m          = Gerçekleşen_m / S_m                     (sezonsallıktan arındırılmış ciro)
eğim          = son 12 aylık SA_m serisine doğrusal regresyon eğimi (TL/ay)
yıllık büyüme = eğim × 12 / ortalama(SA_m)
TR            = normalize(yıllık büyüme; −%20→0, %0→50, +%20→100)
```

## 5. Nihai Skor, Harf Notu, PD ve Erken Uyarı

```
S  = w_G × G + w_A × A          (v1.0: w_G = 0,50; w_A = 0,50)
PD = 1 / (1 + e^((S − 30) / 9))
```

| Not | Skor aralığı | Not çarpanı f |
|:-:|---|---:|
| AAA | 90+ | 1,00 |
| AA | 80–89 | 0,90 |
| A | 70–79 | 0,80 |
| BBB | 60–69 | 0,65 |
| BB | 50–59 | 0,50 |
| B | 40–49 | 0,30 |
| C | < 40 (limit verilmez) | 0 |

Ekranlarda skor bir ondalıkla **aşağı yuvarlanarak** gösterilir; böylece gösterilen skor ile harf notu çelişmez.

**Kritik erken uyarılar (not override):** Aşağıdakilerden biri varsa not en fazla **BB** olabilir; UI'da kırmızı uyarı rozeti gösterilir. Daha kötü bir not yükseltilmez; birden çok sinyalde en kısıtlayıcı tavan uygulanır. PD skordan hesaplanmaya devam eder.

| Sinyal | Koşul |
|---|---|
| Beyan tutarsızlığı | Beyan sapması > %20 |
| Karşılıksız çek kaydı | Kayıt var |
| Vergi / SGK borcu | Vadesi geçmiş vergi veya SGK borcu var |

**İzleme sinyalleri (notu değiştirmez):** Rozet ve "izlenmesi gereken gösterge" olarak gösterilir.

| Sinyal | Koşul (v1.0) |
|---|---|
| Zayıflayan alternatif gösterge | Gösterge puanı ≤ 35 |
| Arındırılmış ciro trendi negatif | Yıllık büyüme ≤ −%10 |
| Alternatif veri bilançoyu teyit etmiyor | G − A ≥ 25 |

## 6. Limit

```
K1 (İşletme Sermayesi İhtiyacı)  = Net Satış × max(NDS; 30) / 365 × 1,2
K2 (Özkaynak Kapasitesi)         = Özkaynak × 1,5
K3 (Borç Servis Kapasitesi)      = max(0; FAVÖK × 0,6 − Mevcut Yıllık Kredi Ödemeleri) × 2
Kapasite                         = min(K1; K2; K3)
Önerilen Limit                   = Kapasite × f(not) × SRK   → 50.000 TL'ye aşağı yuvarlanır (negatifse 0)
```

**Mevcut Yıllık Kredi Ödemeleri:** Vadeli kredilerin önümüzdeki 12 aydaki anapara taksitleri. Yenilenen rotatif kısa vadeli krediler dahil edilmez; faiz yükü finansman gideri olarak Faiz Karşılama oranında izlenir.

**Sektör Risk Katsayısı (SRK):** E-ticaret 0,95 · Oto Galeri 0,90 · Kırtasiye 1,00 · Turizm 0,85 · Restoran/Kafe 0,90 · Yapı Malzemesi 0,90 · Tekstil 0,95 · Tarım/Gıda 0,90 · Lojistik 1,00 · Eczane 1,05.

## 7. Teminat, Vade, Fiyatlama, Ürün Kırılımı

| Not | Teminat oranı (limitin %'si) | Varsayılan teminat türü | Vade | Spread |
|:-:|---:|---|---|---:|
| AAA | %0 | Müşterek kefalet | 24 ay rotatif | TLREF + 150 bp |
| AA | %25 | Çek / senet temliki + müşterek kefalet | 24 ay rotatif | TLREF + 250 bp |
| A | %50 | Çek / senet temliki + müşterek kefalet | 24 ay rotatif | TLREF + 350 bp |
| BBB | %75 | Gayrimenkul ipoteği + müşterek kefalet | 12 ay | TLREF + 450 bp |
| BB | %100 | Gayrimenkul ipoteği + müşterek kefalet | 6 ay | TLREF + 550 bp |
| B | %125 | Gayrimenkul ipoteği + müşterek kefalet | 6 ay | TLREF + 650 bp |

```
BBB ve altında ipotek zorunludur.
İpotek Tutarı            = Limit × Teminat Oranı
Gerekli Ekspertiz Değeri = İpotek Tutarı / 0,70
```

**Ürün kırılımı:** Varsayılan %50 rotatif kredi, %30 spot kredi, %20 gayrinakdi (teminat mektubu). Sektöre göre uyarlanır: turizmde sezon öncesi spot ağırlıklı (%20 / %50 / %30), oto galeride stok finansmanı ağırlıklı (%60 stok finansmanı). Tüm sektörlerin kırılımı Bölüm 9'dadır.

**Revize kuralı:** Tahsis yöneticisi limit, teminat oranı/türü, vade, ürün kırılımı ve özel şartları revize edebilir. Limitin sistem önerisinden sapması %20'yi aşarsa gerekçe zorunludur.

## 8. Model konfigürasyon şeması

Konfigürasyon `ModelConfig` tipindedir (`src/engine/modelConfig.ts`). Aşağıdaki tablo her parametrenin anlamını ve v1.0 varsayılanını verir. Sektöre özgü parametreler Bölüm 9'dadır.

| Parametre (yol) | Anlam | v1.0 |
|---|---|---|
| `schemaVersion` | JSON içe aktarımında şema sürümü | 1 |
| `daysInYear` | Yıl gün sayısı (devir günleri ve K1) | 365 |
| `final.weights.traditional` | Nihai skorda geleneksel skor ağırlığı (w_G) | 0,50 |
| `final.weights.alternative` | Nihai skorda alternatif skor ağırlığı (w_A) | 0,50 |
| `traditional.categories.<kategori>.weight` | Geleneksel kategori ağırlığı | Likidite 0,20 · Kaldıraç 0,25 · Kârlılık 0,20 · Faaliyet 0,15 · Borç Ödeme 0,10 · Beyan 0,10 |
| `traditional.categories.<kategori>.ratios.<oran>.weight` | Kategori içi oran ağırlığı | Bölüm 3.3 |
| `traditional.categories.<kategori>.ratios.<oran>.breakpoints` | Oranın normalizasyon kırılımları (değer → puan) | Bölüm 3.3 |
| `traditional.negativeTaxBaseScoreCap` | Negatif matrahta Beyan Tutarlılığı tavanı | 50 |
| `alternative.weights.sp / su / tr` | A_ham içinde SP, SU, TR ağırlıkları | 0,55 / 0,25 / 0,20 |
| `alternative.seasonalFit.tolerance` | SU toleransı (ortalama mutlak sapma bu değerde SU = 0) | 0,5 |
| `alternative.seasonalFit.windowMonths` | SU değerlendirme penceresi | 12 ay |
| `alternative.trend.windowMonths` | TR regresyon penceresi | 12 ay |
| `alternative.trend.breakpoints` | Yıllık büyüme → TR puanı | −%20→0; %0→50; +%20→100 |
| `alternative.coverage.enabled` | Veri kapsama düzeltmesi açık/kapalı | açık |
| `alternative.coverage.neutralScore` | Veri eksikse skorun çekildiği nötr değer | 50 |
| `rating.minScore.<not>` | Harf notu alt sınırları (kesin azalan) | AAA 90 · AA 80 · A 70 · BBB 60 · BB 50 · B 40 |
| `rating.pd.center` | PD eğrisinin merkezi (PD = %50) | 30 |
| `rating.pd.scale` | PD eğrisinin ölçeği | 9 |
| `earlyWarning.critical.declarationInconsistency` | Beyan tutarsızlığı kuralı: etkin, eşik, not tavanı | açık · %20 · BB |
| `earlyWarning.critical.bouncedCheque` | Karşılıksız çek kuralı: etkin, not tavanı | açık · BB |
| `earlyWarning.critical.taxOrSgkDebt` | Vergi/SGK borcu kuralı: etkin, not tavanı | açık · BB |
| `earlyWarning.watch.weakIndicator.maxScore` | Zayıf gösterge eşiği | 35 |
| `earlyWarning.watch.negativeTrend.maxAnnualGrowth` | Negatif trend eşiği | −%10 |
| `earlyWarning.watch.scoreDivergence.minGap` | G − A uyumsuzluk eşiği | 25 |
| `limit.k1.multiplier` / `limit.k1.minDays` | K1 çarpanı / minimum gün | 1,2 / 30 |
| `limit.k2.equityMultiplier` | K2 özkaynak çarpanı | 1,5 |
| `limit.k3.ebitdaRatio` / `limit.k3.multiplier` | K3 FAVÖK oranı / çarpanı | 0,6 / 2 |
| `limit.gradeMultiplier.<not>` | Not çarpanı f | Bölüm 5 |
| `limit.roundingUnit` | Limit yuvarlama birimi | 50.000 TL |
| `terms.collateralRatio.<not>` | Teminat oranı | Bölüm 7 |
| `terms.collateralType.<not>` | Varsayılan teminat türü | Bölüm 7 |
| `terms.mortgageRequiredFrom` | İpotek zorunluluğunun başladığı not | BBB |
| `terms.appraisalLtv` | Ekspertiz LTV oranı | 0,70 |
| `terms.tenor.<not>` | Vade (ay) ve rotatif olup olmadığı | Bölüm 7 |
| `terms.pricing.referenceRate` | Referans faiz | TLREF |
| `terms.pricing.spreadBp.<not>` | Spread (baz puan) | Bölüm 7 |
| `terms.defaultProductMix` | Genel varsayılan ürün kırılımı | %50 rotatif / %30 spot / %20 gayrinakdi |
| `sectors.<sektör>.riskCoefficient` | Sektör Risk Katsayısı (SRK) | Bölüm 6 ve 9 |
| `sectors.<sektör>.cccMedianDays` | Sektörel NDS medyanı | Bölüm 9 |
| `sectors.<sektör>.indicators.<gösterge>` | Gösterge: etiket, ağırlık, veri kaynağı, ölçüm yöntemi, kırılımlar | Bölüm 9 |
| `sectors.<sektör>.indicators.<gösterge>.aciklama` / `.birimAciklamasi` / `.seriesUnit` | Göstergenin neyi ölçtüğü, aylık verinin açıklaması ve birimi (yalnızca gösterim; skoru etkilemez, sürüm farkında parametre sayılmaz) | Bölüm 9 |
| `sectors.<sektör>.seasonality.profiles.<profil>.index` | 12 aylık sezon endeksi (ortalama 1,00) | Bölüm 9 |
| `sectors.<sektör>.productMix` | Sektörel ürün kırılımı | Bölüm 9 |
| `presentation.strengthBands.strongMin / moderateMin` | "Güçlü / Orta / Zayıf" etiket sınırları | 70 / 40 |
| `presentation.topFactorCount` | "Skoru etkileyen faktörler" listesindeki faktör sayısı | 3 |
| `decision.revisionJustificationThreshold` | Revizede gerekçe zorunluluğu sapma eşiği | %20 |

**Doğrulama kuralları** (`validateModelConfig`): Toplamı %100 olması gereken her ağırlık grubu (nihai, kategori, kategori içi, SP/SU/TR, sektör göstergeleri, ürün kırılımları) 1'e eşit olmalıdır. Kırılım noktaları kesin artan sırada olmalı ve puanlar 0–100 aralığında kalmalıdır. Not eşikleri kesin azalan olmalı, not çarpanları artmamalı, teminat oranı ve spread nota göre azalmamalıdır. Sezon endeksi 12 pozitif değerden oluşmalı ve ortalaması 1,00 olmalıdır. Pozitif olması gereken katsayılar (PD ölçeği, K çarpanları, NDS medyanı, LTV) sıfırın üstünde olmalıdır. Hatalı konfigürasyon kaydedilemez ve içe aktarılamaz.

## 9. Sektör göstergeleri, ağırlıkları ve sezon endeksleri

Her sektörde 4–6 gösterge vardır ve ağırlık toplamı %100'dür. "Veri" sütunu, firma verisindeki aylık seri anahtarıdır (`revenue` = aylık ciro).

Tahsis Yöneticisi (Alternatif Veri sekmesi) ve Portföy Yöneticisi (Erken uyarı ve izleme kartı) ekranlarında her gösterge adının yanında bir bilgi ikonu vardır; üzerine gelince veya tıklayınca göstergenin ne ölçtüğü ve aylık verinin birimi görünür. Sunum Modu'nda açıklama adın altında sürekli yazılır. Gösterilen değerin ne olduğu (ör. "Geçen yılın aynı dönemine göre değişim · son 3 ay") değerin altında, ölçüm yönteminden türetilerek yazılır. Açıklamalar formül, ağırlık veya eşik içermez.

**Dönem görünümü (yalnızca görüntüleme).** Aynı iki ekranda 1 ay | 3 ay | 6 ay | 12 ay dönem seçici vardır (varsayılan 3 ay). Seçilen N ay için her göstergenin aylık verisinden dönem ortalaması, bir önceki eşit uzunluktaki döneme göre değişim yüzdesi ve mini grafik (önceki ve seçili dönem; en az 6 ay, seçili dönem vurgulu) gösterilir; veri firmanın 24 aylık serilerinden okunur. Kartın alt başlığında dönem tarihleri yazar (ör. "Haz 26 – Ağu 26, önceki 3 aya göre"). Güçlü / Orta / Zayıf etiketi, göstergenin ölçüm yöntemi seçili döneme uyarlanarak hesaplanan değerin kırılım eğrisi ve `presentation.strengthBands` sınırlarıyla yeniden belirlenir. Değişimin rengi göstergenin yönüne göredir (ör. iade oranındaki artış olumsuz). **Dönem seçimi skoru etkilemez:** kredi skoru, not ve limit motorun kendi ölçüm pencereleriyle (Bölüm 4) hesaplanmaya devam eder; kartlarda skora giren değer ayrıca gösterilir. Hesaplama `src/engine/indicatorPeriod.ts` içindedir.

### E-ticaret

SRK **0,95** · NDS medyanı **25 gün** · Ürün kırılımı: Rotatif kredi %45, Spot kredi %35, Gayrinakdi (teminat mektubu) %20

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| Ürün yorum puanı ve trendi | %20 | `reviewRating` | Son 6 aya doğrusal eğilim, 3 ay sonrası | 3,5→0; 4→45; 4,4→80; 4,7→100 |
| Yorum duygu skoru (olumsuz yorum oranı) | %15 | `negativeReviewRatio` | Son 3 ay ortalaması | %5→100; %10→70; %20→25; %30→0 |
| Sipariş adedi ve ortalama sepet tutarı | %20 | `orderCount` × `averageBasket` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→30; %0→50; %20→85; %40→100 |
| İade oranı | %20 | `returnRate` | Son 3 ay ortalaması | %3→100; %6→75; %10→40; %15→0 |
| Kargo teslim süresi ve zamanında teslim oranı | %10 | `onTimeDeliveryRate` | Son 3 ay ortalaması | %80→0; %90→50; %95→80; %98→100 |
| Pazaryeri satıcı puanı | %15 | `sellerScore` | Son 3 ay ortalaması | 7→0; 8→45; 9→85; 9,5→100 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| Ürün yorum puanı ve trendi | Pazaryerindeki ürün yorumlarının ortalama puanı ve bu puanın son aylardaki yönü; müşteri memnuniyetini gösterir. | Ay içindeki ürün yorumlarının ortalama puanı (5 üzerinden). |
| Yorum duygu skoru (olumsuz yorum oranı) | Müşteri yorumları içinde olumsuz olarak sınıflanan yorumların payı; ürün ve hizmet kalitesine yönelik şikâyet yoğunluğunu gösterir. | Ay içindeki olumsuz yorumların tüm yorumlara oranı (%). |
| Sipariş adedi ve ortalama sepet tutarı | Alınan sipariş sayısı ile sepet tutarlarının birlikte oluşturduğu sipariş hacmi; satışların gerçek yönünü gösterir. | Ay içinde alınan siparişlerin toplam tutarı (TL). |
| İade oranı | İade edilen siparişlerin payı; ürün kalitesini, ürün tanıtımının doğruluğunu ve müşteri memnuniyetini yansıtır. | Ay içinde iade edilen siparişlerin tüm siparişlere oranı (%). |
| Kargo teslim süresi ve zamanında teslim oranı | Siparişlerin söz verilen kargo süresi içinde müşteriye ulaşma oranı; operasyonel güvenilirliği gösterir. | Ay içinde zamanında teslim edilen siparişlerin oranı (%). |
| Pazaryeri satıcı puanı | Pazaryerinin satıcıya verdiği performans puanı; teslimat, iletişim ve iade süreçlerindeki genel başarıyı özetler. | Pazaryerinin aylık satıcı performans puanı (10 üzerinden). |

Sezon endeksi — Standart (Kasım–Aralık kampanya dönemi pik; ocak–şubat durgun):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,88 | 0,82 | 0,9 | 0,92 | 0,95 | 0,9 | 0,88 | 0,9 | 0,95 | 1 | 1,45 | 1,45 |

### Oto Galeri

SRK **0,90** · NDS medyanı **55 gün** · Ürün kırılımı: Rotatif kredi %20, Spot kredi %10, Gayrinakdi (teminat mektubu) %10, Stok finansmanı %60

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| Aylık yeni ilan sayısı | %15 | `newListings` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→55; %20→90; %30→100 |
| Satılan / kaldırılan ilan sayısı | %25 | `soldListings` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→55; %20→90; %30→100 |
| Ortalama ilanda kalma süresi (stok devir) | %25 | `daysOnMarket` | Son 6 aya doğrusal eğilim, 3 ay sonrası | 30→100; 45→75; 60→50; 90→15; 120→0 |
| Stok değeri | %15 | `inventoryValue` / `revenue` | Son 3 ay ortalaması | 1→100; 2→75; 3→45; 5→0 |
| Fiyat indirimi sıklığı | %20 | `priceCutRatio` | Son 3 ay ortalaması | %10→100; %20→75; %35→35; %50→0 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| Aylık yeni ilan sayısı | İlan platformlarına eklenen yeni araç ilanı sayısı; galerinin stok yenileme temposunu ve iş hacmini gösterir. | Ay içinde eklenen yeni araç ilanı sayısı (adet). |
| Satılan / kaldırılan ilan sayısı | Araç satıldığı için yayından kaldırılan ilan sayısı; fiili satış temposunu gösterir. | Ay içinde satılarak kaldırılan ilan sayısı (adet). |
| Ortalama ilanda kalma süresi (stok devir) | Bir aracın satılana kadar ilanda kaldığı süre; stokların ne kadar hızlı nakde döndüğünü gösterir. | Ay içinde satılan araçların ilanda kaldığı ortalama süre (gün). |
| Stok değeri | Galerinin elinde tuttuğu araç stokunun aylık satışlara kıyasla büyüklüğü; stokta bağlı kalan sermayeyi gösterir. | Ay sonu stok değerinin kaç aylık ciroya karşılık geldiği (kat). |
| Fiyat indirimi sıklığı | Fiyatı düşürülen ilanların payı; satış baskısını ve talepteki zayıflığı gösterir. | Ay içinde fiyatı düşürülen ilanların tüm ilanlara oranı (%). |

Sezon endeksi — Standart (İlkbahar–yaz yüksek; aralıkta yıl sonu kampanyası):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,75 | 0,8 | 1 | 1,1 | 1,15 | 1,15 | 1,1 | 1 | 0,9 | 0,9 | 0,95 | 1,2 |

### Kırtasiye

SRK **1,00** · NDS medyanı **70 gün** · Ürün kırılımı: Rotatif kredi %40, Spot kredi %40, Gayrinakdi (teminat mektubu) %20

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| POS ciro | %20 | `posRevenue` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%20→0; %0→50; %20→85; %40→100 |
| POS işlem adedi | %15 | `posTransactions` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%20→0; %0→55; %15→90; %25→100 |
| Okul sezonu performansı | %25 | `posRevenue` | Şub+Ağu+Eyl toplamı, önceki yıla göre değişim | −%20→0; %0→50; %20→85; %40→100 |
| Stok devir hızı | %15 | `inventoryTurnover` | Son 12 ay ortalaması | 2→0; 4→50; 6→80; 8→100 |
| Tedarikçi ödeme düzeni | %25 | `supplierOnTimePaymentRate` | Son 6 ay ortalaması | %70→0; %85→50; %95→85; %100→100 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| POS ciro | Mağazadaki POS cihazlarından geçen kartlı satış tutarı; satış hacmini doğrudan gösterir. | Aylık POS cirosu (TL). |
| POS işlem adedi | POS cihazlarında yapılan işlem sayısı; mağazaya gelen müşteri trafiğini gösterir. | Ay içindeki POS işlem sayısı (adet). |
| Okul sezonu performansı | Okul açılışı ve yarıyıl dönemlerinde elde edilen satışlar; sektörün en kritik sezonundaki performansı gösterir. | Aylık POS cirosu (TL); değerlendirme okul sezonu aylarına bakar. |
| Stok devir hızı | Stokların bir yıl içinde kaç kez satılıp yenilendiği; stok yönetiminin verimliliğini gösterir. | Stokların yıllık devir sayısı (kez). |
| Tedarikçi ödeme düzeni | Tedarikçilere yapılan ödemelerin vadesinde yapılma oranı; firmanın ödeme disiplinini ve nakit sıkışıklığı olup olmadığını gösterir. | Ay içinde vadesinde yapılan tedarikçi ödemelerinin oranı (%). |

Sezon endeksi — Standart (Ağustos sonu–Eylül ana pik (okul açılışı), Şubat ikinci pik):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,75 | 1,15 | 0,85 | 0,8 | 0,8 | 0,7 | 0,75 | 1,45 | 2 | 1 | 0,9 | 0,85 |

### Turizm Acentesi

SRK **0,85** · NDS medyanı **15 gün** · Ürün kırılımı: Rotatif kredi %20, Spot kredi %50, Gayrinakdi (teminat mektubu) %30

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| Rezervasyon hacmi | %25 | `bookings` | Son 6 ay / 12 ay önceki 6 ay − 1 | −%30→0; −%10→35; %0→55; %15→85; %30→100 |
| İptal oranı | %20 | `cancellationRate` | Son 12 ay ortalaması | %5→100; %10→75; %20→35; %30→0 |
| Erken rezervasyon oranı | %20 | `earlyBookingRate` | Son 12 ay ortalaması | %5→0; %15→40; %30→80; %45→100 |
| Müşteri yorum puanı | %20 | `customerRating` | Son 6 ay ortalaması | 3,5→0; 4→50; 4,5→85; 4,8→100 |
| TÜRSAB belge durumu | %15 | `tursabLicenseValid` | Son gözlem | 0→0; 1→100 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| Rezervasyon hacmi | Acentenin aldığı rezervasyon sayısı; gelecekteki satışların öncü göstergesidir. | Ay içinde alınan rezervasyon sayısı (adet). |
| İptal oranı | İptal edilen rezervasyonların payı; talebin sağlamlığını ve olası iade yükünü gösterir. | Ay içindeki iptallerin rezervasyonlara oranı (%). |
| Erken rezervasyon oranı | Sezondan önce yapılan erken rezervasyonların payı; gelirin önceden görülebilmesini ve nakdin erken gelmesini gösterir. | Ay içindeki erken rezervasyonların tüm rezervasyonlara oranı (%). |
| Müşteri yorum puanı | Müşterilerin tur ve hizmetlere verdiği ortalama puan; hizmet kalitesini ve acentenin itibarını gösterir. | Ay içindeki müşteri yorumlarının ortalama puanı (5 üzerinden). |
| TÜRSAB belge durumu | Acentenin TÜRSAB belgesinin geçerli olup olmadığı; yasal olarak faaliyet gösterebilmenin ön koşuludur. | Belgenin ay sonundaki durumu (geçerli / geçersiz). |

Sezon endeksi — Yaz turizmi (Haziran–Eylül pik; kış ayları düşük):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,45 | 0,5 | 0,65 | 0,85 | 1,1 | 1,5 | 1,85 | 1,9 | 1,4 | 0,85 | 0,5 | 0,45 |

Sezon endeksi — Kış turizmi (Aralık–Mart pik (kayak ve yılbaşı); yaz ayları düşük):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,8 | 1,75 | 1,3 | 0,75 | 0,55 | 0,45 | 0,4 | 0,45 | 0,6 | 0,8 | 1,1 | 2,05 |

### Restoran / Kafe

SRK **0,90** · NDS medyanı **10 gün** · Ürün kırılımı: Rotatif kredi %60, Spot kredi %30, Gayrinakdi (teminat mektubu) %10

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| Harita platformu puanı | %15 | `mapRating` | Son 3 ay ortalaması | 3,5→0; 4→50; 4,4→85; 4,7→100 |
| Yemek platformu puanı | %15 | `deliveryPlatformRating` | Son 3 ay ortalaması | 7→0; 8→50; 8,8→85; 9,4→100 |
| Online sipariş adedi | %20 | `onlineOrders` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→55; %25→100 |
| POS işlem sayısı | %20 | `posTransactions` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%25→0; −%10→35; %0→55; %20→100 |
| Ortalama adisyon | %10 | `posRevenue` / `posTransactions` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%10→0; %0→40; %20→80; %35→100 |
| SGK çalışan sayısı trendi | %20 | `sgkHeadcount` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→60; %15→100 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| Harita platformu puanı | Harita platformlarında işletmeye verilen ortalama puan; salondaki müşteri memnuniyetini gösterir. | Harita platformundaki aylık ortalama puan (5 üzerinden). |
| Yemek platformu puanı | Yemek sipariş platformundaki işletme puanı; paket servis kalitesini gösterir. | Yemek platformundaki aylık işletme puanı (10 üzerinden). |
| Online sipariş adedi | Yemek platformları üzerinden alınan sipariş sayısı; paket servis talebinin yönünü gösterir. | Ay içinde platformlardan alınan sipariş sayısı (adet). |
| POS işlem sayısı | Kasadaki POS işlem sayısı; işletmeye gelen müşteri trafiğini gösterir. | Ay içindeki POS işlem sayısı (adet). |
| Ortalama adisyon | Müşteri başına ortalama hesap tutarı; fiyatlama gücünü ve harcama eğilimini gösterir. | Ay içindeki işlem başına ortalama tutar (TL). |
| SGK çalışan sayısı trendi | SGK'ya bildirilen çalışan sayısı; işletmenin büyüdüğünü ya da küçüldüğünü gösterir. | Ay sonunda SGK'ya bildirilen çalışan sayısı (kişi). |

Sezon endeksi — Standart (Hafif dalgalı; Ramazan dönemi (Şubat–Mart) hafif düşüş, yaz aylarında artış):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,92 | 0,93 | 0,94 | 1 | 1,03 | 1,08 | 1,1 | 1,08 | 1,02 | 1 | 0,95 | 0,95 |

### Yapı Malzemesi

SRK **0,90** · NDS medyanı **90 gün** · Ürün kırılımı: Rotatif kredi %40, Spot kredi %25, Gayrinakdi (teminat mektubu) %35

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| Bölgesel yapı ruhsatı verisi | %20 | `regionalBuildingPermits` | Son 6 ay / 12 ay önceki 6 ay − 1 | −%30→0; −%10→35; %0→55; %20→100 |
| e-İrsaliye hacmi | %30 | `eDispatchCount` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→55; %20→100 |
| Çek ödeme performansı | %30 | `chequePaidOnTimeRate` | Son 6 ay ortalaması | %85→0; %95→60; %99→90; %100→100 |
| Kamu ihale kazanımları | %20 | `publicTenderWins` | Son 12 ay ortalaması | 0→30; 0,25→60; 0,5→80; 1→100 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| Bölgesel yapı ruhsatı verisi | Firmanın bulunduğu bölgede verilen yapı ruhsatı sayısı; yakın dönemde yapı malzemesine olacak talebin öncü göstergesidir. | Bölgede ay içinde verilen yapı ruhsatı sayısı (adet). |
| e-İrsaliye hacmi | Firmanın düzenlediği elektronik sevk irsaliyesi sayısı; fiili mal sevkiyatı ve taşıma yoğunluğunu gösterir. | Ay içinde düzenlenen e-irsaliye sayısı (adet). |
| Çek ödeme performansı | Firmanın verdiği çeklerin vadesinde ödenme oranı; ödeme disiplinini ve karşılıksız çek riskini gösterir. | Ay içinde vadesi gelen çeklerden zamanında ödenenlerin oranı (%). |
| Kamu ihale kazanımları | Firmanın kazandığı kamu ihaleleri; kamu projelerinden gelecek iş hacmini ve sözleşmeye bağlı geliri gösterir. | Aylık ortalama kazanılan kamu ihalesi sayısı. |

Sezon endeksi — Standart (İlkbahar–sonbahar inşaat sezonu yüksek; kış düşük):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,7 | 0,7 | 0,9 | 1,1 | 1,2 | 1,2 | 1,15 | 1,15 | 1,15 | 1,1 | 0,9 | 0,75 |

### Tekstil / Hazır Giyim İhracatçısı

SRK **0,95** · NDS medyanı **95 gün** · Ürün kırılımı: Rotatif kredi %40, Spot kredi %40, Gayrinakdi (teminat mektubu) %20

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| e-Fatura / e-İhracat hacmi | %25 | `eExportInvoiceAmount` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→55; %25→100 |
| İhracat beyannamesi sayısı | %15 | `exportDeclarations` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→55; %20→100 |
| Sipariş birikimi | %25 | `orderBacklogMonths` | Son 3 ay ortalaması | 0,5→0; 1,5→50; 3→85; 4→100 |
| Müşteri yoğunlaşması | %20 | `top3CustomerShare` | Son 3 ay ortalaması | %30→100; %50→70; %70→30; %90→0 |
| Döviz pozisyonu | %15 | `netFxShortToEquity` | Son gözlem | 0→100; 0,25→70; 0,5→35; 1→0 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| e-Fatura / e-İhracat hacmi | Düzenlenen e-Fatura ve e-İhracat faturalarının tutarı; gerçekleşen ihracat satışlarını gösterir. | Ay içinde düzenlenen ihracat faturalarının toplam tutarı (TL). |
| İhracat beyannamesi sayısı | Gümrükte açılan ihracat beyannamesi sayısı; fiili sevkiyatların sıklığını gösterir. | Ay içinde açılan ihracat beyannamesi sayısı (adet). |
| Sipariş birikimi | Alınmış ancak henüz üretilip sevk edilmemiş siparişlerin büyüklüğü; önümüzdeki aylarda gelirin ne kadar güvende olduğunu gösterir. | Ay sonundaki sipariş stokunun kaç aylık üretime karşılık geldiği (ay). |
| Müşteri yoğunlaşması | Satışların en büyük birkaç müşteride toplanma derecesi; tek müşteriye bağımlılık riskini gösterir. | En büyük üç müşterinin aylık satışlar içindeki payı (%). |
| Döviz pozisyonu | Döviz borçlarının döviz varlıklarını aşan kısmının özkaynağa göre büyüklüğü; kur artışlarına karşı kırılganlığı gösterir. | Ay sonundaki net döviz açığının özkaynağa oranı (kat). |

Sezon endeksi — Standart (İlkbahar/yaz ve sonbahar/kış koleksiyonları öncesi sevkiyat dönemleri (Şubat–Mart, Ağustos–Eylül)):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,9 | 1,1 | 1,2 | 1,05 | 0,9 | 0,85 | 1 | 1,1 | 1,2 | 1,05 | 0,85 | 0,8 |

### Tarım / Gıda Toptan

SRK **0,90** · NDS medyanı **60 gün** · Ürün kırılımı: Rotatif kredi %30, Spot kredi %50, Gayrinakdi (teminat mektubu) %20

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| Hasat dönemi hacmi | %30 | `purchaseVolumeTons` | Haz+Tem+Ağu+Eyl+Eki toplamı, önceki yıla göre değişim | −%30→0; −%10→35; %0→55; %20→100 |
| Ürün borsası fiyat trendi | %20 | `commodityPrice` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%20→0; %0→40; %30→85; %50→100 |
| Depo doluluk oranı | %20 | `warehouseOccupancy` | Son 12 ay ortalaması | %20→0; %50→60; %75→100; %90→80; %100→40 |
| e-İrsaliye hacmi | %30 | `eDispatchCount` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%30→0; −%10→35; %0→55; %20→100 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| Hasat dönemi hacmi | Hasat aylarında satın alınan ürün miktarı; firmanın ana sezondaki iş hacmini gösterir. | Ay içinde satın alınan ürün miktarı (ton); değerlendirme hasat aylarına bakar. |
| Ürün borsası fiyat trendi | Firmanın alıp sattığı ürünlerin borsadaki fiyat eğilimi; stok değerini ve satış gelirini doğrudan etkiler. | Ürün borsasındaki aylık ortalama fiyat (TL/kg). |
| Depo doluluk oranı | Depoların doluluk oranı; kapasitenin verimli kullanılıp kullanılmadığını gösterir, çok boş ya da tamamen dolu depo olumsuz işarettir. | Ay içindeki ortalama depo doluluk oranı (%). |
| e-İrsaliye hacmi | Firmanın düzenlediği elektronik sevk irsaliyesi sayısı; fiili mal sevkiyatı ve taşıma yoğunluğunu gösterir. | Ay içinde düzenlenen e-irsaliye sayısı (adet). |

Sezon endeksi — Standart (Hasat ayları (Haziran–Ekim) yüksek; kış ve ilkbahar düşük):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,75 | 0,7 | 0,75 | 0,8 | 0,9 | 1,2 | 1,4 | 1,35 | 1,3 | 1,2 | 0,9 | 0,75 |

### Lojistik / Nakliye

SRK **1,00** · NDS medyanı **50 gün** · Ürün kırılımı: Rotatif kredi %50, Spot kredi %25, Gayrinakdi (teminat mektubu) %25

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| Filo kullanım oranı (telematik) | %30 | `fleetUtilization` | Son 3 ay ortalaması | %50→0; %70→50; %85→85; %95→100 |
| Sefer sayısı | %25 | `tripCount` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%25→0; −%10→35; %0→55; %20→100 |
| Yakıt harcaması / km | %15 | `fuelLitresPer100Km` | Son 3 ay ortalaması | 28→100; 32→75; 36→40; 40→0 |
| Tahsilat süresi | %30 | `collectionDays` | Son 3 ay ortalaması | 30→100; 45→80; 60→55; 90→15; 120→0 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| Filo kullanım oranı (telematik) | Araç filosunun telematik verilerine göre aktif kullanılma oranı; kapasitenin ne kadarının gelir ürettiğini gösterir. | Ay içinde aktif kullanılan filo kapasitesinin oranı (%). |
| Sefer sayısı | Filonun gerçekleştirdiği sefer sayısı; taşıma hizmetine olan talebi gösterir. | Ay içinde yapılan sefer sayısı (adet). |
| Yakıt harcaması / km | Araçların yol başına yakıt tüketimi; filonun verimliliğini ve maliyet kontrolünü gösterir. | Aylık ortalama yakıt tüketimi (litre / 100 km). |
| Tahsilat süresi | Müşterilerden alacakların tahsil edilme süresi; nakit akışının hızını gösterir. | Ay içindeki ortalama tahsilat süresi (gün). |

Sezon endeksi — Standart (4. çeyrek pik (yıl sonu ticaret ve ihracat yoğunluğu)):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0,88 | 0,85 | 0,95 | 0,97 | 0,98 | 0,97 | 0,95 | 0,95 | 1,02 | 1,12 | 1,18 | 1,18 |

### Eczane

SRK **1,05** · NDS medyanı **35 gün** · Ürün kırılımı: Rotatif kredi %60, Spot kredi %25, Gayrinakdi (teminat mektubu) %15

| Gösterge | Ağırlık | Veri | Ölçüm | Kırılımlar (değer → puan) |
|---|---:|---|---|---|
| SGK reçete hacmi | %35 | `sgkPrescriptions` | Son 3 ay / 12 ay önceki 3 ay − 1 | −%20→0; −%5→40; %0→55; %15→100 |
| SGK ödeme gecikmesi | %25 | `sgkPaymentDelayDays` | Son 3 ay ortalaması | 0→100; 15→75; 30→40; 60→0 |
| Stok devir hızı | %20 | `inventoryTurnover` | Son 3 ay ortalaması | 4→0; 6→50; 9→85; 12→100 |
| Reçete dışı satış payı | %20 | `nonPrescriptionSalesShare` | Son 6 ay ortalaması | %0→0; %10→40; %20→75; %30→100 |

Göstergelerin ekranlardaki açıklamaları (bilgi ikonu):

| Gösterge | Ne ölçer | Aylık veri |
|---|---|---|
| SGK reçete hacmi | Eczanede karşılanan SGK reçetesi sayısı; eczanenin ana gelir kaynağının hacmini gösterir. | Ay içinde karşılanan SGK reçetesi sayısı (adet). |
| SGK ödeme gecikmesi | SGK'nın reçete bedellerini ödemesindeki gecikme; eczanenin nakit akışı üzerindeki baskıyı gösterir. | SGK ödemelerinin ay içindeki ortalama gecikmesi (gün). |
| Stok devir hızı | İlaç ve ürün stoklarının bir yıl içinde kaç kez yenilendiği; stok yönetiminin verimliliğini gösterir. | Stokların yıllık devir sayısı (kez). |
| Reçete dışı satış payı | Reçetesiz ürün ve dermokozmetik satışlarının toplam satışlar içindeki payı; eczanenin SGK'ya ne kadar az bağımlı olduğunu gösterir. | Ay içindeki reçete dışı satışların toplam satışlara oranı (%). |

Sezon endeksi — Standart (Kış (grip dönemi) yüksek; yaz ayları düşük):

| Oca | Şub | Mar | Nis | May | Haz | Tem | Ağu | Eyl | Eki | Kas | Ara |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,2 | 1,15 | 1,05 | 0,95 | 0,9 | 0,85 | 0,85 | 0,85 | 0,95 | 1 | 1,1 | 1,15 |

**Eczane notu:** Şartnamede eczane için üç gösterge sayılır (SGK reçete hacmi, SGK ödeme gecikmesi, stok devir hızı). Sektör başına 4–6 gösterge kuralını sağlamak için SGK bağımlılığını ölçen "Reçete dışı satış payı" eklenmiştir.

**Birleşik göstergeler:** E-ticarette şartnamedeki çift ölçütler tek göstergede birleştirilmiştir: "Ürün yorum puanı ve trendi" eğilimli seviye yöntemiyle, "Sipariş adedi ve ortalama sepet tutarı" iki serinin çarpımıyla (sipariş hacmi), "Kargo teslim süresi ve zamanında teslim oranı" taahhüt edilen süre içinde teslim oranıyla ölçülür.

## 10. Demo verisi ve senaryolar

16 hayali firma `src/data` altındadır: 10 sektörün tamamını kapsayan 14 KOBİ ve farklı bir kitleyi temsil eden 2 holding (milyar TL ölçeğinde ciro, binlerce çalışan, konsolide grup şirketleri). Her firmanın ölçeği künyede gösterilir: KOBİ'lerde çalışan sayısından türetilir (<10 mikro, <50 küçük, <250 orta işletme), holdinglerde "Holding" ve grup şirketi sayısıdır. Adlar, VKN'ler ve tüm rakamlar hayalidir; gerçek marka veya pazaryeri adı kullanılmaz ("Pazaryeri A", "Yemek Platformu A"). Her firma için künye (VKN, il, kuruluş yılı, çalışan sayısı), hesap kodlu ve denk mizan (2025), KVB özeti (net satış, matrah, ödenen vergi), 24 aylık ciro (Eylül 2024 – Ağustos 2026) ve sektöre özgü aylık gösterge serileri vardır. Seriler tohumlu (deterministik) üreteçlerle oluşturulur. Tüm TL tutarları kuruş hassasiyetindedir; mizan, borç/alacak hareket toplamları ve bakiyeleriyle kuruşu kuruşuna denktir ve alt hesap bölüşümleri firmaya özgü sapmalar içerir. Mizandaki 2025 net satışı aylık ciro serisinin 2025 toplamına eşittir. Her firmanın mizanı gerçek bir muhasebe programı çıktısı biçiminde `docs/mizanlar/` klasöründe PDF olarak bulunur.

Başlangıçta 9 firma "Tahsis Bekliyor" (8 KOBİ + Çağlayan Holding), 7 firma karara bağlanmıştır (4 onay, 2 revize onay, 1 red). Tahsis kuyruğunda ve Portföy özetinde ölçek filtresi (Tümü / KOBİ / Holding) vardır; KOBİ filtresi holdinglerin büyük limitlerinden bağımsız bir KOBİ portföyü görünümü verir. Karara bağlanmış firmaların sistem görüşü, kararın verildiği andaki veriyle ve Model v1.0 ile hesaplanır.

### 10.1 Model v1.0 çıktıları

| Firma | Sektör | Başlangıç | G | A | S | Not | PD | Önerilen limit |
|---|---|---|---:|---:|---:|:-:|---:|---:|
| Defne Kırtasiye Ltd. Şti. | Kırtasiye | Tahsis Bekliyor | 50,1 | 78,6 | 64,4 | BBB | %2,15 | 1.150.000 ₺ |
| Kuzey Oto Galeri A.Ş. | Oto Galeri | Tahsis Bekliyor | 82,4 | 45,7 | 64,1 | BBB | %2,22 | 1.550.000 ₺ |
| Palandöken Kar Turizm Seyahat Acentesi Ltd. Şti. (kış) | Turizm | Tahsis Bekliyor | 76,9 | 77,7 | 77,3 | A | %0,52 | 650.000 ₺ |
| Mavi Sepet E-Ticaret A.Ş. | E-ticaret | Onaylandı | 65,5 | 66,1 | 65,8 | BBB | %1,83 | 1.700.000 ₺ |
| Çınaraltı Restoran ve Kafe İşletmeleri Ltd. Şti. | Restoran / Kafe | Tahsis Bekliyor | 73,7 | 78,1 | 75,9 | A | %0,60 | 850.000 ₺ |
| Anadolu Yapı Market Ltd. Şti. | Yapı Malzemesi | Tahsis Bekliyor | 54,1 | 56,0 | 55,1 | BB | %5,80 | 750.000 ₺ |
| Toros Yapı Malzemeleri İnşaat Ltd. Şti. | Yapı Malzemesi | Tahsis Bekliyor | 11,6 | 25,7 | 18,7 | C | %77,89 | 0 ₺ |
| Denizli Dokuma Tekstil San. ve Tic. A.Ş. | Tekstil | Tahsis Bekliyor | 74,1 | 77,9 | 76,0 | A | %0,60 | 4.350.000 ₺ |
| Çukurova Tarım Ürünleri Toptan Ticaret Ltd. Şti. | Tarım / Gıda | Revize Onay | 61,0 | 74,0 | 67,5 | BBB | %1,53 | 1.700.000 ₺ |
| Marmara Lojistik ve Taşımacılık A.Ş. | Lojistik | Onaylandı | 94,0 | 92,9 | 93,5 | AAA | %0,09 | 6.950.000 ₺ |
| Şifa Eczanesi Sağlık Ürünleri Ltd. Şti. | Eczane | Revize Onay | 80,3 | 83,7 | 82,0 | AA | %0,31 | 2.250.000 ₺ |
| Bodrum Mavi Tur Seyahat Acentesi Ltd. Şti. (yaz) | Turizm | Onaylandı | 59,0 | 73,9 | 66,4 | BBB | %1,71 | 800.000 ₺ |
| Karadeniz Nakliyat ve Lojistik Ltd. Şti. | Lojistik | Tahsis Bekliyor | 88,8 | 80,8 | 84,8 | AA → BB | %0,23 | 1.550.000 ₺ |
| Kapadokya Lezzet Kafe Ltd. Şti. | Restoran / Kafe | Reddedildi | 46,2 | 47,4 | 46,8 | B | %13,39 | 150.000 ₺ |
| Kuzeyhan Tekstil Holding A.Ş. (holding) | Tekstil | Onaylandı | 85,5 | 87,2 | 86,3 | AA | %0,19 | 866.200.000 ₺ |
| Çağlayan Gıda ve Tarım Holding A.Ş. (holding) | Tarım / Gıda | Tahsis Bekliyor | 54,4 | 75,4 | 64,9 | BBB | %2,03 | 115.250.000 ₺ |

Bu değerler `src/engine/engine.test.ts` tarafından doğrulanır. Hiçbir firmanın skoru bir not eşiğine 0,5 puandan yakın değildir.

### 10.2 Hikâyeler

1. **Kırtasiye — ana mesaj.** Defne Kırtasiye'nin bilançosu zayıftır (G 50,1: düşük likidite, yüksek kaldıraç, uzun nakit dönüşüm süresi). Geleneksel skor tek başına BB verir, yani geleneksel yöntemle reddedilecek bir firmadır. Alternatif veri güçlüdür (A 78,6): POS ciro ve okul sezonu cirosu büyüyor, tedarikçi ödemeleri düzenli, eylül piki sezon profiline birebir uyuyor (SU > 90). Sistem BBB ve 1.150.000 ₺ limit önerir.
2. **Oto galeri — erken uyarı.** Kuzey Oto Galeri'nin bilançosu güçlüdür (G 82,4; tek başına AA). İlanda kalma süresi 42 günden 68 güne çıkıyor, satılan ilan ve arındırılmış ciro düşüyor, fiyat indirimleri artıyor (A 45,7). Üç izleme sinyali çıkar (zayıflayan gösterge: ilanda kalma süresi; negatif trend; alternatif veri bilançoyu teyit etmiyor). Not BBB'ye iner; limit, yalnız bilançoyla hesaplanacak limitin %80'inin altında kalır.
3. **Kış turizmi — sezonsallık.** Palandöken Kar Turizm'in haziran–ağustos cirosu yıllık ortalamanın %60'ının altındadır. Kış alt profiliyle bu düşüş beklenen desendir (SU > 90), not A'dır. Aynı firma yaz profiliyle değerlendirilseydi SU 20'nin altına düşer ve not kötüleşirdi.
4. **E-ticaret — not bir kademe düşüyor.** Mavi Sepet, Mart 2026'da Şubat verisiyle A notuyla onaylanmıştır. Son altı ayda yorum puanı 4,6'dan 4,0'a iniyor, iade ve olumsuz yorum oranları iki katından fazla artıyor. Güncel not BBB'dir; firma Portföy özetinde erken uyarı listesinde görünür.
5. **Uçlar ve override.** Toros Yapı C alır (zarar, karşılıksız çek, %28 beyan sapması; limit yok, red senaryosu). Marmara Lojistik AAA, Şifa Eczanesi AA alır. Karadeniz Nakliyat'ın skoru AA'dır ancak vadesi geçmiş vergi/SGK borcu (mizanda 368 hesabı) nedeniyle not BB ile sınırlanır.
6. **Holding ölçeği.** Kuzeyhan Tekstil Holding (7 grup şirketi, 2.400 çalışan, ~5,5 milyar ₺ net satış) güçlü bilanço ve alternatif veriyle AA alır; 866,2 milyon ₺ limitle onaylanmıştır ve kurumsal kredi komitesi adımı karar geçmişinde görünür. Çağlayan Gıda ve Tarım Holding (5 grup şirketi, 1.150 çalışan, ~3,2 milyar ₺ net satış) satın alma sonrası kaldıraçlı ve ince marjlıdır: geleneksel skor tek başına BB, alternatif veriyle BBB; borç servis kapasitesi (K3) nedeniyle önerilen limit 115,25 milyon ₺, talep edilen 250 milyon ₺'nin altındadır. Aynı formüller KOBİ'den holdinge kadar ölçekten bağımsız çalışır.
7. **Sunum finali.** Alternatif veri ağırlığı %50'den %30'a düşürüldüğünde Defne Kırtasiye'nin skoru 64,4'ten 58,7'ye iner; not BBB'den BB'ye, önerilen limit 1.150.000 ₺'den 850.000 ₺'ye düşer. Aynı değişiklik Kuzey Oto Galeri'yi BBB'den A'ya yükseltir.

## 11. Etki simülasyonu ve sürümleme

- **Etki Önizleme:** Model Yöneticisi'nde parametreler değiştikçe, kaydetmeden önce sağdaki panel aktif model ile düzenlenen değerleri tüm firmalar için karşılaştırır. Firma bazında skor, not ve limit değişimi; notu yükselen / düşen / değişmeyen firma sayısı; toplam limit değişimi ve ortalama PD değişimi gösterilir.
- **Şelale grafiği:** Nihai skor toplamsal bileşenlere ayrılır: `S = Σ w_G·w_c·G_c + w_A·k·(w_SP·SP + w_SU·SU + w_TR·TR) + w_A·(1 − k)·Nötr` (k = kapsama düzeltmesi açıksa c, kapalıysa 1). Seçili firmanın skor değişimi bu bileşenlerin değişimleri olarak gösterilir; adımların toplamı toplam değişime eşittir.
- **Duyarlılık analizi:** Seçilen parametre (ör. alternatif ağırlık, SP ağırlığı, SU toleransı, nötr değer, kategori ağırlıkları, sektör NDS medyanı) min–max arasında kaydırılır ve seçili firmanın skoru çizilir. Ağırlık gruplarında kalan pay diğer ağırlıklara orantılı dağıtılır.
- **Sürümleme:** "Yeni sürüm olarak kaydet" sürüm numarasını otomatik artırır (v1.1, v1.2 …) ve değişiklik notu ister. Sürüm listesinde her sürüm bir öncekiyle parametre farkı (eski → yeni) ile gösterilir. Herhangi bir sürüm aktif yapılabilir veya v1.0 varsayılanlarına dönülebilir; ikisi de onay penceresi ister. Tüm işlemler model denetim izine yazılır.
- **JSON dışa / içe aktarma:** Dışa aktarılan dosya `{ format, modelVersion, exportedAt, config }` biçimindedir. İçe aktarımda önce yapı (eksik / tanımsız alan, tür), sonra değer kuralları doğrulanır; geçerli dosya çalışma kopyasına yüklenir ve etkisi incelendikten sonra yeni sürüm olarak kaydedilir.
- **Diğer arayüzlere etkisi:** Karara bağlanmış firmalarda karar, verildiği andaki model sürümüyle birlikte saklanır ve değişmez. Beklemedeki başvurular her zaman aktif modelle yeniden hesaplanır. Tahsis ve Portföy ekranlarında yalnızca aktif model sürüm numarası görünür.

## 12. Sunum akışı (5–6 dakika)

| Süre | Adım | Ne gösterilir |
|---|---|---|
| 0:00–0:30 | Giriş ekranı → **Tahsis Yöneticisi** | Üç rol; kuyrukta 9 bekleyen başvuru (biri holding), sistem notları ve önerilen limitler, sektör/not/ölçek filtresi |
| 0:30–1:45 | **Defne Kırtasiye** | Analiz animasyonu. Üst şerit: S 64,4, BBB, PD %2,15. Geleneksel sekme: zayıf likidite ve kaldıraç çubukları. Alternatif sekme: POS ve okul sezonu kartları, sezonsallık grafiğinde eylül piki. Faktörler ve sistem önerisi: 1.150.000 ₺ (talep 2.000.000 ₺). Mesaj: "Geleneksel yöntemle reddedilecek firma, alternatif veriyle BBB alıyor." |
| 1:45–2:30 | **Kuzey Oto Galeri** | Güçlü bilanço ama izleme rozetleri; ilanda kalma süresi kartı ve mini grafiği; not BBB, limit 1.550.000 ₺. Mesaj: "Bilanço geçmişi, alternatif veri bugünü gösterir." |
| 2:30–3:00 | **Palandöken Kar Turizm** | Sezonsallık grafiği: yaz düşüşü beklenen çizgiyle örtüşüyor; SU yüksek, not A |
| 3:00–3:15 | Karar paneli | Kırtasiye için Revize Et: limiti düşürünce sapma yüzdesi canlı hesaplanıyor, %20 aşılınca gerekçe zorunlu oluyor (isteğe bağlı olarak onayla, bildirimi göster) |
| 3:15–4:00 | **Portföy Yöneticisi** | Özet: toplam limit, kullandırılan risk, erken uyarıda Mavi Sepet (A → BBB). Mavi Sepet detayı: 12 aylık skor trendi. Çukurova Tarım: Sistem Görüşü ve Tahsis Kararı karşılaştırması (1.700.000 → 1.300.000 ₺) |
| 4:00–5:30 | **Model Yöneticisi** (PIN 1946) | Ana Denge: alternatif ağırlığı %50'den %30'a çek. Sağdaki Etki Önizleme'de Defne Kırtasiye BBB → BB (limit −%26,1), Kuzey Oto BBB → A. İsteğe bağlı: Etki Simülasyonu'nda Defne için şelale grafiği. "Yeni sürüm" → not yaz → v1.1 aktif |
| 5:30–6:00 | Tahsis Yöneticisi'ne dön | Kuyrukta "Model v1.1" etiketi; Defne Kırtasiye BB ve 850.000 ₺. Karara bağlanmış firmalar v1.0 ile sabit. Kapanış |

Sunumdan önce **Ctrl+Shift+R** ile demo başlangıç durumuna (v1.0, başlangıç kararları) döndürülür. Projektörde kenar çubuğundaki **Sunum Modu** açılabilir.

## 13. Varsayımlar ve yorumlar

- **Trendin yıllığa çevrilmesi:** Şartname yöntemi belirtmez; aylık eğim × 12 / penceredeki ortalama arındırılmış ciro kullanılır.
- **SU için yıllık ciro:** Son 12 ayın cirosu (12 aydan kısa veride yıllıklandırılır).
- **Eksik göstergeler:** SP yalnızca mevcut göstergeler üzerinden ağırlıklanır; ardından kapsama oranı `c` skoru nötr değere çeker. Hiç gösterge yoksa SP nötr değeri alır.
- **Beyan tutarsızlığı:** Kritik sinyal için koşul "sapma > %20"dir (tam %20'de tetiklenmez).
- **Portföy skor trendi:** Her ay, o aya kadarki veriyle aktif modelden hesaplanır. Geçmiş noktalarda veri penceresi henüz dolmamış göstergeler firmada "eksik veri" sayılmaz; bu noktalarda kapsama düzeltmesi uygulanmaz. Son nokta güncel değerlendirmedir.
- **Kullandırılan risk:** Onaylı limitin kullanım oranı demo verisinde karar kaydıyla birlikte tutulur; yeni kararlarda %0 başlar.
- **Teminat türleri:** Şartname teminat türünü yalnız AAA için (müşterek kefalet) ve BBB altı için (ipotek) belirtir; AA ve A için "çek / senet temliki + müşterek kefalet" varsayılmıştır. Oto galeri stok finansmanı için dördüncü ürün olarak "Stok finansmanı" eklenmiştir.
- **Fiyatlama:** TLREF'in sayısal değeri modele dahil değildir; fiyat "TLREF + spread" olarak gösterilir.
- **Dönem görünümünde ölçüm uyarlaması:** Ortalama ölçümlü göstergelerde etiket dönem ortalamasından; değişim ölçümlülerde dönem uzunluğunda aynı karşılaştırma aralığıyla (ör. geçen yılın aynı dönemi, sezonsallıktan etkilenmemesi için); eğilimli seviyede dönem uzunluğunda regresyonla (en az 3 ay) hesaplanır. Son gözlem ve sezon dönemi ölçümleri dönemden bağımsızdır. Karşılaştırma için yeterli geçmiş yoksa (ör. karar tarihindeki veriyle 12 ay) değişim "—", etiket "Yetersiz veri" gösterilir. Ekranda gösterilen değişim ise her zaman bir önceki eşit uzunluktaki dönemedir.
- **Model değişiklik akışı:** Model Yöneticisi'ndeki düzenlemeler önce çalışma kopyasında tutulur, "Taslak" ile saklanabilir; aktif model yalnızca "Yeni sürüm olarak kaydet" veya bir sürümün aktif yapılmasıyla değişir.

## 14. Piyasa İstihbaratı

Piyasa İstihbaratı, her sektör için Türkiye'deki son 3–6 ayın gelişmelerini özetleyen **bilgi amaçlı** bir modüldür. **Kredi skorunu, notu ve limiti etkilemez**, model konfigürasyonunun ve sürümlerinin parçası değildir.

- **Kaynak:** Uygulama çevrimdışı çalıştığı için içerik çalışma zamanında internetten çekilmez. Başlangıç maddeleri 25.09.2026'da yapılan web araştırmasıyla derlenmiş ve `src/data/marketIntel.ts` dosyasına statik veri olarak yazılmıştır. Her sektörde 3–5 madde vardır.
- **Madde yapısı:** kısa başlık, 1–2 cümlelik özet (kaynağın cümleleri değil, özet ifadeler), etki yönü (Olumlu / Nötr / Olumsuz), kaynak adı, kaynak bağlantısı ve tarih. Her rakamın kaynağı maddede yer alır. Sektör başına bir "Kredi açısından ne anlama geliyor" yorumu ve "Son güncelleme" tarihi tutulur.
- **Görünüm:** Tahsis Yöneticisi değerlendirme ekranında ayrı "Piyasa İstihbaratı" sekmesi (maddeler yeniden eskiye, kaynak bağlantılarıyla); Portföy Yöneticisi firma detayında sağ sütunda kompakt kart (olumsuzlar önce); Portföy Özeti'nde seçili ölçekteki firmaların sektörleri için olumsuz sinyal sayısı.
- **Düzenleme:** Model Yöneticisi → "Piyasa İstihbaratı" ekranında maddeler eklenir, düzenlenir, silinir ve kredi yorumu güncellenir. Kayıt anında "Son güncelleme" bugünün tarihine çekilir, değişiklik model denetim izine yazılır ve localStorage'da saklanır. Sektör bazında "Araştırma verisine dön" ile başlangıç maddelerine dönülür; demo sıfırlaması (Ctrl+Shift+R) da başlangıç verisini geri yükler.
