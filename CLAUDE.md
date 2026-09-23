# AlphaAnalytica — Proje Kuralları

Bu proje TEKNOFEST 2026 Finansal Teknolojiler finali için çevrimdışı bir demo uygulamasıdır.
Tam şartname **SPEC.md** dosyasındadır. Aşama aşama ilerlenir; aşama listesi **ASAMALAR.md** dosyasındadır.

## Çalışma şekli
- Her görevde önce SPEC.md'nin ilgili bölümlerini oku. Şartnamede yazan hiçbir detayı atlama, kendi yorumunla sadeleştirme.
- Sadece istenen aşamayı yap. Bitince dur, kısa bir özet ver (ne yapıldı, hangi dosyalar, varsa eksik/sorun). Sonraki aşamaya kendiliğinden geçme.
- Uzun planlama yapma; aşamayı küçük adımlara bölüp doğrudan uygulamaya başla.
- Her aşama sonunda `npm run build` ve `npm test` hatasız geçmeli.
- Her aşama sonunda anlamlı bir mesajla git commit at.

## Teknik kurallar
- Stack: Vite + React + TypeScript + Tailwind CSS + Recharts + lucide-react. Test: Vitest.
- Backend yok. Tamamen çevrimdışı çalışır; CDN yok, fontlar @fontsource ile yerel (IBM Plex Sans, IBM Plex Mono).
- Veri: /src/data. Hesaplama: /src/engine altında saf TypeScript fonksiyonları.
- Motor hiçbir ağırlık, eşik veya katsayıyı sabit kod olarak içermez. Her parametre /src/engine/modelConfig.ts'teki tipli konfigürasyondan okunur (varsayılan = Model v1.0).
- UI hiçbir skoru veya limiti elle yazmaz; her şey motordan gelir.
- Aktif config, model sürümleri ve kararlar localStorage'da tutulur.

## Görünürlük
- Tahsis Yöneticisi ve Portföy Yöneticisi ekranlarında formül, ağırlık, katsayı veya eşik GÖRÜNMEZ. Yalnızca skor, not, alt kategori çubukları ve niteliksel açıklamalar.
- Formüller ve parametreler yalnızca Model Yöneticisi panelinde görünür.

## Dil ve format
- Tüm arayüz Türkçe. Para birimi TL, sayı formatı tr-TR (1.250.000 ₺).

## Tasarım (özet — ayrıntı SPEC.md "TASARIM" bölümünde)
- Banka iç kurumsal yazılımı görünümü. Mor/pembe gradyan, neon, glassmorphism, parlama, emoji YOK.
- Zemin #F6F5F1, kart #FFFFFF, lacivert #12233D, kenar çubuğu #0E1B2E, metin #1D2433, ikincil #5B6475, çizgi #E3E1DA, vurgu #1F6F6B, olumlu #1E7B4F, uyarı #B7791F, olumsuz #B42318.
- 8px ızgara, 1px çizgiler, köşe yuvarlama en fazla 6px, çok hafif gölge. Sayılar IBM Plex Mono, tabular rakamlar.
