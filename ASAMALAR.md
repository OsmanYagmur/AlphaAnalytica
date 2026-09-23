# Aşama Prompt'ları

Her aşamayı Claude Code'a AYRI mesaj olarak gönder. Bir aşama bitip özet gelmeden diğerine geçme.
Aşamalar arasında istersen `/clear` yapabilirsin; SPEC.md ve CLAUDE.md dosyada durduğu için bağlam kaybolmaz.

---

## Aşama 1 — İskelet ve model konfigürasyonu
```
SPEC.md'deki "TEKNİK ALTYAPI", "FORMÜLLER" ve "SEKTÖRLER" bölümlerini oku. git init yap. Projeyi kur (Vite + React + TS + Tailwind + Recharts + lucide-react + Vitest, @fontsource IBM Plex Sans/Mono). Sadece /src/engine/modelConfig.ts'i yaz: tipli konfigürasyon şeması ve v1.0 varsayılanları; 10 sektörün gösterge listesi ve ağırlıkları, normalizasyon kırılımları, 12 aylık sezon endeksleri (turizmde yaz/kış ayrı), SRK, nakit dönüşüm süresi medyanları, sektörel ürün kırılımları dahil. UI yazma. Bitince dur ve özet ver.
```

## Aşama 2 — Motor
```
SPEC.md "FORMÜLLER" bölümüne göre /src/engine altında traditionalScore.ts, alternativeScore.ts, seasonality.ts, limit.ts, collateral.ts ile nihai skor, harf notu, PD ve erken uyarı override fonksiyonlarını yaz. Tüm parametreler modelConfig'ten gelsin, hiçbir sabit kod olmasın. Her fonksiyon için birim testleri yaz ve çalıştır. Bitince dur ve özet ver.
```

## Aşama 3 — Demo verisi ve kalibrasyon
```
SPEC.md "DEMO VERİSİ" bölümüne göre 14 hayali firmayı /src/data altında oluştur (künye, hesap kodlu mizan, KVB, 24 aylık ciro, sektörel alternatif gösterge serileri, başlangıç karar durumları: 8 bekleyen, 6 karara bağlanmış). Veriyi, motorun v1.0 çıktıları oradaki hikâyeleri tutacak şekilde kalibre et. engine.test.ts'i yaz; her firmanın v1.0 çıktısını ve hikâyeleri doğrulayan testler dahil. Testler geçene kadar veriyi ayarla. Sonunda her firmanın G, A, S, not, PD ve önerilen limitini tablo olarak göster. Bitince dur.
```

> Bu aşama takılırsa ikiye böl:
> 3a: "Aşama 3'ü sadece ilk 7 firma için yap."
> 3b: "Kalan 7 firmayı ekle, tüm kalibrasyonu ve engine.test.ts'i tamamla."

## Aşama 4 — Tasarım sistemi, kabuk ve giriş ekranı
```
SPEC.md "TASARIM" ve "GİRİŞ EKRANI" bölümlerini uygula: renk ve tipografi token'ları, SVG logo, sabit lacivert kenar çubuğu, sağ alt "AlphaAnalytica · TEKNOFEST 2026 Finansal Teknolojiler" etiketi, "Demo Verisi" etiketi, Sunum Modu anahtarı, localStorage store (aktif config, sürümler, kararlar; arayüzler arası anında senkron), Ctrl+Shift+R gizli sıfırlama, rol seçimi ekranı ve Model Yöneticisi için 1946 PIN'i. Üç arayüz şimdilik boş yer tutucu sayfa olsun. Bitince dur ve özet ver.
```

## Aşama 5 — Tahsis Yöneticisi
```
SPEC.md "A) TAHSİS YÖNETİCİSİ ARAYÜZÜ" bölümünü eksiksiz uygula: başvuru kuyruğu (filtre, arama), firma değerlendirme ekranı (üst şerit, gauge, geleneksel ve alternatif sekmeler, sezonsallık grafiği, skoru etkileyen faktörler, sistem önerisi kartı), karar paneli (onay, gerekçeli red, revize ve %20 sapma kuralı, onay bildirimi, audit log) ve analiz animasyonu. "FORMÜLLERİN GÖRÜNÜRLÜĞÜ" kuralına uy. Bitince dur ve özet ver.
```

> Takılırsa: 5a "kuyruk + değerlendirme ekranı", 5b "karar paneli + audit log + animasyon".

## Aşama 6 — Portföy Yöneticisi
```
SPEC.md "B) PORTFÖY YÖNETİCİSİ ARAYÜZÜ" bölümünü eksiksiz uygula: portföy özeti, firma listesi ve durum rozetleri, firma detay ekranı (skor trendi, Sistem Görüşü / Tahsis Kararı karşılaştırması, limit ve teminat detayı, gerekçe notu, erken uyarılar, eski model sürümü bilgi satırı). Bitince dur ve özet ver.
```

## Aşama 7 — Model Yöneticisi: parametre ekranları
```
SPEC.md "C) MODEL YÖNETİCİSİ (MASTER) ARAYÜZÜ" bölümündeki 1–7 numaralı ekranları (Genel Bakış, Ana Denge, Geleneksel, Alternatif, Sektör Ayarları, Not/PD/Limit, Teminat ve Fiyatlama) ve "Doğrulama kuralları"nı uygula. Kendi kenar çubuğu menüsü olsun. Etki simülasyonu ve sürümleme bu aşamada YOK. Bitince dur ve özet ver.
```

## Aşama 8 — Model Yöneticisi: etki simülasyonu
```
SPEC.md'deki "Etki Simülasyonu" bölümünü uygula: kaydetmeden önce canlı Etki Önizleme paneli, tüm firmalar için eski → yeni tablo, özet kartları, tek firma odak modunda şelale grafiği ve duyarlılık analizi çizgi grafiği. Bitince dur ve özet ver.
```

## Aşama 9 — Model Yöneticisi: sürümleme ve entegrasyon
```
SPEC.md'deki "Sürümleme ve denetim izi" ve "Diğer arayüzlere etkisi" bölümlerini uygula: yeni sürüm kaydetme, sürüm listesi ve diff görünümü, sürümü aktif yapma ve v1.0'a dönme (onay pencereli), JSON dışa/içe aktarma ve şema doğrulaması. Karara bağlanmış firmaların verildiği sürümle sabit kaldığını, bekleyenlerin aktif modelle yeniden hesaplandığını test et. Bitince dur ve özet ver.
```

## Aşama 10 — Dokümantasyon ve son kontrol
```
SPEC.md "METODOLOJİ.md" ve "KALİTE KONTROL" bölümlerini uygula. METODOLOJI.md ve README.md'yi yaz. 1920x1080 ve 1366x768'de taşma kontrolü yap, konsol hatalarını temizle, npm run build ve tüm testleri çalıştır. Son olarak SPEC.md'yi baştan sona madde madde tara, eksik kalan her şeyi listele ve tamamla. En sonda kontrol listesini özet olarak ver.
```
