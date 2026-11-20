import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Loader2,
  MapPin,
  DollarSign,
  Home,
  Users,
  User,
  Mail,
  Landmark,
  FileText,
  Gavel,
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
  Star,
  ListPlus,
  RotateCcw,
  ThumbsDown,
  ChevronDown,
  StickyNote,
  MessageSquare,
  Edit3,
} from 'lucide-react';
import { OffMarketProperty } from '../../types';
import { supabase } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { normalizeOffMarketLists } from './OffMarketPropertiesListModal';
import {
  TextMessageTemplateModal,
  TextMessageTemplatesConfig,
  TemplateKey,
  TEMPLATE_KEYS,
  DEFAULT_TEXT_MESSAGE_TEMPLATES,
  renderTextMessageTemplate,
  parseTextTemplatesConfig,
  loadLocalTextTemplates,
  saveLocalTextTemplates,
} from './TextMessageTemplateModal';

interface OffMarketPropertyModalProps {
  property: OffMarketProperty;
  initialTemplates?: TextMessageTemplatesConfig;
  onSaveTemplates?: (updatedTemplates: TextMessageTemplatesConfig) => Promise<void>;
  onPropertyUpdated?: (updated: OffMarketProperty) => void;
  onClose: () => void;
  onSave: (updated: OffMarketProperty) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onMoveToNotInterested?: (id: number) => Promise<void>;
  onRestore?: (id: number) => Promise<void>;
  onToggleInterested?: (property: OffMarketProperty) => Promise<void>;
  onAddToList?: (property: OffMarketProperty) => void;
  onLocateOnMap?: (address: string) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

type FieldType = 'text' | 'numeric' | 'currency' | 'date' | 'textarea' | 'readonly';

const formatDollarInput = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const raw = String(val).trim();
  if (!raw) return '';
  const isNegative = raw.startsWith('-');
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return isNegative ? '-' : '';
  const dotIdx = cleaned.indexOf('.');
  const intPart = dotIdx >= 0 ? cleaned.slice(0, dotIdx) : cleaned;
  const decPart = dotIdx >= 0 ? cleaned.slice(dotIdx + 1).replace(/\./g, '') : null;
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNegative ? '-' : '';
  return decPart !== null ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
};

const formatCombinedAddress = (
  street?: string,
  city?: string,
  state?: string,
  zip?: string
): string => {
  const stateZip = [state?.trim(), zip?.trim()].filter(Boolean).join(' ');
  return [street?.trim(), city?.trim(), stateZip].filter(Boolean).join(', ');
};

export const DATE_OFF_MARKET_COLUMNS = new Set<keyof OffMarketProperty>([
  'Last Sale Date',
  'Mortgage Document Date',
  'Recording Date',
  'Auction Date',
]);

export const normalizeToIsoDate = (val: any): string | null => {
  if (val === null || val === undefined) return null;

  // Handle Excel serial date numbers (e.g. 45231 -> 2023-11-01)
  if (typeof val === 'number' && Number.isFinite(val) && val > 1 && val < 100000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const dt = new Date(excelEpoch + Math.round(val) * 86400000);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(0, 10);
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Already YYYY-MM-DD (or ISO timestamp starting with YYYY-MM-DD)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Handle numeric string Excel serial dates
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    if (serial > 1 && serial < 100000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const dt = new Date(excelEpoch + Math.round(serial) * 86400000);
      if (!Number.isNaN(dt.getTime())) {
        return dt.toISOString().slice(0, 10);
      }
    }
  }

  // Handle MM/DD/YYYY or MM-DD-YYYY (and 2-digit years)
  const usMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (usMatch) {
    let [, m, d, y] = usMatch;
    if (y.length === 2) {
      const yr = Number(y);
      y = yr >= 50 ? `19${y}` : `20${y}`;
    }
    const mm = Number(m);
    const dd = Number(d);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Fallback to native Date parsing
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    if (year >= 1800 && year <= 2200) {
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return null;
};

interface FieldDef {
  key: keyof OffMarketProperty;
  label: string;
  type: FieldType;
  colSpan?: 2 | 3;
}

interface SectionDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  fields: FieldDef[];
}

export const NUMERIC_OFF_MARKET_COLUMNS = new Set<keyof OffMarketProperty>([
  'Zip',
  'Estimated Value',
  'Estimated Equity Percent',
  'Estimated Equity',
  'Living Square Feet',
  'Year Built',
  'Lot (Acres)',
  'Lot (Square Feet)',
  'APN',
  'Units Count',
  'Bedrooms',
  'Bathrooms',
  '# of Stories',
  'Garage Square Feet',
  'Carport Area',
  '# of Fireplaces',
  'Owner Mailing Zip',
  'Ownership Length (Months)',
  'Owner Occupied',
  'Vacant?',
  'Last Sale Amount',
  'Open Mortgage Balance',
  'Assessment Year',
  'Assessed Total Value',
  'Assessed Land Value',
  'Assessed Improvement Value',
  'Market Value',
  'Market Land Value',
  'Market Improvement Value',
  'Default Amount',
  'Opening bid',
  'My Estimated Offer',
]);

const SECTIONS: SectionDef[] = [
  {
    id: 'location',
    title: 'Property Location & Overview',
    icon: <MapPin size={14} />,
    fields: [
      { key: 'Address', label: 'Address', type: 'text', colSpan: 2 },
      { key: 'Status', label: 'Status', type: 'text' },
      { key: 'City', label: 'City', type: 'text' },
      { key: 'State', label: 'State', type: 'text' },
      { key: 'Zip', label: 'Zip', type: 'numeric' },
      { key: 'County', label: 'County', type: 'text' },
      { key: 'Subdivision', label: 'Subdivision', type: 'text' },
      { key: 'APN', label: 'APN', type: 'numeric' },
      { key: 'Legal Description', label: 'Legal Description', type: 'textarea', colSpan: 3 },
    ],
  },
  {
    id: 'details',
    title: 'Property Details & Features',
    icon: <Home size={14} />,
    fields: [
      { key: 'Property Type', label: 'Property Type', type: 'text' },
      { key: 'Property Use', label: 'Property Use', type: 'text' },
      { key: 'Land Use', label: 'Land Use', type: 'text' },
      { key: 'Living Square Feet', label: 'Living Square Feet', type: 'numeric' },
      { key: 'Year Built', label: 'Year Built', type: 'numeric' },
      { key: 'Units Count', label: 'Units Count', type: 'numeric' },
      { key: 'Bedrooms', label: 'Bedrooms', type: 'numeric' },
      { key: 'Bathrooms', label: 'Bathrooms', type: 'numeric' },
      { key: '# of Stories', label: '# of Stories', type: 'numeric' },
      { key: 'Lot (Acres)', label: 'Lot (Acres)', type: 'numeric' },
      { key: 'Lot (Square Feet)', label: 'Lot (Square Feet)', type: 'numeric' },
      { key: '# of Fireplaces', label: '# of Fireplaces', type: 'numeric' },
      { key: 'Garage Type', label: 'Garage Type', type: 'text' },
      { key: 'Garage Square Feet', label: 'Garage Square Feet', type: 'numeric' },
      { key: 'Carport', label: 'Carport', type: 'text' },
      { key: 'Carport Area', label: 'Carport Area', type: 'numeric' },
      { key: 'Air Conditioning Type', label: 'Air Conditioning Type', type: 'text' },
      { key: 'Heating Type', label: 'Heating Type', type: 'text' },
    ],
  },
  {
    id: 'owners',
    title: 'Owner Information',
    icon: <Users size={14} />,
    fields: [
      { key: 'Owner 1 First Name', label: 'Owner 1 First Name', type: 'text' },
      { key: 'Owner 1 Last Name', label: 'Owner 1 Last Name', type: 'text' },
      { key: 'Owner 1 Phone Number 1', label: 'Owner 1 Phone Number 1', type: 'text' },
      { key: 'Owner 1 Phone Number 2', label: 'Owner 1 Phone Number 2', type: 'text' },
      { key: 'Owner 1 Phone Number 3', label: 'Owner 1 Phone Number 3', type: 'text' },
      { key: 'Owner 2 First Name', label: 'Owner 2 First Name', type: 'text' },
      { key: 'Owner 2 Last Name', label: 'Owner 2 Last Name', type: 'text' },
      { key: 'Owner 2 Phone Number 1', label: 'Owner 2 Phone Number 1', type: 'text' },
      { key: 'Owner 2 Phone Number 2', label: 'Owner 2 Phone Number 2', type: 'text' },
      { key: 'Owner 2 Phone Number 3', label: 'Owner 2 Phone Number 3', type: 'text' },
      { key: 'Owner 3 First Name', label: 'Owner 3 First Name', type: 'text' },
      { key: 'Owner 3 Last Name', label: 'Owner 3 Last Name', type: 'text' },
      { key: 'Owner 3 Phone Number 1', label: 'Owner 3 Phone Number 1', type: 'text' },
      { key: 'Owner 3 Phone Number 2', label: 'Owner 3 Phone Number 2', type: 'text' },
      { key: 'Owner 3 Phone Number 3', label: 'Owner 3 Phone Number 3', type: 'text' },
      { key: 'Owner 4 First Name', label: 'Owner 4 First Name', type: 'text' },
      { key: 'Owner 4 Last Name', label: 'Owner 4 Last Name', type: 'text' },
      { key: 'Owner 4 Phone Number 1', label: 'Owner 4 Phone Number 1', type: 'text' },
      { key: 'Owner 4 Phone Number 2', label: 'Owner 4 Phone Number 2', type: 'text' },
      { key: 'Owner 4 Phone Number 3', label: 'Owner 4 Phone Number 3', type: 'text' },
    ],
  },
  {
    id: 'mailing',
    title: 'Owner Mailing & Occupancy',
    icon: <Mail size={14} />,
    fields: [
      { key: 'Owner Mailing Address', label: 'Owner Mailing Address', type: 'text', colSpan: 2 },
      { key: 'Owner Type', label: 'Owner Type', type: 'text' },
      { key: 'Owner Mailing City', label: 'Owner Mailing City', type: 'text' },
      { key: 'Owner Mailing State', label: 'Owner Mailing State', type: 'text' },
      { key: 'Owner Mailing Zip', label: 'Owner Mailing Zip', type: 'numeric' },
      { key: 'Ownership Length (Months)', label: 'Ownership Length (Months)', type: 'numeric' },
      { key: 'Owner Occupied', label: 'Owner Occupied', type: 'numeric' },
      { key: 'Vacant?', label: 'Vacant?', type: 'numeric' },
    ],
  },
  {
    id: 'valuation',
    title: 'Valuation & Equity',
    icon: <DollarSign size={14} />,
    fields: [
      { key: 'Estimated Value', label: 'Estimated Value', type: 'currency' },
      { key: 'Estimated Equity Percent', label: 'Estimated Equity Percent', type: 'numeric' },
      { key: 'Estimated Equity', label: 'Estimated Equity', type: 'currency' },
      { key: 'Market Value', label: 'Market Value', type: 'currency' },
      { key: 'Market Land Value', label: 'Market Land Value', type: 'currency' },
      { key: 'Market Improvement Value', label: 'Market Improvement Value', type: 'currency' },
      { key: 'Market Improvement Percentage', label: 'Market Improvement Percentage', type: 'text' },
      { key: 'My Estimated Offer', label: 'My Estimated Offer', type: 'currency' },
    ],
  },
  {
    id: 'mortgage',
    title: 'Sale & Mortgage Details',
    icon: <Landmark size={14} />,
    fields: [
      { key: 'Last Sale Date', label: 'Last Sale Date', type: 'date' },
      { key: 'Last Sale Amount', label: 'Last Sale Amount', type: 'currency' },
      { key: 'Open Mortgage Balance', label: 'Open Mortgage Balance', type: 'currency' },
      { key: 'Recorded Mortgage Interest Rate', label: 'Recorded Mortgage Interest Rate', type: 'text' },
      { key: 'Mortgage Document Date', label: 'Mortgage Document Date', type: 'date' },
      { key: 'Mortgage Loan Type', label: 'Mortgage Loan Type', type: 'text' },
      { key: 'Lender Name', label: 'Lender Name', type: 'text' },
      { key: 'Deed Type', label: 'Deed Type', type: 'text' },
      { key: 'Position', label: 'Position', type: 'text' },
    ],
  },
  {
    id: 'tax',
    title: 'Tax & Assessment',
    icon: <FileText size={14} />,
    fields: [
      { key: 'Tax Amount', label: 'Tax Amount', type: 'currency' },
      { key: 'Assessment Year', label: 'Assessment Year', type: 'numeric' },
      { key: 'Assessed Total Value', label: 'Assessed Total Value', type: 'currency' },
      { key: 'Assessed Land Value', label: 'Assessed Land Value', type: 'currency' },
      { key: 'Assessed Improvement Value', label: 'Assessed Improvement Value', type: 'currency' },
      { key: 'Assessed Improvement Percentage', label: 'Assessed Improvement Percentage', type: 'text' },
    ],
  },
  {
    id: 'auction',
    title: 'Foreclosure & Auction Details',
    icon: <Gavel size={14} />,
    fields: [
      { key: 'Default Amount', label: 'Default Amount', type: 'currency' },
      { key: 'Opening bid', label: 'Opening bid', type: 'numeric' },
      { key: 'Recording Date', label: 'Recording Date', type: 'date' },
      { key: 'Auction Date', label: 'Auction Date', type: 'date' },
      { key: 'Auction Time', label: 'Auction Time', type: 'text' },
      { key: 'Auction Courthouse', label: 'Auction Courthouse', type: 'text' },
      { key: 'Auction Address', label: 'Auction Address', type: 'text', colSpan: 2 },
      { key: 'Auction City State', label: 'Auction City State', type: 'text' },
    ],
  },
  {
    id: 'text-message-generator',
    title: 'Text Message Generator',
    icon: <MessageSquare size={14} />,
    fields: [],
  },
  {
    id: 'notes',
    title: 'Notes',
    icon: <StickyNote size={14} />,
    fields: [
      { key: 'Notes', label: 'Notes', type: 'textarea', colSpan: 3 },
    ],
  },
  {
    id: 'metadata',
    title: 'Record Metadata',
    icon: <Database size={14} />,
    fields: [
      { key: 'id', label: 'id', type: 'readonly' },
      { key: 'created_at', label: 'created_at', type: 'text' },
    ],
  },
];

export const OffMarketPropertyModal: React.FC<OffMarketPropertyModalProps> = ({
  property,
  initialTemplates,
  onSaveTemplates,
  onPropertyUpdated,
  onClose,
  onSave,
  onDelete,
  onMoveToNotInterested,
  onRestore,
  onToggleInterested,
  onAddToList,
  onLocateOnMap,
  onNavigate,
  hasPrevious = false,
  hasNext = false,
}) => {
  const currentUser = useAppStore((s) => s.currentUser);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [fieldSearch, setFieldSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isTogglingInterested, setIsTogglingInterested] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedField, setCopiedField] = useState<
    'property' | 'mailing' | 'textMessage' | 'phone-1' | 'phone-2' | 'phone-3' | 'phone-4' | null
  >(null);

  const [selectedOwner, setSelectedOwner] = useState<1 | 2 | 3 | 4>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('Text Template 1');
  const [templatesConfig, setTemplatesConfig] = useState<TextMessageTemplatesConfig>(() => ({
    ...DEFAULT_TEXT_MESSAGE_TEMPLATES,
    ...(initialTemplates || {}),
  }));
  const [textMessageText, setTextMessageText] = useState('');
  const [isTextMessageSent, setIsTextMessageSent] = useState<boolean>(
    property['Text Message Sent'] === true
  );
  const [isMarkingTextSent, setIsMarkingTextSent] = useState(false);
  const [textGeneratorError, setTextGeneratorError] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const buildTemplateContext = (ownerNum: 1 | 2 | 3 | 4, stateMap: Record<string, string>) => {
    const ownerFirstName = (stateMap[`Owner ${ownerNum} First Name`] || '').trim();
    const ownerLastName = (stateMap[`Owner ${ownerNum} Last Name`] || '').trim();
    const ownerFullName = [ownerFirstName, ownerLastName].filter(Boolean).join(' ');
    const combinedAddress = formatCombinedAddress(
      stateMap['Address'],
      stateMap['City'],
      stateMap['State'],
      stateMap['Zip']
    );
    const propertyAddress = combinedAddress || (stateMap['Address'] || '').trim();
    const rawFromForm = (stateMap['My Estimated Offer'] || '').trim();
    const rawEstimatedOffer =
      rawFromForm ||
      (property['My Estimated Offer'] !== null &&
      property['My Estimated Offer'] !== undefined &&
      property['My Estimated Offer'] !== '' &&
      !(typeof stateMap['My Estimated Offer'] === 'string' && stateMap['My Estimated Offer'] === '' && Object.keys(stateMap).length > 0)
        ? formatDollarInput(property['My Estimated Offer'])
        : '');
    const myEstimatedOffer = rawEstimatedOffer
      ? rawEstimatedOffer.startsWith('$')
        ? rawEstimatedOffer
        : `$${rawEstimatedOffer}`
      : '';
    const userFullName = (currentUser?.name || '').trim();
    const userFirstName = userFullName ? userFullName.split(/\s+/)[0] : '';

    return {
      ownerFirstName,
      ownerLastName,
      ownerFullName,
      propertyAddress,
      myEstimatedOffer,
      userFirstName,
      userFullName,
    };
  };

  useEffect(() => {
    const initial: Record<string, string> = {};
    SECTIONS.forEach((section) => {
      section.fields.forEach((f) => {
        const val = property[f.key];
        if (val === null || val === undefined || val === '') {
          initial[f.key] = '';
        } else if (f.type === 'currency') {
          initial[f.key] = formatDollarInput(val);
        } else if (f.type === 'date') {
          initial[f.key] = normalizeToIsoDate(val) ?? '';
        } else if (f.key === 'Notes') {
          if (typeof val === 'string') {
            initial[f.key] = val;
          } else if (Array.isArray(val)) {
            initial[f.key] = val.join('\n');
          } else {
            initial[f.key] = JSON.stringify(val);
          }
        } else {
          initial[f.key] = String(val);
        }
      });
    });

    const localTemplates = loadLocalTextTemplates();
    const resolvedTemplates: TextMessageTemplatesConfig = {
      ...DEFAULT_TEXT_MESSAGE_TEMPLATES,
      ...(initialTemplates || localTemplates || parseTextTemplatesConfig(property['Text Message Templates']) || {}),
    };

    let nextOwner: 1 | 2 | 3 | 4 = 1;
    let nextTemplate: TemplateKey = 'Text Template 1';
    let initialGeneratedText = '';

    const savedGen = property['Text Message Generator'];
    if (typeof savedGen === 'string' && savedGen.trim() !== '') {
      initialGeneratedText = savedGen;
    } else if (savedGen && typeof savedGen === 'object') {
      const obj = savedGen as { message?: string; selectedOwner?: number; selectedTemplate?: number };
      if (obj.selectedOwner && [1, 2, 3, 4].includes(obj.selectedOwner)) {
        nextOwner = obj.selectedOwner as 1 | 2 | 3 | 4;
      }
      if (obj.selectedTemplate && [1, 2, 3, 4].includes(obj.selectedTemplate)) {
        nextTemplate = `Text Template ${obj.selectedTemplate}` as TemplateKey;
      }
      if (typeof obj.message === 'string' && obj.message.trim() !== '') {
        initialGeneratedText = obj.message;
      }
    }

    if (!initialGeneratedText) {
      initialGeneratedText = renderTextMessageTemplate(
        resolvedTemplates[nextTemplate],
        buildTemplateContext(nextOwner, initial)
      );
    }

    setFormState(initial);
    setTemplatesConfig(resolvedTemplates);
    setSelectedOwner(nextOwner);
    setSelectedTemplate(nextTemplate);
    setTextMessageText(initialGeneratedText);
    setIsTextMessageSent(property['Text Message Sent'] === true);
    setTextGeneratorError(null);
    setIsTemplateModalOpen(false);
    setSaveError(null);
    setSaveSuccess(false);
    setConfirmDelete(false);
    setIsMoveMenuOpen(false);
  }, [property]);

  useEffect(() => {
    if (!initialTemplates) return;
    setTemplatesConfig({
      ...DEFAULT_TEXT_MESSAGE_TEMPLATES,
      ...initialTemplates,
    });
  }, [initialTemplates]);

  useEffect(() => {
    if (!isMoveMenuOpen) return;
    const handleWindowClick = () => setIsMoveMenuOpen(false);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [isMoveMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTemplateModalOpen) {
          setIsTemplateModalOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isTemplateModalOpen]);

  const fullPropertyAddress = useMemo(
    () =>
      formatCombinedAddress(
        formState['Address'],
        formState['City'],
        formState['State'],
        formState['Zip']
      ),
    [formState]
  );

  const fullOwnerMailingAddress = useMemo(
    () =>
      formatCombinedAddress(
        formState['Owner Mailing Address'],
        formState['Owner Mailing City'],
        formState['Owner Mailing State'],
        formState['Owner Mailing Zip']
      ),
    [formState]
  );

  const handleCopyAddress = (
    type: 'property' | 'mailing' | 'textMessage' | 'phone-1' | 'phone-2' | 'phone-3' | 'phone-4',
    value: string
  ) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopiedField(type);
    setTimeout(() => {
      setCopiedField((prev) => (prev === type ? null : prev));
    }, 1500);
  };

  const handleSelectOwnerForText = (ownerNum: 1 | 2 | 3 | 4) => {
    setSelectedOwner(ownerNum);
    const generated = renderTextMessageTemplate(
      templatesConfig[selectedTemplate],
      buildTemplateContext(ownerNum, formState)
    );
    setTextMessageText(generated);
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleSelectTemplateForText = (tplKey: TemplateKey) => {
    setSelectedTemplate(tplKey);
    const generated = renderTextMessageTemplate(
      templatesConfig[tplKey],
      buildTemplateContext(selectedOwner, formState)
    );
    setTextMessageText(generated);
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleMarkTextMessageSent = async () => {
    setIsMarkingTextSent(true);
    setTextGeneratorError(null);
    const nextSent = !isTextMessageSent;
    try {
      const nextGeneratorVal = textMessageText.trim() === '' ? null : textMessageText;
      const updatePayload: Record<string, any> = {
        'Text Message Sent': nextSent,
      };
      if (nextSent) {
        updatePayload['Text Message Generator'] = nextGeneratorVal;
      }

      const { data, error } = await supabase
        .from('OffMarketProperties')
        .update(updatePayload)
        .eq('id', property.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to update Text Message Sent in Supabase.');
      }

      const saved = (data as OffMarketProperty) || {
        ...property,
        ...updatePayload,
      };
      setIsTextMessageSent(nextSent);
      onPropertyUpdated?.(saved);
    } catch (err: any) {
      setTextGeneratorError(err?.message || 'Failed to update Text Message Sent.');
    } finally {
      setIsMarkingTextSent(false);
    }
  };

  const handleSaveTemplates = async (updatedTemplates: TextMessageTemplatesConfig) => {
    if (onSaveTemplates) {
      await onSaveTemplates(updatedTemplates);
    } else {
      const dbPayload = {
        'Text Message Template 1': updatedTemplates['Text Template 1'],
        'Text Message Template 2': updatedTemplates['Text Template 2'],
        'Text Message Template 3': updatedTemplates['Text Template 3'],
        'Text Message Template 4': updatedTemplates['Text Template 4'],
      };

      const { data: existingRows, error: lookupError } = await supabase
        .from('OffMarketOfferTextMessageGenerator')
        .select('id')
        .order('id', { ascending: true })
        .limit(1);

      if (lookupError) {
        throw new Error(lookupError.message || 'Failed to read OffMarketOfferTextMessageGenerator.');
      }

      const existingId =
        existingRows && existingRows.length > 0 && typeof existingRows[0].id === 'number'
          ? existingRows[0].id
          : null;

      const { error } =
        existingId !== null
          ? await supabase
              .from('OffMarketOfferTextMessageGenerator')
              .update(dbPayload)
              .eq('id', existingId)
              .select()
              .single()
          : await supabase
              .from('OffMarketOfferTextMessageGenerator')
              .insert(dbPayload)
              .select()
              .single();

      if (error) {
        throw new Error(
          error.message || 'Failed to save templates to OffMarketOfferTextMessageGenerator.'
        );
      }

      saveLocalTextTemplates(updatedTemplates);
    }

    setTemplatesConfig(updatedTemplates);

    const regenerated = renderTextMessageTemplate(
      updatedTemplates[selectedTemplate],
      buildTemplateContext(selectedOwner, formState)
    );
    setTextMessageText(regenerated);
  };

  const filteredSections = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) {
      return SECTIONS.map((section) => ({
        ...section,
        showFullAddress: section.id === 'location',
        showFullMailingAddress: section.id === 'mailing',
        showTextGenerator: section.id === 'text-message-generator',
      }));
    }
    return SECTIONS.map((section) => {
      const showFullAddress =
        section.id === 'location' &&
        ('full address'.includes(q) || fullPropertyAddress.toLowerCase().includes(q));
      const showFullMailingAddress =
        section.id === 'mailing' &&
        ('full owner mailing address'.includes(q) ||
          fullOwnerMailingAddress.toLowerCase().includes(q));
      const showTextGenerator =
        section.id === 'text-message-generator' &&
        ('text message generator'.includes(q) ||
          'text message sent'.includes(q) ||
          'text message templates'.includes(q) ||
          'owner 1 owner 2 owner 3 owner 4'.includes(q) ||
          'text template 1 text template 2 text template 3 text template 4'.includes(q) ||
          textMessageText.toLowerCase().includes(q));

      return {
        ...section,
        showFullAddress,
        showFullMailingAddress,
        showTextGenerator,
        fields: section.fields.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            (formState[f.key] || '').toLowerCase().includes(q)
        ),
      };
    }).filter(
      (s) =>
        s.fields.length > 0 ||
        s.showFullAddress ||
        s.showFullMailingAddress ||
        s.showTextGenerator
    );
  }, [fieldSearch, formState, fullPropertyAddress, fullOwnerMailingAddress, textMessageText]);

  const handleFieldChange = (key: keyof OffMarketProperty, value: string) => {
    const next = { ...formState, [key]: value };
    setFormState(next);
    if (
      key === 'My Estimated Offer' ||
      key === 'Address' ||
      key === 'City' ||
      key === 'State' ||
      key === 'Zip' ||
      key.startsWith('Owner ')
    ) {
      const activeTemplateStr = templatesConfig[selectedTemplate] || '';
      const shouldAutoRefresh =
        !property['Text Message Generator'] ||
        activeTemplateStr.toLowerCase().includes('{my estimated offer}');
      if (shouldAutoRefresh) {
        setTextMessageText(
          renderTextMessageTemplate(activeTemplateStr, buildTemplateContext(selectedOwner, next))
        );
      }
    }
    if (saveSuccess) setSaveSuccess(false);
    if (saveError) setSaveError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const payload: Record<string, any> = { id: property.id };

      for (const section of SECTIONS) {
        for (const field of section.fields) {
          if (field.key === 'id') continue;
          const raw = (formState[field.key] ?? '').trim();

          if (field.key === 'created_at') {
            if (raw) payload[field.key] = raw;
            continue;
          }

          if (NUMERIC_OFF_MARKET_COLUMNS.has(field.key)) {
            if (raw === '') {
              payload[field.key] = null;
            } else {
              const cleaned = raw.replace(/[$,%\s,]/g, '');
              const parsed = Number(cleaned);
              if (Number.isNaN(parsed)) {
                throw new Error(`"${field.label}" must be a valid number.`);
              }
              payload[field.key] = parsed;
            }
          } else if (DATE_OFF_MARKET_COLUMNS.has(field.key)) {
            if (raw === '') {
              payload[field.key] = null;
            } else {
              const iso = normalizeToIsoDate(raw);
              if (!iso) {
                throw new Error(`"${field.label}" must be a valid date (YYYY-MM-DD).`);
              }
              payload[field.key] = iso;
            }
          } else if (field.type === 'currency') {
            const formatted = formatDollarInput(raw);
            payload[field.key] = formatted === '' ? null : `$${formatted}`;
          } else {
            payload[field.key] = raw === '' ? null : raw;
          }
        }
      }

      payload['Text Message Generator'] = textMessageText.trim() === '' ? null : textMessageText;

      await onSave(payload as OffMarketProperty);
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save property changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const isTrashed = property['Trash'] === true;
  const isNotInterested = property['Not Interested'] === true && !isTrashed;

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    setSaveError(null);
    try {
      await onDelete(property.id);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to move property to Trash.');
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleMoveToNotInterestedClick = async () => {
    if (!onMoveToNotInterested) return;
    setIsDeleting(true);
    setSaveError(null);
    try {
      await onMoveToNotInterested(property.id);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to move property to Not Interested.');
      setIsDeleting(false);
    }
  };

  const handleRestoreClick = async () => {
    if (!onRestore) return;
    setIsRestoring(true);
    setSaveError(null);
    try {
      await onRestore(property.id);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to restore property.');
      setIsRestoring(false);
    }
  };

  const handleToggleInterestedClick = async () => {
    if (!onToggleInterested) return;
    setIsTogglingInterested(true);
    setSaveError(null);
    try {
      await onToggleInterested(property);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update Interested status.');
    } finally {
      setIsTogglingInterested(false);
    }
  };

  const fullAddress = [
    formState['Address'],
    formState['City'],
    formState['State'],
    formState['Zip'],
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0B1220] border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 flex flex-col gap-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {formState['Address'] || `Off-Market Property #${property.id}`}
                </h2>
                {formState['Status'] && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {formState['Status']}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {[formState['City'], formState['State'], formState['Zip']]
                  .filter(Boolean)
                  .join(', ') || 'No city/state/zip recorded'}
                {formState['County'] ? ` • ${formState['County']} County` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onNavigate && (
                <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                  <button
                    type="button"
                    disabled={!hasPrevious}
                    onClick={() => onNavigate('prev')}
                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                    title="Previous Property"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => onNavigate('next')}
                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors border-l border-gray-300 dark:border-gray-700"
                    title="Next Property"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {onToggleInterested && (
                <button
                  type="button"
                  disabled={isTogglingInterested || isDeleting}
                  onClick={handleToggleInterestedClick}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
                    property['Interested'] === true
                      ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={property['Interested'] === true ? 'Remove from Interested' : 'Mark as Interested'}
                >
                  {isTogglingInterested ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Star
                      size={14}
                      className={
                        property['Interested'] === true
                          ? 'fill-amber-400 text-amber-500 dark:text-amber-400'
                          : 'text-gray-400'
                      }
                    />
                  )}
                  <span>Interested</span>
                </button>
              )}

              {onAddToList && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => onAddToList(property)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
                    normalizeOffMarketLists(property['Off Market List']).length > 0
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Add To List"
                >
                  <ListPlus size={14} className="text-blue-500" />
                  <span>Add To List</span>
                  {normalizeOffMarketLists(property['Off Market List']).length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-800/80 text-blue-700 dark:text-blue-200 text-[10px] font-mono">
                      {normalizeOffMarketLists(property['Off Market List']).length}
                    </span>
                  )}
                </button>
              )}

              {onLocateOnMap && fullAddress && (
                <button
                  type="button"
                  onClick={() => {
                    onLocateOnMap(fullAddress);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                  title="Locate on Map"
                >
                  <MapPin size={14} className="text-blue-500" />
                  <span className="hidden sm:inline">Locate</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-60 transition-colors"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Search Fields Filter Bar */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="Filter fields by column name or value..."
              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 pl-8 pr-8 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 outline-none"
            />
            {fieldSearch && (
              <button
                type="button"
                onClick={() => setFieldSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Property saved to OffMarketProperties.</span>
            </div>
          )}
        </div>

        {/* Scrollable Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-6 bg-white dark:bg-[#0B1220]"
        >
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
              No fields match &ldquo;{fieldSearch}&rdquo;.
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.id} className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                  <span className="text-blue-500">{section.icon}</span>
                  {section.title}
                </h3>

                {section.id === 'owners' ? (
                  <div className="bg-gray-50 dark:bg-[#172235]/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700/60 divide-y divide-gray-200 dark:divide-gray-700/60">
                    {[1, 2, 3, 4].map((ownerNum) => {
                      const prefix = `Owner ${ownerNum} `;
                      const ownerFields = section.fields.filter((f) => f.key.startsWith(prefix));
                      if (ownerFields.length === 0) return null;

                      const nameFields = ownerFields.filter(
                        (f) => f.key.endsWith('First Name') || f.key.endsWith('Last Name')
                      );
                      const phoneFields = ownerFields.filter((f) => f.key.includes('Phone Number'));

                      return (
                        <div
                          key={`owner-group-${ownerNum}`}
                          className="first:pt-0 pt-5 first:mt-0 pb-5 last:pb-0 space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-blue-500" />
                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                              Owner {ownerNum}
                            </h4>
                          </div>

                          {nameFields.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {nameFields.map((field) => (
                                <div key={field.key}>
                                  <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">
                                    {field.label}
                                  </label>
                                  <input
                                    type="text"
                                    value={formState[field.key] ?? ''}
                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                    className="w-full rounded-lg p-2 text-sm border outline-none transition-colors bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {phoneFields.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {phoneFields.map((field) => (
                                <div key={field.key}>
                                  <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">
                                    {field.label}
                                  </label>
                                  <input
                                    type="text"
                                    value={formState[field.key] ?? ''}
                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                    className="w-full rounded-lg p-2 text-sm border outline-none transition-colors bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : section.id === 'text-message-generator' ? (
                  <div className="bg-gray-50 dark:bg-[#172235]/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700/60 space-y-4">
                    {/* Top Row: Owner 1 - Owner 4 */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                        Select Owner
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([1, 2, 3, 4] as const).map((ownerNum) => {
                          const ownerName = [
                            formState[`Owner ${ownerNum} First Name`],
                            formState[`Owner ${ownerNum} Last Name`],
                          ]
                            .filter(Boolean)
                            .join(' ')
                            .trim();
                          const isSelected = selectedOwner === ownerNum;

                          return (
                            <button
                              key={`tmg-owner-${ownerNum}`}
                              type="button"
                              onClick={() => handleSelectOwnerForText(ownerNum)}
                              className={`px-3 py-2 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div className="text-xs font-bold">Owner {ownerNum}</div>
                              <div
                                className={`text-[11px] truncate ${
                                  isSelected
                                    ? 'text-blue-100'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {ownerName || 'No name'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Owner Phone Numbers 1 - 4 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {([1, 2, 3, 4] as const).map((phoneNum) => {
                        const phoneKey = `Owner ${selectedOwner} Phone Number ${phoneNum}`;
                        const rawPropVal = (property as Record<string, any>)[phoneKey];
                        const phoneVal =
                          phoneNum <= 3
                            ? (formState[phoneKey] ?? '').trim()
                            : String(formState[phoneKey] ?? rawPropVal ?? '').trim();
                        const copyKey = `phone-${phoneNum}` as
                          | 'phone-1'
                          | 'phone-2'
                          | 'phone-3'
                          | 'phone-4';

                        return (
                          <div key={`tmg-phone-${phoneNum}`}>
                            <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                              Phone Number {phoneNum}
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                readOnly
                                value={phoneVal}
                                placeholder="No phone"
                                onClick={(e) => {
                                  if (phoneVal) {
                                    (e.target as HTMLInputElement).select();
                                  }
                                }}
                                className="w-full rounded-lg p-2 pr-8 text-xs font-medium border outline-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                              />
                              {phoneVal && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyAddress(copyKey, phoneVal)}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                                  title={`Copy Owner ${selectedOwner} Phone Number ${phoneNum}`}
                                >
                                  {copiedField === copyKey ? (
                                    <Check size={13} className="text-emerald-500" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Second Row: Text Template 1 - Text Template 4 */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                        Select Template
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {TEMPLATE_KEYS.map((tplKey) => {
                          const isSelected = selectedTemplate === tplKey;
                          return (
                            <button
                              key={`tmg-tpl-${tplKey}`}
                              type="button"
                              onClick={() => handleSelectTemplateForText(tplKey)}
                              className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all text-center ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {tplKey}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons: Edit Text Message Templates & Text Message Sent */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 size={13} className="text-blue-500" />
                        <span>Edit Text Message Templates</span>
                      </button>

                      <button
                        type="button"
                        disabled={isMarkingTextSent || isSaving || isDeleting}
                        onClick={handleMarkTextMessageSent}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5 disabled:opacity-60 transition-colors ${
                          isTextMessageSent
                            ? 'border-emerald-500 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {isMarkingTextSent ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2
                            size={13}
                            className={
                              isTextMessageSent
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-400'
                            }
                          />
                        )}
                        <span>Text Message Sent</span>
                      </button>
                    </div>

                    {textGeneratorError && (
                      <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{textGeneratorError}</span>
                      </div>
                    )}

                    {/* Auto-Generated Seller Text Message Box */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                          Auto-Generated Seller Text Message
                        </label>
                        {textMessageText && (
                          <button
                            type="button"
                            onClick={() => handleCopyAddress('textMessage', textMessageText)}
                            className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                            title="Copy Text Message"
                          >
                            {copiedField === 'textMessage' ? (
                              <>
                                <Check size={12} className="text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={4}
                        value={textMessageText}
                        onChange={(e) => {
                          setTextMessageText(e.target.value);
                          if (saveSuccess) setSaveSuccess(false);
                        }}
                        placeholder="Select an owner and template above to generate a seller text message..."
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none resize-y"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-[#172235]/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {section.showFullAddress && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">
                          Full Address
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            value={fullPropertyAddress}
                            placeholder="Automatically combined from Address, City, State, and Zip"
                            className="w-full rounded-lg p-2 pr-9 text-sm border outline-none bg-gray-100/80 dark:bg-gray-900/70 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                          />
                          {fullPropertyAddress && (
                            <button
                              type="button"
                              onClick={() => handleCopyAddress('property', fullPropertyAddress)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                              title="Copy Full Address"
                            >
                              {copiedField === 'property' ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {section.showFullMailingAddress && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">
                          Full Owner Mailing Address
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            value={fullOwnerMailingAddress}
                            placeholder="Automatically combined from Owner Mailing Address, City, State, and Zip"
                            className="w-full rounded-lg p-2 pr-9 text-sm border outline-none bg-gray-100/80 dark:bg-gray-900/70 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium"
                          />
                          {fullOwnerMailingAddress && (
                            <button
                              type="button"
                              onClick={() => handleCopyAddress('mailing', fullOwnerMailingAddress)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                              title="Copy Full Owner Mailing Address"
                            >
                              {copiedField === 'mailing' ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {section.fields.map((field) => {
                      const spanClass =
                        field.colSpan === 3
                          ? 'sm:col-span-2 lg:col-span-3'
                          : field.colSpan === 2
                            ? 'sm:col-span-2'
                            : '';

                      const isEstimatedOffer = field.key === 'My Estimated Offer';

                      return (
                        <div key={field.key} className={spanClass}>
                          <label
                            className={`text-xs block mb-1 ${
                              isEstimatedOffer
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-gray-600 dark:text-gray-400 font-medium'
                            }`}
                          >
                            {field.label}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              rows={field.key === 'Notes' ? 5 : 2}
                              placeholder={field.key === 'Notes' ? 'Add notes about this property...' : undefined}
                              value={formState[field.key] ?? ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none resize-y"
                            />
                          ) : field.type === 'currency' ? (
                            <div className="relative">
                              <span
                                className={`absolute left-2.5 top-2 text-sm ${
                                  isEstimatedOffer
                                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'text-gray-400'
                                }`}
                              >
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={formState[field.key] ?? ''}
                                onChange={(e) => handleFieldChange(field.key, formatDollarInput(e.target.value))}
                                className={`w-full rounded-lg p-2 pl-6 text-sm border outline-none transition-colors bg-white dark:bg-gray-800 ${
                                  isEstimatedOffer
                                    ? 'border-emerald-500 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 focus:border-emerald-400 font-semibold'
                                    : 'border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500'
                                }`}
                              />
                            </div>
                          ) : field.type === 'date' ? (
                            <input
                              type="date"
                              value={formState[field.key] ?? ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full rounded-lg p-2 text-sm border outline-none transition-colors bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500"
                            />
                          ) : (
                            <input
                              type="text"
                              inputMode={field.type === 'numeric' ? 'decimal' : 'text'}
                              disabled={field.type === 'readonly'}
                              value={formState[field.key] ?? ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className={`w-full rounded-lg p-2 text-sm border outline-none transition-colors ${
                                field.type === 'readonly'
                                  ? 'bg-gray-100 dark:bg-gray-900/80 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-blue-500'
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-[#172235] border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {(isTrashed || isNotInterested) && onRestore && (
              <button
                type="button"
                disabled={isSaving || isDeleting || isRestoring}
                onClick={handleRestoreClick}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {isRestoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                <span>Restore</span>
              </button>
            )}
            {(onDelete || onMoveToNotInterested) && (
              confirmDelete ? (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                    Delete permanently?
                  </span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-2.5 py-1 text-xs font-bold rounded bg-red-600 hover:bg-red-500 text-white flex items-center gap-1 disabled:opacity-60 transition-colors"
                  >
                    {isDeleting && <Loader2 size={12} className="animate-spin" />}
                    <span>Yes, Delete</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-xs font-medium rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    disabled={isSaving || isDeleting || isRestoring}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMoveMenuOpen((prev) => !prev);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/70 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    <span>Delete</span>
                    <ChevronDown size={13} />
                  </button>
                  {isMoveMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 bottom-full mb-1.5 w-44 rounded-lg bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 shadow-xl py-1 z-30"
                    >
                      {onDelete && (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={async () => {
                            setIsMoveMenuOpen(false);
                            if (isTrashed) {
                              setConfirmDelete(true);
                              return;
                            }
                            await handleConfirmDelete();
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          <span>Trash</span>
                        </button>
                      )}
                      {onMoveToNotInterested && (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={async () => {
                            setIsMoveMenuOpen(false);
                            await handleMoveToNotInterestedClick();
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/70 flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <ThumbsDown size={13} />
                          <span>Not Interested</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
              Table: <span className="font-mono">OffMarketProperties</span> • ID #{property.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || isDeleting}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-60 transition-colors"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {isTemplateModalOpen && (
        <TextMessageTemplateModal
          templates={templatesConfig}
          initialTemplateKey={selectedTemplate}
          previewContext={buildTemplateContext(selectedOwner, formState)}
          onSave={handleSaveTemplates}
          onClose={() => setIsTemplateModalOpen(false)}
        />
      )}
    </div>
  );
};
