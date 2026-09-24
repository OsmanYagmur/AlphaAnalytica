"""
AlphaAnalytica demo firmaları için gerçek muhasebe programı çıktısı görünümünde
mizan PDF'leri üretir. Girdi: mizan.json (tutarlar kuruş cinsinden tam sayı).

Kullanım:
  MIZAN_EXPORT=mizan.json npx vitest run src/data/mizanExport.test.ts
  pip install reportlab pypdf
  python3 scripts/mizan_pdf.py mizan.json docs/mizanlar

Yazı tipi: macOS Arial (/System/Library/Fonts/Supplemental). Başka sistemde
FONT_DIR'i Türkçe karakter destekleyen bir TTF klasörüne yönlendirin.
"""

import json
import random
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT_DIR = "/System/Library/Fonts/Supplemental"
pdfmetrics.registerFont(TTFont("Arial", f"{FONT_DIR}/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", f"{FONT_DIR}/Arial Bold.ttf"))
from reportlab.lib.fonts import addMapping
addMapping("Arial", 0, 0, "Arial")
addMapping("Arial", 1, 0, "Arial-Bold")

INK = colors.HexColor("#1D2433")
MUTED = colors.HexColor("#5B6475")
LINE = colors.HexColor("#B9BDC6")
BAND = colors.HexColor("#EEF0F3")
SUBTOTAL = colors.HexColor("#E3E6EB")

CLASS_TITLES = {
    "1": "1  DÖNEN VARLIKLAR",
    "2": "2  DURAN VARLIKLAR",
    "3": "3  KISA VADELİ YABANCI KAYNAKLAR",
    "4": "4  UZUN VADELİ YABANCI KAYNAKLAR",
    "5": "5  ÖZKAYNAKLAR",
    "6": "6  GELİR TABLOSU HESAPLARI",
    "7": "7  MALİYET HESAPLARI",
}

ACCOUNTANTS = [
    "SMMM Serkan Ateşoğlu",
    "SMMM Neslihan Karataş",
    "SMMM Oğuzhan Demirel",
    "SMMM Gülşen Yalçınkaya",
    "SMMM Burak Tanrıverdi",
    "SMMM Derya Kocabaş",
]

RETAIL_SECTORS = {"Kırtasiye", "Restoran / Kafe", "E-ticaret", "Eczane"}


def tl(kurus: int, blank_zero: bool = True) -> str:
    """Kuruş → Türkçe biçimli tutar (1.457,43)."""
    if kurus == 0 and blank_zero:
        return ""
    s = f"{abs(kurus) / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-{s}" if kurus < 0 else s


def split_int(total: int, weights: list[float]) -> list[int]:
    """Tam sayıyı ağırlıklara göre, toplamı birebir koruyarak böler."""
    s = sum(weights)
    parts = [int(total * w / s) for w in weights]
    parts[0] += total - sum(parts)
    return parts


def sub_accounts(firm: dict, line: dict, rnd: random.Random) -> list[tuple[str, str, float]]:
    code = line["code"]
    exporter = firm["exporter"]
    j = lambda w: w * (1 + 0.25 * (rnd.random() * 2 - 1))  # noqa: E731
    if code == "102":
        subs = [("102.01", "Banka A - TL Vadesiz Hesap", j(0.5)), ("102.02", "Banka B - TL Vadesiz Hesap", j(0.3))]
        if exporter:
            subs.append(("102.03", "Banka A - USD Vadesiz Hesap", j(0.35)))
            subs.append(("102.04", "Banka C - EUR Vadesiz Hesap", j(0.15)))
        if firm["sector"] in RETAIL_SECTORS:
            subs.append(("102.05", "Banka C - POS Blokeli Hesap", j(0.2)))
        return subs
    if code == "120" and exporter:
        return [("120.01", "Yurt İçi Alıcılar", j(0.18)), ("120.02", "Yurt Dışı Alıcılar", j(0.82))]
    if code == "300":
        return [("300.01", "Banka A - Rotatif Kredi", j(0.55)), ("300.02", "Banka B - Spot Kredi", j(0.45))]
    if code == "400":
        return [("400.01", "Banka A - Yatırım Kredisi", j(0.7)), ("400.02", "Banka B - İşletme Kredisi", j(0.3))]
    if code == "320" and exporter:
        return [("320.01", "Yurt İçi Satıcılar", j(0.86)), ("320.02", "Yurt Dışı Satıcılar", j(0.14))]
    if code == "600" and firm["segment"] == "Holding":
        return [("600.01", "Yurt İçi Satışlar - Toptan", j(0.7)), ("600.02", "Yurt İçi Satışlar - Grup Şirketleri", j(0.3))]
    return []


def expand(firm: dict, line: dict, rnd: random.Random) -> list[dict]:
    """Ana hesap + muavinler. Muavin tutarları ana hesabı kuruşu kuruşuna verir."""
    subs = sub_accounts(firm, line, rnd)
    main = {**line, "level": 0, "has_subs": bool(subs)}
    if not subs:
        return [main]
    balance = line["db"] - line["cb"]
    turnover = line["dt"] - line["db"]
    weights = [w for _, _, w in subs]
    b_parts = split_int(balance, weights)
    t_parts = split_int(turnover, weights)
    rows = [main]
    for (code, name, _), b, t in zip(subs, b_parts, t_parts):
        rows.append(
            {
                "code": code,
                "name": name,
                "db": max(b, 0),
                "cb": max(-b, 0),
                "dt": max(b, 0) + t,
                "ct": max(-b, 0) + t,
                "level": 1,
                "has_subs": False,
            }
        )
    return rows


class NumberedCanvas(rl_canvas.Canvas):
    """Her sayfaya başlık/altlık ve "Sayfa x / y" basar."""

    def __init__(self, *args, meta=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []
        self.meta = meta

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self.draw_frame(total)
            super().showPage()
        super().save()

    def draw_frame(self, total: int):
        m = self.meta
        w, h = A4
        left, right = 14 * mm, w - 14 * mm
        top = h - 12 * mm
        self.setFillColor(INK)
        self.setFont("Arial-Bold", 9.5)
        self.drawString(left, top, m["name"].upper())
        self.setFont("Arial", 7.5)
        self.setFillColor(MUTED)
        self.drawString(left, top - 11, f"Vergi No: {m['vkn']}")
        self.drawString(left, top - 20, f"Vergi Dairesi: {m['taxOffice']}")
        self.drawString(left, top - 29, f"{m['city']}  ·  {m['sector']}  ·  {m['segment']}")

        self.setFillColor(INK)
        self.setFont("Arial-Bold", 12)
        self.drawCentredString(w / 2, top - 2, "MİZAN")
        self.setFont("Arial", 7.5)
        self.drawCentredString(w / 2, top - 13, f"Dönem: 01.01.{m['year']} - 31.12.{m['year']}")
        self.drawCentredString(w / 2, top - 22, "Genel Geçici Mizan (Kapanış Öncesi)  ·  Tutarlar TL")

        self.setFont("Arial", 7.5)
        self.drawRightString(right, top, f"Sayfa {self._pageNumber} / {total}")
        self.setFillColor(MUTED)
        self.drawRightString(right, top - 11, f"Rapor tarihi: {m['printDate']}")
        self.drawRightString(right, top - 21, f"Hazırlayan: {m['accountant']}")

        self.setStrokeColor(INK)
        self.setLineWidth(0.8)
        self.line(left, top - 35, right, top - 35)

        self.setFont("Arial", 6.5)
        self.setFillColor(MUTED)
        self.drawString(left, 8 * mm, "AlphaAnalytica demo verisi · Simülasyon amaçlı hayali firma; tutarlar gerçek değildir.")
        self.drawRightString(right, 8 * mm, f"{m['name']} · {m['year']} Mizanı")


def build_pdf(firm: dict, out: Path):
    rnd = random.Random(firm["no"] * 104729)
    meta = {
        "name": firm["name"],
        "vkn": firm["vkn"],
        "taxOffice": f"{firm['city']} V.D." if firm["segment"] != "Holding" else "Büyük Mükellefler V.D. Başkanlığı",
        "city": firm["city"],
        "sector": firm["sector"],
        "segment": firm["segment"] + (f" ({firm['groupCompanies']} grup şirketi)" if firm["groupCompanies"] else ""),
        "year": firm["fiscalYear"],
        "printDate": f"{5 + rnd.randrange(20):02d}.02.{firm['fiscalYear'] + 1}",
        "accountant": ACCOUNTANTS[firm["no"] % len(ACCOUNTANTS)],
    }

    name_style = ParagraphStyle("name", fontName="Arial", fontSize=7.2, leading=8.6, textColor=INK)
    name_bold = ParagraphStyle("nameb", parent=name_style, fontName="Arial-Bold")
    name_sub = ParagraphStyle("names", parent=name_style, leftIndent=8, textColor=MUTED)

    header = ["Hesap Kodu", "Hesap Adı", "Borç", "Alacak", "Borç Bakiye", "Alacak Bakiye"]
    data = [header]
    styles = [
        ("FONT", (0, 0), (-1, 0), "Arial-Bold", 7.2),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("LINEABOVE", (0, 0), (-1, 0), 0.8, INK),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONT", (0, 1), (-1, -1), "Arial", 7.2),
        ("TOPPADDING", (0, 0), (-1, -1), 1.15),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.15),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]

    grand = [0, 0, 0, 0]
    classes: dict[str, list[dict]] = {}
    for line in firm["lines"]:
        classes.setdefault(line["code"][0], []).append(line)

    for cls in sorted(classes):
        r = len(data)
        data.append([CLASS_TITLES[cls], "", "", "", "", ""])
        styles += [("SPAN", (0, r), (-1, r)), ("FONT", (0, r), (-1, r), "Arial-Bold", 7.4), ("BACKGROUND", (0, r), (-1, r), BAND)]
        sub = [0, 0, 0, 0]
        for line in sorted(classes[cls], key=lambda l: l["code"]):
            for row in expand(firm, line, rnd):
                r = len(data)
                style = name_bold if row["has_subs"] else name_sub if row["level"] else name_style
                data.append([row["code"], Paragraph(row["name"], style), tl(row["dt"]), tl(row["ct"]), tl(row["db"]), tl(row["cb"])])
                if row["has_subs"]:
                    styles.append(("FONT", (0, r), (-1, r), "Arial-Bold", 7.2))
                if row["level"]:
                    styles += [("TEXTCOLOR", (0, r), (-1, r), MUTED), ("FONT", (0, r), (0, r), "Arial", 6.8)]
                else:
                    styles.append(("LINEABOVE", (0, r), (-1, r), 0.25, LINE))
                    for k, key in enumerate(["dt", "ct", "db", "cb"]):
                        sub[k] += row[key]
        r = len(data)
        data.append(["", f"{cls} Grup Toplamı", tl(sub[0], False), tl(sub[1], False), tl(sub[2], False), tl(sub[3], False)])
        styles += [("FONT", (0, r), (-1, r), "Arial-Bold", 7.2), ("BACKGROUND", (0, r), (-1, r), SUBTOTAL), ("LINEABOVE", (0, r), (-1, r), 0.5, INK)]
        grand = [g + s for g, s in zip(grand, sub)]

    assert grand[0] == grand[1], f"{firm['id']}: borç/alacak toplamı eşit değil"
    assert grand[2] == grand[3], f"{firm['id']}: bakiye toplamları eşit değil"
    r = len(data)
    data.append(["", "GENEL TOPLAM", tl(grand[0], False), tl(grand[1], False), tl(grand[2], False), tl(grand[3], False)])
    styles += [
        ("FONT", (0, r), (-1, r), "Arial-Bold", 7.6),
        ("LINEABOVE", (0, r), (-1, r), 0.8, INK),
        ("LINEBELOW", (0, r), (-1, r), 1.6, INK),
    ]

    widths = [17 * mm, None, 29 * mm, 29 * mm, 27 * mm, 27 * mm]
    usable = A4[0] - 28 * mm
    widths[1] = usable - sum(w for w in widths if w)
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle(styles))

    sign_style = ParagraphStyle("sign", fontName="Arial", fontSize=7.5, leading=10, textColor=INK)
    signatures = Table(
        [
            [Paragraph("<b>Hazırlayan</b><br/>" + meta["accountant"] + "<br/>Serbest Muhasebeci Mali Müşavir", sign_style), "",
             Paragraph("<b>Firma Yetkilisi</b><br/>" + firm["name"] + "<br/>Kaşe / İmza", sign_style)],
            ["", "", ""],
        ],
        colWidths=[usable * 0.42, usable * 0.16, usable * 0.42],
        rowHeights=[None, 16 * mm],
    )
    signatures.setStyle(TableStyle([("LINEBELOW", (0, 1), (0, 1), 0.5, INK), ("LINEBELOW", (2, 1), (2, 1), 0.5, INK), ("VALIGN", (0, 0), (-1, -1), "TOP")]))

    note_style = ParagraphStyle("note", fontName="Arial", fontSize=6.8, leading=9, textColor=MUTED)
    note = Paragraph(
        f"Bu mizan {firm['name']} yasal defter kayıtlarından {meta['printDate']} tarihinde alınmıştır. "
        f"Borç ve alacak toplamları ile borç ve alacak bakiye toplamları birbirine eşittir. "
        f"Dönem sonu kapanış kayıtları yapılmamıştır; dönem net kârı gelir tablosu hesaplarında yer almaktadır.",
        note_style,
    )

    doc = SimpleDocTemplate(
        str(out),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=28 * mm,
        bottomMargin=14 * mm,
        title=f"{firm['name']} - {firm['fiscalYear']} Mizanı",
        author=meta["accountant"],
        subject="Genel Geçici Mizan (Kapanış Öncesi)",
        creator="AlphaAnalytica demo verisi",
    )
    doc.build(
        [table, Spacer(1, 6 * mm), KeepTogether([note, Spacer(1, 8 * mm), signatures])],
        canvasmaker=lambda *a, **k: NumberedCanvas(*a, meta=meta, **k),
    )
    return grand


def slug(text: str) -> str:
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return "".join(ch if ch.isalnum() else "_" for ch in text.translate(tr)).strip("_")


def main(src: str, out_dir: str):
    firms = json.load(open(src, encoding="utf-8"))
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for firm in firms:
        path = out / f"{firm['no']:02d}_{slug(firm['id'])}_mizan_{firm['fiscalYear']}.pdf"
        grand = build_pdf(firm, path)
        files.append(path)
        print(f"{path.name}: borç=alacak {tl(grand[0], False)} · bakiye {tl(grand[2], False)}")
    writer = PdfWriter()
    for path in files:
        start = len(writer.pages)
        for page in PdfReader(str(path)).pages:
            writer.add_page(page)
        writer.add_outline_item(path.stem.split("_mizan")[0][3:].replace("_", " "), start)
    writer.add_metadata({"/Title": "AlphaAnalytica demo firmaları - 2025 mizanları"})
    combined = out / "00_tum_firmalar_mizan_2025.pdf"
    with open(combined, "wb") as f:
        writer.write(f)
    print(f"{combined.name}: {len(writer.pages)} sayfa")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
