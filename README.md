# AlphaAnalytica — Dinamik Bilançolar ile Risk Analizi

TEKNOFEST 2026 Finansal Teknolojiler Yarışması finali için hazırlanmış, tamamen çevrimdışı çalışan demo uygulaması. KOBİ'ler için ticari kredi tahsis sürecini simüle eder: geleneksel finansal analizi (mizan + Kurumlar Vergisi Beyannamesi) sektöre özgü alternatif veri analiziyle varsayılan olarak %50–%50 birleştirir; kredi skoru, harf notu, temerrüt olasılığı, limit ve teminat önerisi üretir.

Üç arayüz vardır: **Tahsis Yöneticisi**, **Portföy Yöneticisi** ve **Model Yöneticisi** (Master). Tüm formüller ve parametreler [METODOLOJI.md](METODOLOJI.md) dosyasında belgelenmiştir.

## Gereksinimler

- Node.js 22.12+ (veya 24+). Geliştirildiği sürüm: Node 22.20
- npm 10+

İnternet bağlantısı yalnızca ilk `npm install` için gerekir. Uygulama çalışırken hiçbir dış kaynağa (CDN, font sunucusu, API) bağlanmaz; IBM Plex Sans ve IBM Plex Mono fontları `@fontsource` paketleriyle yerel olarak paketlenir.

## Kurulum ve çalıştırma

```bash
npm install
```

```bash
npm run dev
```

Geliştirme sunucusu http://localhost:5173 adresinde açılır.

## Üretim derlemesi

```bash
npm run build
```

Statik dosyalar `dist/` klasörüne üretilir. Göreli yollar ve hash tabanlı yönlendirme kullanıldığı için `dist/` herhangi bir statik sunucuda, herhangi bir alt klasörde internet olmadan çalışır (tarayıcılar ES modüllerini `file://` üzerinden yüklemediği için dosyayı çift tıklamak yerine bir statik sunucu kullanın). Yerel önizleme:

```bash
npm run preview
```

## Testler

```bash
npm test
```

Vitest ile motorun tüm fonksiyonları, her demo firmanın Model v1.0 çıktıları ve senaryoları (`src/engine/engine.test.ts`), konfigürasyon doğrulaması, JSON şema doğrulaması, etki simülasyonu ve sürümlemenin diğer arayüzlere etkisi test edilir.

## Demo kullanımı

| | |
|---|---|
| Tahsis Yöneticisi | Giriş ekranında "Demo girişi" |
| Portföy Yöneticisi | Giriş ekranında "Demo girişi" |
| Model Yöneticisi | Demo PIN'i: **1946** |
| Demo'yu sıfırla | **Ctrl+Shift+R** (Mac'te ⌘+Shift+R da çalışır). Tüm kararları ve model konfigürasyonunu başlangıç durumuna (v1.0) döndürür. Ekranda bunun için buton yoktur. |
| Sunum Modu | Kenar çubuğunun altındaki anahtar: yazı tipi %15 büyür, yan paneller sadeleşir |

Aktif model konfigürasyonu, model sürümleri, taslak ve tahsis kararları tarayıcının `localStorage` alanında tutulur. Bir arayüzde yapılan değişiklik diğer arayüzlere (farklı sekmeler dahil) anında yansır.

Önerilen 5–6 dakikalık sunum akışı için [METODOLOJI.md → Sunum akışı](METODOLOJI.md#12-sunum-akışı-56-dakika) bölümüne bakın.

## Proje yapısı

```
src/
  engine/            Saf TypeScript hesaplama motoru (UI'dan bağımsız)
    modelConfig.ts     Tipli model konfigürasyonu ve v1.0 varsayılanları
    financials.ts      Mizan (hesap kodları) → finansal tablo → oranlar
    traditionalScore.ts, alternativeScore.ts, seasonality.ts
    rating.ts          Nihai skor, harf notu, PD
    earlyWarning.ts    Erken uyarı sinyalleri ve not override
    limit.ts, collateral.ts
    evaluate.ts        Firma değerlendirme hattı, skor trendi
    factors.ts         "Skoru etkileyen faktörler", Güçlü/Orta/Zayıf etiketi
    impact.ts, sensitivity.ts   Etki simülasyonu, şelale, duyarlılık
    validation.ts, schema.ts, configDiff.ts   Doğrulama, JSON şeması, sürüm farkları
    *.test.ts          Birim testleri; engine.test.ts demo çıktıları ve senaryolar
  data/              16 hayali firma (14 KOBİ + 2 holding), başlangıç kararları, deterministik veri üreteçleri
  store/             localStorage durumu, firma görünümleri, portföy, Model Yöneticisi çalışma kopyası
  components/        Kabuk, logo, arayüz bileşenleri, grafikler, Model Yöneticisi düzenleyicileri
  pages/             tahsis/, portfoy/, model/ ve giriş ekranı
METODOLOJI.md        Formüller, parametre şeması, sektör tabloları, demo senaryoları, sunum akışı
SPEC.md              Şartname
```

## Teknoloji

Vite · React · TypeScript · Tailwind CSS · Recharts · lucide-react · Vitest

## Not

Tüm firma adları, vergi kimlik numaraları ve finansal veriler hayalidir. Uygulama bir demo'dur; gerçek kredi kararı için kullanılamaz.
