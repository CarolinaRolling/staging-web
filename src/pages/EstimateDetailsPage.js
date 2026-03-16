import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Upload, Eye, X, Printer, Check, FileDown, Package, FileText, Edit } from 'lucide-react';
import {
  getEstimateById, createEstimate, updateEstimate,
  addEstimatePart, updateEstimatePart, deleteEstimatePart,
  uploadEstimateFiles, getEstimateFileSignedUrl, deleteEstimateFile,
  downloadEstimatePDF, convertEstimateToWorkOrder,
  uploadEstimatePartFile, deleteEstimatePartFile, viewEstimatePartFile,
  searchClients, searchVendors, getSettings, resetEstimateConversion,
  getNextDRNumber
} from '../services/api';
import PlateRollForm from '../components/PlateRollForm';
import AngleRollForm from '../components/AngleRollForm';
import FlatStockForm from '../components/FlatStockForm';
import FabServiceForm from '../components/FabServiceForm';
import ShopRateForm from '../components/ShopRateForm';
import PipeRollForm from '../components/PipeRollForm';
import SquareTubeRollForm from '../components/SquareTubeRollForm';
import FlatBarRollForm from '../components/FlatBarRollForm';
import ChannelRollForm from '../components/ChannelRollForm';
import BeamRollForm from '../components/BeamRollForm';
import ConeRollForm from '../components/ConeRollForm';
import TeeBarRollForm from '../components/TeeBarRollForm';
import PressBrakeForm from '../components/PressBrakeForm';
import RushServiceForm from '../components/RushServiceForm';
import HeatNumberInput from '../components/HeatNumberInput';

const PART_TYPES = {
  plate_roll: { label: 'Plate Roll', icon: '🔩', desc: 'Flat plate rolling with arc calculator' },
  cone_roll: { label: 'Cone Layout', icon: '🔺', desc: 'Cone segment design with AutoCAD export' },
  angle_roll: { label: 'Angle Roll', icon: '📐', desc: 'Angle iron rolling' },
  flat_bar: { label: 'Flat & Square Bar', icon: '▬', desc: 'Flat bar and square bar bending' },
  pipe_roll: { label: 'Pipes/Tubes/Round', icon: '🔧', desc: 'Pipe, tube, and solid round bar bending' },
  tube_roll: { label: 'Square & Rect Tubing', icon: '⬜', desc: 'Square and rectangular tube rolling' },
  channel_roll: { label: 'Channel', icon: '🔲', desc: 'C-channel rolling' },
  beam_roll: { label: 'Beam', icon: '🏗️', desc: 'I-beam and H-beam rolling' },
  tee_bar: { label: 'Tee Bars', icon: '🇹', desc: 'Structural tee rolling' },
  press_brake: { label: 'Press Brake', icon: '⏏️', desc: 'Press brake forming from print' },
  flat_stock: { label: 'Flat Stock', icon: '📄', desc: 'Ship flat — plate, angle, tube, channel, beam (no rolling)' },
  fab_service: { label: 'Fabrication Service', icon: '🔥', desc: 'Welding, fitting, cut-to-fit — links to another part' },
  shop_rate: { label: 'Shop Rate', icon: '⏱️', desc: 'Hourly rate — flattening, art projects, custom work' },
  rush_service: { label: 'Expedite & Emergency', icon: '🚨', desc: 'Rush order surcharge and off-hour opening fees' },
  other: { label: 'Other', icon: '📦', desc: 'Custom or miscellaneous parts' }
};

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)})${digits.slice(3)}`;
  return `(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6)}`;
};

function EstimateDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const isNew = id === 'new';

  const [estimate, setEstimate] = useState(null);
  const [clientPaymentTerms, setClientPaymentTerms] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [partFormError, setPartFormError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const pdfPreviewActive = useRef(false);

  const [formData, setFormData] = useState({
    clientName: '', contactName: '', contactEmail: '', contactPhone: '',
    projectDescription: '', notes: '', internalNotes: '', validUntil: '',
    taxRate: 7.0, useCustomTax: false, customTaxReason: '',
    taxExempt: false, taxExemptReason: '', taxExemptCertNumber: '',
    truckingDescription: '', truckingCost: 0,
    discountPercent: '', discountAmount: '', discountReason: '',
    minimumOverride: false, minimumOverrideReason: ''
  });

  const [parts, setParts] = useState([]);
  const [files, setFiles] = useState([]);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showPartTypePicker, setShowPartTypePicker] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partData, setPartData] = useState({});
  
  // Labor minimums from admin settings
  const [laborMinimums, setLaborMinimums] = useState([]);
  
  // Convert to Work Order state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [nextDR, setNextDR] = useState(null);
  const [useCustomDR, setUseCustomDR] = useState(false);
  const [customDR, setCustomDR] = useState('');
  const [convertData, setConvertData] = useState({
    clientPurchaseOrderNumber: '',
    requestedDueDate: '',
    promisedDate: '',
    notes: '',
    materialReceived: false
  });
  
  // Part file upload state
  const [uploadingPartFile, setUploadingPartFile] = useState(null);
  const partFileInputRef = useRef(null);
  
  // Estimate number editing state
  const [editingEstNum, setEditingEstNum] = useState(false);
  const [estNumInput, setEstNumInput] = useState('');
  
  // Client autofill state
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef(null);
  
  // Vendor autofill state (for parts)
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  
  // Default settings
  const [defaultSettings, setDefaultSettings] = useState({
    defaultTaxRate: 9.75,
    defaultLaborRate: 125,
    defaultMaterialMarkup: 20
  });

  useEffect(() => { 
    loadDefaultSettings();
    if (!isNew) loadEstimate(); 
  }, [id]);

  // Cleanup PDF blob URL on unmount
  useEffect(() => {
    return () => { if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) window.URL.revokeObjectURL(pdfPreviewUrl); };
  }, [pdfPreviewUrl]);

  const loadDefaultSettings = async () => {
    try {
      const response = await getSettings('tax_settings');
      if (response.data.data?.value) {
        const settings = response.data.data.value;
        setDefaultSettings(settings);
        if (isNew) {
          setFormData(prev => ({
            ...prev,
            taxRate: settings.defaultTaxRate || 9.75
          }));
        }
      }
    } catch (err) {}
    // Load labor minimums
    const defaultMinimums = [
      { partType: 'plate_roll', label: 'Plate ≤ 3/8"', sizeField: 'thickness', maxSize: 0.375, minWidth: '', maxWidth: '', minimum: 125 },
      { partType: 'plate_roll', label: 'Plate ≤ 3/8" (24-60" wide)', sizeField: 'thickness', maxSize: 0.375, minWidth: 24, maxWidth: 60, minimum: 150 },
      { partType: 'plate_roll', label: 'Plate > 3/8"', sizeField: 'thickness', minSize: 0.376, minWidth: '', maxWidth: '', minimum: 200 },
      { partType: 'angle_roll', label: 'Angle ≤ 2x2', sizeField: 'angleSize', maxSize: 2, minWidth: '', maxWidth: '', minimum: 150 },
      { partType: 'angle_roll', label: 'Angle > 2x2', sizeField: 'angleSize', minSize: 2.01, minWidth: '', maxWidth: '', minimum: 250 },
    ];
    try {
      const resp = await getSettings('labor_minimums');
      if (resp.data.data?.value && Array.isArray(resp.data.data.value) && resp.data.data.value.length > 0) {
        setLaborMinimums(resp.data.data.value);
      } else {
        setLaborMinimums(defaultMinimums);
      }
    } catch (err) {
      setLaborMinimums(defaultMinimums);
    }
  };

  const initialLoadDone = useRef(false);

  const loadEstimate = async () => {
    const scrollY = window.scrollY;
    const isReload = initialLoadDone.current;
    
    try {
      if (!isReload) setLoading(true);
      const response = await getEstimateById(id);
      const data = response.data.data;
      setEstimate(data);
      setFormData({
        clientName: data.clientName || '', contactName: data.contactName || '',
        contactEmail: data.contactEmail || '', contactPhone: data.contactPhone || '',
        projectDescription: data.projectDescription || '', notes: data.notes || '',
        internalNotes: data.internalNotes || '', validUntil: data.validUntil || '',
        taxRate: parseFloat(data.taxRate) || 7.0, useCustomTax: data.useCustomTax || false,
        customTaxReason: data.customTaxReason || '',
        taxExempt: data.taxExempt || false, 
        taxExemptReason: data.taxExemptReason || '',
        taxExemptCertNumber: data.taxExemptCertNumber || '',
        truckingDescription: data.truckingDescription || '',
        truckingCost: parseFloat(data.truckingCost) || 0,
        discountPercent: data.discountPercent || '',
        discountAmount: data.discountAmount || '',
        discountReason: data.discountReason || '',
        minimumOverride: data.minimumOverride || false,
        minimumOverrideReason: data.minimumOverrideReason || ''
      });
      setParts((data.parts || []).sort((a, b) => a.partNumber - b.partNumber));
      setFiles(data.files || []);
      // Load client payment terms and auto-detect tax exempt
      if (data.clientName) {
        try {
          const clientRes = await searchClients(data.clientName);
          const clients = clientRes.data?.data || [];
          const client = clients.find(c => c.name === data.clientName);
          if (client?.paymentTerms) setClientPaymentTerms(client.paymentTerms);
          // Auto tax exempt for verified resale clients (only if not already saved on estimate)
          if (client && !data.taxExempt) {
            const clientIsExempt = client.taxStatus === 'resale' || client.taxStatus === 'exempt' ||
              (client.resaleCertificate && client.permitStatus === 'active');
            if (clientIsExempt) {
              const exemptData = {
                taxExempt: true,
                taxExemptReason: (client.taxStatus === 'exempt') ? 'Tax Exempt' : 'Resale',
                taxExemptCertNumber: client.resaleCertificate || ''
              };
              setFormData(prev => ({ ...prev, ...exemptData }));
              // Persist to DB immediately so totals are recalculated without tax
              if (!isNew) {
                try { await updateEstimate(id, exemptData); } catch (e) { /* ignore */ }
              }
            }
          }
        } catch (e) { /* ignore */ }
      }
    } catch (err) {
      setError('Failed to load estimate');
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      if (isReload) {
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      }
    }
  };

  // Round up material cost after markup
  const roundUpMaterial = (value, rounding) => {
    if (!rounding || rounding === 'none' || value <= 0) return value;
    if (rounding === 'dollar') return Math.ceil(value);
    if (rounding === 'five') return Math.ceil(value / 5) * 5;
    return value;
  };

  const calculatePartTotal = (part) => {
    // Per-each pricing: (mat cost × markup + labor) × qty
    if (['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType)) {
      const qty = parseInt(part.quantity) || 1;
      const materialCost = parseFloat(part.materialTotal) || 0;
      const materialMarkup = parseFloat(part.materialMarkupPercent) || 0;
      const materialEachRaw = materialCost * (1 + materialMarkup / 100);
      const materialEach = roundUpMaterial(materialEachRaw, part._materialRounding);
      const laborEach = parseFloat(part.laborTotal) || 0;
      const unitPrice = materialEach + laborEach;
      const partTotal = unitPrice * qty;
      return { materialCost, materialMarkup, materialEachRaw, materialEach, laborEach, unitPrice, qty, partTotal };
    }
    
    const qty = parseInt(part.quantity) || 1;
    
    // Material - only if we supply it
    const weSupply = part.weSupplyMaterial;
    const materialCost = weSupply ? (parseFloat(part.materialUnitCost) || 0) * qty : 0;
    const materialMarkup = weSupply ? (parseFloat(part.materialMarkupPercent) || 0) : 0;
    const materialTotal = materialCost * (1 + materialMarkup / 100);
    
    // Rolling
    const rolling = parseFloat(part.rollingCost) || 0;
    
    // Additional Services
    const drillingCost = part.serviceDrilling ? (parseFloat(part.serviceDrillingCost) || 0) : 0;
    const cuttingCost = part.serviceCutting ? (parseFloat(part.serviceCuttingCost) || 0) : 0;
    const fittingCost = part.serviceFitting ? (parseFloat(part.serviceFittingCost) || 0) : 0;
    const weldingCost = part.serviceWelding ? (parseFloat(part.serviceWeldingCost) || 0) : 0;
    const additionalServices = drillingCost + cuttingCost + fittingCost + weldingCost;
    
    // Legacy other services
    const otherCost = parseFloat(part.otherServicesCost) || 0;
    const otherMarkup = parseFloat(part.otherServicesMarkupPercent) || 15;
    const otherTotal = otherCost * (1 + otherMarkup / 100);
    
    return { 
      materialCost, 
      materialTotal, 
      otherTotal, 
      additionalServices,
      partTotal: materialTotal + rolling + otherTotal + additionalServices 
    };
  };

  // Parse dimension string: "3/8"" → 0.375, "1-1/2"" → 1.5, "2.5" → 2.5, "24 ga" → 0.025, "2x2" → 2
  const parseDimension = (val) => {
    if (!val) return 0;
    const s = String(val).trim().replace(/["\u2033]/g, '');
    if (!isNaN(s) && s !== '') return parseFloat(s);
    const gaugeMatch = s.match(/^(\d+)\s*ga/i);
    if (gaugeMatch) {
      const gaugeMap = { 24: 0.025, 22: 0.030, 20: 0.036, 18: 0.048, 16: 0.060, 14: 0.075, 12: 0.105, 11: 0.120, 10: 0.135 };
      return gaugeMap[parseInt(gaugeMatch[1])] || 0;
    }
    const mixedMatch = s.match(/^(\d+)\s*[-\u2013]\s*(\d+)\s*\/\s*(\d+)/);
    if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    const fracMatch = s.match(/^(\d+)\s*\/\s*(\d+)/);
    if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    const leadMatch = s.match(/^([\d.]+)/);
    if (leadMatch) return parseFloat(leadMatch[1]);
    return 0;
  };

  // Get primary size for a part based on its type
  const getPartSize = (part) => {
    if (part.partType === 'plate_roll' || part.partType === 'flat_stock') {
      return parseDimension(part.thickness);
    }
    if (part.partType === 'angle_roll') {
      return parseDimension(part._angleSize || part.sectionSize || '');
    }
    if (part.partType === 'pipe_roll') {
      return parseDimension(part.outerDiameter);
    }
    if (part.partType === 'tube_roll') {
      return parseDimension(part._tubeSize || part.sectionSize || '');
    }
    if (part.partType === 'flat_bar') {
      return parseDimension(part._barSize || part.sectionSize || '');
    }
    if (part.partType === 'channel_roll') {
      return parseDimension(part._channelSize || part.sectionSize || '');
    }
    if (part.partType === 'beam_roll') {
      return parseDimension(part._beamSize || part.sectionSize || '');
    }
    if (part.partType === 'tee_bar') {
      return parseDimension(part._teeSize || part.sectionSize || '');
    }
    if (part.partType === 'cone_roll') {
      return parseFloat(part._coneLargeDia) || parseDimension(part.sectionSize || '');
    }
    return parseDimension(part.sectionSize || part.thickness || '');
  };

  const getPartWidth = (part) => {
    return parseDimension(part.width);
  };

  // Check labor minimum for a part - returns the best matching rule
  // Finds ALL rules matching this part type, filters by size/width, picks highest minimum
  const getLaborMinimum = (part) => {
    if (!laborMinimums.length) return null;

    const partSize = getPartSize(part);
    const partWidth = getPartWidth(part);

    let bestSpecificRule = null;
    let bestGeneralRule = null;

    for (const rule of laborMinimums) {
      if (rule.partType !== part.partType) continue;

      const hasMinSize = rule.minSize !== undefined && rule.minSize !== null && rule.minSize !== '' && parseFloat(rule.minSize) > 0;
      const hasMaxSize = rule.maxSize !== undefined && rule.maxSize !== null && rule.maxSize !== '' && parseFloat(rule.maxSize) > 0;
      const hasMinWidth = rule.minWidth !== undefined && rule.minWidth !== null && rule.minWidth !== '' && parseFloat(rule.minWidth) > 0;
      const hasMaxWidth = rule.maxWidth !== undefined && rule.maxWidth !== null && rule.maxWidth !== '' && parseFloat(rule.maxWidth) > 0;
      const hasSizeConstraints = hasMinSize || hasMaxSize;
      const hasWidthConstraints = hasMinWidth || hasMaxWidth;

      // No constraints = general catch-all for this part type
      if (!hasSizeConstraints && !hasWidthConstraints) {
        if (!bestGeneralRule || parseFloat(rule.minimum) > parseFloat(bestGeneralRule.minimum)) {
          bestGeneralRule = rule;
        }
        continue;
      }

      // Check size constraints
      let sizeOk = true;
      if (hasSizeConstraints) {
        if (partSize <= 0) { sizeOk = false; }
        else {
          if (hasMinSize && partSize < parseFloat(rule.minSize)) sizeOk = false;
          if (hasMaxSize && partSize > parseFloat(rule.maxSize)) sizeOk = false;
        }
      }

      // Check width constraints
      let widthOk = true;
      if (hasWidthConstraints) {
        if (partWidth <= 0) { widthOk = false; }
        else {
          if (hasMinWidth && partWidth < parseFloat(rule.minWidth)) widthOk = false;
          if (hasMaxWidth && partWidth > parseFloat(rule.maxWidth)) widthOk = false;
        }
      }

      if (sizeOk && widthOk) {
        if (!bestSpecificRule || parseFloat(rule.minimum) > parseFloat(bestSpecificRule.minimum)) {
          bestSpecificRule = rule;
        }
      }
    }

    // Only return a specific match or a general (no-constraints) match
    // Never fall back to a constrained rule that didn't match
    return bestSpecificRule || bestGeneralRule || null;
  };

  // Estimate-level minimum check:
  // 1. Sum total labor across ALL ea-priced parts
  // 2. Find the highest applicable minimum from any part's matching rule
  // 3. If total labor < highest minimum, replace labor with minimum
  // Material is never affected
  const getMinimumInfo = () => {
    let totalLabor = 0;
    let totalMaterial = 0;
    let highestMinimum = 0;
    let highestMinRule = null;

    const EA_PRICED = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'];

    parts.forEach(part => {
      if (!EA_PRICED.includes(part.partType)) return;
      const laborEach = parseFloat(part.laborTotal) || 0;
      const materialCost = parseFloat(part.materialTotal) || 0;
      const materialMarkup = parseFloat(part.materialMarkupPercent) || 0;
      const materialEachRaw = materialCost * (1 + materialMarkup / 100);
      const materialEach = roundUpMaterial(materialEachRaw, part._materialRounding);
      const qty = parseInt(part.quantity) || 1;
      totalLabor += laborEach * qty;
      totalMaterial += materialEach * qty;

      const rule = getLaborMinimum(part);
      if (rule && parseFloat(rule.minimum) > highestMinimum) {
        highestMinimum = parseFloat(rule.minimum);
        highestMinRule = rule;
      }
    });

    const minimumApplies = !formData.minimumOverride && highestMinimum > 0 && totalLabor > 0 && totalLabor < highestMinimum;
    const adjustedLabor = minimumApplies ? highestMinimum : totalLabor;
    const laborDifference = minimumApplies ? (highestMinimum - totalLabor) : 0;

    return { totalLabor, totalMaterial, highestMinimum, highestMinRule, minimumApplies, adjustedLabor, laborDifference };
  };

  const calculateTotals = () => {
    const minInfo = getMinimumInfo();
    
    // For ea-priced parts, recalculate with minimum applied
    let partsSubtotal = 0;
    let eaPricedTotal = 0;
    
    parts.forEach(part => {
      if (part.partType === 'rush_service') return; // handle separately
      const calc = calculatePartTotal(part);
      if (['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType)) {
        eaPricedTotal += calc.partTotal;
      } else {
        partsSubtotal += calc.partTotal;
      }
    });

    // If minimum applies: replace ea-priced total with (total material + adjusted labor)
    if (minInfo.minimumApplies) {
      partsSubtotal += minInfo.totalMaterial + minInfo.adjustedLabor;
    } else {
      partsSubtotal += eaPricedTotal;
    }
    
    // Rush service: calculate expedite and emergency
    let expediteAmount = 0, emergencyAmount = 0, expediteLabel = '', emergencyLabel = '';
    const rushPart = parts.find(p => p.partType === 'rush_service');
    if (rushPart) {
      const fd = rushPart.formData || rushPart;
      if (fd._expediteEnabled) {
        if (fd._expediteType === 'custom_amt') {
          expediteAmount = parseFloat(fd._expediteCustomAmt) || 0;
          expediteLabel = 'Expedite (Custom)';
        } else {
          let pct = parseFloat(fd._expediteType) || 0;
          if (fd._expediteType === 'custom_pct') pct = parseFloat(fd._expediteCustomPct) || 0;
          expediteAmount = partsSubtotal * (pct / 100);
          expediteLabel = `Expedite (${pct}%)`;
        }
      }
      if (fd._emergencyEnabled) {
        const emergOpts = { 'Saturday': 600, 'Saturday Night': 800, 'Sunday': 600, 'Sunday Night': 800 };
        emergencyAmount = emergOpts[fd._emergencyDay] || 0;
        emergencyLabel = `Emergency Off Hour Opening: ${fd._emergencyDay}`;
      }
    }
    partsSubtotal += expediteAmount + emergencyAmount;
    
    // Discount
    let discountAmt = 0;
    if (parseFloat(formData.discountPercent) > 0) {
      discountAmt = partsSubtotal * (parseFloat(formData.discountPercent) / 100);
    } else if (parseFloat(formData.discountAmount) > 0) {
      discountAmt = parseFloat(formData.discountAmount);
    }
    const afterDiscount = partsSubtotal - discountAmt;
    
    const trucking = parseFloat(formData.truckingCost) || 0;
    const taxAmount = formData.taxExempt ? 0 : afterDiscount * (parseFloat(formData.taxRate) / 100);
    const grandTotal = afterDiscount + taxAmount + trucking;
    
    // Calculate credit card totals (Square fees)
    // In-Person: 2.6% + $0.15
    const ccInPersonFee = (grandTotal * 2.6 / 100) + 0.15;
    const ccInPersonTotal = grandTotal + ccInPersonFee;
    // Manual Input: 3.5% + $0.15
    const ccManualFee = (grandTotal * 3.5 / 100) + 0.15;
    const ccManualTotal = grandTotal + ccManualFee;
    
    return { partsSubtotal, discountAmt, afterDiscount, trucking, taxAmount, grandTotal, ccInPersonFee, ccInPersonTotal, ccManualFee, ccManualTotal, minInfo, expediteAmount, expediteLabel, emergencyAmount, emergencyLabel };
  };

  const generatePdfPreview = async () => {
    try {
      setPdfGenerating(true);
      // Save current state first so PDF reflects on-screen values
      try {
        await updateEstimate(id, { 
          taxExempt: formData.taxExempt, 
          taxExemptReason: formData.taxExemptReason,
          taxExemptCertNumber: formData.taxExemptCertNumber,
          taxRate: formData.taxRate,
          truckingCost: formData.truckingCost,
          truckingDescription: formData.truckingDescription,
          discountPercent: formData.discountPercent,
          discountAmount: formData.discountAmount,
          discountReason: formData.discountReason,
          minimumOverride: formData.minimumOverride,
          minimumOverrideReason: formData.minimumOverrideReason
        });
      } catch (saveErr) {
        console.warn('Auto-save before PDF failed:', saveErr);
      }
      const response = await downloadEstimatePDF(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      // Revoke old blob URL
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
      const url = window.URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      pdfPreviewActive.current = true;

      // Save a copy as an estimate file (fire-and-forget)
      try {
        const oldPdf = files.find(f => (f.originalName || f.filename || '').startsWith('Generated-Estimate-'));
        if (oldPdf) { try { await deleteEstimateFile(id, oldPdf.id); } catch {} }
        const pdfFileName = `Generated-Estimate-${estimate?.estimateNumber || id}.pdf`;
        const pdfFile = new File([blob], pdfFileName, { type: 'application/pdf' });
        await uploadEstimateFiles(id, [pdfFile]);
        await loadEstimate();
      } catch (storeErr) {
        console.warn('Storing PDF copy failed:', storeErr);
      }

      showMessage('PDF generated');
    } catch (err) {
      setError('Failed to generate PDF');
      console.error(err);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadFromPreview = async () => {
    try {
      const response = await downloadEstimatePDF(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Estimate-${estimate?.estimateNumber || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showMessage('PDF downloaded');
    } catch {
      if (pdfPreviewUrl) window.open(pdfPreviewUrl, '_blank');
    }
  };

  const closePdfPreview = () => {
    if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    pdfPreviewActive.current = false;
  };

  // Auto-regenerate PDF preview when it's open
  const regeneratePdfIfActive = async () => {
    if (pdfPreviewActive.current) {
      await generatePdfPreview();
    }
  };

  // View stored PDF preview
  const viewStoredPdf = async () => {
    try {
      setPdfGenerating(true);
      const response = await downloadEstimatePDF(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      if (pdfPreviewUrl) window.URL.revokeObjectURL(pdfPreviewUrl);
      const url = window.URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      pdfPreviewActive.current = true;
    } catch (err) {
      setError('Failed to load PDF preview');
    } finally {
      setPdfGenerating(false);
    }
  };

  // Download stored PDF
  const downloadStoredPdf = async () => {
    try {
      const response = await downloadEstimatePDF(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Estimate-${estimate?.estimateNumber || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showMessage('PDF downloaded');
    } catch (err) {
      setError('Failed to download PDF');
    }
  };

  const handleSave = async (sendToClient = false) => {
    if (!formData.clientName.trim()) { setError('Client name is required'); return; }
    try {
      setSaving(true); setError(null);
      const payload = { ...formData, status: sendToClient ? 'sent' : (estimate?.status || 'draft') };
      if (isNew) {
        const response = await createEstimate(payload);
        navigate(`/estimates/${response.data.data.id}`, { replace: true });
      } else {
        await updateEstimate(id, payload);
        await loadEstimate();
        regeneratePdfIfActive();
      }
      showMessage(sendToClient ? 'Estimate sent' : 'Estimate saved');
    } catch (err) { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  const showMessage = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const handleEstNumChange = async () => {
    const newNum = estNumInput.trim();
    if (!newNum) { setError('Estimate number cannot be empty'); return; }
    if (newNum === estimate.estimateNumber) { setEditingEstNum(false); return; }
    try {
      await updateEstimate(id, { estimateNumber: newNum });
      setEditingEstNum(false);
      showMessage(`Estimate number changed to ${newNum}`);
      await loadEstimate();
      regeneratePdfIfActive();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update estimate number');
    }
  };

  const openAddPartModal = () => {
    setEditingPart(null);
    setShowPartTypePicker(true);
  };

  const handleSelectPartType = (type) => {
    setShowPartTypePicker(false);
    setPartData({
      partType: type, clientPartNumber: '', heatNumber: '', cutFileReference: '', quantity: 1,
      // Material - controlled by weSupplyMaterial checkbox
      weSupplyMaterial: false,
      materialDescription: '', supplierName: '', vendorEstimateNumber: '', materialUnitCost: '', 
      materialMarkupPercent: defaultSettings.defaultMaterialMarkup || 20,
      // Rolling cost
      rollingCost: '',
      // Additional Services
      serviceDrilling: false, serviceDrillingCost: '', serviceDrillingVendor: '',
      serviceCutting: false, serviceCuttingCost: '', serviceCuttingVendor: '',
      serviceFitting: false, serviceFittingCost: '', serviceFittingVendor: '',
      serviceWelding: false, serviceWeldingCost: '', serviceWeldingVendor: '', serviceWeldingPercent: 100,
      // Legacy other services
      otherServicesCost: '', otherServicesMarkupPercent: 15,
      // Specs
      material: '', thickness: '', width: '', length: '', sectionSize: '',
      outerDiameter: '', wallThickness: '', rollType: '', radius: '', diameter: '',
      arcDegrees: '', flangeOut: false, specialInstructions: '',
      // PlateRollForm fields
      materialTotal: '', laborTotal: '', setupCharge: '', otherCharges: '', partTotal: '',
      materialSource: 'customer_supplied', _materialOrigin: '', _rollToMethod: '', _rollValue: '', _rollMeasurePoint: 'inside',
      _rollMeasureType: 'diameter', _tangentLength: '',
      // AngleRollForm fields
      _angleSize: '', _customAngleSize: '', _legOrientation: '', _rollingDescription: '',
      _lengthOption: '', _customLength: ''
    });
    setPartFormError(null);
    setVendorSuggestions([]);
    setShowVendorSuggestions(false);
    setShowPartModal(true);
  };

  const openEditPartModal = (part) => {
    setEditingPart(part);
    // Clear vendor search state from previous part edit
    setVendorSuggestions([]);
    setShowVendorSuggestions(false);
    const editData = {
      ...part,
      _vendorSearch: undefined, // ensure clean vendor search state
      weSupplyMaterial: part.weSupplyMaterial || false,
      materialUnitCost: part.materialUnitCost || '',
      materialMarkupPercent: part.materialMarkupPercent ?? defaultSettings.defaultMaterialMarkup ?? 20,
      rollingCost: part.rollingCost || '',
      serviceDrilling: part.serviceDrilling || false,
      serviceDrillingCost: part.serviceDrillingCost || '',
      serviceDrillingVendor: part.serviceDrillingVendor || '',
      serviceCutting: part.serviceCutting || false,
      serviceCuttingCost: part.serviceCuttingCost || '',
      serviceCuttingVendor: part.serviceCuttingVendor || '',
      serviceFitting: part.serviceFitting || false,
      serviceFittingCost: part.serviceFittingCost || '',
      serviceFittingVendor: part.serviceFittingVendor || '',
      serviceWelding: part.serviceWelding || false,
      serviceWeldingCost: part.serviceWeldingCost || '',
      serviceWeldingVendor: part.serviceWeldingVendor || '',
      serviceWeldingPercent: part.serviceWeldingPercent || 100,
      otherServicesCost: part.otherServicesCost || '',
      otherServicesMarkupPercent: part.otherServicesMarkupPercent || 15
    };
    // Restore _angleSize from sectionSize for angle parts
    if (part.partType === 'angle_roll' && part.sectionSize && !part._angleSize) {
      editData._angleSize = part.sectionSize;
    }
    // Restore _pipeSize from sectionSize for pipe parts
    if (part.partType === 'pipe_roll' && part.sectionSize && !part._pipeSize) {
      editData._pipeSize = part.sectionSize;
    }
    // Restore _tubeSize from sectionSize for sq/rect tube parts
    if (part.partType === 'tube_roll' && part.sectionSize && !part._tubeSize) {
      editData._tubeSize = part.sectionSize;
    }
    // Restore _barSize from sectionSize for flat bar parts
    if (part.partType === 'flat_bar' && part.sectionSize && !part._barSize) {
      editData._barSize = part.sectionSize;
    }
    // Restore _channelSize from sectionSize for channel parts
    if (part.partType === 'channel_roll' && part.sectionSize && !part._channelSize) {
      editData._channelSize = part.sectionSize;
    }
    // Restore _beamSize from sectionSize for beam parts
    if (part.partType === 'beam_roll' && part.sectionSize && !part._beamSize) {
      editData._beamSize = part.sectionSize;
    }
    if (part.partType === 'tee_bar' && part.sectionSize && !part._teeSize) {
      editData._teeSize = part.sectionSize;
    }
    setPartData(editData);
    setPartFormError(null);
    setShowPartModal(true);
  };

  const validatePart = () => {
    const warnings = [];
    
    if (!partData.partType) {
      warnings.push('Part type is required');
      return warnings;
    }
    
    if (partData.partType === 'plate_roll') {
      if (!partData.thickness) warnings.push('Thickness is required');
      if (!partData.rollType) warnings.push('Roll Direction (Easy Way / Hard Way) is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
    }

    if (partData.partType === 'flat_stock') {
      if (!partData._stockType) warnings.push('Stock type is required');
      if (partData._stockType === 'plate' && !partData.thickness) warnings.push('Thickness is required');
      if (partData._stockType === 'angle' && !partData._angleSize) warnings.push('Angle size is required');
      if (partData._stockType === 'square_tube' && !partData._tubeSize) warnings.push('Tube size is required');
      if (partData._stockType === 'channel' && !partData._channelSize) warnings.push('Channel size is required');
      if (partData._stockType === 'beam' && !partData._beamSize) warnings.push('Beam size is required');
    }
    
    if (partData.partType === 'angle_roll') {
      if (!partData._angleSize) warnings.push('Angle size is required');
      if (partData._angleSize === 'Custom' && !partData._customAngleSize) warnings.push('Custom angle size is required');
      if (!partData.thickness) warnings.push('Thickness is required');
      if (!partData.rollType) warnings.push('Roll Direction (Easy Way / Hard Way) is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
      
      // Check unequal legs orientation
      if (partData._angleSize && partData._angleSize !== 'Custom') {
        const parts = partData._angleSize.split('x').map(Number);
        if (parts.length === 2 && parts[0] !== parts[1] && partData.rollType && !partData._legOrientation) {
          warnings.push('Leg orientation is required for unequal angle sizes');
        }
      }
    }
    
    if (partData.partType === 'pipe_roll') {
      if (!partData._pipeSize && !partData.outerDiameter) warnings.push('Pipe/tube size or OD is required');
      if (partData._pipeSize === 'Custom' && !partData.outerDiameter) warnings.push('Outer diameter is required for custom size');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
    }

    if (partData.partType === 'tube_roll') {
      if (!partData._tubeSize) warnings.push('Tube size is required');
      if (partData._tubeSize === 'Custom' && !partData._customTubeSize) warnings.push('Custom tube size is required');
      if (!partData.thickness) warnings.push('Wall thickness is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
      // Only require EW/HW for rectangular tubes
      const tubeParts = (partData._tubeSize || '').split('x').map(Number);
      if (tubeParts.length === 2 && tubeParts[0] !== tubeParts[1] && !partData.rollType) {
        warnings.push('Roll Direction (Easy Way / Hard Way) is required for rectangular tubes');
      }
    }

    if (partData.partType === 'flat_bar') {
      if (!partData._barSize && !partData._barShape) warnings.push('Bar size is required');
      if (partData._barSize === 'Custom' && !partData._customBarSize) warnings.push('Custom bar size is required');
      if (partData._barShape !== 'square' && !partData.rollType) warnings.push('Roll Direction (Easy Way / Hard Way) is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
    }

    if (partData.partType === 'channel_roll') {
      if (!partData._channelSize) warnings.push('Channel size is required');
      if (partData._channelSize === 'Custom' && !partData._customChannelSize) warnings.push('Custom channel size is required');
      if (!partData.rollType) warnings.push('Roll Direction (Easy Way / Hard Way) is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
    }

    if (partData.partType === 'beam_roll') {
      if (!partData._beamSize) warnings.push('Beam size is required');
      if (partData._beamSize === 'Custom' && !partData._customBeamSize) warnings.push('Custom beam size is required');
      if (partData._isCamber) {
        if (!partData._camberDepth) warnings.push('Camber depth is required');
      } else {
        if (!partData.rollType) warnings.push('Roll Direction (Easy Way / Hard Way) is required');
        if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
      }
    }

    if (partData.partType === 'tee_bar') {
      if (!partData._teeSize) warnings.push('Tee size is required');
      if (partData._teeSize === 'Custom' && !partData._customTeeSize) warnings.push('Custom tee size is required');
      if (!partData.rollType) warnings.push('Roll Direction (Stem In / Stem Out / Stem Up) is required');
      if (!partData._rollToMethod && !partData._rollValue && !partData.radius && !partData.diameter) warnings.push('Roll value (radius or diameter) is required');
    }

    if (partData.partType === 'press_brake') {
      if (!partData.thickness) warnings.push('Thickness is required');
    }

    if (partData.partType === 'cone_roll') {
      if (!partData.thickness) warnings.push('Thickness is required');
      if (!partData._coneLargeDia) warnings.push('Large diameter is required');
      if (!partData._coneSmallDia) warnings.push('Small diameter is required');
      if (!partData._coneHeight) warnings.push('Cone height is required');
      if (parseFloat(partData._coneLargeDia) <= parseFloat(partData._coneSmallDia)) warnings.push('Large diameter must be greater than small diameter');
    }

    if (partData.partType === 'fab_service') {
      if (!partData._serviceType) warnings.push('Service type is required');
      if (!partData._linkedPartId) warnings.push('A linked part must be selected');
    }

    if (partData.partType === 'shop_rate') {
      if (!partData._shopDescription) warnings.push('Job description is required');
      if (!partData._shopHours || parseFloat(partData._shopHours) <= 0) warnings.push('Estimated hours is required');
    }

    if (partData.partType === 'rush_service') {
      if (partData._expediteEnabled && partData._expediteType === 'custom_pct' && !partData._expediteCustomPct) warnings.push('Custom percentage is required');
      if (partData._expediteEnabled && partData._expediteType === 'custom_amt' && !partData._expediteCustomAmt && partData._expediteCustomAmt !== '0') warnings.push('Custom amount is required');
    }
    
    // Generic validations for all types
    if (!partData.quantity || parseInt(partData.quantity) < 1) warnings.push('Quantity must be at least 1');
    
    return warnings;
  };

  const handleSavePart = async (addAnother = false) => {
    const warnings = validatePart();
    if (warnings.length > 0) {
      setPartFormError(warnings);
      return;
    }
    if (isNew) { setPartFormError(['Generate the estimate first to add parts']); return; }
    try {
      setSaving(true);
      setPartFormError(null);
      
      // Ensure materialSource has a valid value before sending
      const dataToSend = { ...partData };
      // Remove UI-only fields that shouldn't be saved to database
      delete dataToSend._vendorSearch;
      // Capture the shape file before cleaning dataToSend
      const pendingShapeFile = dataToSend._shapeFile;
      delete dataToSend._shapeFile; // File objects can't be serialized to JSON
      if (!dataToSend.materialSource || !['we_order', 'customer_supplied', 'in_stock'].includes(dataToSend.materialSource)) {
        dataToSend.materialSource = 'customer_supplied';
      }
      // Sanitize ENUM fields — empty strings break Postgres ENUMs, must be null
      if (!dataToSend.rollType) dataToSend.rollType = null;
      
      // Recalculate partTotal at save time to avoid useEffect timing issues
      const EA_PRICED = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'];
      // Clean price fields to exact 2-decimal values
      if (dataToSend.laborTotal) dataToSend.laborTotal = (Math.round(parseFloat(dataToSend.laborTotal) * 100) / 100).toFixed(2);
      if (dataToSend.materialTotal) dataToSend.materialTotal = (Math.round(parseFloat(dataToSend.materialTotal) * 100) / 100).toFixed(2);
      if (EA_PRICED.includes(dataToSend.partType)) {
        const qty = parseInt(dataToSend.quantity) || 1;
        const matCost = parseFloat(dataToSend.materialTotal) || 0;
        const matMarkup = parseFloat(dataToSend.materialMarkupPercent) || 0;
        const matEachRaw = Math.round(matCost * (1 + matMarkup / 100) * 100) / 100;
        const matEach = roundUpMaterial(matEachRaw, dataToSend._materialRounding);
        const labEach = parseFloat(dataToSend.laborTotal) || 0;
        dataToSend.partTotal = ((matEach + labEach) * qty).toFixed(2);
      }
      
      let savedPartId = editingPart?.id;
      if (editingPart && editingPart.id) {
        await updateEstimatePart(id, editingPart.id, dataToSend);
      } else {
        const result = await addEstimatePart(id, dataToSend);
        savedPartId = result.data?.data?.id || result.data?.id;
      }
      
      // Auto-upload pending shape file (from any part form with drawing upload)
      if (pendingShapeFile && savedPartId) {
        try {
          await uploadEstimatePartFile(id, savedPartId, pendingShapeFile, 'drawing');
        } catch (fileErr) {
          console.error('Auto-upload file failed:', fileErr);
        }
      }
      
      await loadEstimate();
      regeneratePdfIfActive();
      
      if (addAnother && !editingPart) {
        // Reset form and go back to part type picker
        setShowPartModal(false);
        setEditingPart(null);
        setPartData({});
        setPartFormError(null);
        setVendorSuggestions([]);
        setShowVendorSuggestions(false);
        showMessage('Part added — select next part type');
        setShowPartTypePicker(true);
      } else {
        setShowPartModal(false);
        setEditingPart(null);
        setPartData({});
        setPartFormError(null);
        setVendorSuggestions([]);
        setShowVendorSuggestions(false);
        showMessage(editingPart ? 'Part updated' : 'Part added');
      }
    } catch (err) { 
      console.error('Save part error:', err);
      setPartFormError([err.response?.data?.error?.message || 'Failed to save part']); 
    }
    finally { setSaving(false); }
  };

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Delete this part?')) return;
    try {
      await deleteEstimatePart(id, partId);
      await loadEstimate();
      regeneratePdfIfActive();
      showMessage('Part deleted');
    } catch (err) { setError('Failed to delete part'); }
  };

  const handleFileUpload = async (uploadedFiles) => {
    if (isNew) { setError('Save first'); return; }
    try {
      setSaving(true);
      await uploadEstimateFiles(id, Array.from(uploadedFiles));
      await loadEstimate();
      showMessage('Files uploaded');
    } catch (err) { setError('Upload failed'); }
    finally { setSaving(false); }
  };

  const handleViewFile = async (file) => {
    try {
      const data = await getEstimateFileSignedUrl(id, file.id);
      window.open(data.url, '_blank');
    } catch (err) { setError('Failed to open'); }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm('Delete?')) return;
    try {
      await deleteEstimateFile(id, file.id);
      await loadEstimate();
    } catch (err) { setError('Delete failed'); }
  };

  // Part File Upload Handlers
  const handlePartFileUpload = async (partId, files) => {
    const fileList = Array.isArray(files) ? files : files?.length ? Array.from(files) : files ? [files] : [];
    if (fileList.length === 0) return;
    try {
      setUploadingPartFile(partId);
      await uploadEstimatePartFile(id, partId, fileList, 'drawing');
      await loadEstimate();
      showMessage(`${fileList.length} file${fileList.length > 1 ? 's' : ''} uploaded to part`);
    } catch (err) { setError('Failed to upload file'); }
    finally { setUploadingPartFile(null); }
  };

  const handleViewPartFile = async (partId, file) => {
    try {
      const response = await viewEstimatePartFile(id, partId, file.id);
      const url = response.data?.data?.url || response.data?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        // Fallback to direct URL
        window.open(file.url, '_blank');
      }
    } catch (err) {
      // Fallback to direct URL if proxy fails
      window.open(file.url, '_blank');
    }
  };

  const handleDeletePartFile = async (partId, fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await deleteEstimatePartFile(id, partId, fileId);
      await loadEstimate();
      showMessage('File deleted');
    } catch (err) { setError('Failed to delete file'); }
  };

  // Convert to Work Order Handlers
  const openConvertModal = async () => {
    if (parts.length === 0) {
      setError('Add at least one part before converting to work order');
      return;
    }
    
    setConvertData({
      clientPurchaseOrderNumber: '',
      requestedDueDate: '',
      promisedDate: '',
      notes: formData.notes,
      materialReceived: false
    });
    setUseCustomDR(false);
    setCustomDR('');
    try { const res = await getNextDRNumber(); setNextDR(res.data.data.nextNumber); } catch { setNextDR(null); }
    
    setShowConvertModal(true);
  };

  const handleConvertToWorkOrder = async () => {
    try {
      setConverting(true);
      const payload = {
        ...convertData,
        customDRNumber: useCustomDR && customDR ? parseInt(customDR) : null
      };
      const response = await convertEstimateToWorkOrder(id, payload);
      const workOrder = response.data.data.workOrder;
      setShowConvertModal(false);
      
      const message = `Work order DR-${workOrder.drNumber} created!`;
      showMessage(message);
      
      // Reload estimate to update workOrderId status
      await loadEstimate();
      
      // Navigate to the new work order
      setTimeout(() => navigate(`/workorders/${workOrder.id}`), 1500);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to convert to work order');
    } finally {
      setConverting(false);
    }
  };

  const formatCurrency = (amt) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt || 0);
  
  const printEstimate = () => {
    const totals = calculateTotals();
    const partsHtml = (() => {
      const sorted = parts.filter(p => p.partType !== 'rush_service').sort((a, b) => a.partNumber - b.partNumber);
      const regular = sorted.filter(p => !['fab_service', 'shop_rate'].includes(p.partType) || !(p._linkedPartId || (p.formData || {})._linkedPartId));
      const services = sorted.filter(p => ['fab_service', 'shop_rate'].includes(p.partType) && (p._linkedPartId || (p.formData || {})._linkedPartId));
      const grouped = [];
      const used = new Set();
      regular.forEach(rp => {
        grouped.push(rp);
        services.forEach(sp => {
          const lid = sp._linkedPartId || (sp.formData || {})._linkedPartId;
          if (String(lid) === String(rp.id) && !used.has(sp.id)) { grouped.push(sp); used.add(sp.id); }
        });
      });
      services.forEach(sp => { if (!used.has(sp.id)) grouped.push(sp); });
      return grouped;
    })().map(part => {
      const isLinkedService = ['fab_service', 'shop_rate'].includes(part.partType) && (part._linkedPartId || (part.formData || {})._linkedPartId);
      const linkedParent = isLinkedService ? parts.find(p => String(p.id) === String(part._linkedPartId || (part.formData || {})._linkedPartId)) : null;
      const calc = calculatePartTotal(part);
      const isEaPricing = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType);
      const laborRatio = (totals.minInfo.minimumApplies && totals.minInfo.totalLabor > 0 && isEaPricing) ? totals.minInfo.adjustedLabor / totals.minInfo.totalLabor : 1;
      const adjLaborEach = calc.laborEach * laborRatio;
      const adjUnitPrice = (calc.materialEach || 0) + adjLaborEach;
      const adjPartTotal = adjUnitPrice * (parseInt(part.quantity) || 1);
      
      // Build description lines (matching PDF style)
      const descLines = [];
      
      if (part.clientPartNumber) descLines.push(`Client Part#: ${part.clientPartNumber}`);
      
      // Material description
      if (part.partType === 'cone_roll') {
        const thk = part.thickness || '';
        const ldType = (part._coneLargeDiaType || 'inside') === 'inside' ? 'ID' : (part._coneLargeDiaType === 'outside' ? 'OD' : 'CLD');
        const sdType = (part._coneSmallDiaType || 'inside') === 'inside' ? 'ID' : (part._coneSmallDiaType === 'outside' ? 'OD' : 'CLD');
        const ld = parseFloat(part._coneLargeDia) || 0;
        const sd = parseFloat(part._coneSmallDia) || 0;
        const vh = parseFloat(part._coneHeight) || 0;
        let c = thk ? thk + ' ' : '';
        c += 'Cone - ';
        if (ld && sd && vh) c += ld.toFixed(1) + '" ' + ldType + ' x ' + sd.toFixed(1) + '" ' + sdType + ' x ' + vh.toFixed(1) + '" VH';
        if (part.material) c += ' ' + part.material;
        if (part._materialOrigin) c += ' ' + part._materialOrigin;
        descLines.push(c);
      } else if (part.materialDescription) {
        descLines.push(part.materialDescription);
      } else {
        const specs = [];
        if (part.material) specs.push(part.material);
        if (part.sectionSize) specs.push(part.partType === 'pipe_roll' && part._schedule ? part.sectionSize.replace(' Pipe', ` Sch ${part._schedule} Pipe`) : part.sectionSize);
        if (part.thickness) specs.push(part.thickness);
        if (part.width) specs.push(`${part.width}" wide`);
        if (part.length) specs.push(part.length.toString().includes('"') || part.length.toString().includes("'") ? part.length : `${part.length}" long`);
        if (part.outerDiameter) specs.push(`${part.outerDiameter}" OD`);
        if (part.wallThickness && part.wallThickness !== 'SOLID') specs.push(`${part.wallThickness}" wall`);
        if (part.wallThickness === 'SOLID') specs.push('Solid Bar');
        if (specs.length) descLines.push(specs.join(' x '));
      }
      
      // Rolling info
      const rollVal = part.diameter || part.radius;
      if (rollVal) {
        const mp = part._rollMeasurePoint || 'inside';
        const isRad = !!part.radius && !part.diameter;
        const specLbl = mp === 'inside' ? (isRad ? 'ISR' : 'ID') : mp === 'outside' ? (isRad ? 'OSR' : 'OD') : (isRad ? 'CLR' : 'CLD');
        const dirLbl = part.rollType ? (part.partType === 'tee_bar' ? (part.rollType === 'easy_way' ? 'SO' : part.rollType === 'on_edge' ? 'SU' : 'SI') : (part.rollType === 'easy_way' ? 'EW' : part.rollType === 'on_edge' ? 'OE' : 'HW')) : '';
        let rl = 'Roll: ' + rollVal + '" ' + specLbl;
        if (dirLbl) rl += ' (' + dirLbl + ')';
        if (part.arcDegrees) rl += ' | Arc: ' + part.arcDegrees + '°';
        descLines.push(rl);
      } else if (part._rollToMethod === 'template') {
        descLines.push('Roll Per Template / Sample');
      } else if (part._rollToMethod === 'print') {
        descLines.push('Roll per print (see attached)');
      }
      
      if (part._completeRings && part._ringsNeeded) descLines.push(part._ringsNeeded + ' complete ring(s) required');
      if ((part.partType === 'angle_roll' || part.partType === 'channel_roll') && part._orientationOption) {
        descLines.push('Orientation: ' + (part.rollType === 'easy_way' ? 'EW-OD' : 'HW-ID') + ' Option ' + part._orientationOption);
      }
      if (part.partType === 'cone_roll') {
        const cType = part._coneType === 'eccentric' ? 'Eccentric' + (part._coneEccentricAngle ? ' = ' + part._coneEccentricAngle + '°' : '') : 'Concentric';
        const rSegs = parseInt(part._coneRadialSegments) || 1;
        descLines.push(cType + (rSegs > 1 ? ' | ' + rSegs + ' @ ' + (360/rSegs).toFixed(0) + '°' : ''));
        if (part.cutFileReference) descLines.push('Layout: ' + part.cutFileReference);
      }
      
      if (part._pitchEnabled) {
        let pLine = 'Pitch: ' + (part._pitchDirection === 'clockwise' ? 'CW' : 'CCW');
        if (part._pitchMethod === 'runrise' && part._pitchRise) pLine += ' | Run: ' + part._pitchRun + '" / Rise: ' + part._pitchRise + '"';
        if (part._pitchDevelopedDia > 0) pLine += ' | Dev Ø: ' + parseFloat(part._pitchDevelopedDia).toFixed(4) + '"';
        descLines.push(pLine);
      }
      
      // Material source
      if (!['fab_service', 'shop_rate'].includes(part.partType)) {
        descLines.push('Material by: ' + (part.materialSource === 'customer_supplied' ? (formData.clientName || 'Customer') : 'Carolina Rolling Company'));
      }
      
      if (part.specialInstructions) descLines.push('Note: ' + (part.specialInstructions.length > 80 ? part.specialInstructions.substring(0, 80) + '...' : part.specialInstructions));
      
      // Pricing detail line
      const priceParts = [];
      if (calc.materialEach > 0) priceParts.push('Material: ' + formatCurrency(calc.materialEach));
      if (adjLaborEach > 0) priceParts.push((part.partType === 'fab_service' ? 'Service' : part.partType === 'shop_rate' ? 'Shop Rate' : part.partType === 'flat_stock' ? 'Handling' : 'Rolling') + ': ' + formatCurrency(adjLaborEach));
      
      const partTypeLabel = PART_TYPES[part.partType]?.label || part.partType;
      
      return `<div class="part-row${isLinkedService ? ' service' : ''}">
        <div class="pr-item${isLinkedService ? ' svc' : ''}">${isLinkedService ? '+' : '#' + part.partNumber}</div>
        <div class="pr-desc">
          <div class="pr-type${isLinkedService ? ' svc' : ''}">${partTypeLabel}${isLinkedService && linkedParent ? ' <span style="font-weight:400;color:#999;">(for Part #' + linkedParent.partNumber + ')</span>' : ''}</div>
          <div class="pr-detail">${descLines.join('<br/>')}</div>
          ${priceParts.length ? '<div class="pr-pricing">' + priceParts.join(' &nbsp;|&nbsp; ') + ' &nbsp;|&nbsp; <strong>Unit: ' + formatCurrency(adjUnitPrice) + '</strong></div>' : ''}
          ${part.partType === 'shop_rate' ? '<div class="shop-rate-warn">* Pricing based on estimated hours — actual cost may vary</div>' : ''}
        </div>
        <div class="pr-qty">${part.quantity}</div>
        <div class="pr-unit">${formatCurrency(adjUnitPrice)}</div>
        <div class="pr-amt">${formatCurrency(adjPartTotal)}</div>
      </div>`;
    }).join('');
    
    const taxLine = formData.taxExempt 
      ? `<div class="total-row"><span>Tax</span><span style="color:#c62828;font-weight:bold;">EXEMPT</span></div>`
      : `<div class="total-row"><span>Tax (${formData.taxRate}%)</span><span>${formatCurrency(totals.taxAmount)}</span></div>`;
    
    const discountLine = totals.discountAmt > 0
      ? `<div class="total-row" style="color:#c62828;"><span>Discount${formData.discountReason ? ` (${formData.discountReason})` : ''}</span><span>-${formatCurrency(totals.discountAmt)}</span></div>` : '';

    const minimumLine = totals.minInfo.minimumApplies
      ? `<div class="total-row" style="font-size:11px;color:#e65100;"><span>Minimum Labor Charge (${totals.minInfo.highestMinRule?.label || ''})</span><span>${formatCurrency(totals.minInfo.adjustedLabor)}</span></div>` : '';

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Estimate ${estimate?.estimateNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px 40px; max-width: 850px; margin: 0 auto; font-size: 13px; color: #333; }
        @page { size: letter; margin: 0.5in; }
        @media print { body { padding: 0; } }
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .doc-title { font-size: 20px; font-weight: 700; color: #1976d2; }
        .doc-right { text-align: right; }
        .doc-num { font-size: 13px; font-weight: 700; color: #333; }
        .doc-date { font-size: 11px; color: #888; }
        .divider { border: none; border-top: 1px solid #ccc; margin: 8px 0; }
        .info-grid { display: flex; gap: 24px; padding: 8px 0; margin-bottom: 6px; font-size: 12px; flex-wrap: wrap; }
        .info-item label { display: block; font-size: 9px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; font-weight: 600; }
        .info-item span { font-weight: 600; color: #333; }
        .section-title { font-size: 11px; text-transform: uppercase; color: #1976d2; font-weight: 700; letter-spacing: 0.5px; margin: 14px 0 6px; }
        .parts-header { display: flex; background: #f5f5f5; padding: 6px 0; border-bottom: 2px solid #ccc; font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; letter-spacing: 0.5px; }
        .ph-item { width: 42px; padding-left: 4px; }
        .ph-desc { flex: 1; padding-left: 8px; }
        .ph-qty { width: 40px; text-align: center; }
        .ph-unit { width: 65px; text-align: right; }
        .ph-amt { width: 70px; text-align: right; padding-right: 4px; }
        .part-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; page-break-inside: avoid; }
        .part-row.service { background: #f9f5fb; padding-left: 20px; }
        .pr-item { width: 42px; font-weight: 700; color: #1976d2; font-size: 11px; padding-left: 4px; flex-shrink: 0; }
        .pr-item.svc { color: #7b1fa2; }
        .pr-desc { flex: 1; padding-left: 8px; }
        .pr-type { font-weight: 700; font-size: 11px; color: #333; }
        .pr-type.svc { color: #7b1fa2; font-size: 10px; }
        .pr-detail { font-size: 10px; color: #666; line-height: 1.5; margin-top: 2px; }
        .pr-pricing { font-size: 10px; color: #555; margin-top: 3px; display: flex; gap: 12px; }
        .pr-pricing strong { color: #1565c0; }
        .pr-qty { width: 40px; text-align: center; font-weight: 600; font-size: 12px; flex-shrink: 0; }
        .pr-unit { width: 65px; text-align: right; font-size: 11px; flex-shrink: 0; }
        .pr-amt { width: 70px; text-align: right; font-weight: 700; font-size: 11px; padding-right: 4px; flex-shrink: 0; }
        .totals-box { margin-top: 16px; padding: 12px 16px; border: 1px solid #ccc; border-radius: 6px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .total-row.grand { padding: 8px 0; border-top: 2px solid #1976d2; margin-top: 4px; font-size: 16px; font-weight: 700; color: #1976d2; }
        .cc-box { margin-top: 10px; font-size: 11px; color: #666; text-align: right; }
        .notes-box { margin-top: 12px; padding: 10px; background: #f9f9f9; border-radius: 4px; font-size: 11px; }
        .shop-rate-warn { font-size: 10px; color: #e65100; margin-top: 2px; font-style: italic; }
      </style></head><body>

      <div class="doc-header">
        <span class="doc-title">ESTIMATE</span>
        <div class="doc-right">
          <div class="doc-num">${estimate?.estimateNumber}</div>
          <div class="doc-date">Date: ${new Date(estimate?.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
      ${formData.taxExempt ? '<div style="color:#c62828;font-weight:700;font-size:11px;text-align:right;margin-top:-4px;">TAX EXEMPT</div>' : ''}
      <hr class="divider" />

      <div class="info-grid">
        <div class="info-item"><label>Client</label><span>${formData.clientName}</span></div>
        ${formData.contactName ? `<div class="info-item"><label>Contact</label><span>${formData.contactName}</span></div>` : ''}
        ${formData.contactEmail ? `<div class="info-item"><label>Email</label><span>${formData.contactEmail}</span></div>` : ''}
        ${formData.contactPhone ? `<div class="info-item"><label>Phone</label><span>${formData.contactPhone}</span></div>` : ''}
      </div>
      ${formData.projectDescription ? `<div style="font-size:11px;color:#666;margin-bottom:8px;"><strong>Project:</strong> ${formData.projectDescription}</div>` : ''}

      <div class="section-title">SERVICES & MATERIALS</div>
      <div class="parts-header">
        <div class="ph-item">ITEM</div>
        <div class="ph-desc">DESCRIPTION</div>
        <div class="ph-qty">QTY</div>
        <div class="ph-unit">UNIT</div>
        <div class="ph-amt">AMOUNT</div>
      </div>

      ${partsHtml}

      ${formData.truckingCost > 0 ? `
        <div class="part-row">
          <div class="pr-item"></div>
          <div class="pr-desc"><span class="pr-type">Trucking / Delivery</span>${formData.truckingDescription ? `<div class="pr-detail">${formData.truckingDescription}</div>` : ''}<div class="pr-detail" style="color:#e65100;">Not Taxed</div></div>
          <div class="pr-qty"></div>
          <div class="pr-unit"></div>
          <div class="pr-amt">${formatCurrency(formData.truckingCost)}</div>
        </div>
      ` : ''}

      <div class="totals-box">
        ${minimumLine}
        ${totals.expediteAmount > 0 ? `<div class="total-row" style="color:#e65100;"><span>🚨 ${totals.expediteLabel}</span><strong>${formatCurrency(totals.expediteAmount)}</strong></div>` : ''}
        ${totals.emergencyAmount > 0 ? `<div class="total-row" style="color:#c62828;"><span>🚨 ${totals.emergencyLabel}</span><strong>${formatCurrency(totals.emergencyAmount)}</strong></div>` : ''}
        <div class="total-row"><span>Parts Subtotal</span><span>${formatCurrency(totals.partsSubtotal)}</span></div>
        ${totals.trucking > 0 ? `<div class="total-row"><span>Trucking</span><span>${formatCurrency(totals.trucking)}</span></div>` : ''}
        ${discountLine}
        ${taxLine}
        <div class="total-row grand"><span>Grand Total</span><span>${formatCurrency(totals.grandTotal)}</span></div>
      </div>

      <div class="cc-box">
        <strong>Total with Credit Card Fees:</strong>
        In-Person (2.6% + $0.15): <strong>${formatCurrency(totals.ccInPersonTotal)}</strong> |
        Manual (3.5% + $0.15): <strong>${formatCurrency(totals.ccManualTotal)}</strong>
      </div>

      ${formData.notes ? `<div class="notes-box"><strong>Terms:</strong> ${formData.notes}</div>` : ''}
      </body></html>`);
    w.document.close();
    w.print();
  };

  const totals = calculateTotals();

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/estimates')} style={{ borderRadius: '50%', padding: 8 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            {isNew ? (
              <h1 className="page-title">New Estimate</h1>
            ) : editingEstNum ? (
              <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="text" value={estNumInput} onChange={(e) => setEstNumInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEstNumChange(); if (e.key === 'Escape') setEditingEstNum(false); }}
                  autoFocus
                  style={{ fontSize: '1.1rem', fontWeight: 700, padding: '4px 10px', border: '2px solid #1976d2', borderRadius: 6, width: 220 }} />
                <button className="btn btn-sm btn-primary" onClick={handleEstNumChange} style={{ padding: '4px 8px' }}><Check size={16} /></button>
                <button className="btn btn-sm btn-outline" onClick={() => setEditingEstNum(false)} style={{ padding: '4px 8px' }}><X size={16} /></button>
              </h1>
            ) : (
              <h1 className="page-title" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => { setEstNumInput(estimate?.estimateNumber || ''); setEditingEstNum(true); }}
                title="Click to change estimate number">
                {estimate?.estimateNumber} <Edit size={14} style={{ opacity: 0.4 }} />
              </h1>
            )}
            {!isNew && <div style={{ color: '#666', fontSize: '0.875rem' }}>{formData.clientName}</div>}
          </div>
        </div>
        <div className="actions-row">
          {!isNew && (
            <button className="btn btn-outline" onClick={generatePdfPreview} disabled={pdfGenerating}>
              <Eye size={18} /> {pdfGenerating ? 'Generating...' : 'Generate PDF'}
            </button>
          )}
          {!isNew && <button className="btn btn-outline" onClick={printEstimate}><Printer size={18} /> Print</button>}
          <button className="btn btn-secondary" onClick={() => handleSave(false)} disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : isNew ? 'Generate New Estimate' : 'Save'}
          </button>
          {!isNew && !estimate?.workOrderId && (
            <button className="btn" onClick={openConvertModal} disabled={converting}
              style={{ background: '#2e7d32', color: 'white' }}>
              <Package size={18} /> Convert to Work Order
            </button>
          )}
          {estimate?.workOrderId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button 
                className="btn"
                onClick={() => navigate(`/workorders/${estimate.workOrderId}`)}
                style={{ background: '#e8f5e9', color: '#2e7d32' }}
              >
                ✓ View Work Order
              </button>
              <button 
                className="btn btn-sm"
                onClick={async () => {
                  if (!window.confirm('Reset conversion? This will allow you to convert again. Use only if the work order is missing.')) return;
                  try {
                    await resetEstimateConversion(id);
                    await loadEstimate();
                    showMessage('Conversion reset. You can convert again.');
                  } catch (err) {
                    setError(err.response?.data?.error?.message || 'Cannot reset - work order exists');
                  }
                }}
                style={{ background: '#fff3e0', color: '#e65100' }}
                title="Reset if work order is missing"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Stored PDF File Bar */}
      {!isNew && files.some(f => (f.originalName || f.filename || '').startsWith('Generated-Estimate-')) && !pdfPreviewUrl && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: 8 }}>
          <FileText size={18} style={{ color: '#1976d2' }} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: '#333' }}>
            Estimate-{estimate?.estimateNumber || id}.pdf
          </span>
          <button onClick={viewStoredPdf} disabled={pdfGenerating}
            title="Preview PDF"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#1976d2' }}>
            <Eye size={18} />
          </button>
          <button onClick={downloadStoredPdf}
            title="Download PDF"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#1976d2' }}>
            <FileDown size={18} />
          </button>
        </div>
      )}

      {/* PDF Preview (expanded) */}
      {pdfPreviewUrl && (
        <div style={{ marginBottom: 16, border: '2px solid #1976d2', borderRadius: 12, overflow: 'hidden', background: '#f5f5f5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#1976d2', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.9rem' }}>
              <FileText size={16} /> PDF Preview
              {pdfGenerating && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}> — Regenerating...</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={generatePdfPreview} disabled={pdfGenerating}
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                ↻ Refresh
              </button>
              <button onClick={handleDownloadFromPreview}
                style={{ background: 'white', color: '#1976d2', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileDown size={14} /> Download</span>
              </button>
              <button onClick={closePdfPreview}
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', lineHeight: 1 }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <iframe
            src={pdfPreviewUrl}
            style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
            title="Estimate PDF Preview"
          />
        </div>
      )}

      {/* Status Workflow Bar */}
      {!isNew && estimate && (
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', marginBottom: 16,
          background: '#f5f5f5', borderRadius: 10, border: '1px solid #e0e0e0', flexWrap: 'wrap'
        }}>
          {/* Status steps */}
          {[
            { key: 'draft', label: 'Draft', icon: '📝', color: '#757575', bg: '#eeeeee' },
            { key: 'sent', label: 'Sent', icon: '📤', color: '#1565c0', bg: '#e3f2fd' },
            { key: 'accepted', label: 'Accepted', icon: '✅', color: '#2e7d32', bg: '#e8f5e9' },
          ].map((step, idx) => {
            const statusOrder = ['draft', 'sent', 'accepted', 'declined', 'converted', 'archived'];
            const currentIdx = statusOrder.indexOf(estimate.status);
            const stepIdx = statusOrder.indexOf(step.key);
            const isActive = estimate.status === step.key;
            const isPast = stepIdx < currentIdx || (estimate.status === 'converted' && step.key !== 'converted');
            const ts = step.key === 'sent' ? estimate.sentAt : step.key === 'accepted' ? estimate.acceptedAt : estimate.createdAt;
            return (
              <React.Fragment key={step.key}>
                {idx > 0 && <div style={{ width: 24, height: 2, background: isPast || isActive ? step.color : '#ccc' }} />}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  opacity: isPast || isActive ? 1 : 0.4,
                }}>
                  <div style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
                    background: isActive ? step.bg : isPast ? step.bg : '#eee',
                    color: isActive || isPast ? step.color : '#999',
                    border: isActive ? `2px solid ${step.color}` : '2px solid transparent',
                  }}>
                    {step.icon} {step.label}
                  </div>
                  {ts && (isPast || isActive) && (
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>
                      {new Date(ts).toLocaleDateString()} {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* Converted indicator */}
          {estimate.workOrderId && (
            <>
              <div style={{ width: 24, height: 2, background: '#7b1fa2' }} />
              <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, background: '#f3e5f5', color: '#7b1fa2', border: '2px solid #7b1fa2' }}>
                🔄 Work Order Created
              </div>
            </>
          )}

          {/* Declined indicator */}
          {estimate.status === 'declined' && (
            <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, background: '#ffebee', color: '#c62828', border: '2px solid #c62828' }}>
              ❌ Declined
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Action buttons */}
          {estimate.status === 'draft' && (
            <button className="btn btn-sm" onClick={async () => {
              try {
                await updateEstimate(id, { status: 'sent' });
                await loadEstimate();
                showMessage('Estimate marked as sent');
              } catch (err) { setError('Failed to update status'); }
            }} style={{ background: '#1565c0', color: 'white', borderRadius: 20, padding: '6px 16px' }}>
              📤 Mark as Sent
            </button>
          )}
          {estimate.status === 'sent' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={async () => {
                try {
                  await updateEstimate(id, { status: 'accepted' });
                  await loadEstimate();
                  showMessage('Estimate marked as accepted');
                } catch (err) { setError('Failed to update status'); }
              }} style={{ background: '#2e7d32', color: 'white', borderRadius: 20, padding: '6px 16px' }}>
                ✅ Mark as Accepted
              </button>
              <button className="btn btn-sm" onClick={async () => {
                try {
                  await updateEstimate(id, { status: 'declined' });
                  await loadEstimate();
                  showMessage('Estimate marked as declined');
                } catch (err) { setError('Failed to update status'); }
              }} style={{ background: '#fff', color: '#c62828', border: '1px solid #c62828', borderRadius: 20, padding: '6px 16px' }}>
                ❌ Decline
              </button>
            </div>
          )}
          {(estimate.status === 'declined' || estimate.status === 'archived') && (
            <button className="btn btn-sm" onClick={async () => {
              try {
                await updateEstimate(id, { status: 'draft' });
                await loadEstimate();
                showMessage('Estimate reset to draft');
              } catch (err) { setError('Failed to update status'); }
            }} style={{ background: '#fff', color: '#555', border: '1px solid #999', borderRadius: 20, padding: '6px 16px' }}>
              ↩ Reset to Draft
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          {/* Client Info */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Client Information</h3>
            {isNew && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Custom Estimate Number <span style={{ fontWeight: 400, color: '#999' }}>(optional — leave blank for auto)</span></label>
                <input type="text" className="form-input" value={formData.estimateNumber || ''}
                  onChange={(e) => setFormData({ ...formData, estimateNumber: e.target.value })}
                  placeholder="e.g. Q-2026-001 or leave blank for EST-XXXXXX-XXX" style={{ maxWidth: 300 }} />
              </div>
            )}
            <div className="grid grid-2">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Client Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.clientName}
                  ref={clientInputRef}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, clientName: value });
                    if (value.length >= 2) {
                      try {
                        const res = await searchClients(value);
                        setClientSuggestions(res.data.data || []);
                        setShowClientSuggestions(true);
                      } catch (err) {
                        setClientSuggestions([]);
                      }
                    } else {
                      setClientSuggestions([]);
                      setShowClientSuggestions(false);
                    }
                  }}
                  onFocus={() => clientSuggestions.length > 0 && setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  autoComplete="off"
                />
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'white', border: '1px solid #ddd', borderRadius: 4,
                    maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {clientSuggestions.map(client => (
                      <div 
                        key={client.id}
                        style={{ 
                          padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #eee',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                        onMouseDown={() => {
                          // Apply client data
                          setFormData({
                            ...formData,
                            clientName: client.name,
                            contactName: client.contactName || formData.contactName,
                            contactEmail: client.contactEmail || formData.contactEmail,
                            contactPhone: client.contactPhone || formData.contactPhone,
                            // Apply tax settings - auto exempt for resale/exempt or verified resale certs
                            taxExempt: client.taxStatus === 'resale' || client.taxStatus === 'exempt' || 
                              (!!client.resaleCertificate && client.permitStatus === 'active'),
                            taxExemptReason: (client.taxStatus === 'resale' || (client.resaleCertificate && client.permitStatus === 'active')) ? 'Resale' : (client.taxStatus === 'exempt' ? 'Tax Exempt' : ''),
                            taxExemptCertNumber: client.resaleCertificate || '',
                            useCustomTax: !!client.customTaxRate,
                            taxRate: client.customTaxRate ? parseFloat(client.customTaxRate) * 100 : formData.taxRate
                          });
                          setShowClientSuggestions(false);
                          setClientPaymentTerms(client.paymentTerms || null);
                          showMessage(`Applied ${client.name}'s info`);
                        }}
                      >
                        <div>
                          <strong>{client.name}</strong>
                          {client.contactName && <div style={{ fontSize: '0.8rem', color: '#666' }}>{client.contactName}</div>}
                        </div>
                        <span style={{ 
                          fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                          background: (client.taxStatus === 'resale' || (client.resaleCertificate && client.permitStatus === 'active')) ? '#fff3e0' : client.taxStatus === 'exempt' ? '#e8f5e9' : '#e3f2fd',
                          color: (client.taxStatus === 'resale' || (client.resaleCertificate && client.permitStatus === 'active')) ? '#e65100' : client.taxStatus === 'exempt' ? '#2e7d32' : '#1565c0'
                        }}>
                          {(client.taxStatus === 'resale' || (client.resaleCertificate && client.permitStatus === 'active')) ? '✅ Resale' : client.taxStatus === 'exempt' ? 'Exempt' : 'Taxable'}
                        </span>
                      </div>
                    ))}
                    {formData.clientName && formData.clientName.length >= 2 && !clientSuggestions.some(c => c.name.toLowerCase() === formData.clientName.toLowerCase()) && (
                      <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, borderTop: '2px solid #c8e6c9' }}
                        onMouseDown={() => {
                          setShowClientSuggestions(false);
                          navigate(`/clients-vendors?addClient=${encodeURIComponent(formData.clientName)}`);
                        }}>
                        + Add "{formData.clientName}" as new client
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input type="text" className="form-input" value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" className="form-input" value={formatPhone(formData.contactPhone || '')}
                  onChange={(e) => setFormData({ ...formData, contactPhone: formatPhone(e.target.value) })} />
              </div>
              {clientPaymentTerms && (
                <div className="form-group">
                  <label className="form-label">Payment Terms</label>
                  <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, fontWeight: 600, fontSize: '0.95rem', border: '1px solid #e0e0e0' }}>{clientPaymentTerms}</div>
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Project Description</label>
                <textarea className="form-textarea" value={formData.projectDescription}
                  onChange={(e) => setFormData({ ...formData, projectDescription: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Parts */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📦 Parts ({parts.length})</h3>
              <button className="btn btn-primary btn-sm" onClick={openAddPartModal} disabled={isNew}>
                <Plus size={16} /> Add Part
              </button>
            </div>

            {isNew && <p style={{ color: '#666', padding: 20, textAlign: 'center' }}>Save the estimate first to add parts</p>}

            {(() => {
              // Group parts: regular parts first, then linked services right after their parent
              const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
              const regularParts = sortedParts.filter(p => !['fab_service', 'shop_rate'].includes(p.partType) || !(p._linkedPartId || (p.formData || {})._linkedPartId));
              const serviceParts = sortedParts.filter(p => ['fab_service', 'shop_rate'].includes(p.partType) && (p._linkedPartId || (p.formData || {})._linkedPartId));
              const grouped = [];
              const usedServiceIds = new Set();
              regularParts.forEach(rp => {
                grouped.push(rp);
                serviceParts.forEach(sp => {
                  const linkedId = sp._linkedPartId || (sp.formData || {})._linkedPartId;
                  if (String(linkedId) === String(rp.id) && !usedServiceIds.has(sp.id)) {
                    grouped.push(sp);
                    usedServiceIds.add(sp.id);
                  }
                });
              });
              // Add any unlinked services at the end
              serviceParts.forEach(sp => { if (!usedServiceIds.has(sp.id)) grouped.push(sp); });
              return grouped;
            })().map(part => {
              const calc = calculatePartTotal(part);
              const isLinkedService = ['fab_service', 'shop_rate'].includes(part.partType) && (part._linkedPartId || (part.formData || {})._linkedPartId);
              const linkedParent = isLinkedService ? parts.find(p => String(p.id) === String(part._linkedPartId || (part.formData || {})._linkedPartId)) : null;
              // Adjust labor proportionally when minimum charge applies
              const isEa = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType);
              const laborRatio = (totals.minInfo.minimumApplies && totals.minInfo.totalLabor > 0 && isEa) ? totals.minInfo.adjustedLabor / totals.minInfo.totalLabor : 1;
              const adjLabor = (calc.laborEach || 0) * laborRatio;
              const adjUnitPrice = (calc.materialEach || 0) + adjLabor;
              const adjPartTotal = adjUnitPrice * (parseInt(part.quantity) || 1);
              return (
                <div key={part.id} style={{
                  border: isLinkedService ? '2px solid #9e9e9e' : '2px solid #e0e0e0',
                  borderRadius: 12, padding: isLinkedService ? '12px 16px' : 16, marginBottom: isLinkedService ? 4 : 12,
                  marginLeft: isLinkedService ? 32 : 0, marginTop: isLinkedService ? -4 : 0,
                  background: isLinkedService ? '#eeeeee' : 'white',
                  borderTopLeftRadius: isLinkedService ? 4 : 12, borderTopRightRadius: isLinkedService ? 4 : 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 8, borderBottom: isLinkedService ? '1px solid #bdbdbd' : '1px solid #eee' }}>
                    <div>
                      <div style={{ fontSize: isLinkedService ? '0.95rem' : '1.1rem', fontWeight: 700, color: isLinkedService ? '#424242' : '#1976d2' }}>
                        {isLinkedService && <span style={{ marginRight: 6 }}>+</span>}
                        Part #{part.partNumber} - {PART_TYPES[part.partType]?.label || part.partType}
                        {isLinkedService && linkedParent && (
                          <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#757575', marginLeft: 8 }}>
                            for Part #{linkedParent.partNumber}
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.85rem' }}>
                        {part.clientPartNumber && `Client Part#: ${part.clientPartNumber}`}
                        {part.heatNumber && ` • Heat#: ${part.heatNumber}`}
                        {part.cutFileReference && ` • Cut File: ${part.cutFileReference}`}
                      </div>
                    </div>
                    <div className="actions-row">
                      {part.materialOrdered && (
                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                          <Check size={12} /> PO: {part.materialPurchaseOrderNumber}
                        </span>
                      )}
                      <button className="btn btn-sm btn-outline" onClick={() => openEditPartModal(part)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeletePart(part.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.875rem', marginBottom: 12 }}>
                    {/* Rush Service Display */}
                    {part.partType === 'rush_service' ? (() => {
                      const fd = part.formData || part;
                      return (
                        <div style={{ padding: 12, background: '#fff8e1', borderRadius: 8, border: '2px solid #ffcc80' }}>
                          {fd._expediteEnabled && (
                            <div style={{ padding: '4px 0', color: '#e65100', fontWeight: 600 }}>
                              🚨 Expedite: {fd._expediteType === 'custom_amt' ? `$${parseFloat(fd._expediteCustomAmt) || 0}` : `${fd._expediteType === 'custom_pct' ? (fd._expediteCustomPct || 0) : fd._expediteType}% of parts subtotal`}
                            </div>
                          )}
                          {fd._emergencyEnabled && (
                            <div style={{ padding: '4px 0', color: '#c62828', fontWeight: 600 }}>
                              🚨 Emergency Off Hour Opening: {fd._emergencyDay} — ${{'Saturday': 600, 'Saturday Night': 800, 'Sunday': 600, 'Sunday Night': 800}[fd._emergencyDay] || 0}
                            </div>
                          )}
                        </div>
                      );
                    })() : <>
                    {/* Line 1: Qty, Size, Grade */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                      <span><strong>Qty:</strong> {part.quantity}</span>
                      {part.sectionSize && <span style={{ color: '#555' }}>| <strong>Size:</strong> {part.partType === 'pipe_roll' && (part.formData || {})._schedule ? part.sectionSize.replace(' Pipe', ` Sch ${(part.formData || {})._schedule} Pipe`) : part.sectionSize}</span>}
                      {part.thickness && <span style={{ color: '#555' }}>| <strong>Thk:</strong> {part.thickness}</span>}
                      {part.outerDiameter && <span style={{ color: '#555' }}>| <strong>OD:</strong> {part.outerDiameter}"</span>}
                      {part.wallThickness && part.wallThickness !== 'SOLID' && <span style={{ color: '#555' }}>| <strong>Wall:</strong> {part.wallThickness}</span>}
                      {part.wallThickness === 'SOLID' && <span style={{ color: '#e65100', fontWeight: 600 }}>| Solid Bar</span>}
                      {part.width && <span style={{ color: '#555' }}>| <strong>Width:</strong> {part.width}"</span>}
                      {part.length && <span style={{ color: '#555' }}>| <strong>Length:</strong> {part.length}</span>}
                      {part.material && <span style={{ color: '#555' }}>| <strong>Grade:</strong> {part.material}</span>}
                    </div>
                    {/* Line 2: Roll info */}
                    {(part.formData || {})._rollToMethod === 'template' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, color: '#e65100', fontSize: '0.82rem', fontWeight: 600 }}>
                        📐 Per Template / Sample
                        {part.rollType && <span>({part.partType === 'tee_bar' ? (part.rollType === 'easy_way' ? 'SO' : part.rollType === 'on_edge' ? 'SU' : 'SI') : (part.rollType === 'easy_way' ? 'EW' : part.rollType === 'on_edge' ? 'OE' : 'HW')})</span>}
                      </div>
                    )}
                    {(part.formData || {})._rollToMethod === 'print' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, color: '#1565c0', fontSize: '0.82rem', fontWeight: 600 }}>
                        📄 Roll per print
                        {part.rollType && <span>({part.partType === 'tee_bar' ? (part.rollType === 'easy_way' ? 'SO' : part.rollType === 'on_edge' ? 'SU' : 'SI') : (part.rollType === 'easy_way' ? 'EW' : part.rollType === 'on_edge' ? 'OE' : 'HW')})</span>}
                      </div>
                    )}
                    {!(part.formData || {})._rollToMethod && (part.diameter || part.radius) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, color: '#1565c0', fontSize: '0.82rem' }}>
                        🔄 {part.diameter || part.radius}" {(() => {
                          const mp = part._rollMeasurePoint || 'inside';
                          const isRad = !!part.radius && !part.diameter;
                          if (mp === 'inside') return isRad ? 'ISR' : 'ID';
                          if (mp === 'outside') return isRad ? 'OSR' : 'OD';
                          return isRad ? 'CLR' : 'CLD';
                        })()}
                        {part.rollType && <span>({part.partType === 'tee_bar' ? (part.rollType === 'easy_way' ? 'SO' : part.rollType === 'on_edge' ? 'SU' : 'SI') : (part.rollType === 'easy_way' ? 'EW' : part.rollType === 'on_edge' ? 'OE' : 'HW')})</span>}
                        {part.arcDegrees && <span>| Arc: {part.arcDegrees}°</span>}
                        {part._legOrientation && <span>| {part._legOrientation}" leg {part.rollType === 'easy_way' ? 'out' : part.rollType === 'on_edge' ? 'edge' : 'in'}</span>}
                        {part._sideOrientation && <span>| {part._sideOrientation}" side {part.rollType === 'easy_way' ? 'out' : part.rollType === 'on_edge' ? 'edge' : 'in'}</span>}
                      </div>
                    )}
                    {/* Line 3: Centerline Ø (pipe/tube) or Rise/chord calc */}
                    {(() => {
                      const desc = part._rollingDescription || part.specialInstructions || '';
                      const infoLines = desc.split('\n').filter(l => l.includes('Rise:') || l.includes('Complete Ring') || l.includes('Cone:') || l.includes('Sheet Size:'));
                      return infoLines.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: '#6a1b9a', marginTop: 2 }}>
                          {infoLines.map((line, i) => (
                            <div key={i}>📐 {line.trim()}</div>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Complete rings note */}
                    {part._completeRings && part._ringsNeeded && (
                      <div style={{ fontSize: '0.85rem', color: '#2e7d32', fontWeight: 600, marginTop: 4 }}>⭕ {part._ringsNeeded} complete ring(s) required</div>
                    )}
                    {/* Orientation diagram for angle/channel rolls */}
                    {(part.partType === 'angle_roll' || part.partType === 'channel_roll') && part._orientationOption && (
                      <div style={{ marginTop: 8, maxWidth: 250 }}>
                        <img 
                          src={`/images/angle-orientation/${part.partType === 'channel_roll' ? 'Channel' : ''}${part.rollType === 'easy_way' ? 'EWOD' : 'HWID'}Op${part._orientationOption}.png`}
                          alt={`${part.rollType === 'easy_way' ? 'EW-OD' : 'HW-ID'} Option ${part._orientationOption}`}
                          style={{ width: '100%', borderRadius: 6, border: '1px solid #ddd' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', marginTop: 2 }}>
                          {part.rollType === 'easy_way' ? 'EW-OD' : 'HW-ID'} Option {part._orientationOption}
                        </div>
                      </div>
                    )}
                    {/* Cone type + segments */}
                    {part.partType === 'cone_roll' && (
                      <div style={{ fontSize: '0.8rem', color: '#4a148c', marginTop: 4 }}>
                        🔺 {part._coneType === 'eccentric' ? `Eccentric${part._coneEccentricAngle ? ` = ${part._coneEccentricAngle}°` : ''}` : 'Concentric'}
                        {(parseInt(part._coneRadialSegments) || 1) > 1 && ` | ${part._coneRadialSegments} @ ${(360 / (parseInt(part._coneRadialSegments) || 1)).toFixed(0)}°`}
                      </div>
                    )}
                    {part.partType === 'cone_roll' && part.cutFileReference && (
                      <div style={{ fontSize: '0.8rem', color: '#1565c0', marginTop: 2 }}>Layout Filename: {part.cutFileReference}</div>
                    )}
                    {/* Line 4: Pitch info */}
                    {part._pitchEnabled && (
                      <div style={{ fontSize: '0.8rem', color: '#e65100', marginTop: 2 }}>
                        🌀 Pitch: {part._pitchDirection === 'clockwise' ? 'CW' : 'CCW'}
                        {part._pitchMethod === 'runrise' && part._pitchRise && ` | Run: ${part._pitchRun}" / Rise: ${part._pitchRise}"`}
                        {part._pitchMethod === 'degree' && part._pitchAngle && ` | Angle: ${part._pitchAngle}°`}
                        {part._pitchMethod === 'space' && part._pitchSpaceValue && ` | ${part._pitchSpaceType === 'center' ? 'C-C' : 'Between'}: ${part._pitchSpaceValue}"`}
                        {part._pitchDevelopedDia > 0 && <span style={{ color: '#2e7d32', fontWeight: 600 }}> | Dev Ø: {parseFloat(part._pitchDevelopedDia).toFixed(4)}"</span>}
                      </div>
                    )}
                  </>}
                  </div>

                  {/* Material Section - only show if we supply material (old part types) */}
                  {!['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType) && part.weSupplyMaterial && part.materialDescription && (
                    <div style={{ background: '#fff3e0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <strong>📦 Material supplied by: Carolina Rolling Company</strong>
                      </div>
                      <div style={{ fontSize: '0.875rem' }}>{part.materialDescription} (Qty: {part.quantity})</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.85rem' }}>
                        <span>Cost: {formatCurrency(calc.materialCost)} + {part.materialMarkupPercent}% markup</span>
                        <strong style={{ color: '#e65100' }}>{formatCurrency(calc.materialTotal)}</strong>
                      </div>
                    </div>
                  )}

                  {/* Costs Section - ea pricing */}
                  {['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType) ? (
                    <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12 }}>
                      {part.clientPartNumber && (
                        <div style={{ fontSize: '0.8rem', color: '#1565c0', fontWeight: 600, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #e0e0e0' }}>
                          🏷️ Client Part#: {part.clientPartNumber}
                        </div>
                      )}
                      {part.materialDescription && (
                        <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                          📦 {part.materialDescription}
                          {!['fab_service', 'shop_rate'].includes(part.partType) && (
                            <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#2e7d32', fontWeight: 600 }}>
                              {part.materialSource === 'we_order' ? 'Material supplied by: Carolina Rolling Company' : part.materialSource === 'in_stock' ? 'Material supplied by: Carolina Rolling Company' : `Material supplied by: ${formData.clientName || 'Customer'}`}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Material line (after markup + rounding) */}
                      {(calc.materialEach || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
                          <span>Material</span>
                          <strong>{formatCurrency(calc.materialEach)}</strong>
                        </div>
                      )}
                      {/* Rolling/Labor line */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
                        <span>{part.partType === 'fab_service' ? 'Service' : part.partType === 'shop_rate' ? 'Shop Rate' : (part.partType === 'flat_stock' ? 'Handling' : 'Rolling')}</span>
                        <strong>{formatCurrency(adjLabor)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #ddd', marginTop: 4, fontWeight: 600 }}>
                        <span>Unit Price</span>
                        <span style={{ color: '#1976d2' }}>{formatCurrency(adjUnitPrice)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '1.05rem', borderTop: '1px solid #ddd' }}>
                        <strong>Line Total ({part.quantity} × {formatCurrency(adjUnitPrice)})</strong>
                        <strong style={{ color: '#2e7d32' }}>{formatCurrency(adjPartTotal)}</strong>
                      </div>
                      {part.partType === 'shop_rate' && (
                        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 6, padding: 8, marginTop: 8, fontSize: '0.8rem', color: '#e65100' }}>
                          ⚠️ Pricing is an estimate based on predicted hours. Actual cost may vary depending on hours required to complete the job.
                        </div>
                      )}
                    </div>
                  ) : (
                  /* Costs Section - old part types */
                  <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                      <span>🔄 Rolling Cost</span>
                      <strong>{formatCurrency(part.rollingCost)}</strong>
                    </div>
                    {/* Additional Services */}
                    {part.serviceDrilling && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>🔩 Drilling {part.serviceDrillingVendor && <span style={{ fontSize: '0.75rem', color: '#666' }}>({part.serviceDrillingVendor})</span>}</span>
                        <strong>{formatCurrency(part.serviceDrillingCost)}</strong>
                      </div>
                    )}
                    {part.serviceCutting && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>✂️ Cutting {part.serviceCuttingVendor && <span style={{ fontSize: '0.75rem', color: '#666' }}>({part.serviceCuttingVendor})</span>}</span>
                        <strong>{formatCurrency(part.serviceCuttingCost)}</strong>
                      </div>
                    )}
                    {part.serviceFitting && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>🔧 Fitting {part.serviceFittingVendor && <span style={{ fontSize: '0.75rem', color: '#666' }}>({part.serviceFittingVendor})</span>}</span>
                        <strong>{formatCurrency(part.serviceFittingCost)}</strong>
                      </div>
                    )}
                    {part.serviceWelding && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>🔥 Welding {part.serviceWeldingPercent}% {part.serviceWeldingVendor && <span style={{ fontSize: '0.75rem', color: '#666' }}>({part.serviceWeldingVendor})</span>}</span>
                        <strong>{formatCurrency(part.serviceWeldingCost)}</strong>
                      </div>
                    )}
                    {(parseFloat(part.otherServicesCost) > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <span>Other Services (+{part.otherServicesMarkupPercent}%)</span>
                        <strong>{formatCurrency(calc.otherTotal)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '1.05rem' }}>
                      <strong>Part Total</strong>
                      <strong style={{ color: '#1976d2' }}>{formatCurrency(calc.partTotal)}</strong>
                    </div>
                  </div>
                  )}

                  {/* Part Files Section */}
                  <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: '0.9rem' }}>📄 Part Documents</strong>
                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.gif,.dxf,.dwg,.stp,.step"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files?.length > 0) {
                              handlePartFileUpload(part.id, e.target.files);
                              e.target.value = '';
                            }
                          }}
                          disabled={uploadingPartFile === part.id}
                        />
                        <span className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Upload size={14} />
                          {uploadingPartFile === part.id ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                    </div>
                    {part.files && part.files.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {part.files.map(file => (
                          <div key={file.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, background: 'white',
                            padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: '0.8rem'
                          }}>
                            <FileText size={14} style={{ color: '#1976d2' }} />
                            <button onClick={() => handleViewPartFile(part.id, file)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2', textDecoration: 'underline', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', padding: 0 }}>
                              {file.originalName || file.filename}
                            </button>
                            <button onClick={() => handleDeletePartFile(part.id, file.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: 2 }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#999', fontSize: '0.8rem', textAlign: 'center', padding: 8 }}>
                        No documents attached. Upload drawings, prints, or specs.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Trucking */}
            <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 8, padding: 16, marginTop: 16 }}>
              <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                🚚 Trucking <span style={{ fontSize: '0.75rem', color: '#e65100' }}>(Not Taxed)</span>
              </h4>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input type="text" className="form-input" placeholder="Description..."
                  value={formData.truckingDescription}
                  onChange={(e) => setFormData({ ...formData, truckingDescription: e.target.value })}
                  style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>$</span>
                  <input type="number" className="form-input" value={formData.truckingCost}
                    onChange={(e) => setFormData({ ...formData, truckingCost: parseFloat(e.target.value) || 0 })}
                    style={{ width: 100 }} step="0.01" />
                </div>
              </div>
            </div>

            {/* Files */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <strong>📎 Files (DXF, STEP, PDF)</strong>
                <input type="file" multiple accept=".pdf,.dxf,.step,.stp" style={{ display: 'none' }}
                  ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files)} />
                <button className="btn btn-sm btn-outline" onClick={() => fileInputRef.current?.click()} disabled={isNew}>
                  <Upload size={14} /> Upload
                </button>
              </div>
              {files.filter(f => !(f.originalName || f.filename || '').startsWith('Generated-Estimate-')).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {files.filter(f => !(f.originalName || f.filename || '').startsWith('Generated-Estimate-')).map(file => (
                    <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#e3f2fd', borderRadius: 4, fontSize: '0.85rem' }}>
                      <span>{file.originalName || file.filename}</span>
                      <button onClick={() => handleViewFile(file)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Eye size={14} /></button>
                      <button onClick={() => handleDeleteFile(file)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: '#999', fontSize: '0.85rem' }}>{isNew ? 'Save first to upload' : 'No files'}</div>}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Notes & Terms</h3>
            <div className="form-group">
              <label className="form-label">Estimate Notes (visible to customer)</label>
              <textarea className="form-textarea" value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Internal Notes (not visible)</label>
              <textarea className="form-textarea" value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 24 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Estimate Summary</h3>

            {parts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 8 }}>Parts Breakdown</div>
                <div style={{ fontSize: '0.8rem', padding: 8, background: '#f9f9f9', borderRadius: 8 }}>
                  {(() => {
                    const sorted = parts.filter(p => p.partType !== 'rush_service').sort((a, b) => a.partNumber - b.partNumber);
                    const regular = sorted.filter(p => !['fab_service', 'shop_rate'].includes(p.partType) || !(p._linkedPartId || (p.formData || {})._linkedPartId));
                    const services = sorted.filter(p => ['fab_service', 'shop_rate'].includes(p.partType) && (p._linkedPartId || (p.formData || {})._linkedPartId));
                    const grouped = [];
                    const used = new Set();
                    regular.forEach(rp => {
                      grouped.push(rp);
                      services.forEach(sp => {
                        const lid = sp._linkedPartId || (sp.formData || {})._linkedPartId;
                        if (String(lid) === String(rp.id) && !used.has(sp.id)) { grouped.push(sp); used.add(sp.id); }
                      });
                    });
                    services.forEach(sp => { if (!used.has(sp.id)) grouped.push(sp); });
                    return grouped;
                  })().map(part => {
                    const calc = calculatePartTotal(part);
                    const isLS = ['fab_service', 'shop_rate'].includes(part.partType) && (part._linkedPartId || (part.formData || {})._linkedPartId);
                    const isEa = ['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'tee_bar', 'press_brake', 'cone_roll', 'fab_service', 'shop_rate'].includes(part.partType);
                    const lr = (totals.minInfo.minimumApplies && totals.minInfo.totalLabor > 0 && isEa) ? totals.minInfo.adjustedLabor / totals.minInfo.totalLabor : 1;
                    const adjTotal = isEa ? ((calc.materialEach || 0) + (calc.laborEach || 0) * lr) * (parseInt(part.quantity) || 1) : calc.partTotal;
                    return (
                      <div key={part.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', paddingLeft: isLS ? 12 : 0, color: isLS ? '#616161' : 'inherit', fontSize: isLS ? '0.75rem' : '0.8rem' }}>
                        <span>{isLS ? '+ ' : ''}Part #{part.partNumber}{isLS ? ` (${PART_TYPES[part.partType]?.label})` : ''}</span>
                        <span>{formatCurrency(adjTotal)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 16 }}>
              {/* Show labor/material breakdown when minimum applies */}
              {totals.minInfo.minimumApplies && (
                <div style={{ padding: '4px 0 8px', borderBottom: '1px solid #ddd', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', padding: '2px 0' }}>
                    <span>Total Material</span><span>{formatCurrency(totals.minInfo.totalMaterial)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', padding: '2px 0' }}>
                    <span>Total Labor <s style={{ color: '#999' }}>{formatCurrency(totals.minInfo.totalLabor)}</s></span>
                    <span style={{ color: '#e65100', fontWeight: 600 }}>{formatCurrency(totals.minInfo.adjustedLabor)} (min)</span>
                  </div>
                </div>
              )}
              {totals.expediteAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ffcc80', color: '#e65100', fontSize: '0.85rem' }}>
                  <span>🚨 {totals.expediteLabel}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.expediteAmount)}</span>
                </div>
              )}
              {totals.emergencyAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ffcc80', color: '#c62828', fontSize: '0.85rem' }}>
                  <span>🚨 {totals.emergencyLabel}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.emergencyAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #ddd' }}>
                <span>Parts Subtotal</span><span>{formatCurrency(totals.partsSubtotal)}</span>
              </div>
              
              {/* Discount Section */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid #ddd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>💸 Discount</span>
                  <input type="number" step="0.1" className="form-input" placeholder="%" value={formData.discountPercent}
                    onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value, discountAmount: '' })}
                    style={{ width: 55, textAlign: 'center', padding: '3px 4px', fontSize: '0.8rem' }} />
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>% or $</span>
                  <input type="number" step="0.01" className="form-input" placeholder="$0.00" value={formData.discountAmount}
                    onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value, discountPercent: '' })}
                    style={{ width: 70, textAlign: 'center', padding: '3px 4px', fontSize: '0.8rem' }} />
                </div>
                {(parseFloat(formData.discountPercent) > 0 || parseFloat(formData.discountAmount) > 0) && (
                  <>
                    <input type="text" className="form-input" placeholder="Discount reason..." value={formData.discountReason}
                      onChange={(e) => setFormData({ ...formData, discountReason: e.target.value })}
                      style={{ fontSize: '0.8rem', padding: '4px 8px', marginTop: 4 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#c62828', fontWeight: 600, fontSize: '0.9rem' }}>
                      <span>Discount</span><span>-{formatCurrency(totals.discountAmt)}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #ddd' }}>
                <span>Trucking</span><span>{formatCurrency(totals.trucking)}</span>
              </div>
              
              {/* Tax Section */}
              <div style={{ padding: '8px 0', borderBottom: '1px solid #ddd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.taxExempt}
                      onChange={(e) => setFormData({ ...formData, taxExempt: e.target.checked })} />
                    <span style={{ fontWeight: formData.taxExempt ? 600 : 400, color: formData.taxExempt ? '#c62828' : 'inherit' }}>
                      Tax Exempt
                    </span>
                  </label>
                  {!formData.taxExempt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" className="form-input" value={formData.taxRate}
                        onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                        style={{ width: 50, textAlign: 'center', padding: '4px' }} step="0.1" />%
                      <span style={{ marginLeft: 8 }}>{formatCurrency(totals.taxAmount)}</span>
                    </div>
                  ) : (
                    <span style={{ color: '#c62828', fontWeight: 600 }}>$0.00</span>
                  )}
                </div>
                
                {/* Tax Exempt Details */}
                {formData.taxExempt && (
                  <div style={{ marginTop: 8, padding: 8, background: '#fff3e0', borderRadius: 4, fontSize: '0.8rem' }}>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <input type="text" className="form-input" placeholder="Resale Certificate #" 
                        value={formData.taxExemptCertNumber}
                        onChange={(e) => setFormData({ ...formData, taxExemptCertNumber: e.target.value })}
                        style={{ fontSize: '0.8rem', padding: '4px 8px' }} />
                    </div>
                    <input type="text" className="form-input" placeholder="Reason (e.g., Resale, Non-profit)" 
                      value={formData.taxExemptReason}
                      onChange={(e) => setFormData({ ...formData, taxExemptReason: e.target.value })}
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }} />
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '1.25rem', fontWeight: 700, color: '#1976d2' }}>
                <span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span>
              </div>
              
              {/* Credit Card Total */}
              <div style={{ textAlign: 'right', marginTop: 12, paddingTop: 8, borderTop: '1px solid #ccc', fontSize: '0.8rem', color: '#555', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 600, color: '#333' }}>Total with Credit Card Fees</div>
                <div>In-Person (2.6% + $0.15): <strong>{formatCurrency(totals.ccInPersonTotal)}</strong></div>
                <div>Manual (3.5% + $0.15): <strong>{formatCurrency(totals.ccManualTotal)}</strong></div>
              </div>
            </div>

            {/* Minimum Charge Info */}
            {totals.minInfo.minimumApplies && (
              <div style={{ marginTop: 12, padding: 12, background: '#fff3e0', border: '1px solid #ff9800', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 8, fontSize: '0.85rem' }}>⚠️ Minimum Charge Applied</div>
                <div style={{ fontSize: '0.8rem', color: '#bf360c', marginBottom: 4 }}>
                  Total labor across all parts: {formatCurrency(totals.minInfo.totalLabor)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#bf360c', marginBottom: 4 }}>
                  Minimum charge ({totals.minInfo.highestMinRule?.label}): {formatCurrency(totals.minInfo.highestMinimum)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#bf360c', marginBottom: 8 }}>
                  Labor adjusted up by {formatCurrency(totals.minInfo.laborDifference)}
                </div>
                <button
                  className="btn btn-sm"
                  style={{ background: '#ff9800', color: '#fff', border: 'none', fontSize: '0.75rem' }}
                  onClick={() => setFormData({ ...formData, minimumOverride: true })}
                >
                  Override Minimum
                </button>
              </div>
            )}

            {!totals.minInfo.minimumApplies && totals.minInfo.highestMinimum > 0 && totals.minInfo.totalLabor > 0 && !formData.minimumOverride && (
              <div style={{ marginTop: 12, padding: 8, background: '#e8f5e9', border: '1px solid #66bb6a', borderRadius: 8, fontSize: '0.8rem', color: '#2e7d32' }}>
                ✅ Total labor {formatCurrency(totals.minInfo.totalLabor)} meets minimum {formatCurrency(totals.minInfo.highestMinimum)}
              </div>
            )}

            {formData.minimumOverride && (
              <div style={{ marginTop: 12, padding: 12, background: '#fce4ec', border: '1px solid #e91e63', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c2185b' }}>🔓 Minimum Override Active</span>
                  <button className="btn btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                    onClick={() => setFormData({ ...formData, minimumOverride: false, minimumOverrideReason: '' })}>
                    Remove
                  </button>
                </div>
                <input type="text" className="form-input" placeholder="Override reason..."
                  value={formData.minimumOverrideReason}
                  onChange={(e) => setFormData({ ...formData, minimumOverrideReason: e.target.value })}
                  style={{ fontSize: '0.8rem', padding: '4px 8px', marginTop: 6 }} />
              </div>
            )}

            {/* Minimum Rules Status */}
            {parts.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#999', padding: '4px 8px' }}>
                Min rules: {laborMinimums.length} | Labor total: {formatCurrency(totals.minInfo.totalLabor)} | Highest min: {formatCurrency(totals.minInfo.highestMinimum)}
                {totals.minInfo.highestMinRule ? ` (${totals.minInfo.highestMinRule.label})` : ' (no match)'}
              </div>
            )}

            {/* Material by Supplier */}
            {parts.some(p => p.supplierName) && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 8 }}>Material by Supplier</div>
                <div style={{ fontSize: '0.8rem' }}>
                  {Object.entries(parts.reduce((acc, p) => {
                    if (p.supplierName) {
                      const matEa = parseFloat(p.materialTotal) || 0;
                      const q = parseInt(p.quantity) || 1;
                      const key = p.supplierName;
                      if (!acc[key]) acc[key] = { total: 0, estNums: new Set() };
                      acc[key].total += matEa * q;
                      if (p.vendorEstimateNumber) acc[key].estNums.add(p.vendorEstimateNumber);
                    }
                    return acc;
                  }, {})).map(([supplier, info]) => (
                    <div key={supplier} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{supplier}{info.estNums.size > 0 && <span style={{ color: '#999', marginLeft: 6 }}>({[...info.estNums].join(', ')})</span>}</span>
                      <span>{formatCurrency(info.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Part Type Picker Modal */}
      {showPartTypePicker && (
        <div className="modal-overlay" onClick={() => setShowPartTypePicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <h3 className="modal-title">Select Part Type</h3>
              <button className="modal-close" onClick={() => setShowPartTypePicker(false)}>&times;</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {Object.entries(PART_TYPES).map(([key, { label, icon, desc }]) => (
                  <div
                    key={key}
                    onClick={() => handleSelectPartType(key)}
                    style={{
                      padding: '12px 8px', borderRadius: 10, border: '2px solid #e0e0e0', cursor: 'pointer',
                      transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      textAlign: 'center', gap: 4
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1976d2'; e.currentTarget.style.background = '#e3f2fd'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white'; }}
                  >
                    <span style={{ fontSize: '1.6rem' }}>{icon}</span>
                    <strong style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>{label}</strong>
                    <span style={{ fontSize: '0.7rem', color: '#888', lineHeight: 1.2 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Part Modal */}
      {showPartModal && (
        <div className="modal-overlay">
          <div className="modal modal-flex" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingPart ? 'Edit Part' : 'Add Part'} — {PART_TYPES[partData.partType]?.icon} {PART_TYPES[partData.partType]?.label || partData.partType}
              </h3>
              <button className="modal-close" onClick={() => setShowPartModal(false)}>&times;</button>
            </div>

            <div className="modal-body">

              {/* Common fields for all part types (plate_roll, angle_roll, flat_stock have their own) */}
              {!['plate_roll', 'angle_roll', 'flat_stock', 'pipe_roll', 'tube_roll', 'flat_bar', 'channel_roll', 'beam_roll', 'cone_roll', 'tee_bar', 'press_brake', 'fab_service'].includes(partData.partType) && (
              <div className="grid grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Client Part Number</label>
                  <input type="text" className="form-input" value={partData.clientPartNumber || ''}
                    onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} />
                </div>
                <div className="form-group">
                  <HeatNumberInput partData={partData} setPartData={setPartData} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cut File Reference</label>
                  <input type="text" className="form-input" value={partData.cutFileReference || ''}
                    onChange={(e) => setPartData({ ...partData, cutFileReference: e.target.value })}
                    placeholder="e.g. Part2_cutout.dxf" />
                </div>
              </div>
              )}

              {/* Type-specific form */}
              {partData.partType === 'flat_stock' ? (
                <div className="grid grid-2">
                  <FlatStockForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'plate_roll' ? (
                <div className="grid grid-2">
                  <PlateRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'angle_roll' ? (
                <div className="grid grid-2">
                  <AngleRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'pipe_roll' ? (
                <div className="grid grid-2">
                  <PipeRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'tube_roll' ? (
                <div className="grid grid-2">
                  <SquareTubeRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'flat_bar' ? (
                <div className="grid grid-2">
                  <FlatBarRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'channel_roll' ? (
                <div className="grid grid-2">
                  <ChannelRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'beam_roll' ? (
                <div className="grid grid-2">
                  <BeamRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'tee_bar' ? (
                <div className="grid grid-2">
                  <TeeBarRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'press_brake' ? (
                <div className="grid grid-2">
                  <PressBrakeForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'cone_roll' ? (
                <div className="grid grid-2">
                  <ConeRollForm
                    partData={partData}
                    setPartData={setPartData}
                    vendorSuggestions={vendorSuggestions}
                    setVendorSuggestions={setVendorSuggestions}
                    showVendorSuggestions={showVendorSuggestions}
                    setShowVendorSuggestions={setShowVendorSuggestions}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'fab_service' ? (
                <div className="grid grid-2">
                  <FabServiceForm
                    partData={partData}
                    setPartData={setPartData}
                    estimateParts={parts}
                    showMessage={showMessage}
                    setError={setError}
                  />
                </div>
              ) : partData.partType === 'shop_rate' ? (
                <div className="grid grid-2">
                  <ShopRateForm
                    partData={partData}
                    setPartData={setPartData}
                  />
                </div>
              ) : partData.partType === 'rush_service' ? (
                <div className="grid grid-2">
                  <RushServiceForm partData={partData} setPartData={setPartData} />
                </div>
              ) : (
                <div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input type="number" className="form-input" value={partData.quantity}
                  onChange={(e) => setPartData({ ...partData, quantity: parseInt(e.target.value) || 1 })} onFocus={(e) => e.target.select()} min="1" />
              </div>
            </div>

            <h4 style={{ margin: '20px 0 12px', borderBottom: '1px solid #eee', paddingBottom: 8 }}>📦 Material</h4>
            
            {/* We Supply Material Checkbox Section */}
            <div style={{ 
              padding: 16, borderRadius: 8, marginBottom: 16,
              background: partData.weSupplyMaterial ? '#fff3e0' : '#f5f5f5',
              border: `2px solid ${partData.weSupplyMaterial ? '#ff9800' : '#e0e0e0'}`
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={partData.weSupplyMaterial || false}
                  onChange={(e) => setPartData({ ...partData, weSupplyMaterial: e.target.checked })}
                  style={{ width: 20, height: 20 }}
                />
                <span style={{ fontSize: '1.1rem' }}>We Supply Material</span>
              </label>
              
              {partData.weSupplyMaterial && (
                <div style={{ marginTop: 16 }}>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
                      <label className="form-label">Material Description</label>
                      <input type="text" className="form-input" value={partData.materialDescription || ''}
                        onChange={(e) => setPartData({ ...partData, materialDescription: e.target.value })}
                        placeholder='e.g., A36 Plate 1/2" x 48" x 96"' />
                    </div>
                    <div className="form-group" style={{ position: 'relative', margin: 0 }}>
                      <label className="form-label">Supplier</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={partData.supplierName || ''}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setPartData({ ...partData, supplierName: value });
                          if (value.length >= 2) {
                            try {
                              const res = await searchVendors(value);
                              setVendorSuggestions(res.data.data || []);
                              setShowVendorSuggestions(true);
                            } catch (err) { setVendorSuggestions([]); }
                          } else {
                            setVendorSuggestions([]);
                            setShowVendorSuggestions(false);
                          }
                        }}
                        onFocus={() => vendorSuggestions.length > 0 && setShowVendorSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
                        placeholder="e.g., Metro Steel Supply"
                        autoComplete="off"
                      />
                      {showVendorSuggestions && vendorSuggestions.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                          background: 'white', border: '1px solid #ddd', borderRadius: 4,
                          maxHeight: 150, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}>
                          {vendorSuggestions.map(vendor => (
                            <div key={vendor.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                              onMouseDown={() => { setPartData({ ...partData, supplierName: vendor.name }); setShowVendorSuggestions(false); }}>
                              <strong>{vendor.name}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Vendor Estimate #</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={partData.vendorEstimateNumber || ''}
                        onChange={(e) => setPartData({ ...partData, vendorEstimateNumber: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Unit Cost ($)</label>
                      <input type="number" className="form-input" value={partData.materialUnitCost || ''}
                        onChange={(e) => setPartData({ ...partData, materialUnitCost: e.target.value })}
                        step="0.01" placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Markup (%)</label>
                      <input type="number" className="form-input" value={partData.materialMarkupPercent || 20}
                        onChange={(e) => setPartData({ ...partData, materialMarkupPercent: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h4 style={{ margin: '20px 0 12px', borderBottom: '1px solid #eee', paddingBottom: 8 }}>🔄 Rolling</h4>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Rolling Cost *</label>
                <input type="number" className="form-input" value={partData.rollingCost || ''}
                  onChange={(e) => setPartData({ ...partData, rollingCost: e.target.value })}
                  step="0.01" placeholder="0.00" />
              </div>
            </div>

            <h4 style={{ margin: '20px 0 12px', borderBottom: '1px solid #eee', paddingBottom: 8 }}>🔧 Additional Services</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {/* Drilling */}
              <div style={{ padding: 12, borderRadius: 8, background: partData.serviceDrilling ? '#e3f2fd' : '#fafafa', border: `1px solid ${partData.serviceDrilling ? '#2196f3' : '#e0e0e0'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={partData.serviceDrilling || false}
                    onChange={(e) => setPartData({ ...partData, serviceDrilling: e.target.checked })} />
                  <strong>🔩 Drilling</strong>
                </label>
                {partData.serviceDrilling && (
                  <div className="grid grid-2" style={{ marginTop: 8, gap: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Cost ($)</label>
                      <input type="number" className="form-input" value={partData.serviceDrillingCost || ''}
                        onChange={(e) => setPartData({ ...partData, serviceDrillingCost: e.target.value })} step="0.01" placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Vendor (if outsourced)</label>
                      <input type="text" className="form-input" value={partData.serviceDrillingVendor || ''}
                        onChange={(e) => setPartData({ ...partData, serviceDrillingVendor: e.target.value })} placeholder="In-house" />
                    </div>
                  </div>
                )}
              </div>

              {/* Cutting */}
              <div style={{ padding: 12, borderRadius: 8, background: partData.serviceCutting ? '#e3f2fd' : '#fafafa', border: `1px solid ${partData.serviceCutting ? '#2196f3' : '#e0e0e0'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={partData.serviceCutting || false}
                    onChange={(e) => setPartData({ ...partData, serviceCutting: e.target.checked })} />
                  <strong>✂️ Cutting</strong>
                </label>
                {partData.serviceCutting && (
                  <div className="grid grid-2" style={{ marginTop: 8, gap: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Cost ($)</label>
                      <input type="number" className="form-input" value={partData.serviceCuttingCost || ''}
                        onChange={(e) => setPartData({ ...partData, serviceCuttingCost: e.target.value })} step="0.01" placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Vendor (if outsourced)</label>
                      <input type="text" className="form-input" value={partData.serviceCuttingVendor || ''}
                        onChange={(e) => setPartData({ ...partData, serviceCuttingVendor: e.target.value })} placeholder="In-house" />
                    </div>
                  </div>
                )}
              </div>

              {/* Fitting */}
              <div style={{ padding: 12, borderRadius: 8, background: partData.serviceFitting ? '#e3f2fd' : '#fafafa', border: `1px solid ${partData.serviceFitting ? '#2196f3' : '#e0e0e0'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={partData.serviceFitting || false}
                    onChange={(e) => setPartData({ ...partData, serviceFitting: e.target.checked })} />
                  <strong>🔧 Fitting</strong>
                </label>
                {partData.serviceFitting && (
                  <div className="grid grid-2" style={{ marginTop: 8, gap: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Cost ($)</label>
                      <input type="number" className="form-input" value={partData.serviceFittingCost || ''}
                        onChange={(e) => setPartData({ ...partData, serviceFittingCost: e.target.value })} step="0.01" placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Vendor (if outsourced)</label>
                      <input type="text" className="form-input" value={partData.serviceFittingVendor || ''}
                        onChange={(e) => setPartData({ ...partData, serviceFittingVendor: e.target.value })} placeholder="In-house" />
                    </div>
                  </div>
                )}
              </div>

              {/* Welding */}
              <div style={{ padding: 12, borderRadius: 8, background: partData.serviceWelding ? '#fff3e0' : '#fafafa', border: `1px solid ${partData.serviceWelding ? '#ff9800' : '#e0e0e0'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={partData.serviceWelding || false}
                    onChange={(e) => setPartData({ ...partData, serviceWelding: e.target.checked })} />
                  <strong>🔥 Welding</strong>
                </label>
                {partData.serviceWelding && (
                  <div className="grid grid-3" style={{ marginTop: 8, gap: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Cost ($)</label>
                      <input type="number" className="form-input" value={partData.serviceWeldingCost || ''}
                        onChange={(e) => setPartData({ ...partData, serviceWeldingCost: e.target.value })} step="0.01" placeholder="0.00" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Welding %</label>
                      <select className="form-select" value={partData.serviceWeldingPercent || 100}
                        onChange={(e) => setPartData({ ...partData, serviceWeldingPercent: parseInt(e.target.value) })}>
                        <option value={25}>25%</option>
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={100}>100%</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Vendor</label>
                      <input type="text" className="form-input" value={partData.serviceWeldingVendor || ''}
                        onChange={(e) => setPartData({ ...partData, serviceWeldingVendor: e.target.value })} placeholder="In-house" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <h4 style={{ margin: '20px 0 12px', borderBottom: '1px solid #eee', paddingBottom: 8 }}>📐 Specifications</h4>
            <div className="grid grid-3">
              <div className="form-group">
                <label className="form-label">Material Type</label>
                <input type="text" className="form-input" value={partData.material || ''}
                  onChange={(e) => setPartData({ ...partData, material: e.target.value })}
                  placeholder="e.g., A36, 304 SS" />
              </div>
              <div className="form-group">
                <label className="form-label">Diameter</label>
                <input type="text" className="form-input" value={partData.diameter || ''}
                  onChange={(e) => setPartData({ ...partData, diameter: e.target.value })}
                  placeholder='e.g., 72"' />
              </div>
              <div className="form-group">
                <label className="form-label">Radius</label>
                <input type="text" className="form-input" value={partData.radius || ''}
                  onChange={(e) => setPartData({ ...partData, radius: e.target.value })}
                  placeholder='e.g., 36"' />
              </div>
              <div className="form-group">
                <label className="form-label">Arc Degrees</label>
                <input type="text" className="form-input" value={partData.arcDegrees || ''}
                  onChange={(e) => setPartData({ ...partData, arcDegrees: e.target.value })}
                  placeholder="e.g., 90, 180, 360" />
              </div>
              <div className="form-group">
                <label className="form-label">Roll Direction</label>
                <select className="form-select" value={partData.rollType || ''}
                  onChange={(e) => setPartData({ ...partData, rollType: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="easy_way">Easy Way</option>
                  <option value="hard_way">Hard Way</option>
                  <option value="on_edge">On-Edge</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={partData.flangeOut || false}
                    onChange={(e) => setPartData({ ...partData, flangeOut: e.target.checked })} />
                  Flange Out
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Special Instructions</label>
              <textarea className="form-textarea" value={partData.specialInstructions || ''} rows={2}
                onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} />
            </div>
                </div>
              )}
            </div>

            {/* Cut File Reference — always visible for all part types */}
            <div style={{ margin: '0 20px 12px', padding: '12px 0', borderTop: '1px solid #eee' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">📐 Cut File Reference <span style={{ fontWeight: 400, color: '#999' }}>(DXF/STEP filename to send to vendor)</span></label>
                <input type="text" className="form-input" value={partData.cutFileReference || ''} onChange={(e) => setPartData({ ...partData, cutFileReference: e.target.value })} placeholder="e.g. Part2_cutout.dxf — will appear on purchase order" />
              </div>
            </div>

            {partFormError && (
              <div style={{ margin: '0 20px 12px', padding: 12, background: '#fff3e0', border: '2px solid #ff9800', borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 6, fontSize: '0.9rem' }}>⚠️ Please fix the following:</div>
                {partFormError.map((msg, i) => (
                  <div key={i} style={{ color: '#bf360c', fontSize: '0.85rem', padding: '2px 0', paddingLeft: 12, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0 }}>•</span> {msg}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPartModal(false)}>Cancel</button>
              {!editingPart && (
                <button className="btn btn-outline" onClick={() => handleSavePart(true)} disabled={!partData.partType || saving}
                  style={{ borderColor: '#1976d2', color: '#1976d2' }}>
                  {saving ? 'Saving...' : 'Save & Add Another'}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => handleSavePart(false)} disabled={!partData.partType || saving}>
                {saving ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Work Order Modal */}
      {showConvertModal && (
        <div className="modal-overlay" onClick={() => setShowConvertModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Convert to Work Order</h3>
              <button className="btn btn-icon" onClick={() => setShowConvertModal(false)}><X size={20} /></button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ background: '#e3f2fd', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>📋 {estimate?.estimateNumber}</p>
                <p style={{ margin: '8px 0 0', color: '#666' }}>
                  Client: {formData.clientName} • {parts.length} part(s)
                </p>
                <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#1976d2' }}>
                  Total: {formatCurrency(calculateTotals().grandTotal)}
                </p>
              </div>

              {/* DR Number Preview */}
              <div style={{ background: '#e3f2fd', padding: 14, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>DR Number</div>
                  <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#1565c0' }}>
                    DR-{useCustomDR ? (customDR || '?') : (nextDR || '...')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={useCustomDR} onChange={(e) => { setUseCustomDR(e.target.checked); if (!e.target.checked) setCustomDR(''); }} />
                    <span>Use different DR#</span>
                  </label>
                  {useCustomDR && (
                    <input type="number" className="form-input" value={customDR}
                      onChange={(e) => setCustomDR(e.target.value)}
                      placeholder="Enter DR#" autoFocus
                      style={{ width: 120, marginTop: 4, textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}
                    />
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Client Purchase Order Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter client's PO number..."
                  value={convertData.clientPurchaseOrderNumber}
                  onChange={(e) => setConvertData({ ...convertData, clientPurchaseOrderNumber: e.target.value })}
                />
              </div>

              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Requested Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={convertData.requestedDueDate}
                    onChange={(e) => setConvertData({ ...convertData, requestedDueDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Promised Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={convertData.promisedDate}
                    onChange={(e) => setConvertData({ ...convertData, promisedDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={convertData.notes}
                  onChange={(e) => setConvertData({ ...convertData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Note about material ordering */}
              {parts.some(p => p.materialSource === 'we_order') && (
                <div style={{ background: '#e3f2fd', padding: 12, borderRadius: 8, marginTop: 16 }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#1565c0' }}>
                    💡 <strong>Material Ordering:</strong> After converting, you can order material from the Work Order page using the "Order Material" button.
                  </p>
                </div>
              )}

              {/* Material Received Toggle */}
              <div style={{ marginTop: 16 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Has the material been received?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={{
                    flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                    border: `2px solid ${convertData.materialReceived ? '#2e7d32' : '#ccc'}`,
                    background: convertData.materialReceived ? '#e8f5e9' : '#fff',
                    color: convertData.materialReceived ? '#2e7d32' : '#666'
                  }} onClick={() => setConvertData({ ...convertData, materialReceived: true })}>
                    ✓ Yes — Material Received
                  </button>
                  <button type="button" style={{
                    flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                    border: `2px solid ${!convertData.materialReceived ? '#e65100' : '#ccc'}`,
                    background: !convertData.materialReceived ? '#fff3e0' : '#fff',
                    color: !convertData.materialReceived ? '#e65100' : '#666'
                  }} onClick={() => setConvertData({ ...convertData, materialReceived: false })}>
                    ✗ No — Waiting for Material
                  </button>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 4 }}>
                  {convertData.materialReceived
                    ? 'Work order will be set to "Received" status'
                    : 'Work order will be set to "Waiting for Materials" status'}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
              <button
                className="btn"
                onClick={handleConvertToWorkOrder}
                disabled={converting}
                style={{ background: '#2e7d32', color: 'white' }}
              >
                <Package size={18} />
                {converting ? 'Converting...' : `Create Work Order (DR-${useCustomDR ? (customDR || '?') : (nextDR || '...')})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EstimateDetailsPage;
