import React, { useState, useEffect, useMemo } from 'react';
import RollToOverride from './RollToOverride';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { searchVendors, getSettings, createVendor } from '../services/api';
import { useSectionSizes } from '../hooks/useSectionSizes';

// Sagitta formula: h = R - sqrt(R² - (c/2)²)
function calculateRise(radiusInches, chordInches) {
  if (!radiusInches || radiusInches <= 0) return null;
  const halfChord = chordInches / 2;
  if (halfChord >= radiusInches) return null;
  return radiusInches - Math.sqrt(radiusInches * radiusInches - halfChord * halfChord);
}

// ── PIPE & TUBE SIZE DATA (defaults) ──────────────────────────────────────────
const DEFAULT_TUBE_SIZES = [
  { label: '.625" OD Tube', od: 0.625, type: 'tube', defaultLength: '20\'' },
  { label: '.75" OD Tube', od: 0.75, type: 'tube', defaultLength: '20\'' },
  { label: '1" OD Tube', od: 1.0, type: 'tube', defaultLength: '20\'' },
  { label: '1.25" OD Tube', od: 1.25, type: 'tube', defaultLength: '20\'' },
  { label: '1.5" OD Tube', od: 1.5, type: 'tube', defaultLength: '20\'' },
  { label: '2" OD Tube', od: 2.0, type: 'tube', defaultLength: '20\'' },
  { label: '3" OD Tube', od: 3.0, type: 'tube', defaultLength: '20\'' },
  { label: '4" OD Tube', od: 4.0, type: 'tube', defaultLength: '20\'' },
];

const DEFAULT_PIPE_SIZES = [
  { label: '1" Pipe', nominal: '1"', od: 1.315, type: 'pipe', defaultLength: '21\'' },
  { label: '1.25" Pipe', nominal: '1-1/4"', od: 1.660, type: 'pipe', defaultLength: '21\'' },
  { label: '1.5" Pipe', nominal: '1-1/2"', od: 1.900, type: 'pipe', defaultLength: '21\'' },
  { label: '2" Pipe', nominal: '2"', od: 2.375, type: 'pipe', defaultLength: '21\'' },
  { label: '3" Pipe', nominal: '3"', od: 3.500, type: 'pipe', defaultLength: '21\'' },
  { label: '4" Pipe', nominal: '4"', od: 4.500, type: 'pipe', defaultLength: '21\'' },
];

const DEFAULT_SOLID_BAR_SIZES = [
  { label: '.500" Solid Round', od: 0.500, type: 'solid_bar', defaultLength: '20\'' },
  { label: '.625" Solid Round', od: 0.625, type: 'solid_bar', defaultLength: '20\'' },
  { label: '.750" Solid Round', od: 0.750, type: 'solid_bar', defaultLength: '20\'' },
  { label: '.875" Solid Round', od: 0.875, type: 'solid_bar', defaultLength: '20\'' },
  { label: '1" Solid Round', od: 1.0, type: 'solid_bar', defaultLength: '20\'' },
  { label: '1.25" Solid Round', od: 1.25, type: 'solid_bar', defaultLength: '20\'' },
  { label: '1.5" Solid Round', od: 1.5, type: 'solid_bar', defaultLength: '20\'' },
  { label: '1.75" Solid Round', od: 1.75, type: 'solid_bar', defaultLength: '20\'' },
  { label: '2" Solid Round', od: 2.0, type: 'solid_bar', defaultLength: '20\'' },
  { label: '2.5" Solid Round', od: 2.5, type: 'solid_bar', defaultLength: '20\'' },
  { label: '3" Solid Round', od: 3.0, type: 'solid_bar', defaultLength: '20\'' },
  { label: '3.5" Solid Round', od: 3.5, type: 'solid_bar', defaultLength: '20\'' },
  { label: '4" Solid Round', od: 4.0, type: 'solid_bar', defaultLength: '20\'' },
];

const DEFAULT_ALL_PIPE_SIZES = [...DEFAULT_TUBE_SIZES, ...DEFAULT_PIPE_SIZES, ...DEFAULT_SOLID_BAR_SIZES];

// Schedule data: { schedule: wallThickness } for each pipe nominal size
const PIPE_SCHEDULES = {
  '1"':     { '5': 0.065, '10': 0.109, '40': 0.133, '80': 0.179, '160': 0.250 },
  '1-1/4"': { '5': 0.065, '10': 0.109, '40': 0.140, '80': 0.191, '160': 0.250 },
  '1-1/2"': { '5': 0.065, '10': 0.109, '40': 0.145, '80': 0.200, '160': 0.281 },
  '2"':     { '5': 0.065, '10': 0.109, '40': 0.154, '80': 0.218, '160': 0.344 },
  '3"':     { '5': 0.083, '10': 0.120, '40': 0.216, '80': 0.300, '160': 0.438 },
  '4"':     { '5': 0.083, '10': 0.120, '40': 0.237, '80': 0.337, '160': 0.531 },
};

// Common tube wall thicknesses
const TUBE_WALL_OPTIONS = [
  '.035"', '.049"', '.058"', '.065"', '.083"', '.095"', '.109"', '.120"', '.125"', '.134"', '.156"', '.188"', '.250"', '.375"', '.500"', 'Custom'
];

const DEFAULT_GRADES = ['A500 Gr B', 'A513', 'DOM', 'A36', '1018', '1045', '4140', '304 S/S', '316 S/S', '6061-T6 Alum', '5052 Alum', 'Custom'];

// ── HELPERS ────────────────────────────────────────────────────────────────────
function wallToDecimal(w) {
  if (!w) return 0;
  const clean = String(w).replace(/["″]/g, '').trim();
  if (!isNaN(clean) && clean !== '') return parseFloat(clean);
  if (clean.includes('/')) {
    const parts = clean.split('/').map(Number);
    return parts[0] / parts[1];
  }
  const num = clean.match(/^\.?[\d.]+/);
  return num ? parseFloat(num[0]) : 0;
}

function isStainless(grade) {
  if (!grade) return false;
  const g = grade.toLowerCase();
  return g.includes('s/s') || g.includes('stainless') || g.includes('304') || g.includes('316');
}

function isAluminum(grade) {
  if (!grade) return false;
  const g = grade.toLowerCase();
  return g.includes('alum') || g.includes('6061') || g.includes('5052') || g.includes('6063') || g.includes('3003');
}

function getMaterialCategory(grade) {
  if (isStainless(grade)) return 'stainless';
  if (isAluminum(grade)) return 'aluminum';
  return 'steel';
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────
export default function PipeRollForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  const dynamicPipeSizes = useSectionSizes('pipe', DEFAULT_ALL_PIPE_SIZES);
  const ALL_SIZES = dynamicPipeSizes;
  const TUBE_SIZES = ALL_SIZES.filter(s => s.type === 'tube');
  const PIPE_SIZES = ALL_SIZES.filter(s => s.type === 'pipe');
  const SOLID_BAR_SIZES = ALL_SIZES.filter(s => s.type === 'solid_bar');
  const [customGrade, setCustomGrade] = useState('');
  const [customWall, setCustomWall] = useState('');
  const [rollValue, setRollValue] = useState(partData._rollValue || '');
  const [rollToMethod, setRollToMethod] = useState(partData._rollToMethod || '');
  const [rollMeasureType, setRollMeasureType] = useState(partData._rollMeasureType || 'diameter');
  const [rollMeasurePoint, setRollMeasurePoint] = useState(partData._rollMeasurePoint || 'centerline');
  const [showDiaFind, setShowDiaFind] = useState(false);
  const [diaFindChord, setDiaFindChord] = useState('');
  const [diaFindRise, setDiaFindRise] = useState('');
  const diaFindResult = (diaFindChord && diaFindRise && parseFloat(diaFindRise) > 0) ? ((parseFloat(diaFindChord) ** 2) / (4 * parseFloat(diaFindRise))) + parseFloat(diaFindRise) : null;
  const [rollLimits, setRollLimits] = useState([]);   // admin: min rollable diameters
  const [mandrelDies, setMandrelDies] = useState([]);  // admin: available mandrel dies
  const [gradeOptions, setGradeOptions] = useState(DEFAULT_GRADES);

  // Pitch / Helix state
  const [pitchEnabled, setPitchEnabled] = useState(!!(partData._pitchEnabled));
  const [pitchMethod, setPitchMethod] = useState(partData._pitchMethod || 'runrise');
  const [pitchRun, setPitchRun] = useState(partData._pitchRun || '12');
  const [pitchRise, setPitchRise] = useState(partData._pitchRise || '');
  const [pitchAngle, setPitchAngle] = useState(partData._pitchAngle || '');
  const [pitchSpaceType, setPitchSpaceType] = useState(partData._pitchSpaceType || 'between');
  const [pitchSpaceValue, setPitchSpaceValue] = useState(partData._pitchSpaceValue || '');
  const [pitchDirection, setPitchDirection] = useState(partData._pitchDirection || 'clockwise');

  // Complete rings state
  const [completeRings, setCompleteRings] = useState(!!(partData._completeRings));
  const [ringsNeeded, setRingsNeeded] = useState(partData._ringsNeeded || 1);
  const [tangentLength, setTangentLength] = useState(partData._tangentLength || '12');

  // Load admin settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const resp = await getSettings('roll_limits');
        if (resp.data.data?.value) setRollLimits(resp.data.data.value);
      } catch {}
      try {
        const resp = await getSettings('mandrel_dies');
        if (resp.data.data?.value) setMandrelDies(resp.data.data.value);
      } catch {}
      try {
        const resp = await getSettings('material_grades');
        if (resp.data.data?.value) {
          const grades = resp.data.data.value.filter(g => g.partTypes?.includes('pipe_roll'));
          if (grades.length > 0) {
            setGradeOptions([...grades.map(g => g.name), 'Custom']);
          }
        }
      } catch {}
    };
    loadSettings();
  }, []);

  // Sync roll fields from partData on mount (for editing)
  useEffect(() => {
    if (partData.radius && !partData.diameter) {
      setRollValue(partData.radius);
      setRollMeasureType('radius');
    } else if (partData.diameter) {
      setRollValue(partData.diameter);
      setRollMeasureType('diameter');
    }
    if (partData._rollMeasurePoint) setRollMeasurePoint(partData._rollMeasurePoint);
  }, []);

  // Find selected size object
  const selectedSize = useMemo(() => {
    return ALL_SIZES.find(s => s.label === partData._pipeSize) || null;
  }, [partData._pipeSize]);

  // Available schedules for selected pipe
  const availableSchedules = useMemo(() => {
    if (!selectedSize || selectedSize.type !== 'pipe') return [];
    const schData = PIPE_SCHEDULES[selectedSize.nominal];
    if (!schData) return [];
    return Object.entries(schData).map(([sch, wall]) => ({
      schedule: sch,
      wall,
      label: `Sch ${sch} (${wall}" wall)`
    }));
  }, [selectedSize]);

  // Compute actual centerline diameter from roll input
  const rollCalc = useMemo(() => {
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return null;
    const od = selectedSize ? selectedSize.od : (parseFloat(partData.outerDiameter) || 0);
    const wall = wallToDecimal(partData.wallThickness);
    if (!od) return null;

    let centerlineDia;
    if (rollMeasureType === 'radius') {
      if (rollMeasurePoint === 'inside') centerlineDia = (rv * 2) + od;
      else if (rollMeasurePoint === 'outside') centerlineDia = (rv * 2) - od;
      else centerlineDia = rv * 2; // centerline
    } else {
      if (rollMeasurePoint === 'inside') centerlineDia = rv + od;
      else if (rollMeasurePoint === 'outside') centerlineDia = rv - od;
      else centerlineDia = rv; // centerline
    }
    return { centerlineDia, od, wall };
  }, [rollToMethod, rollValue, rollMeasureType, rollMeasurePoint, selectedSize, partData.outerDiameter, partData.wallThickness]);

  // Check minimum rollable diameter
  const rollCheck = useMemo(() => {
    if (!rollCalc || rollCalc.centerlineDia <= 0) return null;
    const od = rollCalc.od;
    const materialCat = getMaterialCategory(partData.material);

    // Find matching roll limit rule
    let minRollDia = null;
    let matchedRule = null;
    for (const rule of rollLimits) {
      const ruleOd = parseFloat(rule.od);
      if (Math.abs(ruleOd - od) < 0.01) {
        // Check material category match
        if (rule.materialCategory === materialCat || rule.materialCategory === 'all') {
          if (!matchedRule || parseFloat(rule.minDiameter) < (minRollDia || Infinity)) {
            minRollDia = parseFloat(rule.minDiameter);
            matchedRule = rule;
          }
        }
      }
    }

    // If no specific rule, use a general minimum (8x OD for steel, 12x OD for aluminum)
    if (minRollDia === null) {
      minRollDia = materialCat === 'aluminum' ? od * 12 : od * 8;
    }

    const isBelowMin = rollCalc.centerlineDia < minRollDia;

    // Check for mandrel dies if below minimum
    let availableDies = [];
    if (isBelowMin) {
      availableDies = mandrelDies.filter(d => {
        const dieOd = parseFloat(d.od);
        return Math.abs(dieOd - od) < 0.01 && parseFloat(d.minDiameter) <= rollCalc.centerlineDia;
      });
    }

    return {
      minRollDia,
      isBelowMin,
      centerlineDia: rollCalc.centerlineDia,
      availableDies,
      materialCat,
      matchedRule
    };
  }, [rollCalc, rollLimits, mandrelDies, partData.material]);

  // Build material description
  const materialDescription = useMemo(() => {
    const qty = parseInt(partData.quantity) || 1;
    const parts = [];
    parts.push(`${qty}pc:`);

    if (selectedSize) {
      if (selectedSize.type === 'pipe') {
        parts.push(`${selectedSize.nominal}`);
        if (partData._schedule) parts.push(`Sch ${partData._schedule}`);
        parts.push(`Pipe (${selectedSize.od}" OD)`);
      } else if (selectedSize.type === 'solid_bar') {
        parts.push(`${selectedSize.od}" Solid Round Bar`);
      } else {
        parts.push(`${selectedSize.od}" OD Round Tubing`);
      }
    } else if (partData.outerDiameter) {
      parts.push(`${partData.outerDiameter}" OD Round Tubing`);
    }

    if (partData.wallThickness && partData.wallThickness !== 'SOLID') parts.push(`x ${partData.wallThickness} Wall`);
    if (partData.length) parts.push(`x ${partData.length} long`);

    const grade = partData.material || '';
    if (grade) parts.push(grade);
    const origin = partData._materialOrigin || '';
    if (origin) parts.push(origin);

    return parts.join(' ');
  }, [partData._pipeSize, partData._schedule, partData.outerDiameter, partData.wallThickness, partData.length, partData.material, partData._materialOrigin, partData.quantity, selectedSize]);

  // Pitch / Helix calculations — cross-convert between input methods
  const pitchCalc = useMemo(() => {
    if (!pitchEnabled) return null;
    const od = selectedSize ? selectedSize.od : (parseFloat(partData.outerDiameter) || 0);
    const clDia = rollCalc ? rollCalc.centerlineDia : 0;
    const circumference = clDia > 0 ? Math.PI * clDia : 0;
    // Raw input diameter (no CL offset) — developed diameter matches user's measurement point
    const inputDia = rollMeasureType === 'radius' ? (parseFloat(rollValue) || 0) * 2 : (parseFloat(rollValue) || 0);

    let angle = 0;   // degrees
    let run = parseFloat(pitchRun) || 12;
    let rise = 0;
    let risePerRev = 0;
    let spaceBetween = 0;
    let spaceCenter = 0;

    if (pitchMethod === 'runrise') {
      rise = parseFloat(pitchRise) || 0;
      if (rise > 0 && run > 0) {
        angle = Math.atan(rise / run) * (180 / Math.PI);
      }
    } else if (pitchMethod === 'degree') {
      angle = parseFloat(pitchAngle) || 0;
      if (angle > 0 && angle < 90 && run > 0) {
        rise = run * Math.tan(angle * (Math.PI / 180));
      }
    } else if (pitchMethod === 'space') {
      const sv = parseFloat(pitchSpaceValue) || 0;
      if (sv > 0 && circumference > 0) {
        if (pitchSpaceType === 'center') {
          spaceCenter = sv;
          spaceBetween = sv - od;
          risePerRev = sv;
        } else {
          spaceBetween = sv;
          spaceCenter = sv + od;
          risePerRev = sv + od;
        }
        // Derive angle from space: rise per rev over circumference
        angle = Math.atan(risePerRev / circumference) * (180 / Math.PI);
        rise = (risePerRev / circumference) * (run > 0 ? run : 12);
      }
    }

    // Compute rise per revolution from angle if not already set via space
    if (pitchMethod !== 'space' && angle > 0 && circumference > 0) {
      risePerRev = circumference * Math.tan(angle * (Math.PI / 180));
      spaceCenter = risePerRev;
      spaceBetween = risePerRev - od;
    }

    if (angle <= 0 && rise <= 0) return null;

    // Developed Diameter: √( ((π × D × rise) / (2 × run))² + D² )
    // Uses raw input diameter (not CL) — if user enters ID, developed is ID
    let developedDia = 0;
    if (inputDia > 0 && rise > 0 && run > 0) {
      const h = (Math.PI * inputDia * rise) / (2 * run);
      developedDia = Math.sqrt(h * h + inputDia * inputDia);
    }

    return { angle, rise, run, risePerRev, spaceBetween, spaceCenter, circumference, od, developedDia, inputDia };
  }, [pitchEnabled, pitchMethod, pitchRun, pitchRise, pitchAngle, pitchSpaceType, pitchSpaceValue, rollCalc, selectedSize, partData.outerDiameter, rollValue, rollMeasureType]);

  // Calculate chord and rise (check dimension for verifying bend radius)
  const riseCalc = useMemo(() => {
    if (!rollCalc) return null;
    const radiusValue = rollCalc.centerlineDia / 2;
    if (radiusValue <= 0 || rollCalc.centerlineDia <= 100) return null;
    const chord = radiusValue >= 60 ? 60 : radiusValue >= 24 ? 24 : radiusValue >= 12 ? 12 : radiusValue >= 6 ? 6 : 3;
    const rise = calculateRise(radiusValue, chord);
    if (rise !== null && rise > 0) return { rise, chord };
    return null;
  }, [rollCalc]);

  // Parse length to inches
  const lengthInches = useMemo(() => {
    const raw = partData.length || '';
    const m = raw.match(/([\d.]+)/);
    if (!m) return 0;
    const val = parseFloat(m[1]);
    if (raw.includes("'") || raw.includes('ft')) return val * 12;
    return val;
  }, [partData.length]);

  // Complete rings calculation
  const ringCalc = useMemo(() => {
    if (!completeRings || !rollCalc || rollCalc.centerlineDia <= 0) return null;
    const circumference = Math.PI * rollCalc.centerlineDia;
    const tang = parseFloat(tangentLength) || 0;
    const usable = lengthInches - (2 * tang);
    if (usable <= 0) return { error: 'Length too short after tangents' };
    const numRings = parseInt(ringsNeeded) || 1;
    if (circumference <= usable) {
      const ringsPerStick = Math.floor(usable / circumference);
      const sticksNeeded = Math.ceil(numRings / ringsPerStick);
      return { circumference, usable, ringsPerStick, sticksNeeded, tangent: tang, multiSegment: false };
    } else {
      const segmentsPerRing = Math.ceil(circumference / usable);
      const sticksNeeded = segmentsPerRing * numRings;
      return { circumference, usable, segmentsPerRing, sticksNeeded, tangent: tang, multiSegment: true };
    }
  }, [completeRings, rollCalc, lengthInches, tangentLength, ringsNeeded]);

  // Auto-update quantity when complete rings changes
  useEffect(() => {
    if (completeRings && ringCalc && !ringCalc.error) {
      setPartData(prev => ({
        ...prev,
        quantity: String(parseInt(ringsNeeded) || 1),
        _completeRings: true,
        _ringsNeeded: ringsNeeded,
        _tangentLength: tangentLength,
        _ringSticksNeeded: ringCalc.sticksNeeded,
        _ringRingsPerStick: ringCalc.ringsPerStick || 0,
        _ringMultiSegment: ringCalc.multiSegment || false,
      }));
    } else {
      setPartData(prev => ({ ...prev, _completeRings: false }));
    }
  }, [completeRings, ringCalc, ringsNeeded, tangentLength]);

  // Build rolling description
  const rollingDescription = useMemo(() => {
    if (rollToMethod === 'template') return 'Roll Per Template / Sample';
    if (rollToMethod === 'print') return 'Roll per print';
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return '';
    const lines = [];
    const spec = rollMeasurePoint === 'inside' ? (rollMeasureType === 'radius' ? 'ISR' : 'ID') : rollMeasurePoint === 'outside' ? (rollMeasureType === 'radius' ? 'OSR' : 'OD') : (rollMeasureType === 'radius' ? 'CLR' : 'CLD');
    lines.push(`Roll to ${rv}" ${spec}`);
    if (riseCalc) {
      lines.push(`Chord: ${riseCalc.chord}" Rise: ${riseCalc.rise.toFixed(4)}"`);
    }
    if (partData.arcDegrees) lines.push(`Arc: ${partData.arcDegrees}°`);
    if (pitchEnabled) {
      if (pitchCalc) {
        lines.push(`Pitch to ${pitchCalc.angle.toFixed(5)}°`);
      }
      if (pitchMethod === 'runrise') {
        lines.push(`Run: ${pitchRun}" Rise: ${pitchRise}"`);
      } else if (pitchMethod === 'degree') {
        lines.push(`Pitch Angle: ${pitchAngle}°`);
      } else if (pitchMethod === 'space') {
        lines.push(`${pitchSpaceType === 'center' ? 'Center-to-Center' : 'Between'} Spacing: ${pitchSpaceValue}"`);
      }
      if (pitchCalc && pitchCalc.developedDia > 0) {
        const specLabel = rollMeasureType === 'radius' ? 
          (rollMeasurePoint === 'inside' ? 'ISR' : rollMeasurePoint === 'outside' ? 'OSR' : 'CLR') :
          (rollMeasurePoint === 'inside' ? 'ID' : rollMeasurePoint === 'outside' ? 'OD' : 'CLD');
        const devValue = rollMeasureType === 'radius' ? (pitchCalc.developedDia / 2).toFixed(4) : pitchCalc.developedDia.toFixed(4);
        const devLabel = rollMeasureType === 'radius' ? 'Developed Radius' : 'Developed Diameter';
        lines.push(`${devLabel}: ${devValue}" ${specLabel}`);
      }
      lines.push(`Direction: ${pitchDirection === 'clockwise' ? 'Clockwise' : 'Counter-Clockwise'} (going up)`);
    }
    if (completeRings && ringCalc && !ringCalc.error) {
      if (!ringCalc.multiSegment) {
        lines.push(`Complete Ring — ${ringsNeeded} ring(s), ${ringCalc.ringsPerStick} rings/stick, ${ringCalc.sticksNeeded} stick(s) needed`);
      } else {
        lines.push(`Complete Ring — ${ringsNeeded} ring(s), ${ringCalc.segmentsPerRing} segments/ring, ${ringCalc.sticksNeeded} stick(s) needed`);
      }
      lines.push(`Tangents: ${ringCalc.tangent}" each end`);
    }
    return lines.join('\n');
  }, [rollToMethod, rollValue, rollMeasureType, rollMeasurePoint, rollCalc, riseCalc, partData.arcDegrees, pitchEnabled, pitchMethod, pitchRun, pitchRise, pitchAngle, pitchSpaceType, pitchSpaceValue, pitchDirection, pitchCalc, completeRings, ringCalc, ringsNeeded]);

  // Sync pitch fields to partData
  useEffect(() => {
    if (pitchEnabled) {
      setPartData(prev => ({
        ...prev,
        _pitchEnabled: true,
        _pitchMethod: pitchMethod,
        _pitchRun: pitchRun,
        _pitchRise: pitchRise,
        _pitchAngle: pitchAngle,
        _pitchSpaceType: pitchSpaceType,
        _pitchSpaceValue: pitchSpaceValue,
        _pitchDirection: pitchDirection,
        _pitchDevelopedDia: pitchCalc ? pitchCalc.developedDia : 0,
      }));
    } else {
      setPartData(prev => ({ ...prev, _pitchEnabled: false, _pitchDevelopedDia: 0 }));
    }
  }, [pitchEnabled, pitchMethod, pitchRun, pitchRise, pitchAngle, pitchSpaceType, pitchSpaceValue, pitchDirection, pitchCalc]);

  // Auto-update descriptions
  useEffect(() => {
    setPartData(prev => ({ ...prev, materialDescription, _materialDescription: materialDescription }));
  }, [materialDescription]);

  useEffect(() => {
    setPartData(prev => ({ ...prev, _rollingDescription: rollingDescription }));
  }, [rollingDescription]);

  // Sync roll fields to partData
  useEffect(() => {
    const rv = parseFloat(rollValue) || 0;
    const updates = { _rollValue: rollValue,
      _rollToMethod: rollToMethod, _rollMeasureType: rollMeasureType, _rollMeasurePoint: rollMeasurePoint };
    if (rollMeasureType === 'radius') {
      updates.radius = rv ? String(rv) : '';
      updates.diameter = '';
    } else {
      updates.diameter = rv ? String(rv) : '';
      updates.radius = '';
    }
    setPartData(prev => ({ ...prev, ...updates }));
  }, [rollToMethod, rollValue, rollMeasureType, rollMeasurePoint]);

  // Handle size selection
  const handleSizeSelect = (sizeLabel) => {
    const size = ALL_SIZES.find(s => s.label === sizeLabel);
    if (!size) {
      setPartData(prev => ({ ...prev, _pipeSize: sizeLabel, _pipeType: '', outerDiameter: '', _schedule: '', wallThickness: '' }));
      return;
    }
    const updates = {
      _pipeSize: sizeLabel,
      _pipeType: size.type,
      outerDiameter: String(size.od),
      sectionSize: sizeLabel,
    };
    // Set default length if not already set
    if (!partData.length) updates.length = size.defaultLength;
    // Clear schedule for tubes and solid bars
    if (size.type === 'tube' || size.type === 'solid_bar') updates._schedule = '';
    // Solid bar: set wall = 'SOLID' and clear schedule
    if (size.type === 'solid_bar') {
      updates.wallThickness = 'SOLID';
    }
    // Auto set stainless markup
    if (isStainless(partData.material) && partData.materialSource === 'we_order') {
      updates.materialMarkupPercent = 30;
    }
    setPartData(prev => ({ ...prev, ...updates }));
  };

  // Handle schedule selection
  const handleScheduleSelect = (sch) => {
    if (!selectedSize || selectedSize.type !== 'pipe') return;
    const schData = PIPE_SCHEDULES[selectedSize.nominal];
    const wall = schData?.[sch];
    setPartData(prev => ({
      ...prev,
      _schedule: sch,
      wallThickness: wall ? `${wall}"` : prev.wallThickness
    }));
  };

  // Handle grade change
  const handleGradeChange = (grade) => {
    const updates = { material: grade };
    // Auto-adjust markup for stainless
    if (isStainless(grade) && partData.materialSource === 'we_order') {
      updates.materialMarkupPercent = 30;
    }
    setPartData(prev => ({ ...prev, ...updates }));
  };

  // Pricing calculations
  const qty = parseInt(partData.quantity) || 1;
  const materialCost = parseFloat(partData.materialTotal) || 0;
  const materialMarkup = parseFloat(partData.materialMarkupPercent) || 0;
  const materialEachRaw = Math.round(materialCost * (1 + materialMarkup / 100) * 100) / 100;
  const rounding = partData._materialRounding || 'none';
  const materialEach = rounding === 'dollar' && materialEachRaw > 0 ? Math.ceil(materialEachRaw) : rounding === 'five' && materialEachRaw > 0 ? Math.ceil(materialEachRaw / 5) * 5 : materialEachRaw;
  const laborEach = parseFloat(partData.laborTotal) || 0;
  const unitPrice = materialEach + laborEach;
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, title, color) => (
    <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {title}</h4>
  );

  const isCustomGrade = partData.material && !gradeOptions.includes(partData.material) && partData.material !== 'Custom';
  const selectedGradeOption = gradeOptions.includes(partData.material) ? partData.material : (partData.material ? 'Custom' : '');
  const isCustomWall = partData.wallThickness && !TUBE_WALL_OPTIONS.includes(partData.wallThickness) && partData.wallThickness !== 'Custom';

  return (
    <>
      {/* === QUANTITY === */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity || 1}
          onChange={(e) => setPartData({ ...partData, quantity: parseInt(e.target.value) || 1 })}
          onFocus={(e) => e.target.select()} min="1" disabled={completeRings}
          style={completeRings ? { background: '#e8f5e9', fontWeight: 600 } : {}} />
        {completeRings && ringCalc && !ringCalc.error && (
          <div style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: 2 }}>
            ⭕ {ringsNeeded} ring(s) — {ringCalc.sticksNeeded} stick(s) needed{!ringCalc.multiSegment ? ` (${ringCalc.ringsPerStick} rings/stick)` : ` (${ringCalc.segmentsPerRing} segments/ring)`}
          </div>
        )}
      </div>

      {/* === SIZE === */}
      <div className="form-group">
        <label className="form-label">Size *</label>
        <select className="form-select" value={partData._pipeSize || ''}
          onChange={(e) => handleSizeSelect(e.target.value)}>
          <option value="">Select size...</option>
          <optgroup label="Round Tube">
            {TUBE_SIZES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
          </optgroup>
          <optgroup label="Pipe">
            {PIPE_SIZES.map(s => (
              <option key={s.label} value={s.label}>{s.label} ({s.od}" OD)</option>
            ))}
          </optgroup>
          <optgroup label="Solid Round Bar">
            {SOLID_BAR_SIZES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
          </optgroup>
          <option value="Custom">Custom Size</option>
        </select>

        {/* Show OD info for selected pipe */}
        {selectedSize && selectedSize.type === 'pipe' && (
          <div style={{ background: '#e3f2fd', padding: 10, borderRadius: 6, marginTop: 8, fontSize: '0.85rem' }}>
            <Info size={14} style={{ display: 'inline', marginRight: 6 }} />
            {selectedSize.nominal} Pipe = <strong>{selectedSize.od}" OD</strong>
          </div>
        )}

        {/* Show solid bar info */}
        {selectedSize && selectedSize.type === 'solid_bar' && (
          <div style={{ background: '#fff3e0', padding: 10, borderRadius: 6, marginTop: 8, fontSize: '0.85rem' }}>
            <Info size={14} style={{ display: 'inline', marginRight: 6 }} />
            Solid Round Bar — <strong>{selectedSize.od}" OD</strong> (no wall thickness)
          </div>
        )}
      </div>

      {/* Custom OD input */}
      {partData._pipeSize === 'Custom' && (
        <div className="form-group">
          <label className="form-label">Outer Diameter (inches) *</label>
          <input type="number" step="0.001" className="form-input" value={partData.outerDiameter || ''}
            onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, outerDiameter: e.target.value })} placeholder="e.g. 2.375" />
        </div>
      )}

      {/* Schedule selector for pipes */}
      {selectedSize && selectedSize.type === 'pipe' && (
        <div className="form-group">
          <label className="form-label">Schedule *</label>
          <select className="form-select" value={partData._schedule || ''}
            onChange={(e) => handleScheduleSelect(e.target.value)}>
            <option value="">Select schedule...</option>
            {availableSchedules.filter(s => ['10', '40', '80', '160'].includes(s.schedule)).map(s => (
              <option key={s.schedule} value={s.schedule}>Sch. {s.schedule} ({s.wall}" wall)</option>
            ))}
          </select>
        </div>
      )}

      {/* Wall thickness for tubes and custom (hidden for pipes and solid bars) */}
      {(!selectedSize || selectedSize.type === 'tube' || partData._pipeSize === 'Custom') && (!selectedSize || selectedSize.type !== 'solid_bar') && (
        <div className="form-group">
          <label className="form-label">Wall Thickness</label>
          <select className="form-select" value={TUBE_WALL_OPTIONS.includes(partData.wallThickness) ? partData.wallThickness : (partData.wallThickness ? 'Custom' : '')}
            onChange={(e) => {
              if (e.target.value === 'Custom') {
                setPartData({ ...partData, wallThickness: customWall || '' });
              } else {
                setPartData({ ...partData, wallThickness: e.target.value });
                setCustomWall('');
              }
            }}>
            <option value="">Select...</option>
            {TUBE_WALL_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          {(partData.wallThickness === 'Custom' || isCustomWall) && (
            <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter wall thickness"
              value={isCustomWall ? partData.wallThickness : customWall}
              onChange={(e) => { setCustomWall(e.target.value); setPartData({ ...partData, wallThickness: e.target.value }); }} />
          )}
        </div>
      )}

      {/* Length */}
      <div className="form-group">
        <label className="form-label">Length</label>
        <select className="form-select" value={partData._lengthOption || ''} onChange={(e) => {
          const val = e.target.value;
          if (val === 'Custom') {
            setPartData({ ...partData, _lengthOption: 'Custom', length: partData._customLength || '' });
          } else {
            setPartData({ ...partData, _lengthOption: val, length: val, _customLength: '' });
          }
        }}>
          <option value="">Select...</option>
          <option value="20'">20'</option>
          <option value="21'">21'</option>
          <option value="30'">30'</option>
          <option value="40'">40'</option>
          <option value="Custom">Custom</option>
        </select>
        {(partData._lengthOption === 'Custom') && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter length"
            value={partData._customLength || ''}
            onChange={(e) => { setPartData({ ...partData, _customLength: e.target.value, length: e.target.value }); }} />
        )}
      </div>

      {/* === ROLLING SPECS === */}
      <div style={sectionStyle}>
        {sectionTitle('🔄', 'Roll Information', '#1565c0')}
        <RollToOverride rollToMethod={rollToMethod} onMethodChange={setRollToMethod} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Roll to: *</label>
            <input type="number" step="0.1" className="form-input" value={rollToMethod ? '' : rollValue} onChange={(e) => setRollValue(e.target.value)} placeholder={rollToMethod === 'template' ? 'Per Template/Sample' : rollToMethod === 'print' ? 'Per Print' : 'Enter value'} disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} />
          </div>
          <div className="form-group">
            <label className="form-label">Measured At</label>
            <select className="form-select" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} value={rollMeasurePoint} onChange={(e) => setRollMeasurePoint(e.target.value)}>
              <option value="centerline">Centerline</option>
              <option value="inside">Inside</option>
              <option value="outside">Outside</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} value={rollMeasureType} onChange={(e) => setRollMeasureType(e.target.value)}>
              <option value="diameter">Diameter</option>
              <option value="radius">Radius</option>
            </select>
          </div>
        </div>

        {/* DiaFind - chord & rise to diameter calculator */}
        {!rollToMethod && (
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={() => setShowDiaFind(!showDiaFind)}
              style={{ background: 'none', border: 'none', color: '#1565c0', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              📐 DiaFind {showDiaFind ? '▾' : '▸'} <span style={{ fontWeight: 400, color: '#888' }}>— chord & rise → diameter</span>
            </button>
            {showDiaFind && (
              <div style={{ marginTop: 8, padding: 12, background: '#f3e5f5', borderRadius: 8, border: '1px solid #ce93d8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Chord (inches)</label>
                    <input type="number" step="0.001" className="form-input" value={diaFindChord} onFocus={(e) => e.target.select()} onChange={(e) => setDiaFindChord(e.target.value)} placeholder="e.g. 48" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Rise (inches)</label>
                    <input type="number" step="0.001" className="form-input" value={diaFindRise} onFocus={(e) => e.target.select()} onChange={(e) => setDiaFindRise(e.target.value)} placeholder="e.g. 2.5" />
                  </div>
                </div>
                {diaFindResult && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#6a1b9a', fontSize: '1rem' }}>⌀ {diaFindResult.toFixed(3)}"</span>
                    <button type="button" onClick={() => { setRollValue(diaFindResult.toFixed(3)); setRollMeasureType('diameter'); setShowDiaFind(false); }}
                      style={{ padding: '6px 16px', background: '#7b1fa2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      Apply Diameter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Roll limit check */}
        {rollCheck && (
          <>
            {rollCheck.isBelowMin ? (
              <div style={{ background: '#fff3e0', border: '1px solid #ff9800', borderRadius: 8, padding: 12, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e65100', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  <AlertTriangle size={16} /> Diameter Below Minimum Rolling Capacity
                </div>
                <div style={{ fontSize: '0.8rem', color: '#bf360c', marginBottom: 4 }}>
                  Requested: {rollCheck.centerlineDia.toFixed(2)}" CL | Min rollable: {rollCheck.minRollDia.toFixed(2)}" CL
                  {rollCheck.matchedRule && ` (${rollCheck.materialCat})`}
                </div>
                {rollCheck.availableDies.length > 0 ? (
                  <div style={{ marginTop: 8, padding: 8, background: '#e8f5e9', borderRadius: 6 }}>
                    <div style={{ fontWeight: 600, color: '#2e7d32', fontSize: '0.85rem', marginBottom: 4 }}>
                      ✅ Mandrel Dies Available:
                    </div>
                    {rollCheck.availableDies.map((die, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', padding: '2px 0', color: '#1b5e20' }}>
                        • {die.label || `${die.od}" die`} — Min Ø: {die.minDiameter}" CL
                        {die.notes && <span style={{ color: '#666' }}> ({die.notes})</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 6, padding: 8, background: '#ffebee', borderRadius: 6, fontSize: '0.8rem', color: '#c62828' }}>
                    ❌ No mandrel dies available for this size. Smallest rollable diameter is {rollCheck.minRollDia.toFixed(2)}" CL.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#e8f5e9', padding: 8, borderRadius: 6, marginTop: 8, fontSize: '0.8rem', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={14} /> Diameter OK — {rollCheck.centerlineDia.toFixed(2)}" CL (min: {rollCheck.minRollDia.toFixed(2)}")
              </div>
            )}
          </>
        )}

        {/* Chord & Rise calculation */}
        {riseCalc && (
          <div style={{ background: '#f3e5f5', borderRadius: 8, padding: 10, marginTop: 8 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6a1b9a', marginBottom: 4 }}>
              📐 Chord & Rise (check dimension)
            </div>
            <div style={{ fontSize: '0.82rem', color: '#4a148c' }}>
              Over a {riseCalc.chord}" chord: <strong>{riseCalc.rise.toFixed(4)}" rise</strong>
            </div>
          </div>
        )}

        {/* Arc degrees */}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Arc (degrees)</label>
          <input type="number" step="0.1" className="form-input" value={partData.arcDegrees || ''}
            onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, arcDegrees: e.target.value })} placeholder="e.g. 90, 180, 360" />
        </div>

        {/* === COMPLETE RINGS === */}
        <div style={{
          marginTop: 12, padding: 14, borderRadius: 8,
          background: completeRings ? '#e8f5e9' : '#f9f9f9',
          border: `2px solid ${completeRings ? '#4caf50' : '#e0e0e0'}`,
          transition: 'all 0.2s'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={completeRings}
              onChange={(e) => setCompleteRings(e.target.checked)}
              style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '1rem' }}>⭕ Complete Rings</span>
          </label>

          {completeRings && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Rings Needed</label>
                  <input type="number" min="1" className="form-input" value={ringsNeeded}
                    onFocus={(e) => e.target.select()} onChange={(e) => setRingsNeeded(parseInt(e.target.value) || 1)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tangent Each End (inches)</label>
                  <input type="number" step="0.5" className="form-input" value={tangentLength}
                    onFocus={(e) => e.target.select()} onChange={(e) => setTangentLength(e.target.value)} />
                  <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Flat/straight ends that won't bend</div>
                </div>
              </div>

              {ringCalc && !ringCalc.error && (
                <div style={{ background: '#c8e6c9', borderRadius: 8, padding: 12, fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600, color: '#2e7d32', marginBottom: 8 }}>⭕ Ring Calculation</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: '#666', fontSize: '0.7rem' }}>CL Circumference</div>
                      <div style={{ fontWeight: 600 }}>{ringCalc.circumference.toFixed(2)}"</div>
                    </div>
                    <div>
                      <div style={{ color: '#666', fontSize: '0.7rem' }}>Usable Length</div>
                      <div style={{ fontWeight: 600 }}>{ringCalc.usable.toFixed(2)}" <span style={{ color: '#999', fontSize: '0.75rem' }}>({lengthInches}" - {ringCalc.tangent * 2}" tang)</span></div>
                    </div>
                    <div>
                      <div style={{ color: '#666', fontSize: '0.7rem' }}>{ringCalc.multiSegment ? 'Segments/Ring' : 'Rings/Stick'}</div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#1565c0' }}>{ringCalc.multiSegment ? ringCalc.segmentsPerRing : ringCalc.ringsPerStick}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid #a5d6a7', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                    <span><strong>{ringsNeeded}</strong> ring(s) needed</span>
                    <strong style={{ color: '#2e7d32', fontSize: '1.1rem' }}>= {ringCalc.sticksNeeded} stick(s) to order</strong>
                  </div>
                  {!ringCalc.multiSegment && ringCalc.ringsPerStick > 1 && (
                    <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#1565c0', fontStyle: 'italic' }}>
                      💡 Material cost per ring = stick price ÷ {ringCalc.ringsPerStick}
                    </div>
                  )}
                </div>
              )}
              {ringCalc && ringCalc.error && (
                <div style={{ background: '#ffebee', padding: 8, borderRadius: 6, fontSize: '0.85rem', color: '#c62828' }}>
                  ⚠️ {ringCalc.error}
                </div>
              )}
              {!ringCalc && (!rollCalc || rollCalc.centerlineDia <= 0) && (
                <div style={{ background: '#fff3e0', padding: 8, borderRadius: 6, fontSize: '0.85rem', color: '#e65100' }}>
                  ⚠️ Enter a roll diameter/radius above to calculate ring pieces
                </div>
              )}
            </div>
          )}
        </div>

        {/* === PITCH / HELIX === */}
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 8,
          background: pitchEnabled ? '#fff8e1' : '#f9f9f9',
          border: `2px solid ${pitchEnabled ? '#ffc107' : '#e0e0e0'}`,
          transition: 'all 0.2s'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={pitchEnabled}
              onChange={(e) => setPitchEnabled(e.target.checked)}
              style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '1rem' }}>🌀 Pitch / Helix (Spiral Staircase, Coil)</span>
          </label>

          {pitchEnabled && (
            <div style={{ marginTop: 14 }}>
              {/* Direction with images */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Direction (looking down, going up from ground floor)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button type="button" onClick={() => setPitchDirection('clockwise')} style={{
                    padding: 12, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: `3px solid ${pitchDirection === 'clockwise' ? '#1976d2' : '#ccc'}`,
                    background: pitchDirection === 'clockwise' ? '#e3f2fd' : '#fff',
                    transition: 'all 0.2s'
                  }}>
                    <img src="/images/Clockwise.png" alt="Clockwise helix" style={{ width: '100%', maxWidth: 180, height: 'auto', borderRadius: 6 }} />
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: 6, color: pitchDirection === 'clockwise' ? '#1976d2' : '#666' }}>
                      ↻ Clockwise
                    </div>
                  </button>
                  <button type="button" onClick={() => setPitchDirection('counterclockwise')} style={{
                    padding: 12, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: `3px solid ${pitchDirection === 'counterclockwise' ? '#1976d2' : '#ccc'}`,
                    background: pitchDirection === 'counterclockwise' ? '#e3f2fd' : '#fff',
                    transition: 'all 0.2s'
                  }}>
                    <img src="/images/CounterClockwise.png" alt="Counter-Clockwise helix" style={{ width: '100%', maxWidth: 180, height: 'auto', borderRadius: 6 }} />
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: 6, color: pitchDirection === 'counterclockwise' ? '#1976d2' : '#666' }}>
                      ↺ Counter-Clockwise
                    </div>
                  </button>
                </div>
              </div>

              {/* Input Method */}
              <div style={{ marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Input Method</label>
                  <select className="form-select" value={pitchMethod} onChange={(e) => setPitchMethod(e.target.value)}>
                    <option value="runrise">Run & Rise</option>
                    <option value="degree">Degree of Angle</option>
                    <option value="space">Spacing (Between / C-to-C)</option>
                  </select>
                </div>
              </div>

              {/* Run & Rise */}
              {pitchMethod === 'runrise' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Run (inches)</label>
                    <input type="number" step="0.1" className="form-input" value={pitchRun}
                      onFocus={(e) => e.target.select()} onChange={(e) => setPitchRun(e.target.value)} placeholder="12" />
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Horizontal distance (default 12")</div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Rise (inches)</label>
                    <input type="number" step="0.01" className="form-input" value={pitchRise}
                      onFocus={(e) => e.target.select()} onChange={(e) => setPitchRise(e.target.value)} placeholder="Height at run point" />
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Vertical rise at the run distance</div>
                  </div>
                </div>
              )}

              {/* Degree of Angle */}
              {pitchMethod === 'degree' && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Pitch Angle (degrees)</label>
                  <input type="number" step="0.1" className="form-input" value={pitchAngle}
                    onFocus={(e) => e.target.select()} onChange={(e) => setPitchAngle(e.target.value)} placeholder="e.g. 5, 10, 15" />
                  <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Angle of the helix from horizontal</div>
                </div>
              )}

              {/* Spacing */}
              {pitchMethod === 'space' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Spacing Type</label>
                    <select className="form-select" value={pitchSpaceType} onChange={(e) => setPitchSpaceType(e.target.value)}>
                      <option value="between">Between (gap between profiles)</option>
                      <option value="center">Center-to-Center</option>
                    </select>
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>
                      {pitchSpaceType === 'center'
                        ? 'Measured from CL of one revolution to the next (includes 1 OD)'
                        : 'Clear gap between bottom of upper profile and top of lower profile'}
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Spacing (inches)</label>
                    <input type="number" step="0.01" className="form-input" value={pitchSpaceValue}
                      onFocus={(e) => e.target.select()} onChange={(e) => setPitchSpaceValue(e.target.value)} placeholder="Rise per full revolution" />
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Rise over one full revolution (run = circumference)</div>
                  </div>
                </div>
              )}

              {/* Calculated results */}
              {pitchCalc && (
                <div style={{ marginTop: 14, background: '#f3e5f5', borderRadius: 8, padding: 12, fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 600, color: '#6a1b9a', marginBottom: 8, fontSize: '0.85rem' }}>📐 Pitch Calculations</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>Pitch Angle</div>
                      <div style={{ fontWeight: 600 }}>{pitchCalc.angle.toFixed(2)}°</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>Run / Rise</div>
                      <div style={{ fontWeight: 600 }}>{pitchCalc.run}" / {pitchCalc.rise.toFixed(3)}"</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>Rise per Revolution</div>
                      <div style={{ fontWeight: 600 }}>{pitchCalc.risePerRev > 0 ? pitchCalc.risePerRev.toFixed(3) + '"' : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>Between Spacing</div>
                      <div style={{ fontWeight: 600 }}>{pitchCalc.spaceBetween > 0 ? pitchCalc.spaceBetween.toFixed(3) + '"' : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>Center-to-Center</div>
                      <div style={{ fontWeight: 600 }}>{pitchCalc.spaceCenter > 0 ? pitchCalc.spaceCenter.toFixed(3) + '"' : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>CL Circumference</div>
                      <div style={{ fontWeight: 600 }}>{pitchCalc.circumference > 0 ? pitchCalc.circumference.toFixed(2) + '"' : 'Need Ø'}</div>
                    </div>
                  </div>

                  {/* Developed Diameter - highlighted */}
                  {pitchCalc.developedDia > 0 && (
                    <div style={{ marginTop: 10, padding: 10, background: '#e8f5e9', borderRadius: 6, border: '1px solid #a5d6a7' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#2e7d32', fontSize: '0.75rem', fontWeight: 600 }}>🎯 Developed (Pitch) Diameter</div>
                          <div style={{ fontSize: '0.7rem', color: '#666' }}>Set rolls to this diameter</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#2e7d32' }}>
                          {pitchCalc.developedDia.toFixed(4)}"
                        </div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4 }}>
                        Developed Radius: <strong>{(pitchCalc.developedDia / 2).toFixed(4)}"</strong>
                        {pitchCalc.inputDia > 0 && <span> | Floor {rollMeasurePoint === 'inside' ? 'ID' : rollMeasurePoint === 'outside' ? 'OD' : 'Ø'}: {pitchCalc.inputDia.toFixed(2)}" → Pitch {rollMeasurePoint === 'inside' ? 'ID' : rollMeasurePoint === 'outside' ? 'OD' : 'Ø'}: {pitchCalc.developedDia.toFixed(4)}" (+{(pitchCalc.developedDia - pitchCalc.inputDia).toFixed(4)}")</span>}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#666', borderTop: '1px solid #ddd', paddingTop: 6 }}>
                    Direction: <strong>{pitchDirection === 'clockwise' ? '↻ Clockwise' : '↺ Counter-Clockwise'}</strong> (looking down, going up from ground floor)
                    {pitchCalc.od > 0 && <span> | Profile OD: {pitchCalc.od}"</span>}
                  </div>
                </div>
              )}

              {/* Warning if no diameter for space calcs */}
              {pitchEnabled && pitchMethod === 'space' && (!rollCalc || rollCalc.centerlineDia <= 0) && (
                <div style={{ marginTop: 8, background: '#fff3e0', padding: 8, borderRadius: 6, fontSize: '0.8rem', color: '#e65100' }}>
                  ⚠️ Enter a roll diameter above to calculate spacing values (circumference needed for spacing method).
                </div>
              )}
            </div>
          )}
        </div>

        {/* Special Instructions - inside rolling section */}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Special Instructions</label>
          <textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} rows={2} />
        </div>
      </div>

      {/* === MATERIAL INFO === */}
      <div style={sectionStyle}>
        {sectionTitle('📦', 'Material Information', '#e65100')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Grade</label>
            <select className="form-select" value={selectedGradeOption} onChange={(e) => {
              if (e.target.value === 'Custom') {
                handleGradeChange(customGrade || 'Custom');
              } else {
                handleGradeChange(e.target.value);
                setCustomGrade('');
              }
            }}>
              <option value="">Select...</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {(selectedGradeOption === 'Custom' || isCustomGrade) && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter grade"
                value={isCustomGrade ? partData.material : customGrade}
                onChange={(e) => { setCustomGrade(e.target.value); handleGradeChange(e.target.value); }} />
            )}
            {isStainless(partData.material) && (
              <div style={{ fontSize: '0.7rem', color: '#e65100', marginTop: 2 }}>📌 Stainless — markup auto-set to 30%</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Origin</label>
            <select className="form-select" value={partData._materialOrigin || ''} onChange={(e) => setPartData({ ...partData, _materialOrigin: e.target.value })}>
              <option value="">Select...</option>
              <option value="Domestic">Domestic</option>
              <option value="Import">Import</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Material Source</label>
            <select className="form-select" value={partData.materialSource || 'customer_supplied'} onChange={(e) => setPartData({ ...partData, materialSource: e.target.value })}>
              <option value="customer_supplied">Client Supplies</option>
              <option value="we_order">We Order</option>
            </select>
          </div>
        </div>

        {/* Vendor Selector */}
        {partData.materialSource === 'we_order' && (
          <div className="form-group" style={{ position: 'relative', marginTop: 8 }}>
            <label className="form-label">Vendor</label>
            <input className="form-input"
              value={partData._vendorSearch !== undefined ? partData._vendorSearch : (partData.vendor?.name || partData.supplierName || '')}
              onChange={async (e) => {
                const value = e.target.value;
                setPartData({ ...partData, _vendorSearch: value });
                if (value.length >= 1) {
                  try { const res = await searchVendors(value); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch { setVendorSuggestions([]); }
                } else {
                  setPartData({ ...partData, _vendorSearch: value, vendorId: null, supplierName: '' }); setVendorSuggestions([]); setShowVendorSuggestions(false);
                }
              }}
              onFocus={async () => { try { const res = await searchVendors(''); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch {} }}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
              placeholder="Search or add vendor..." autoComplete="off"
            />
            {showVendorSuggestions && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {vendorSuggestions.map(v => (
                  <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    onMouseDown={() => { setPartData({ ...partData, vendorId: v.id, supplierName: v.name, _vendorSearch: undefined }); setShowVendorSuggestions(false); }}>
                    <strong>{v.name}</strong>
                    {v.contactPhone && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{v.contactPhone}</span>}
                  </div>
                ))}
                {partData._vendorSearch && partData._vendorSearch.length >= 2 && !vendorSuggestions.some(v => v.name.toLowerCase() === (partData._vendorSearch || '').toLowerCase()) && (
                  <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                    onMouseDown={async () => {
                      try {
                        const resp = await createVendor({ name: partData._vendorSearch });
                        if (resp.data.data) { setPartData({ ...partData, vendorId: resp.data.data.id, supplierName: resp.data.data.name, _vendorSearch: undefined }); showMessage(`Vendor "${resp.data.data.name}" created`); }
                      } catch { setError('Failed to create vendor'); }
                      setShowVendorSuggestions(false);
                    }}>
                    + Add "{partData._vendorSearch}" as new vendor
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Material Description (for ordering)</label>
          <textarea className="form-textarea" value={partData.materialDescription || ''} onChange={(e) => setPartData({ ...partData, materialDescription: e.target.value })} rows={2}
            style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} />
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Auto-generated from dimensions — edit as needed</div>
        </div>
      </div>

      {/* === PRICING === */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Pricing', '#1976d2')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Material Cost (each)</label>
            <input type="number" step="any" className="form-input" value={partData.materialTotal || ''} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialTotal: e.target.value })} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Markup %</label>
            <input type="number" step="1" className="form-input" value={partData.materialMarkupPercent ?? 20} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialMarkupPercent: e.target.value })} placeholder="20" />
          </div>
          <div className="form-group">
            <label className="form-label">Labor (each)</label>
            <input type="number" step="any" className="form-input" value={partData.laborTotal || ''} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, laborTotal: e.target.value })} placeholder="0.00" />
          </div>
        </div>

        <div style={{ background: '#f0f7ff', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #bbdefb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
            <span>Material Cost (ea)</span><span>${materialCost.toFixed(2)}</span>
          </div>
          {materialMarkup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#e65100' }}><span>+ Markup ({materialMarkup}%)</span><span>${(materialEachRaw - materialCost).toFixed(2)}</span></div>}
          {materialMarkup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555', fontWeight: 600 }}><span>Material w/ Markup</span><span>{materialEachRaw !== materialEach && <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 4, fontSize: '0.8rem' }}>${materialEachRaw.toFixed(2)}</span>}${materialEach.toFixed(2)}</span></div>}
          {materialMarkup > 0 && <div style={{ display: 'flex', gap: 4, padding: '4px 0 2px' }}>
            <span style={{ fontSize: '0.75rem', color: '#888', alignSelf: 'center' }}>Round up:</span>
            {[{k:'none',l:'None'},{k:'dollar',l:'↑ $1'},{k:'five',l:'↑ $5'}].map(o => (
              <button key={o.k} type="button" onClick={() => setPartData(prev => ({ ...prev, _materialRounding: o.k }))}
                style={{ padding: '2px 8px', fontSize: '0.7rem', borderRadius: 4, cursor: 'pointer',
                  border: (partData._materialRounding || 'none') === o.k ? '2px solid #1976d2' : '1px solid #ccc',
                  background: (partData._materialRounding || 'none') === o.k ? '#e3f2fd' : '#fff',
                  color: (partData._materialRounding || 'none') === o.k ? '#1976d2' : '#666',
                  fontWeight: (partData._materialRounding || 'none') === o.k ? 700 : 400 }}>{o.l}</button>
            ))}
          </div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
            <span>Labor (ea)</span><span>${laborEach.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9', marginTop: 4 }}>
            <strong>Unit Price</strong><strong style={{ color: '#1976d2' }}>${unitPrice.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9' }}>
            <strong>Line Total ({qty} × ${unitPrice.toFixed(2)})</strong>
            <strong style={{ fontSize: '1.15rem', color: '#2e7d32' }}>${lineTotal.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* === TRACKING === */}
      <div style={sectionStyle}>
        {sectionTitle('🏷️', 'Tracking', '#616161')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Client Part Number</label>
            <input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label className="form-label">Heat Number</label>
            <input type="text" className="form-input" value={partData.heatNumber || ''} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </div>
    </>
  );
}
