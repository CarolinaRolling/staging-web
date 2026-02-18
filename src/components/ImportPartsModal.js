import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Check, AlertTriangle, FileText, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Fraction & thickness helpers ───────────────────────────────────────────

const UNICODE_FRACS = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅓': '1/3', '⅔': '2/3' };

function normalizeText(text) {
  let t = text;
  Object.entries(UNICODE_FRACS).forEach(([uni, frac]) => { t = t.replace(new RegExp(uni, 'g'), frac); });
  // Normalize mixed fracs like 1-1/2 or 1 1/2
  t = t.replace(/(\d+)\s*[-]\s*(\d+\/\d+)/g, '$1-$2');
  return t;
}

function fractionToDecimal(s) {
  if (!s) return 0;
  const clean = s.replace(/["\s]/g, '').trim();
  if (clean.includes('-')) {
    const [whole, frac] = clean.split('-');
    const [n, d] = frac.split('/').map(Number);
    return Number(whole) + (d ? n / d : 0);
  }
  if (clean.includes('/')) {
    const [n, d] = clean.split('/').map(Number);
    return d ? n / d : 0;
  }
  return parseFloat(clean) || 0;
}

function decimalToFraction(val) {
  if (!val) return '';
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  const fracs = [
    [1/8, '1/8"'], [3/16, '3/16"'], [1/4, '1/4"'], [5/16, '5/16"'], [3/8, '3/8"'],
    [1/2, '1/2"'], [5/8, '5/8"'], [3/4, '3/4"'], [7/8, '7/8"'],
    [1, '1"'], [1.25, '1-1/4"'], [1.5, '1-1/2"'], [2, '2"']
  ];
  for (const [dec, label] of fracs) {
    if (Math.abs(n - dec) < 0.005) return label;
  }
  return `${n}"`;
}

// ─── PART_TYPES for display ─────────────────────────────────────────────────

const PART_TYPES = {
  plate_roll: { label: 'Plate Roll', icon: '🔩' },
  flat_bar: { label: 'Flat Bar', icon: '▬' },
  angle_roll: { label: 'Angle Roll', icon: '📐' },
  pipe_roll: { label: 'Pipes/Tubes/Round', icon: '🔧' },
  press_brake: { label: 'Press Brake', icon: '⏏️' },
  flat_stock: { label: 'Flat Stock', icon: '📄' },
  other: { label: 'Other / Manual', icon: '📦' }
};

// ─── Smart parser ───────────────────────────────────────────────────────────

function parseExtractedText(rawText) {
  const text = normalizeText(rawText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const parts = [];

  // Try to parse multi-line PO format (like the PDF sample where description spans multiple lines)
  const poBlocks = tryParsePOBlocks(lines);
  if (poBlocks.length > 0) return poBlocks;

  // Try line-by-line parsing
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseSingleLine(line);
    if (parsed) {
      parts.push(parsed);
    }
  }

  // If no parts found via rolling patterns, try BOM/table format (Sample 2)
  if (parts.length === 0) {
    const bomParts = tryParseBOM(lines, rawText);
    if (bomParts.length > 0) return bomParts;
  }

  return parts;
}

// Parse PO-style multi-line blocks (PDF format from Nowell Steel)
function tryParsePOBlocks(lines) {
  const parts = [];
  // Look for lines that start with quantity patterns like "1 PCS", "4 PCS", "1 PC"
  // followed by material spec lines
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this line contains a full spec like "1 PCS 1/2" A36 34.75 X 227.77"
    // or "2 PCS 1/2" A36 10 X 48.57"
    const fullSpec = parseSingleLine(line);
    if (fullSpec) {
      // Look ahead for additional instructions on next lines
      let instructions = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        // Stop if we hit another quantity line or a header/empty
        if (/^\d+\s+(PCS?|PIECES?)\b/i.test(nextLine)) break;
        if (/^(LINE|QUANTITY|ITEM|WEIGHT|COST|AMOUNT|SALES ORDER|WIDTH)/i.test(nextLine)) { j++; continue; }
        if (/^(RF|ROLLING AND FORMING|ROLL\/TRIM|FORM AND|ROLL AND TACK|PER DWG)/i.test(nextLine)) {
          // This is additional instruction context - check for roll-to info
          const rollMatch = nextLine.match(/ROLL\s*(?:AND\s*TACK\s*)?(?:THE\s*EASY\s*WAY\s*)?TO\s*A?\s*([\d.]+)["\s]*(ID|OD|IR|OR)\b/i);
          if (rollMatch && !fullSpec.rollValue) {
            fullSpec.rollValue = rollMatch[1];
            fullSpec.rollMeasurePoint = rollMatch[2].toUpperCase().startsWith('I') ? 'inside' : 'outside';
            fullSpec.rollMeasureType = rollMatch[2].toUpperCase().endsWith('R') ? 'radius' : 'diameter';
          }
          if (/EASY\s*WAY/i.test(nextLine)) fullSpec.rollType = 'easy_way';
          if (/HARD\s*WAY/i.test(nextLine)) fullSpec.rollType = 'hard_way';
          if (/TACK/i.test(nextLine) && !fullSpec.specialInstructions.includes('tack')) {
            fullSpec.specialInstructions = (fullSpec.specialInstructions + ' Tack weld').trim();
          }
          if (/TRIM/i.test(nextLine) && !fullSpec.specialInstructions.includes('rim')) {
            fullSpec.specialInstructions = (fullSpec.specialInstructions + ' Trim').trim();
          }
          if (/DRILL/i.test(nextLine)) {
            const drillMatch = nextLine.match(/DRILL\s*\((\d+)\)\s*([\d\/\-."]+)\s*HOLES?/i);
            if (drillMatch) {
              fullSpec.specialInstructions = (fullSpec.specialInstructions + ` Drill (${drillMatch[1]}) ${drillMatch[2]} holes`).trim();
            }
          }
          if (/PER DWG/i.test(nextLine)) {
            fullSpec.specialInstructions = (fullSpec.specialInstructions + ` ${nextLine}`).trim();
          }
          j++;
          continue;
        }
        break;
      }
      parts.push(fullSpec);
      i = j;
      continue;
    }
    i++;
  }
  return parts;
}

// Parse a single line for plate roll / flat bar specs
function parseSingleLine(line) {
  const l = line.toUpperCase().replace(/[""]/g, '"');

  // Skip header / label lines
  if (/^(LINE|QUANTITY|ITEM|QNTY|GNB|DESCRIPTION|MATERIAL|NOTES|WEIGHT|COST|AMOUNT|TERMS|AUTHORIZED|PHONE|FAX|SHIP|PURCHASE|SALESPERSON|BUYER|VENDOR|PAGE|DATE|RECEIVE|NUMBER|ROLLING AND FORMING|FORM AND TRIM|ROLL\/TRIM|^RF$|SALES ORDER|PER DWG|WILL CALL|END ORDER|TOTAL)/i.test(l.trim())) return null;
  if (/^0\.000\s/i.test(l.trim())) return null;

  // ── Pattern 1: Plate roll — "qty pcs thickness grade width x length [R/T to diameter/radius]"
  // e.g. "1 PCS 1/2" A36 34.75 X 227.77" or "5 pcs 1/2" A36 8 x 133.92 R/T to a 42.125" ID"
  const plateRollRx = /^(\d+)\s*(?:PCS?|PIECES?|PC)\s+([\d\/\-."]+)["\s]+(?:X\s+)?([\d\/\-."]+\s*X\s+[\d.]+|[A-Z][\dA-Z\/]*(?:L?|\s*S\/S)?)\s+([\d.]+)\s*X\s*([\d.]+)/i;
  let m = l.match(plateRollRx);
  
  if (!m) {
    // Try alternate pattern: "qty pcs thickness width x length" (no grade, or grade after dimensions)
    const altRx = /^(\d+)\s*(?:PCS?|PIECES?|PC)\s+([\d\/\-."]+)["]\s+([A-Z][\dA-Z\/]*(?:L?|\s*S\/S)?)\s+([\d.]+)\s*X\s*([\d.]+)/i;
    m = l.match(altRx);
  }
  
  if (m) {
    const qty = parseInt(m[1]);
    const thicknessRaw = m[2].replace(/"/g, '').trim();
    const thickness = decimalToFraction(fractionToDecimal(thicknessRaw));
    
    // Determine if m[3] is grade or part of dimensions
    let grade = '', width = '', length = '';
    if (/^[A-Z]/i.test(m[3])) {
      grade = m[3].replace(/\s+/g, '').trim();
      width = m[4];
      length = m[5];
    } else {
      width = m[3] || m[4];
      length = m[5];
    }

    const part = {
      partType: 'plate_roll',
      quantity: qty,
      thickness: thickness,
      material: normalizeGrade(grade),
      width: width,
      length: length,
      rollType: '',
      rollValue: '',
      rollMeasurePoint: 'inside',
      rollMeasureType: 'diameter',
      specialInstructions: '',
      _rawLine: line,
      _confidence: 'high'
    };

    // Check for R/T (roll to) specification
    const rollToRx = /R\/T\s+TO\s+A?\s*([\d.]+)["\s]*(ID|OD|IR|OR)/i;
    const rollToMatch = l.match(rollToRx);
    if (rollToMatch) {
      part.rollValue = rollToMatch[1];
      part.rollMeasurePoint = rollToMatch[2].startsWith('I') ? 'inside' : 'outside';
      part.rollMeasureType = rollToMatch[2].endsWith('R') ? 'radius' : 'diameter';
    }

    // Check for ROLL TO / ROLL AND TACK TO
    const rollTo2Rx = /ROLL\s*(?:AND\s*TACK\s*)?(?:THE\s*EASY\s*WAY\s*)?TO\s*A?\s*([\d.]+)["\s]*(ID|OD|IR|OR)\b/i;
    const rollTo2Match = l.match(rollTo2Rx);
    if (rollTo2Match && !part.rollValue) {
      part.rollValue = rollTo2Match[1];
      part.rollMeasurePoint = rollTo2Match[2].startsWith('I') ? 'inside' : 'outside';
      part.rollMeasureType = rollTo2Match[2].endsWith('R') ? 'radius' : 'diameter';
    }

    // Check for Easy Way / Hard Way
    if (/EASY\s*WAY/i.test(l)) part.rollType = 'easy_way';
    if (/HARD\s*WAY/i.test(l)) part.rollType = 'hard_way';

    // Check for special instructions
    if (/TACK/i.test(l)) part.specialInstructions = 'Tack weld';
    if (/TRIM/i.test(l)) part.specialInstructions = (part.specialInstructions + ' Trim').trim();
    if (/DRILL/i.test(l)) {
      const drillMatch = l.match(/DRILL\s*\((\d+)\)\s*([\d\/\-."]+)\s*HOLES?/i);
      if (drillMatch) part.specialInstructions = (part.specialInstructions + ` Drill (${drillMatch[1]}) ${drillMatch[2]} holes`).trim();
    }
    if (/FORM\s+AND\s+TRIM/i.test(l)) {
      part.specialInstructions = 'Form and trim';
      part.partType = 'press_brake';
    }
    
    // If no roll value found and it's not a special case, it might be a form/trim piece
    if (!part.rollValue && !part.specialInstructions) {
      part._confidence = 'medium';
    }

    return part;
  }

  // ── Pattern 2: Flat bar — "qty pcs thickness x width x length BAR"
  // e.g. "1 PC 1/2" X 2 X 20' BAR SUPPLIED BY NOWELL"
  const barRx = /^(\d+)\s*(?:PCS?|PIECES?|PC)\s+([\d\/\-."]+)["\s]*X\s*([\d\/\-."]+)\s*X\s*([\d.']+)\s*(?:'|FT|FEET)?\s*(?:BAR|FLAT)/i;
  const barMatch = l.match(barRx);
  if (barMatch) {
    const qty = parseInt(barMatch[1]);
    const thickness = decimalToFraction(fractionToDecimal(barMatch[2].replace(/"/g, '')));
    const barWidth = barMatch[3].replace(/"/g, '').trim();
    let barLength = barMatch[4].replace(/'/g, '').trim();
    // Convert feet to inches if needed
    if (/'/i.test(line) || /FT|FEET/i.test(l)) {
      barLength = String(parseFloat(barLength) * 12);
    }

    const part = {
      partType: 'flat_bar',
      quantity: qty,
      thickness: thickness,
      material: 'A36',
      width: barWidth,
      length: barLength,
      rollType: '',
      rollValue: '',
      rollMeasurePoint: 'inside',
      rollMeasureType: 'diameter',
      specialInstructions: '',
      _rawLine: line,
      _confidence: 'high'
    };

    // Check for roll to
    const rollMatch = l.match(/ROLL\s*(?:AND\s*TACK\s*)?(?:THE\s*EASY\s*WAY\s*)?TO\s*A?\s*([\d.]+)["\s]*(ID|OD|IR|OR)\b/i);
    if (rollMatch) {
      part.rollValue = rollMatch[1];
      part.rollMeasurePoint = rollMatch[2].startsWith('I') ? 'inside' : 'outside';
      part.rollMeasureType = rollMatch[2].endsWith('R') ? 'radius' : 'diameter';
    }
    if (/EASY\s*WAY/i.test(l)) part.rollType = 'easy_way';
    if (/HARD\s*WAY/i.test(l)) part.rollType = 'hard_way';
    if (/TACK/i.test(l)) part.specialInstructions = 'Tack weld';
    if (/SUPPLIED BY/i.test(l)) {
      const supplierMatch = l.match(/SUPPLIED BY\s+([A-Z\s]+?)(?:\s+ROLL|\s+CAROLINA|\s*$)/i);
      if (supplierMatch) part.specialInstructions = (part.specialInstructions + ` Material supplied by ${supplierMatch[1].trim()}`).trim();
    }

    return part;
  }

  // ── Pattern 3: Simple plate spec without "PCS" — "qty thickness grade width x length R/T ..."
  // e.g. from Sample_1: "1 pc  1/2"  A36  96 x 133.92   R/T to a 42.125" ID"
  const simpleRx = /^(\d+)\s*(?:PCS?|PC|PIECES?)\s+([\d\/\-]+)["\s]+(A\d+|304(?:\/304L)?|316(?:\s*S\/S)?|AR\d+|[A-Z\d]+(?:\s*S\/S)?)\s+([\d.]+)\s*X\s*([\d.]+)/i;
  const simpleMatch = l.match(simpleRx);
  if (simpleMatch) {
    const part = {
      partType: 'plate_roll',
      quantity: parseInt(simpleMatch[1]),
      thickness: decimalToFraction(fractionToDecimal(simpleMatch[2].replace(/"/g, ''))),
      material: normalizeGrade(simpleMatch[3]),
      width: simpleMatch[4],
      length: simpleMatch[5],
      rollType: '',
      rollValue: '',
      rollMeasurePoint: 'inside',
      rollMeasureType: 'diameter',
      specialInstructions: '',
      _rawLine: line,
      _confidence: 'high'
    };

    const rollMatch = l.match(/R\/T\s+TO\s+A?\s*([\d.]+)["\s]*(ID|OD|IR|OR)/i) ||
                      l.match(/ROLL\s*(?:AND\s*TACK\s*)?(?:THE\s*EASY\s*WAY\s*)?TO\s*A?\s*([\d.]+)["\s]*(ID|OD|IR|OR)/i);
    if (rollMatch) {
      part.rollValue = rollMatch[1];
      part.rollMeasurePoint = rollMatch[2].startsWith('I') ? 'inside' : 'outside';
      part.rollMeasureType = rollMatch[2].endsWith('R') ? 'radius' : 'diameter';
    }
    if (/EASY\s*WAY/i.test(l)) part.rollType = 'easy_way';
    if (/HARD\s*WAY/i.test(l)) part.rollType = 'hard_way';

    return part;
  }

  return null;
}

// Parse BOM / table format (like Sample 2 with headers: QNTY, PART#, DESCRIPTION, MATERIAL, NOTES)
function tryParseBOM(lines, rawText) {
  const parts = [];
  
  // Detect if this looks like a tabular BOM
  const hasHeaders = lines.some(l => /QNTY|QTY|QUANTITY/i.test(l) && (/PART|DESCRIPTION|MATERIAL/i.test(l) || lines.indexOf(l) < 5));
  
  if (!hasHeaders) {
    // Try a simpler approach: look for lines starting with a number followed by text
    for (const line of lines) {
      const m = line.match(/^(\d+)\s+(.+)/);
      if (m) {
        const qty = parseInt(m[1]);
        if (qty > 0 && qty < 1000) {
          parts.push({
            partType: 'other',
            quantity: qty,
            thickness: '',
            material: '',
            width: '',
            length: '',
            rollType: '',
            rollValue: '',
            rollMeasurePoint: 'inside',
            rollMeasureType: 'diameter',
            specialInstructions: m[2].trim(),
            _rawLine: line,
            _confidence: 'low'
          });
        }
      }
    }
    return parts;
  }

  // Find header line index
  let headerIdx = lines.findIndex(l => /QNTY|QTY|QUANTITY/i.test(l));
  if (headerIdx < 0) return parts;

  // Parse remaining lines as data rows
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^\s*$/.test(line)) continue;
    
    // Try to extract: qty, part#, description, material, notes
    // These are typically tab or multi-space separated
    const fields = line.split(/\t+|\s{2,}/).map(f => f.trim()).filter(f => f);
    
    if (fields.length >= 2) {
      const qty = parseInt(fields[0]);
      if (isNaN(qty) || qty <= 0) continue;

      const partNumber = fields[1] || '';
      const description = fields[2] || '';
      const material = fields[3] || '';
      const notes = fields.slice(4).join(' ').trim();

      // Try to detect part type from description
      let partType = 'other';
      if (/ROLL|ROLLING/i.test(description)) partType = 'plate_roll';
      if (/FORMED|FORM/i.test(notes || description)) partType = 'press_brake';
      
      // Try to detect material grade
      let grade = material;
      if (/304|316|S\/S/i.test(material)) grade = material;
      else if (/A36/i.test(material)) grade = 'A36';

      parts.push({
        partType: partType,
        quantity: qty,
        thickness: '',
        material: grade,
        width: '',
        length: '',
        rollType: '',
        rollValue: '',
        rollMeasurePoint: 'inside',
        rollMeasureType: 'diameter',
        clientPartNumber: partNumber,
        specialInstructions: [description, notes].filter(Boolean).join(' — '),
        _rawLine: line,
        _confidence: 'medium'
      });
    }
  }

  return parts;
}

function normalizeGrade(g) {
  if (!g) return '';
  const upper = g.toUpperCase().replace(/\s+/g, '');
  if (upper === 'A36') return 'A36';
  if (upper.includes('304')) return '304 S/S';
  if (upper.includes('316')) return '316 S/S';
  if (upper.includes('AR400')) return 'AR400';
  return g.trim();
}

// ─── PDF text extraction (with OCR fallback for scanned PDFs) ────────────────

async function extractTextFromPDF(file, onStatus) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF.js library not loaded. Please refresh the page.');

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  let totalChars = 0;

  if (onStatus) onStatus(`Extracting text from ${pdf.numPages} page(s)...`);

  // First pass: try native text extraction
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by their Y position to reconstruct lines
    const items = textContent.items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: Math.round(item.transform[5]),
      width: item.width
    }));

    // Sort by Y (descending = top to bottom) then X (left to right)
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    // Group into lines by Y proximity
    let currentY = null;
    let currentLine = '';
    const pageLines = [];

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) > 5) {
        if (currentLine.trim()) pageLines.push(currentLine.trim());
        currentLine = item.text;
        currentY = item.y;
      } else {
        const gap = item.x - (currentLine.length * 4);
        currentLine += (gap > 20 ? '  ' : ' ') + item.text;
      }
    }
    if (currentLine.trim()) pageLines.push(currentLine.trim());

    const pageText = pageLines.join('\n');
    totalChars += pageText.replace(/\s/g, '').length;
    fullText += pageText + '\n--- PAGE BREAK ---\n';
  }

  // If we got meaningful text, return it
  // Threshold: at least 20 non-whitespace chars per page on average
  if (totalChars > pdf.numPages * 20) {
    return fullText;
  }

  // Second pass: OCR fallback for scanned PDFs
  if (onStatus) onStatus('Scanned PDF detected — running OCR (this may take a moment)...');
  
  const Tesseract = window.Tesseract;
  if (!Tesseract) throw new Error('OCR library not loaded. Please refresh the page.');

  let ocrText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (onStatus) onStatus(`OCR: Processing page ${pageNum} of ${pdf.numPages}...`);
    
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale = better OCR
    
    // Render page to canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    // Run OCR on the rendered image
    try {
      const result = await Tesseract.recognize(canvas, 'eng', {
        logger: () => {} // suppress progress logs
      });
      ocrText += result.data.text + '\n--- PAGE BREAK ---\n';
    } catch (ocrErr) {
      console.error(`OCR failed on page ${pageNum}:`, ocrErr);
      ocrText += `[OCR failed on page ${pageNum}]\n--- PAGE BREAK ---\n`;
    }
    
    // Cleanup
    canvas.width = 0;
    canvas.height = 0;
  }

  return ocrText;
}

async function extractTextFromFile(file, onStatus) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return await extractTextFromPDF(file, onStatus);
  }
  // Text file
  return await file.text();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ImportPartsModal({ isOpen, onClose, onImportParts, estimateId }) {
  const [step, setStep] = useState('upload'); // upload | review
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [parsedParts, setParsedParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setRawText('');
    setParsedParts([]);
    setSelectedParts(new Set());
    setImporting(false);
    setImportProgress(0);
    setError(null);
    setStatusMsg('');
    setShowRawText(false);
    setEditingIdx(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.toLowerCase().split('.').pop();
    if (!['pdf', 'txt', 'text', 'csv'].includes(ext)) {
      setError('Please upload a PDF or text file (.pdf, .txt)');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setStep('processing');
    setStatusMsg('Reading file...');

    try {
      const text = await extractTextFromFile(selectedFile, (status) => setStatusMsg(status));
      setRawText(text);
      setStatusMsg('Parsing parts...');
      const parts = parseExtractedText(text);
      setParsedParts(parts);
      // Select all by default
      setSelectedParts(new Set(parts.map((_, i) => i)));
      setStatusMsg('');
      setStep('review');
    } catch (err) {
      console.error('File processing error:', err);
      setError(`Failed to process file: ${err.message}`);
      setStep('upload');
      setStatusMsg('');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const togglePartSelection = (idx) => {
    setSelectedParts(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedParts.size === parsedParts.length) {
      setSelectedParts(new Set());
    } else {
      setSelectedParts(new Set(parsedParts.map((_, i) => i)));
    }
  };

  const updatePart = (idx, field, value) => {
    setParsedParts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const removePart = (idx) => {
    setParsedParts(prev => prev.filter((_, i) => i !== idx));
    setSelectedParts(prev => {
      const next = new Set();
      prev.forEach(i => {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      });
      return next;
    });
  };

  const handleImport = async () => {
    const toImport = parsedParts.filter((_, i) => selectedParts.has(i));
    if (toImport.length === 0) {
      setError('No parts selected for import');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setError(null);

    try {
      // Convert parsed parts to the format expected by addEstimatePart
      const partDataList = toImport.map(p => buildPartData(p));
      await onImportParts(partDataList, (progress) => setImportProgress(progress));
      handleClose();
    } catch (err) {
      console.error('Import error:', err);
      setError(`Import failed: ${err.message}`);
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 40, overflowY: 'auto'
    }} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div style={{
        background: 'white', borderRadius: 12, width: '95%', maxWidth: step === 'review' ? 1100 : 600,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid #e0e0e0'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
            <Upload size={20} style={{ verticalAlign: -4, marginRight: 8 }} />
            {step === 'upload' ? 'Import Parts from File' : `Review Extracted Parts (${parsedParts.length} found)`}
          </h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {error && (
            <div style={{
              background: '#fff3e0', border: '1px solid #ff9800', borderRadius: 8,
              padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <AlertTriangle size={18} color="#e65100" />
              <span style={{ color: '#e65100' }}>{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <p style={{ color: '#666', marginBottom: 16 }}>
                Upload a Purchase Order (PDF) or parts list (TXT) and the system will extract parts automatically. 
                You can review and edit before importing.
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#1976d2' : '#ccc'}`,
                  borderRadius: 12,
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? '#e3f2fd' : '#fafafa',
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={48} color={dragOver ? '#1976d2' : '#999'} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>
                  Drop file here or click to browse
                </div>
                <div style={{ color: '#999', fontSize: '0.9rem' }}>
                  Supports PDF (including scanned) and TXT files
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.text,.csv"
                onChange={(e) => handleFile(e.target.files?.[0])}
                style={{ display: 'none' }}
              />

              {/* Supported formats info */}
              <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Supported Formats:</div>
                <div style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.6 }}>
                  <div>📄 <strong>Purchase Orders (PDF)</strong> — Extracts plate roll specs, dimensions, roll-to values</div>
                  <div>🔍 <strong>Scanned PDFs</strong> — Automatic OCR for image-based documents</div>
                  <div>📝 <strong>Parts Lists (TXT)</strong> — Parses specs like "5 pcs 1/2" A36 8 x 133.92 R/T to a 42.125" ID"</div>
                  <div>📋 <strong>BOM Tables (TXT)</strong> — Reads tabular formats with columns for qty, part#, description, material</div>
                </div>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }}></div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
                Processing {file?.name}
              </div>
              <div style={{ color: '#666', fontSize: '0.95rem' }}>
                {statusMsg || 'Reading file...'}
              </div>
              <div style={{ color: '#999', fontSize: '0.8rem', marginTop: 12 }}>
                Scanned PDFs may take 10-30 seconds per page for OCR
              </div>
            </div>
          )}

          {step === 'review' && (
            <div>
              {/* File info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="#1976d2" />
                  <span style={{ fontWeight: 600 }}>{file?.name}</span>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowRawText(!showRawText)}
                    style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                  >
                    {showRawText ? <><ChevronUp size={14} /> Hide Text</> : <><ChevronDown size={14} /> Show Extracted Text</>}
                  </button>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => { reset(); }}>
                  ↺ Upload Different File
                </button>
              </div>

              {/* Raw text toggle */}
              {showRawText && (
                <pre style={{
                  background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16,
                  maxHeight: 200, overflowY: 'auto', fontSize: '0.8rem', whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace', border: '1px solid #ddd'
                }}>
                  {rawText}
                </pre>
              )}

              {parsedParts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  <AlertTriangle size={48} color="#ff9800" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
                    No parts could be extracted
                  </div>
                  <div>
                    The file format wasn't recognized. Try a different file or add parts manually.
                  </div>
                </div>
              ) : (
                <>
                  {/* Selection toolbar */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: '#e3f2fd', borderRadius: 8, marginBottom: 12
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox"
                        checked={selectedParts.size === parsedParts.length}
                        onChange={toggleAll}
                      />
                      <span style={{ fontWeight: 600 }}>
                        {selectedParts.size} of {parsedParts.length} parts selected for import
                      </span>
                    </label>
                  </div>

                  {/* Parts table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                          <th style={{ padding: '8px 6px', width: 32 }}></th>
                          <th style={{ padding: '8px 6px', width: 50 }}>Qty</th>
                          <th style={{ padding: '8px 6px', width: 100 }}>Type</th>
                          <th style={{ padding: '8px 6px', width: 80 }}>Thk</th>
                          <th style={{ padding: '8px 6px', width: 70 }}>Grade</th>
                          <th style={{ padding: '8px 6px', width: 70 }}>Width</th>
                          <th style={{ padding: '8px 6px', width: 80 }}>Length</th>
                          <th style={{ padding: '8px 6px', width: 100 }}>Roll To</th>
                          <th style={{ padding: '8px 6px' }}>Details</th>
                          <th style={{ padding: '8px 6px', width: 60 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedParts.map((part, idx) => {
                          const isEditing = editingIdx === idx;
                          const confidence = part._confidence || 'high';
                          const bgColor = !selectedParts.has(idx) ? '#fafafa' :
                            confidence === 'low' ? '#fff8e1' :
                            confidence === 'medium' ? '#fff3e0' : 'white';

                          return (
                            <tr key={idx} style={{
                              background: bgColor,
                              borderBottom: '1px solid #e0e0e0',
                              opacity: selectedParts.has(idx) ? 1 : 0.5
                            }}>
                              <td style={{ padding: '8px 6px' }}>
                                <input type="checkbox" checked={selectedParts.has(idx)}
                                  onChange={() => togglePartSelection(idx)} />
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                {isEditing ? (
                                  <input type="number" value={part.quantity} min={1}
                                    onChange={(e) => updatePart(idx, 'quantity', parseInt(e.target.value) || 1)}
                                    style={{ width: 50, padding: '2px 4px' }} />
                                ) : part.quantity}
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                {isEditing ? (
                                  <select value={part.partType}
                                    onChange={(e) => updatePart(idx, 'partType', e.target.value)}
                                    style={{ width: 95, padding: '2px 4px', fontSize: '0.8rem' }}>
                                    {Object.entries(PART_TYPES).map(([k, v]) => (
                                      <option key={k} value={k}>{v.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span title={PART_TYPES[part.partType]?.label || part.partType}>
                                    {PART_TYPES[part.partType]?.icon} {PART_TYPES[part.partType]?.label || part.partType}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                {isEditing ? (
                                  <input type="text" value={part.thickness}
                                    onChange={(e) => updatePart(idx, 'thickness', e.target.value)}
                                    style={{ width: 70, padding: '2px 4px' }} />
                                ) : part.thickness || '—'}
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                {isEditing ? (
                                  <input type="text" value={part.material}
                                    onChange={(e) => updatePart(idx, 'material', e.target.value)}
                                    style={{ width: 65, padding: '2px 4px' }} />
                                ) : part.material || '—'}
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                {isEditing ? (
                                  <input type="text" value={part.width}
                                    onChange={(e) => updatePart(idx, 'width', e.target.value)}
                                    style={{ width: 60, padding: '2px 4px' }} />
                                ) : part.width || '—'}
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                {isEditing ? (
                                  <input type="text" value={part.length}
                                    onChange={(e) => updatePart(idx, 'length', e.target.value)}
                                    style={{ width: 70, padding: '2px 4px' }} />
                                ) : part.length || '—'}
                              </td>
                              <td style={{ padding: '8px 6px', fontSize: '0.8rem' }}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <input type="text" value={part.rollValue}
                                      onChange={(e) => updatePart(idx, 'rollValue', e.target.value)}
                                      placeholder="Ø"
                                      style={{ width: 50, padding: '2px 4px' }} />
                                    <select value={`${part.rollMeasurePoint}_${part.rollMeasureType}`}
                                      onChange={(e) => {
                                        const [mp, mt] = e.target.value.split('_');
                                        updatePart(idx, 'rollMeasurePoint', mp);
                                        updatePart(idx, 'rollMeasureType', mt);
                                      }}
                                      style={{ width: 48, padding: '2px', fontSize: '0.75rem' }}>
                                      <option value="inside_diameter">ID</option>
                                      <option value="outside_diameter">OD</option>
                                      <option value="inside_radius">IR</option>
                                      <option value="outside_radius">OR</option>
                                    </select>
                                  </div>
                                ) : (
                                  part.rollValue ? (
                                    <span>
                                      {part.rollValue}"&nbsp;
                                      {part.rollMeasurePoint === 'inside' ? 'I' : 'O'}
                                      {part.rollMeasureType === 'radius' ? 'R' : 'D'}
                                    </span>
                                  ) : '—'
                                )}
                              </td>
                              <td style={{ padding: '8px 6px', fontSize: '0.8rem', color: '#555' }}>
                                {isEditing ? (
                                  <input type="text" value={part.specialInstructions}
                                    onChange={(e) => updatePart(idx, 'specialInstructions', e.target.value)}
                                    style={{ width: '100%', padding: '2px 4px' }}
                                    placeholder="Special instructions..." />
                                ) : (
                                  <>
                                    {part.rollType && (
                                      <span style={{
                                        display: 'inline-block', background: '#e8f5e9', color: '#2e7d32',
                                        borderRadius: 4, padding: '1px 6px', marginRight: 4, fontSize: '0.75rem'
                                      }}>
                                        {part.rollType === 'easy_way' ? 'EW' : 'HW'}
                                      </span>
                                    )}
                                    {part.clientPartNumber && (
                                      <span style={{
                                        display: 'inline-block', background: '#e3f2fd', color: '#1565c0',
                                        borderRadius: 4, padding: '1px 6px', marginRight: 4, fontSize: '0.75rem'
                                      }}>
                                        {part.clientPartNumber}
                                      </span>
                                    )}
                                    {part.specialInstructions && <span>{part.specialInstructions}</span>}
                                    {confidence !== 'high' && (
                                      <span style={{
                                        display: 'inline-block', background: confidence === 'low' ? '#fff3e0' : '#fff8e1',
                                        color: '#e65100', borderRadius: 4, padding: '1px 6px', marginLeft: 4, fontSize: '0.7rem'
                                      }}>
                                        ⚠ {confidence === 'low' ? 'needs review' : 'verify'}
                                      </span>
                                    )}
                                  </>
                                )}
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    onClick={() => setEditingIdx(isEditing ? null : idx)}
                                    style={{
                                      background: 'none', border: '1px solid #ddd', borderRadius: 4,
                                      padding: '2px 6px', cursor: 'pointer', color: isEditing ? '#1976d2' : '#666'
                                    }}
                                    title={isEditing ? 'Done editing' : 'Edit part'}
                                  >
                                    {isEditing ? <Check size={14} /> : <Edit size={14} />}
                                  </button>
                                  <button
                                    onClick={() => removePart(idx)}
                                    style={{
                                      background: 'none', border: '1px solid #ddd', borderRadius: 4,
                                      padding: '2px 6px', cursor: 'pointer', color: '#d32f2f'
                                    }}
                                    title="Remove part"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e0e0e0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <button className="btn btn-outline" onClick={handleClose} disabled={importing}>
            Cancel
          </button>
          {step === 'review' && parsedParts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {importing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="spinner" style={{ width: 18, height: 18 }}></div>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>
                    Importing... {importProgress}/{selectedParts.size}
                  </span>
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || selectedParts.size === 0}
                style={{ minWidth: 160 }}
              >
                <Upload size={16} />
                {importing ? 'Importing...' : `Import ${selectedParts.size} Part${selectedParts.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Convert parsed part to API-compatible partData ─────────────────────────

function buildPartData(parsed) {
  const base = {
    partType: parsed.partType || 'other',
    quantity: parsed.quantity || 1,
    clientPartNumber: parsed.clientPartNumber || '',
    heatNumber: '',
    cutFileReference: '',
    weSupplyMaterial: false,
    materialDescription: '',
    supplierName: '',
    materialUnitCost: '',
    materialMarkupPercent: 20,
    rollingCost: '',
    // Services
    serviceDrilling: false, serviceDrillingCost: '', serviceDrillingVendor: '',
    serviceCutting: false, serviceCuttingCost: '', serviceCuttingVendor: '',
    serviceFitting: false, serviceFittingCost: '', serviceFittingVendor: '',
    serviceWelding: false, serviceWeldingCost: '', serviceWeldingVendor: '', serviceWeldingPercent: 100,
    otherServicesCost: '', otherServicesMarkupPercent: 15,
    // Specs
    material: parsed.material || '',
    thickness: parsed.thickness || '',
    width: parsed.width || '',
    length: parsed.length || '',
    sectionSize: '',
    outerDiameter: '',
    wallThickness: '',
    rollType: parsed.rollType || null,
    radius: '',
    diameter: '',
    arcDegrees: '',
    flangeOut: false,
    specialInstructions: parsed.specialInstructions || '',
    // Pricing
    materialTotal: '',
    laborTotal: '',
    setupCharge: '',
    otherCharges: '',
    partTotal: '',
    materialSource: 'customer_supplied',
    _materialOrigin: '',
    _rollMeasurePoint: parsed.rollMeasurePoint || 'inside',
    _rollMeasureType: parsed.rollMeasureType || 'diameter',
    _tangentLength: ''
  };

  // Set roll-to values
  if (parsed.rollValue) {
    base._rollToMethod = 'specific_value';
    base._rollValue = parsed.rollValue;
    if (parsed.rollMeasureType === 'radius') {
      base.radius = parsed.rollValue;
      base.diameter = '';
    } else {
      base.diameter = parsed.rollValue;
      base.radius = '';
    }
  }

  // For flat_bar type, set the bar size fields
  if (parsed.partType === 'flat_bar') {
    // barSize would typically be something like "1/2 x 2" but the form expects _barSize
    base._barSize = parsed.thickness ? `${parsed.thickness.replace(/"/g, '')} x ${parsed.width}` : '';
  }

  return base;
}
