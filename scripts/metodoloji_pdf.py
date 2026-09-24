"""METODOLOJI.md → biçimli PDF.

Kullanım:
    python3 scripts/metodoloji_pdf.py METODOLOJI.md docs/METODOLOJI.pdf

Gereksinim: reportlab (pip install reportlab). macOS sistem fontlarını (Arial, Menlo) kullanır.
Belge içeriği tamamen METODOLOJI.md'den okunur; bu betik yalnızca dizgi yapar.
"""

import re
import sys
from datetime import date

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

# ---------------------------------------------------------------------------
# Tasarım (SPEC.md "TASARIM" paleti)
# ---------------------------------------------------------------------------

NAVY = colors.HexColor("#12233D")
INK = colors.HexColor("#1D2433")
MUTED = colors.HexColor("#5B6475")
LINE = colors.HexColor("#E3E1DA")
ACCENT = colors.HexColor("#1F6F6B")
SUBTLE = colors.HexColor("#F6F5F1")
HEAD_BG = colors.HexColor("#EFEDE7")

FONT_DIR = "/System/Library/Fonts/Supplemental/"
pdfmetrics.registerFont(TTFont("Arial", FONT_DIR + "Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", FONT_DIR + "Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Italic", FONT_DIR + "Arial Italic.ttf"))
pdfmetrics.registerFont(TTFont("Arial-BoldItalic", FONT_DIR + "Arial Bold Italic.ttf"))
pdfmetrics.registerFont(TTFont("Menlo", "/System/Library/Fonts/Menlo.ttc", subfontIndex=0))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold", italic="Arial-Italic", boldItalic="Arial-BoldItalic")

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

BODY = ParagraphStyle("body", fontName="Arial", fontSize=9.5, leading=13.6, textColor=INK, spaceAfter=5)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8, leading=10.5, textColor=MUTED)
H2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=14, leading=18, textColor=NAVY, spaceBefore=12, spaceAfter=6)
H3 = ParagraphStyle("h3", fontName="Arial-Bold", fontSize=11, leading=14, textColor=NAVY, spaceBefore=9, spaceAfter=4)
QUOTE = ParagraphStyle("quote", parent=BODY, fontSize=9, leading=12.8, textColor=INK, spaceAfter=0)
LIST = ParagraphStyle("list", parent=BODY, leftIndent=14, bulletIndent=2, spaceAfter=3.5)
CELL = ParagraphStyle("cell", fontName="Arial", fontSize=8, leading=10.2, textColor=INK)
CELL_HEAD = ParagraphStyle("cellHead", parent=CELL, fontName="Arial-Bold", textColor=NAVY)
CODE = ParagraphStyle("code", fontName="Menlo", fontSize=8, leading=11.2, textColor=INK)
TOC_1 = ParagraphStyle("toc1", fontName="Arial", fontSize=10, leading=15, textColor=INK, leftIndent=0)
TOC_2 = ParagraphStyle("toc2", fontName="Arial", fontSize=8.8, leading=12.5, textColor=MUTED, leftIndent=14)


def plain(text: str) -> str:
    """PDF fontlarında olmayan karakterleri eşdeğerleriyle değiştirir."""
    text = text.replace(" ₺", " TL").replace("₺", "TL")
    text = text.replace("ᵢ₊₁", "(i+1)").replace("ᵢ", "i")
    for sub, digit in zip("₀₁₂₃₄₅₆₇₈₉", "0123456789"):
        text = text.replace(sub, digit)
    return text


def inline(text: str) -> str:
    """Satır içi markdown (kalın, kod, kaçışlar) → reportlab paragraf işaretlemesi."""
    text = plain(text).replace("\\|", "|")
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r'<font name="Menlo" size="0.9em" color="#1F6F6B">\1</font>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return text.replace('size="0.9em"', "")


# ---------------------------------------------------------------------------
# Özel akış şeması (Bölüm 1)
# ---------------------------------------------------------------------------


def flow_diagram() -> Drawing:
    w, h = CONTENT_W, 200
    d = Drawing(w, h)
    bh = 34

    def box(x, y, bw, lines, strong=False):
        d.add(Rect(x, y, bw, bh, rx=3, ry=3, fillColor=NAVY if strong else colors.white, strokeColor=NAVY if strong else LINE, strokeWidth=1))
        color = colors.white if strong else INK
        n = len(lines)
        for i, (txt, bold) in enumerate(lines):
            ty = y + bh / 2 + (n - 1) * 5.5 - i * 11 - 3
            d.add(String(x + bw / 2, ty, txt, fontName="Arial-Bold" if bold else "Arial", fontSize=8.2, fillColor=color, textAnchor="middle"))
        return (x, y, bw)

    def arrow(x1, y1, x2, y2):
        d.add(Line(x1, y1, x2, y2, strokeColor=MUTED, strokeWidth=1))
        import math

        a = math.atan2(y2 - y1, x2 - x1)
        s = 5
        p1 = (x2 - s * math.cos(a - 0.45), y2 - s * math.sin(a - 0.45))
        p2 = (x2 - s * math.cos(a + 0.45), y2 - s * math.sin(a + 0.45))
        d.add(Polygon([x2, y2, p1[0], p1[1], p2[0], p2[1]], fillColor=MUTED, strokeColor=MUTED, strokeWidth=0.5))

    col = [0, 118, 250, 385]
    yA, yB, yS, yL = 150, 100, 125, 25
    box(col[0], yA, 96, [("Mizan + KVB", True), ("hesap kodlu, 2025", False)])
    box(col[0], yB, 96, [("Alternatif veri", True), ("aylık sektör serileri", False)])
    box(col[1], yA, 108, [("Geleneksel Skor", True), ("G · 0–100", False)])
    box(col[1], yB, 108, [("Alternatif Skor", True), ("A = SP + SU + TR", False)])
    box(col[2], yS, 112, [("Nihai Skor", True), ("S = w_G·G + w_A·A", False)], strong=True)
    box(col[3], yS, w - col[3], [("Harf notu + PD", True), ("AAA … C", False)])
    box(col[3], yL + 50, w - col[3], [("Erken uyarı", True), ("not tavanı (override)", False)])
    box(col[1] + 20, yL, 210, [("Limit", True), ("min(K1; K2; K3) × f(not) × SRK", False)])
    box(col[0] - 0, yL, 118, [("Koşullar", True), ("teminat · vade · fiyat · ürün", False)])

    arrow(96, yA + bh / 2, col[1], yA + bh / 2)
    arrow(96, yB + bh / 2, col[1], yB + bh / 2)
    arrow(col[1] + 108, yA + bh / 2, col[2], yS + bh / 2 + 6)
    arrow(col[1] + 108, yB + bh / 2, col[2], yS + bh / 2 - 6)
    arrow(col[2] + 112, yS + bh / 2, col[3], yS + bh / 2)
    mid = col[3] + (w - col[3]) / 2
    arrow(mid, yS, mid, yL + 50 + bh)
    arrow(col[3], yL + 50 + bh / 2, col[1] + 230, yL + bh / 2)
    arrow(col[1] + 20, yL + bh / 2, 118, yL + bh / 2)
    d.add(String(w, 4, "evaluateFirm() · src/engine/evaluate.ts", fontName="Menlo", fontSize=7, fillColor=MUTED, textAnchor="end"))
    return d


# ---------------------------------------------------------------------------
# Markdown ayrıştırma
# ---------------------------------------------------------------------------


def split_row(line: str) -> list[str]:
    line = line.strip().strip("|")
    cells = re.split(r"(?<!\\)\|", line)
    return [c.strip() for c in cells]


def word_width(word: str, size: float) -> float:
    if word.startswith("`") or word.endswith("`"):
        return pdfmetrics.stringWidth(word.strip("`"), "Menlo", size)
    return pdfmetrics.stringWidth(word.replace("**", ""), "Arial-Bold", size)


def col_widths(rows: list[list[str]], total: float, size: float, pad: float) -> list[float]:
    n = len(rows[0])
    need = []
    for c in range(n):
        texts = [plain(r[c]).replace("\\|", "|") for r in rows if c < len(r)]
        longest = max((len(t) for t in texts), default=1)
        word = max((word_width(wd, size) for t in texts for wd in t.split()), default=1)
        need.append((min(longest, 70) ** 0.75, word))
    base = [max(nd[0], 2.2) for nd in need]
    widths = [b / sum(base) * total for b in base]
    # En uzun kelime sığsın: çok dar sütunları genişlet
    min_w = [min(nd[1] + 2 * pad + 2, total * 0.45) for nd in need]
    for _ in range(4):
        deficit = sum(max(0, m - w) for w, m in zip(widths, min_w))
        if deficit <= 0:
            break
        surplus_idx = [i for i in range(n) if widths[i] > min_w[i]]
        surplus = sum(widths[i] - min_w[i] for i in surplus_idx)
        widths = [max(w, m) for w, m in zip(widths, min_w)]
        for i in surplus_idx:
            widths[i] -= deficit * (widths[i] - min_w[i]) / surplus if surplus else 0
    return widths


def make_table(lines: list[str]) -> Table:
    header = split_row(lines[0])
    aligns = []
    for spec in split_row(lines[1]):
        if spec.startswith(":") and spec.endswith(":"):
            aligns.append(TA_CENTER)
        elif spec.endswith(":"):
            aligns.append(TA_RIGHT)
        else:
            aligns.append(TA_LEFT)
    body = [split_row(line) for line in lines[2:]]
    rows = [header] + body
    n = len(header)
    small = n >= 9
    widths = col_widths(rows, CONTENT_W, 7.2 if small else CELL.fontSize, 4 if small else 5)

    def cell(text, i, head):
        st = ParagraphStyle(
            "c",
            parent=CELL_HEAD if head else CELL,
            alignment=aligns[i],
            fontSize=7.2 if small else CELL.fontSize,
            leading=9.2 if small else CELL.leading,
        )
        return Paragraph(inline(text), st)

    data = [[cell(r[i] if i < len(r) else "", i, ri == 0) for i in range(n)] for ri, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, NAVY),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 if small else 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 if small else 5),
    ]
    # Tablodaki boş ilk hücreler (kategori grupları) → grup ayırıcı çizgisini kaldır
    for ri, r in enumerate(body, start=1):
        if r and r[0] == "" and ri > 1:
            style.append(("LINEABOVE", (0, ri), (0, ri), 0.6, colors.white))
    t.setStyle(TableStyle(style))
    return t


class QuoteBox(Flowable):
    def __init__(self, para: Paragraph):
        super().__init__()
        self.para = para

    def wrap(self, aw, ah):
        self.pw, self.ph = self.para.wrap(aw - 22, ah)
        self.width = aw
        self.height = self.ph + 14
        return aw, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(SUBTLE)
        c.setStrokeColor(LINE)
        c.roundRect(0, 0, self.width, self.height, 3, fill=1, stroke=1)
        c.setFillColor(ACCENT)
        c.rect(0, 0, 3, self.height, fill=1, stroke=0)
        self.para.drawOn(c, 13, 7)


def code_block(text: str) -> Table:
    text = plain(text)
    inner = CONTENT_W - 18
    longest = max(pdfmetrics.stringWidth(line, "Menlo", CODE.fontSize) for line in text.splitlines())
    style = CODE
    if longest > inner:
        size = CODE.fontSize * inner / longest
        style = ParagraphStyle("codeFit", parent=CODE, fontSize=size, leading=size * 1.4)
    pre = Preformatted(text, style)
    t = Table([[pre]], colWidths=[CONTENT_W])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SUBTLE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


class Heading(Paragraph):
    def __init__(self, text, style, level, key):
        super().__init__(text, style)
        self.toc_level = level
        self.toc_text = re.sub(r"<[^>]+>", "", text)
        self.key = key


def parse(md: str):
    lines = md.splitlines()
    title = subtitle = ""
    story = []
    i = 0
    heading_no = 0
    paragraph: list[str] = []

    def flush():
        if paragraph:
            story.append(Paragraph(inline(" ".join(paragraph)), BODY))
            paragraph.clear()

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("# ") and not title:
            title = s[2:].strip()
        elif s.startswith("**") and not subtitle and title and not story:
            subtitle = s
        elif s.startswith("## "):
            flush()
            heading_no += 1
            txt = inline(s[3:])
            if heading_no > 1:
                story.append(CondPageBreak(60 * mm))
            story.append(Heading(txt, H2, 0, f"h{heading_no}"))
        elif s.startswith("### "):
            flush()
            heading_no += 1
            story.append(CondPageBreak(40 * mm))
            story.append(Heading(inline(s[4:]), H3, 1, f"h{heading_no}"))
        elif s.startswith("```"):
            flush()
            j = i + 1
            block = []
            while not lines[j].strip().startswith("```"):
                block.append(lines[j])
                j += 1
            text = "\n".join(block)
            if "──►" in text:
                story.append(Spacer(1, 4))
                story.append(flow_diagram())
                story.append(Spacer(1, 6))
            else:
                story.append(Spacer(1, 2))
                story.append(code_block(text))
                story.append(Spacer(1, 7))
            i = j
        elif s.startswith("|"):
            flush()
            j = i
            block = []
            while j < len(lines) and lines[j].strip().startswith("|"):
                block.append(lines[j])
                j += 1
            table = make_table(block)
            prev = story[-1] if story else None
            # "Sezon endeksi — …" başlığı tablosuyla birlikte kalsın
            if isinstance(prev, Paragraph) and not isinstance(prev, Heading) and len(block) <= 4:
                story[-1] = KeepTogether([prev, table])
            else:
                story.append(table)
            story.append(Spacer(1, 8))
            i = j - 1
        elif s.startswith("> "):
            flush()
            story.append(QuoteBox(Paragraph(inline(s[2:]), QUOTE)))
            story.append(Spacer(1, 8))
        elif re.match(r"^\d+\.\s", s):
            flush()
            num, rest = s.split(" ", 1)
            story.append(Paragraph(inline(rest), LIST, bulletText=num))
        elif s.startswith("- "):
            flush()
            story.append(Paragraph(inline(s[2:]), LIST, bulletText="•"))
        elif s == "---" or s == "":
            flush()
        else:
            paragraph.append(s)
        i += 1
    flush()
    return title, subtitle, story


# ---------------------------------------------------------------------------
# Belge
# ---------------------------------------------------------------------------


class MethodologyDoc(BaseDocTemplate):
    def __init__(self, path, title, **kw):
        super().__init__(path, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X, topMargin=24 * mm, bottomMargin=20 * mm, title=title, author="AlphaAnalytica", subject="Kredi değerlendirme modeli metodolojisi (Model v1.0)", **kw)
        frame = Frame(MARGIN_X, 20 * mm, CONTENT_W, PAGE_H - 44 * mm, id="body", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate("cover", [frame], onPage=self.cover_page), PageTemplate("body", [frame], onPage=self.body_page)])
        self.doc_title = title

    def afterFlowable(self, f):
        if isinstance(f, Heading):
            self.canv.bookmarkPage(f.key)
            self.canv.addOutlineEntry(f.toc_text, f.key, level=f.toc_level, closed=f.toc_level == 0 and False)
            self.notify("TOCEntry", (f.toc_level, f.toc_text, self.page, f.key))

    def cover_page(self, c, doc):
        c.saveState()
        c.setFillColor(NAVY)
        c.rect(0, PAGE_H - 12 * mm, PAGE_W, 12 * mm, fill=1, stroke=0)
        c.setFillColor(ACCENT)
        c.rect(0, PAGE_H - 13.2 * mm, PAGE_W, 1.2 * mm, fill=1, stroke=0)
        c.setFont("Arial", 7.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN_X, 12 * mm, "AlphaAnalytica · TEKNOFEST 2026 Finansal Teknolojiler · Çevrimdışı demo")
        c.restoreState()

    def body_page(self, c, doc):
        c.saveState()
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(MARGIN_X, PAGE_H - 16 * mm, PAGE_W - MARGIN_X, PAGE_H - 16 * mm)
        c.setFont("Arial-Bold", 8)
        c.setFillColor(NAVY)
        c.drawString(MARGIN_X, PAGE_H - 13.5 * mm, "AlphaAnalytica")
        c.setFont("Arial", 8)
        c.setFillColor(MUTED)
        c.drawString(MARGIN_X + pdfmetrics.stringWidth("AlphaAnalytica ", "Arial-Bold", 8), PAGE_H - 13.5 * mm, "· Metodoloji · Model v1.0")
        c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 13.5 * mm, "Dinamik Bilançolar ile Risk Analizi")
        c.line(MARGIN_X, 14 * mm, PAGE_W - MARGIN_X, 14 * mm)
        c.setFont("Arial", 7.5)
        c.drawString(MARGIN_X, 10 * mm, "Tüm parametreler src/engine/modelConfig.ts (DEFAULT_MODEL_CONFIG) kaynaklıdır.")
        c.drawRightString(PAGE_W - MARGIN_X, 10 * mm, f"Sayfa {doc.page}")
        c.restoreState()


def cover(title: str, subtitle: str, intro: Paragraph | None) -> list:
    t = ParagraphStyle("t", fontName="Arial-Bold", fontSize=30, leading=36, textColor=NAVY)
    st = ParagraphStyle("st", fontName="Arial", fontSize=13, leading=18, textColor=MUTED)
    label = ParagraphStyle("lbl", fontName="Arial", fontSize=7.5, leading=10, textColor=MUTED)
    val = ParagraphStyle("val", fontName="Arial-Bold", fontSize=10, leading=13, textColor=INK)
    name, _, rest = title.partition("—")
    today = date.today()
    months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    meta = [
        ("BELGE", "Model metodolojisi"),
        ("MODEL SÜRÜMÜ", "v1.0 (varsayılan)"),
        ("TARİH", f"{today.day} {months[today.month - 1]} {today.year}"),
        ("KAPSAM", "10 sektör · 16 firma"),
    ]
    meta_t = Table([[Paragraph(k, label) for k, _ in meta], [Paragraph(v, val) for _, v in meta]], colWidths=[CONTENT_W / 4] * 4, hAlign="LEFT")
    meta_t.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 0.8, NAVY), ("TOPPADDING", (0, 0), (-1, -1), 5), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    items = [
        Spacer(1, 48 * mm),
        Paragraph(name.strip(), ParagraphStyle("brand", fontName="Arial-Bold", fontSize=11, leading=14, textColor=ACCENT)),
        Spacer(1, 4),
        Paragraph(rest.strip() or title, t),
        Spacer(1, 6),
        Paragraph(inline(subtitle).replace("<b>", "").replace("</b>", ""), st),
        Spacer(1, 18 * mm),
        meta_t,
        Spacer(1, 16 * mm),
    ]
    if intro is not None:
        items.append(intro)
    return items


def main(src: str, out: str):
    md = open(src, encoding="utf-8").read()
    title, subtitle, story = parse(md)
    # Giriş paragrafı ve görünürlük notu kapağa alınır (ilk başlığa kadar olan kısım)
    first_heading = next(i for i, f in enumerate(story) if isinstance(f, Heading))
    intro_items = story[:first_heading]
    body = story[first_heading:]

    toc = TableOfContents()
    toc.levelStyles = [TOC_1, TOC_2]
    toc.dotsMinLevel = 0

    flow = cover(title, subtitle, None)
    flow += intro_items
    flow += [NextPageTemplate("body"), PageBreak(), Paragraph("İçindekiler", H2), Spacer(1, 4), toc, PageBreak()]
    flow += body

    doc = MethodologyDoc(out, title=plain(title))
    doc.multiBuild(flow)
    print(f"{out} yazıldı")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "METODOLOJI.md", sys.argv[2] if len(sys.argv) > 2 else "docs/METODOLOJI.pdf")
