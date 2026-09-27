# AlphaAnalytica — Dinamik Bilançolar ile Risk Analizi

TEKNOFEST 2026 Finansal Teknolojiler Yarışması finali için hazırlanmış, tamamen çevrimdışı çalışan demo uygulaması. KOBİ'ler için ticari kredi tahsis sürecini simüle eder: geleneksel finansal analizi (mizan + Kurumlar Vergisi Beyannamesi) sektöre özgü alternatif veri analiziyle varsayılan olarak %50–%50 birleştirir; kredi skoru, harf notu, temerrüt olasılığı, limit ve teminat önerisi üretir.

Üç arayüz vardır: **Tahsis Yöneticisi**, **Portföy Yöneticisi** ve **Model Yöneticisi** (Master). Tüm formüller ve parametreler [METODOLOJI.md](METODOLOJI.md) dosyasında belgelenmiştir; aynı belgenin baskıya hazır PDF sürümü [docs/METODOLOJI.pdf](docs/METODOLOJI.pdf) dosyasındadır (`python3 scripts/metodoloji_pdf.py METODOLOJI.md docs/METODOLOJI.pdf` ile yeniden üretilir, reportlab gerekir).

## Gereksinimler

- Node.js 22.12+ (veya 24+). Geliştirildiği sürüm: Node 22.20. Kurulu değilse https://nodejs.org adresinden LTS sürümünü indirin; npm onunla birlikte gelir.
- npm 10+
- Git

İnternet bağlantısı yalnızca ilk `npm install` için gerekir. Uygulama çalışırken hiçbir dış kaynağa (CDN, font sunucusu, API) bağlanmaz; IBM Plex Sans ve IBM Plex Mono fontları `@fontsource` paketleriyle yerel olarak paketlenir.

## Kurulum ve çalıştırma

Depo gizlidir; erişim için depo sahibinin sizi GitHub'da ortak çalışan (collaborator) olarak eklemiş olması gerekir.

```bash
git clone https://github.com/OsmanYagmur/AlphaAnalytica.git
```

```bash
cd AlphaAnalytica
```

```bash
npm install
```

```bash
npm run dev
```

Geliştirme sunucusu http://localhost:5173 adresinde açılır. Sonraki güncellemeleri almak için depo klasöründe `git pull`, ardından (bağımlılıklar değiştiyse) `npm install` çalıştırın.

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

## Site yapısı

| Adres | Sayfa |
|---|---|
| `#/` | Tanıtım sayfası: problem, çözüm, ürün, demo senaryoları, ticari potansiyel, riskler, ekip |
| `#/demo` | Rol seçimi (Tahsis, Portföy, Model Yöneticisi) |
| `#/tahsis/firma/:id/:sekme` | Firma değerlendirmesi; sekme isteğe bağlı: `geleneksel`, `alternatif`, `kkb`, `piyasa` |

Tanıtım sayfasındaki metinler ve ekip bilgileri `src/pages/landing/content.ts` dosyasındadır. Ekip bilgileri dosyadaki `TEAM` listesindedir: her kişi için `name` ve `role` zorunlu; `badge` (ör. "Takım Kaptanı"), `photo` (kare fotoğraf `src/assets/team` klasörüne konur ve dosyanın başında import edilir; yoksa baş harfler gösterilir), `responsibility`, `education` ve `links` (`linkedin`, `website`) isteğe bağlıdır. Liste boşken sayfada "Ekibimizi çok yakında burada tanıtacağız" yazar. Sayfadaki skorlar, notlar ve limitler motordan canlı hesaplanır.

## Ziyaretçi istatistikleri

Yayındaki sitede (Vercel) ziyaretçi istatistikleri Vercel Web Analytics ile toplanır. Analitik yalnızca Vercel'in kendi derlemesinde (`VERCEL=1`) etkindir; `npm run dev`, yerel `npm run build` ve çevrimdışı kullanımda paket hiç yüklenmez ve dışarıya istek gitmez. Hash tabanlı sayfa geçişleri (`#/demo`, `#/tahsis/...`) ayrı sayfa görüntülemesi olarak sayılır; firma adresleri raporda `/tahsis/firma/[firma]` kalıbında toplanır. Vercel panelinde projenin **Analytics** sekmesinden Web Analytics'in etkinleştirilmiş olması gerekir.

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

## Demo firmalarının mizanları (PDF)

`docs/mizanlar/` klasöründe 16 firmanın 2025 mali yılı mizanı, bir muhasebe programı çıktısı biçiminde PDF olarak bulunur (`00_tum_firmalar_mizan_2025.pdf` hepsini bir arada içerir). Tutarlar kuruş hassasiyetindedir; borç/alacak hareket toplamları ve bakiyeleri kuruşu kuruşuna denktir; bankalar, krediler ve ihracatçılarda alıcı/satıcı hesapları muavin kırılımıyla gösterilir. Yeniden üretmek için:

```bash
MIZAN_EXPORT=mizan.json npx vitest run src/data/mizanExport.test.ts
```

```bash
python3 scripts/mizan_pdf.py mizan.json docs/mizanlar
```

(Python tarafı `reportlab` ve `pypdf` paketlerini gerektirir.)

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
    kkb.ts             KKB risk raporu: anlık görüntü, KKB sinyalleri, K1 düşümü, K3 anapara ödemeleri
    indicatorInfo.ts, indicatorPeriod.ts   Gösterge açıklamaları, dönem görünümü (skoru etkilemez)
    migrate.ts         Eski kayıtlı konfigürasyonların yeni alanlarla tamamlanması
    evaluate.ts        Firma değerlendirme hattı, skor trendi
    factors.ts         "Skoru etkileyen faktörler", Güçlü/Orta/Zayıf etiketi
    impact.ts, sensitivity.ts   Etki simülasyonu, şelale, duyarlılık
    validation.ts, schema.ts, configDiff.ts   Doğrulama, JSON şeması, sürüm farkları
    *.test.ts          Birim testleri; engine.test.ts demo çıktıları ve senaryolar
  data/              16 hayali firma (14 KOBİ + 2 holding), başlangıç kararları, deterministik veri üreteçleri,
                     KKB risk raporları (kkb.ts, simülasyon), Piyasa İstihbaratı (marketIntel.ts, kaynaklı statik veri)
  store/             localStorage durumu, firma görünümleri, portföy, Model Yöneticisi çalışma kopyası
  components/        Kabuk, logo, arayüz bileşenleri, grafikler, Model Yöneticisi düzenleyicileri
  pages/             tahsis/, portfoy/, model/ ve giriş ekranı
docs/mizanlar/       16 firmanın 2025 mizanı (PDF)
docs/METODOLOJI.pdf  METODOLOJI.md'nin PDF sürümü
scripts/mizan_pdf.py Mizan PDF üreteci
scripts/metodoloji_pdf.py  Metodoloji PDF üreteci
METODOLOJI.md        Formüller, parametre şeması, sektör tabloları, demo senaryoları, sunum akışı
SPEC.md              Şartname (sonunda REVİZYONLAR: R1 …)
```

## Teknoloji

Vite · React · TypeScript · Tailwind CSS · Recharts · lucide-react · Vitest

## Not

Tüm firma adları, vergi kimlik numaraları ve finansal veriler hayalidir. Uygulama bir demo'dur; gerçek kredi kararı için kullanılamaz.
