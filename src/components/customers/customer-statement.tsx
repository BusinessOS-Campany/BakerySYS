"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ArrowRight, Download, FileText, Printer, Share2 } from "lucide-react";
import { apiFetch } from "@/components/workflows/shared";
import { translate, type Locale } from "@/lib/i18n/dictionary";
import type { StatementPayload, StatementTransaction } from "@/lib/customers/types";

type CustomerRow = {
  id: string;
  code?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  phone?: string | null;
  balance?: string | number | null;
};

type ShareNavigator = Navigator & {
  canShare?: (data: { files?: File[]; text?: string; title?: string }) => boolean;
  share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>;
};

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const ROWS_PER_PAGE = 12;
const BORDER = "#d5d8dc";
const HEADER_BG = "#f1f2f4";

const sheetStyle: CSSProperties = {
  boxSizing: "border-box",
  padding: "42px 46px",
  height: "100%",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  alignItems: "start",
  marginBottom: 10,
};

const bakeryStyle: CSSProperties = { fontSize: 26, fontWeight: 700, color: "#111", textAlign: "right" };
const titleStyle: CSSProperties = { fontSize: 26, fontWeight: 700, color: "#111", textAlign: "left" };
const metaStyle: CSSProperties = { fontSize: 15, color: "#333", marginTop: 4 };
const dividerStyle: CSSProperties = { borderBottom: "1px solid #111", margin: "18px 0 22px" };

const infoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  columnGap: 40,
  rowGap: 10,
  marginBottom: 22,
  fontSize: 16,
  textAlign: "right",
};

const infoLabelStyle: CSSProperties = { color: "#222", marginLeft: 10 };
const infoValueStyle: CSSProperties = { color: "#111", fontWeight: 700 };

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  fontSize: 16,
  direction: "inherit",
};

const thStyle: CSSProperties = {
  border: `1px solid ${BORDER}`,
  background: HEADER_BG,
  padding: "12px 10px",
  fontSize: 16,
  textAlign: "center",
  fontWeight: 700,
  color: "#111",
};

const tdBaseStyle: CSSProperties = {
  border: `1px solid ${BORDER}`,
  padding: "13px 12px",
  fontSize: 16,
  color: "#111",
};

const tdCenterStyle: CSSProperties = { ...tdBaseStyle, textAlign: "center", whiteSpace: "nowrap" };
const tdRightStyle: CSSProperties = { ...tdBaseStyle, textAlign: "right", whiteSpace: "nowrap" };
const openingStyle: CSSProperties = { ...tdBaseStyle, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" };
const totalStyle: CSSProperties = { ...tdBaseStyle, textAlign: "center", fontWeight: 700, background: HEADER_BG, whiteSpace: "nowrap" };

const footerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  alignItems: "end",
  columnGap: 24,
  marginTop: 16,
  direction: "inherit",
};

const finalBoxStyle: CSSProperties = {
  background: HEADER_BG,
  borderRadius: 10,
  padding: "14px 20px",
  fontWeight: 700,
  fontSize: 18,
  minWidth: 300,
  textAlign: "right",
  color: "#111",
  justifySelf: "start",
};

const signatureStyle: CSSProperties = { width: 220, textAlign: "left", color: "#111", justifySelf: "end" };
const signatureLineStyle: CSSProperties = { borderTop: "1px solid #111", marginBottom: 6 };
const signatureLabelStyle: CSSProperties = { fontSize: 15 };

export function CustomerStatement({
  customer,
  locale,
  currency,
  decimalPlaces,
  onBack,
}: {
  customer: CustomerRow;
  locale: Locale;
  currency: string;
  decimalPlaces: number;
  onBack: () => void;
}) {
  const t = useCallback((key: string) => translate(locale, key), [locale]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<StatementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [previewScale, setPreviewScale] = useState(1);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewHostRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const suffix = params.toString();
      setData(await apiFetch<StatementPayload>(`/api/customers/${customer.id}/statement${suffix ? `?${suffix}` : ""}`, locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [customer.id, from, locale, t, to]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host) return;
    const updateScale = () => {
      const availableWidth = host.clientWidth;
      setPreviewScale(availableWidth > 0 ? Math.min(1, availableWidth / PAGE_WIDTH) : 1);
    };
    updateScale();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
    const observer = new ResizeObserver(updateScale);
    observer.observe(host);
    return () => observer.disconnect();
  }, [data, loading]);

  const dateInputValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const selectPeriod = (periodType: "day" | "week" | "month" | "all") => {
    if (periodType === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const today = new Date();
    if (periodType === "day") {
      const value = dateInputValue(today);
      setFrom(value);
      setTo(value);
      return;
    }
    if (periodType === "week") {
      const start = new Date(today);
      start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      setFrom(dateInputValue(start));
      setTo(dateInputValue(end));
      return;
    }
    setFrom(dateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)));
    setTo(dateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  };

  const numberLocale = locale === "ar" ? "ar-YE-u-nu-latn" : "en-US";
  const money = (value: number) => new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number.isFinite(value) ? value : 0);
  const statementDate = (value: Date | string, withTime = false) => new Intl.DateTimeFormat(numberLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(typeof value === "string" ? new Date(value) : value);
  const statementCustomer = data?.customer;
  const name = statementCustomer
    ? locale === "ar" ? statementCustomer.nameAr || statementCustomer.nameEn : statementCustomer.nameEn || statementCustomer.nameAr
    : locale === "ar" ? customer.nameAr || customer.nameEn : customer.nameEn || customer.nameAr;
  const phone = statementCustomer?.phone ?? customer.phone;
  const fileName = `statement-${statementCustomer?.code || customer.code || customer.id}.pdf`;

  const transactions = data?.transactions ?? [];
  const pages = useMemo(() => {
    const chunks: StatementTransaction[][] = [];
    for (let index = 0; index < transactions.length; index += ROWS_PER_PAGE) {
      chunks.push(transactions.slice(index, index + ROWS_PER_PAGE));
    }
    if (chunks.length === 0) chunks.push([]);
    return chunks;
  }, [transactions]);

  const period = data
    ? `${data.from ? statementDate(data.from) : t("statement.allTime")} — ${data.to ? statementDate(data.to) : t("statement.allTime")}`
    : "";

  const infoItem = (label: string, value: string) => (
    <div>
      <span style={infoLabelStyle}>{label}:</span>
      <span style={infoValueStyle}>{value || "—"}</span>
    </div>
  );

  const buildPdf = async () => {
    const nodes = pageRefs.current.slice(0, pages.length).filter((node): node is HTMLDivElement => Boolean(node));
    if (nodes.length === 0) throw new Error(t("statement.generating"));
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [PAGE_WIDTH, PAGE_HEIGHT], compress: true });
    for (let index = 0; index < nodes.length; index += 1) {
        const canvas = await html2canvas(nodes[index], {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          windowWidth: PAGE_WIDTH,
          onclone: (clonedDocument) => {
            clonedDocument.querySelectorAll("[data-statement-preview-frame], [data-statement-preview-scale]").forEach((node) => {
              node.removeAttribute("style");
            });
          },
        });
      if (index > 0) pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], "portrait");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    }
    return pdf.output("blob");
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const download = async () => {
    setGenerating(true);
    setError("");
    try { downloadBlob(await buildPdf()); }
    catch (err) { setError(err instanceof Error ? err.message : t("common.error")); }
    finally { setGenerating(false); }
  };

  const sharePdf = async () => {
    setGenerating(true);
    setError("");
    try {
      const blob = await buildPdf();
      const file = new File([blob], fileName, { type: "application/pdf" });
      const title = `${t("statement.docTitle")} - ${name}`;
      const text = [
        title,
        data ? `${t("statement.period")}: ${period}` : "",
        data ? `${t("statement.balance")}: ${money(data.closingBalance)}` : "",
        t("statement.attachNote"),
      ].filter(Boolean).join("\n");
      const shareNavigator = navigator as ShareNavigator;
      if (shareNavigator.canShare?.({ files: [file], text, title }) && shareNavigator.share) {
        try { await shareNavigator.share({ files: [file], text, title }); } catch { }
        return;
      }
      if (shareNavigator.share) {
        try { await shareNavigator.share({ text, title }); } catch { }
        return;
      }
      downloadBlob(blob);
      const digits = (phone || "").replace(/\D/g, "");
      if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      else window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="statement-page -m-3 min-h-[calc(100vh-1.5rem)] bg-[#050608] p-4 text-white md:-m-5 md:min-h-[calc(100vh-2.5rem)] md:p-8">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="mb-6 grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
          <button className="btn btn-secondary w-fit" onClick={onBack} type="button">
            <ArrowRight className="ms-1 h-4 w-4" /> {t("statement.back")}
          </button>
          <h1 className="text-center text-2xl font-extrabold leading-tight md:text-4xl">
            {t("statement.title")} — {name}
          </h1>
          <div className="hidden md:block" />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center lg:justify-start">
          <button className="btn btn-secondary" disabled={loading} onClick={() => selectPeriod("all")} type="button">
            <FileText className="ms-1 h-4 w-4" /> {t("statement.full")}
          </button>
          <button className="btn btn-primary" disabled={generating || loading} onClick={() => void sharePdf()} type="button">
            <Share2 className="ms-1 h-4 w-4" /> {generating ? t("statement.generating") : t("statement.share")}
          </button>
          <button className="btn btn-secondary" disabled={generating || loading} onClick={() => void download()} type="button">
            <Download className="ms-1 h-4 w-4" /> {generating ? t("statement.generating") : t("statement.pdf")}
          </button>
          <button className="btn btn-secondary" disabled={loading} onClick={() => window.print()} type="button">
            <Printer className="ms-1 h-4 w-4" /> {t("statement.print")}
          </button>
        </div>

        <div className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs font-medium text-white/85">
            {t("statement.from")}
            <input className="input mt-1" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </label>
          <label className="text-xs font-medium text-white/85">
            {t("statement.to")}
            <input className="input mt-1" onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button className="btn btn-secondary" onClick={() => selectPeriod("day")} type="button">{t("statement.day")}</button>
            <button className="btn btn-secondary" onClick={() => selectPeriod("week")} type="button">{t("statement.week")}</button>
            <button className="btn btn-secondary" onClick={() => selectPeriod("month")} type="button">{t("statement.month")}</button>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-lg border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">{error}</p> : null}

        <div className="statement-print-root rounded-2xl border border-black/10 bg-white p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)] md:p-5">
          {loading ? (
            <p className="muted p-8 text-center text-sm">{t("statement.loading")}</p>
          ) : data ? (
            <div className="statement-screen-preview flex w-full flex-col items-center gap-5 overflow-hidden" ref={previewHostRef}>
              {pages.map((rows, pageIndex) => {
                const isFirst = pageIndex === 0;
                const isLast = pageIndex === pages.length - 1;
                return (
                  <div
                    data-statement-preview-frame=""
                    key={pageIndex}
                    style={{
                      height: PAGE_HEIGHT * previewScale,
                      marginInline: "auto",
                      maxWidth: "100%",
                      overflow: "hidden",
                      position: "relative",
                      width: PAGE_WIDTH * previewScale,
                    }}
                  >
                    <div
                      data-statement-preview-scale=""
                      style={{
                        height: PAGE_HEIGHT,
                        left: "50%",
                        position: "absolute",
                        top: 0,
                        transform: `translateX(-50%) scale(${previewScale})`,
                        transformOrigin: "top center",
                        width: PAGE_WIDTH,
                      }}
                    >
                      <div
                        className="statement-page-wrap border border-[var(--border)] bg-white"
                        style={{ boxSizing: "border-box", width: PAGE_WIDTH }}
                      >
                        <div
                          className="statement-sheet"
                      dir={locale === "ar" ? "rtl" : "ltr"}
                      ref={(node) => { pageRefs.current[pageIndex] = node; }}
                    >
                      <div style={sheetStyle}>
                        <div style={headerStyle}>
                          <strong style={bakeryStyle}>
                            {locale === "ar" ? data.tenant.nameAr || data.tenant.nameEn : data.tenant.nameEn || data.tenant.nameAr}
                          </strong>
                          <strong style={titleStyle}>{t("statement.docTitle")}</strong>
                        </div>
                        <div style={metaStyle}>{t("statement.printDate")}: {statementDate(data.generatedAt, true)}</div>
                        <div style={metaStyle}>{t("statement.period")}: {period}</div>
                        <div style={dividerStyle} />

                        <div style={infoGridStyle}>
                          {infoItem(t("statement.name"), name || "")}
                          {infoItem(t("statement.code"), statementCustomer?.code || "")}
                          {infoItem(t("statement.phone"), phone || "")}
                          {infoItem(t("statement.creditLimit"), money(statementCustomer?.creditLimit ?? 0))}
                        </div>

                        <table style={tableStyle}>
                          <colgroup>
                            <col style={{ width: "17%" }} />
                            <col style={{ width: "27%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "20%" }} />
                          </colgroup>
                          <thead style={{ display: "table-header-group" }}>
                            <tr>
                              <th style={thStyle}>{t("statement.date")}</th>
                              <th style={thStyle}>{t("statement.description")}</th>
                              <th style={thStyle}>{t("statement.debit")}</th>
                              <th style={thStyle}>{t("statement.payment")}</th>
                              <th style={thStyle}>{t("statement.balanceAfter")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {isFirst ? (
                              <tr>
                                <td style={openingStyle} colSpan={4}>{t("statement.openingBalance")}</td>
                                <td style={tdCenterStyle}>{money(data.openingBalance)}</td>
                              </tr>
                            ) : null}
                            {rows.length === 0 ? (
                              <tr>
                                <td style={tdCenterStyle} colSpan={5}>{t("statement.noTransactions")}</td>
                              </tr>
                            ) : rows.map((row) => (
                              <tr key={row.id}>
                                <td style={tdCenterStyle}>{statementDate(row.date)}</td>
                                <td style={tdRightStyle}>{locale === "ar" ? row.descriptionAr : row.descriptionEn}</td>
                                <td style={tdCenterStyle}>{row.debit ? money(row.debit) : "—"}</td>
                                <td style={tdCenterStyle}>{row.credit ? money(row.credit) : "—"}</td>
                                <td style={tdCenterStyle}>{money(row.balance)}</td>
                              </tr>
                            ))}
                            {isLast ? (
                              <tr>
                                <td style={totalStyle} colSpan={2}>{t("statement.total")}</td>
                                <td style={totalStyle}>{money(data.totalDebit)}</td>
                                <td style={totalStyle}>{money(data.totalCredit)}</td>
                                <td style={totalStyle}></td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>

                        {isLast ? (
                          <div style={footerStyle}>
                            <div style={finalBoxStyle}>
                              {t("statement.finalBalance")}: {money(data.closingBalance)}
                            </div>
                            <div style={signatureStyle}>
                              <div style={signatureLineStyle} />
                              <div style={signatureLabelStyle}>{t("statement.signature")}</div>
                            </div>
                          </div>
                        ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted p-8 text-center text-sm">{t("statement.noTransactions")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
