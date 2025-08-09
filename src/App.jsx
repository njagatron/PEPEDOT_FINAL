import React, { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function App() {
  const STORAGE_PREFIX = "pepedot2_rn_";

  const [rnList, setRnList] = useState([]);
  const [activeRn, setActiveRn] = useState("");

  const [pdfs, setPdfs] = useState([]); // [{id,name,data:Array<number>,numPages}]
  const [activePdfIdx, setActivePdfIdx] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);

  const [points, setPoints] = useState([]); // [{xNorm,yNorm,name,comment,imageData,originalName,dateISO,pdfIdx,page,source,sessionId}]
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const sessionId = useMemo(() => Date.now(), []);

  const [pdfError, setPdfError] = useState("");
  const [loading, setLoading] = useState(false);

  // NOVO: način odabira izvora fotke (kamera/galerija) koji čeka klik na PDF
  const [pendingSource, setPendingSource] = useState(null); // "captured" | "uploaded" | null

  const pageWrapRef = useRef(null);
  const exportRef = useRef(null);

  const deco = {
    bg: "#0d1f24",
    card: "#10282f",
    edge: "#12343b",
    ink: "#e7ecef",
    gold: "#c9a227",
    accent: "#2a6f77",
  };

  useEffect(() => {
    const savedList = JSON.parse(localStorage.getItem("pepedot2_rn_list") || "[]");
    const savedActive = localStorage.getItem("pepedot2_active_rn") || "";
    setRnList(savedList);
    if (savedActive && savedList.includes(savedActive)) loadRn(savedActive);
  }, []);

  useEffect(() => {
    if (!activeRn) return;
    const payload = { pdfs, activePdfIdx, pageNumber, points };
    localStorage.setItem(STORAGE_PREFIX + activeRn, JSON.stringify(payload));
  }, [pdfs, activePdfIdx, pageNumber, points, activeRn]);

  const loadRn = (rn) => {
    const raw = localStorage.getItem(STORAGE_PREFIX + rn);
    const data = raw ? JSON.parse(raw) : { pdfs: [], activePdfIdx: 0, pageNumber: 1, points: [] };
    setActiveRn(rn);
    localStorage.setItem("pepedot2_active_rn", rn);
    setPdfs(data.pdfs || []);
    setActivePdfIdx(data.activePdfIdx || 0);
    setPageNumber(data.pageNumber || 1);
    setPoints(data.points || []);
    setShowAllSessions(false);
  };

  const createRn = () => {
    const name = (window.prompt("Unesi naziv novog RN-a (npr. RN001 ili RN1-KAT):") || "").trim();
    if (!name) return;
    if (rnList.includes(name)) return window.alert("RN s tim nazivom već postoji.");
    const updated = [...rnList, name];
    setRnList(updated);
    localStorage.setItem("pepedot2_rn_list", JSON.stringify(updated));
    setActiveRn(name);
    localStorage.setItem("pepedot2_active_rn", name);
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify({ pdfs: [], activePdfIdx: 0, pageNumber: 1, points: [] }));
    setPdfs([]); setActivePdfIdx(0); setPageNumber(1); setPoints([]);
  };

  const renameRn = () => {
    if (!activeRn) return;
    const newName = (window.prompt("Novi naziv za RN:", activeRn) || "").trim();
    if (!newName || newName === activeRn) return;
    if (rnList.includes(newName)) return window.alert("RN s tim nazivom već postoji.");
    const oldKey = STORAGE_PREFIX + activeRn;
    const data = localStorage.getItem(oldKey);
    if (data) {
      localStorage.setItem(STORAGE_PREFIX + newName, data);
      localStorage.removeItem(oldKey);
    }
    const updated = rnList.map((r) => (r === activeRn ? newName : r));
    setRnList(updated);
    localStorage.setItem("pepedot2_rn_list", JSON.stringify(updated));
    setActiveRn(newName);
    localStorage.setItem("pepedot2_active_rn", newName);
  };

  const deleteRnWithConfirm = (rnName) => {
    const confirmation = window.prompt(`Za brisanje RN-a upišite njegov naziv: "${rnName}"`);
    if (confirmation !== rnName) return window.alert("Naziv RN-a nije ispravan, brisanje otkazano.");
    if (!window.confirm(`Jeste li sigurni da želite obrisati RN "${rnName}"?`)) return;
    localStorage.removeItem(STORAGE_PREFIX + rnName);
    const updated = rnList.filter((x) => x !== rnName);
    setRnList(updated);
    localStorage.setItem("pepedot2_rn_list", JSON.stringify(updated));
    if (activeRn === rnName) {
      setActiveRn("");
      localStorage.removeItem("pepedot2_active_rn");
      setPdfs([]); setActivePdfIdx(0); setPageNumber(1); setPoints([]);
    }
  };

  const addPdf = async (file) => {
    setLoading(true);
    setPdfError("");
    try {
      const buf = await file.arrayBuffer();
      const uint8 = new Uint8Array(buf);
      const item = { id: Date.now(), name: file.name || "tlocrt.pdf", data: Array.from(uint8), numPages: 1 };
      const next = [...pdfs, item];
      setPdfs(next);
      setActivePdfIdx(next.length - 1);
      setPageNumber(1);
    } catch (e) {
      console.error("addPdf error:", e);
      setPdfError("Ne mogu učitati ovaj PDF (addPdf).");
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await addPdf(f);
    e.target.value = "";
  };

  const selectPdf = (idx) => {
    if (idx < 0 || idx >= pdfs.length) return;
    setActivePdfIdx(idx);
    setPageNumber(1);
  };

  const renamePdf = (idx) => {
    const p = pdfs[idx];
    const newName = (window.prompt("Novi naziv PDF-a:", p.name) || "").trim();
    if (!newName) return;
    const next = [...pdfs];
    next[idx] = { ...p, name: newName };
    setPdfs(next);
  };

  const deletePdfWithConfirm = (idx) => {
    const p = pdfs[idx];
    if (!p) return;
    const confirmation = window.prompt(`Za brisanje PDF-a upišite njegov naziv: "${p.name}"`);
    if (confirmation !== p.name) return window.alert("Naziv PDF-a nije ispravan, brisanje otkazano.");
    if (!window.confirm(`Jeste li sigurni da želite obrisati PDF "${p.name}"? (točke s tog PDF-a će se obrisati)`)) return;
    const filteredPoints = points.filter(pt => pt.pdfIdx !== idx);
    const reindexed = filteredPoints.map(pt => ({ ...pt, pdfIdx: pt.pdfIdx > idx ? pt.pdfIdx - 1 : pt.pdfIdx }));
    const next = pdfs.filter((_, i) => i !== idx);
    setPoints(reindexed);
    setPdfs(next);
    if (next.length === 0) { setActivePdfIdx(0); setPageNumber(1); }
    else { setActivePdfIdx(Math.max(0, idx - 1)); setPageNumber(1); }
  };

  const onDocLoad = ({ numPages }) => setNumPages(numPages);

  const pageFile = (() => {
    const p = pdfs[activePdfIdx];
    if (!p) return null;
    const u8 = new Uint8Array(p.data);
    return { data: u8 };
  })();

  const pickPhoto = (preferCamera=false) => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (preferCamera) input.capture = "environment";
    input.onchange = (ev) => resolve(ev.target.files?.[0] || null);
    input.click();
  });

  const overlayClick = async (e) => {
    if (!pdfs.length) return;

    // Odabir izvora: ako je postavljen preko gumba, koristimo ga; inače pitamo
    let source = pendingSource; // "captured" | "uploaded" | null
    if (!source) {
      const preferCamera = window.confirm("Želite li fotografirati (OK) ili odabrati iz galerije (Cancel)?");
      source = preferCamera ? "captured" : "uploaded";
    }

    const base = window.prompt("Unesi naziv točke (npr. A233VIO):");
    if (!base) { setPendingSource(null); return; }
    const comment = window.prompt("Unesi komentar (opcionalno):") || "";

    const photo = await pickPhoto(source === "captured");
    if (!photo) { setPendingSource(null); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const rect = pageWrapRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const fullName = `${base}${yyyy}${mm}${dd}`;
      const pt = {
        xNorm: x, yNorm: y,
        name: fullName,
        comment,
        imageData: reader.result,
        originalName: photo.name || (source === "captured" ? "camera.jpg" : "gallery.jpg"),
        dateISO: `${yyyy}-${mm}-${dd}`,
        pdfIdx: activePdfIdx,
        page: pageNumber,
        source,
        sessionId
      };
      setPoints(prev => [...prev, pt]);
      setPendingSource(null);
    };
    reader.readAsDataURL(photo);
  };

  const editPoint = (globalIdx) => {
    const copy = [...points];
    const p = copy[globalIdx];
    const newName = window.prompt("Uredi naziv točke:", p.name);
    if (newName !== null && newName.trim() !== "") p.name = newName.trim();
    const newComment = window.prompt("Uredi komentar:", p.comment || "");
    if (newComment !== null) p.comment = newComment;
    setPoints(copy);
  };

  const deletePoint = (globalIdx) => {
    if (!window.confirm("Obrisati ovu točku?")) return;
    const copy = [...points];
    copy.splice(globalIdx, 1);
    setPoints(copy);
  };

  const exportExcel = () => {
    const list = points
      .filter((p) => pdfs[p.pdfIdx])
      .filter((p) => (showAllSessions ? true : p.sessionId === sessionId))
      .filter((p) => p.pdfIdx === activePdfIdx && p.page === pageNumber);
    const data = list.map((p, i) => ({
      ID: i + 1,
      NazivTocke: p.name,
      NazivFotografije: p.originalName || "",
      Datum: p.dateISO || ""
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tocke");
    XLSX.writeFile(wb, "tocke.xlsx");
  };

  const exportPDF = async () => {
    const node = exportRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2 });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(img, "PNG", 6, 6, pw - 12, ph - 12);
    pdf.save("nacrt_s_tockama.pdf");
  };

  const wrap = { minHeight: "100%", background: `linear-gradient(180deg, ${deco.bg} 0%, #0b181c 100%)`, color: deco.ink, fontFamily: "Inter,system-ui,Arial,sans-serif" };
  const container = { maxWidth: 1180, margin: "0 auto", padding: 16 };
  const panel = { background: deco.card, border: `1px solid ${deco.edge}`, borderRadius: 14, padding: 12, boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 6px 24px rgba(0,0,0,0.25)" };
  const btn = {
    base: { padding: "8px 12px", borderRadius: 10, border: `1px solid ${deco.edge}`, background: "#0f2328", color: deco.ink, cursor: "pointer" },
    primary: { background: deco.accent, borderColor: deco.accent, color: "#fff" },
    gold: { background: deco.gold, borderColor: deco.gold, color: "#1a1a1a" },
    warn: { background: "#d99114", borderColor: "#d99114", color: "#fff" },
    danger: { background: "#a62c2b", borderColor: "#a62c2b", color: "#fff" },
    ghost: { background: "transparent" },
  };

  const currentPoints = points
    .map((p, idx) => ({ ...p, _idx: idx }))
    .filter((p) => p.pdfIdx === activePdfIdx && p.page === pageNumber)
    .filter((p) => (showAllSessions ? true : p.sessionId === sessionId));

  return (
    <div style={wrap}>
      <div style={container}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: deco.gold, display: "grid", placeItems: "center", color: "#1b1b1b", fontWeight: 800, letterSpacing: 1 }}>P</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>PEPEDOT 2</div>
              <div style={{ fontSize: 12, color: "#b7c3c8" }}>PP BRTVLJENJE - FOTOTOČKA NANACRTU</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ ...btn.base, ...btn.primary }} onClick={createRn}>+ Novi RN</button>
            <button style={{ ...btn.base }} onClick={renameRn} disabled={!activeRn}>Preimenuj RN</button>
          </div>
        </header>

        <section style={{ ...panel, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#b9c6ca" }}>
              Aktivni RN: {activeRn ? <strong style={{ color: deco.gold, marginLeft: 4 }}>{activeRn}</strong> : "nema"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {rnList.map((rn) => (
              <div key={rn} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button style={{ ...btn.base, ...(rn === activeRn ? btn.gold : btn.ghost) }} onClick={() => loadRn(rn)}>{rn}</button>
                <button style={{ ...btn.base, ...btn.danger }} onClick={() => deleteRnWithConfirm(rn)}>Obriši</button>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...panel, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="file" accept=".pdf,application/pdf" onChange={handlePdfUpload}
              style={{ padding: 6, background: "#0f2328", border: `1px solid ${deco.edge}`, borderRadius: 10, color: deco.ink }} />
            {!!pdfs.length && (<>
              <span style={{ fontSize: 12, color: "#c7d3d7" }}>
                Aktivni PDF: <strong style={{ color: deco.gold }}>{pdfs[activePdfIdx]?.name}</strong>
              </span>
              <button style={{ ...btn.base }} onClick={() => renamePdf(activePdfIdx)} disabled={!pdfs.length}>Preimenuj PDF</button>
              <button style={{ ...btn.base, ...btn.danger }} onClick={() => deletePdfWithConfirm(activePdfIdx)} disabled={!pdfs.length}>Obriši PDF</button>
            </>)}
            <div style={{ flex: 1 }} />
            <button style={{ ...btn.base }} onClick={() => setShowAllSessions(s => !s)}>
              {showAllSessions ? "Prikaži samo novu sesiju" : "Prikaži sve sesije"}
            </button>
            <button style={{ ...btn.base }} onClick={exportExcel}>Izvoz Excel</button>
            <button style={{ ...btn.base, ...btn.gold }} onClick={exportPDF}>Izvoz PDF</button>
          </div>

          {/* NOVO: gumbi za biranje izvora fotografije */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button
              style={{ ...btn.base, ...btn.primary }}
              onClick={() => setPendingSource("captured")}
              disabled={!pdfs.length}
              title="Započni dodavanje točke kamerom, pa dodirni tlocrt"
            >
              📷 Nova točka (kamera)
            </button>
            <button
              style={{ ...btn.base }}
              onClick={() => setPendingSource("uploaded")}
              disabled={!pdfs.length}
              title="Započni dodavanje točke izborom fotke iz galerije, pa dodirni tlocrt"
            >
              📁 Nova točka (galerija)
            </button>
            {pendingSource && (
              <div style={{ alignSelf: "center", fontSize: 12, color: "#cfdadd" }}>
                Dodirni tlocrt za poziciju točke…
              </div>
            )}
          </div>

          {pdfError && <div style={{ marginTop: 8, fontSize: 12, color: "#ffb3b3" }}>{pdfError}</div>}

          {!!pdfs.length && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {pdfs.map((p, i) => (
                <button key={p.id} style={{ ...btn.base, ...(i === activePdfIdx ? btn.gold : btn.ghost) }} onClick={() => selectPdf(i)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section ref={exportRef} style={{ ...panel }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Tlocrt</div>
            <div style={{ fontSize: 12, color: "#9fb2b8" }}>
              {activeRn && <span style={{ marginRight: 12 }}>RN: <strong style={{ color: deco.gold }}>{activeRn}</strong></span>}
              {!!pdfs.length && <span>Datoteka: <strong style={{ color: deco.gold }}>{pdfs[activePdfIdx]?.name}</strong></span>}
            </div>
          </div>

          <div
            ref={pageWrapRef}
            onClick={overlayClick}
            style={{ position: "relative", border: `1px solid ${deco.edge}`, borderRadius: 12, overflow: "hidden", background: "#0f2328", padding: 8 }}
            title="Klikni na tlocrt da dodaš točku s fotografijom"
          >
            {pageFile ? (
              <Document
                file={pageFile}
                onLoadSuccess={onDocLoad}
                onLoadError={(e) => setPdfError("Greška pri učitavanju PDF-a.")}
              >
                <Page pageNumber={pageNumber} width={Math.min(1100, window.innerWidth - 60)} />
              </Document>
            ) : (
              <div style={{ padding: 24, color: "#9fb2b8" }}>Učitaj PDF kako bi započeo.</div>
            )}

            {currentPoints.map((p, i) => (
              <div key={p._idx} style={{ position: "absolute", left: `${p.xNorm*100}%`, top: `${p.yNorm*100}%`, transform: "translate(-50%,-50%)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: deco.gold, border: "2px solid #000" }} />
                <div style={{ position: "absolute", left: 10, top: -10, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 6px", borderRadius: 8, fontSize: 12 }}>
                  {p.name}
                </div>
              </div>
            ))}
          </div>

          {!!pdfs.length && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <button style={{ ...btn.base }} onClick={() => setPageNumber(p => Math.max(1, p-1))}>◀</button>
              <span style={{ fontSize: 12, color: "#c7d3d7" }}>Stranica: <strong>{pageNumber}</strong> / {numPages}</span>
              <button style={{ ...btn.base }} onClick={() => setPageNumber(p => Math.min(numPages, p+1))}>▶</button>
            </div>
          )}
        </section>

        <section style={{ ...panel, marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Fotografije (lista — klik na ikonu za pregled)</div>
          <div style={{ display: "grid", gap: 8 }}>
            {currentPoints.map((p) => (
              <div key={p._idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: `1px solid ${deco.edge}`, borderRadius: 10, padding: "8px 10px", background: "#0f2328" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button style={{ ...btn.base }} onClick={() => setPreviewPhoto(p)} title="Pregled fotografije">🔍</button>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#9fb2b8" }}>{p.originalName} · {p.dateISO} · {p.source === "captured" ? "kamera" : "galerija"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={p.imageData} download={`${p.source}_${p.originalName || "photo.jpg"}`} style={{ ...btn.base, ...btn.ghost, textDecoration: "none" }} title="Preuzmi fotografiju">⬇️</a>
                  <button style={{ ...btn.base, ...btn.warn }} onClick={() => editPoint(p._idx)}>Uredi</button>
                  <button style={{ ...btn.base, ...btn.danger }} onClick={() => deletePoint(p._idx)}>Obriši</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {previewPhoto && (
          <div onClick={() => setPreviewPhoto(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "grid", placeItems: "center", zIndex: 9999, padding: 16 }} title="Zatvori">
            <div style={{ maxWidth: "95vw", maxHeight: "90vh", background: "#0f2328", border: `1px solid ${deco.edge}`, borderRadius: 12, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{previewPhoto.name}</div>
                <button style={{ ...btn.base, ...btn.danger }} onClick={() => setPreviewPhoto(null)}>Zatvori ✖</button>
              </div>
              <img src={previewPhoto.imageData} alt={previewPhoto.name} style={{ maxWidth: "90vw", maxHeight: "75vh", borderRadius: 8 }} />
            </div>
          </div>
        )}

        <footer style={{ textAlign: "center", fontSize: 12, color: "#8ea3a9", padding: 16 }}>
          © {new Date().getFullYear()} PEPEDOT 2 · PP BRTVLJENJE - FOTOTOČKA NANACRTU
        </footer>
      </div>
    </div>
  );
}
