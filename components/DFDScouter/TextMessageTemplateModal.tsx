import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Eye,
  AlertCircle,
} from 'lucide-react';

export type TemplateKey =
  | 'Text Template 1'
  | 'Text Template 2'
  | 'Text Template 3'
  | 'Text Template 4';

export const TEMPLATE_KEYS: TemplateKey[] = [
  'Text Template 1',
  'Text Template 2',
  'Text Template 3',
  'Text Template 4',
];

export interface TextMessageTemplatesConfig {
  'Text Template 1': string;
  'Text Template 2': string;
  'Text Template 3': string;
  'Text Template 4': string;
  updatedAt?: string;
}

export const DEFAULT_TEXT_MESSAGE_TEMPLATES: TextMessageTemplatesConfig = {
  'Text Template 1':
    'Hi {Owner First Name}, this is {User First Name}. I noticed your property at {Property Address} and wanted to see if you might be open to a cash offer on it?',
  'Text Template 2':
    'Hello {Owner First Name}, my name is {User Full Name} and I buy houses in the area. Are you considering selling {Property Address} anytime soon?',
  'Text Template 3':
    "Hi {Owner First Name}, just following up regarding {Property Address}. We can close quickly, as-is, with no agent commissions. Let me know if you'd like to chat.",
  'Text Template 4':
    "Hi {Owner First Name}, I'm a local buyer looking for another property near {Property Address}. Would you be open to discussing an offer? - {User First Name}",
};

export const TEXT_TEMPLATE_INSERTS: { token: string; label: string }[] = [
  { token: '{Owner First Name}', label: 'Owner First Name' },
  { token: '{Owner Last Name}', label: 'Owner Last Name' },
  { token: '{Owner Full Name}', label: 'Owner Full Name' },
  { token: '{Property Address}', label: 'Property Address' },
  { token: '{My Estimated Offer}', label: 'My Estimated Offer' },
  { token: '{User First Name}', label: 'User First Name' },
  { token: '{User Full Name}', label: 'User Full Name' },
];

export const TEXT_TEMPLATES_STORAGE_KEY = 'azre_off_market_text_message_templates';

export interface TemplateRenderContext {
  ownerFirstName: string;
  ownerLastName: string;
  ownerFullName: string;
  propertyAddress: string;
  myEstimatedOffer?: string;
  userFirstName: string;
  userFullName: string;
}

export const renderTextMessageTemplate = (
  template: string,
  context: TemplateRenderContext
): string => {
  if (!template) return '';

  const replacements: Record<string, string> = {
    '{owner first name}': context.ownerFirstName.trim(),
    '{owner last name}': context.ownerLastName.trim(),
    '{owner full name}': context.ownerFullName.trim(),
    '{property address}': context.propertyAddress.trim(),
    '{my estimated offer}': (context.myEstimatedOffer || '').trim(),
    '{user first name}': context.userFirstName.trim(),
    '{user full name}': context.userFullName.trim(),
  };

  let rendered = template.replace(
    /\{(owner first name|owner last name|owner full name|property address|my estimated offer|user first name|user full name)\}/gi,
    (match) => replacements[match.toLowerCase()] ?? ''
  );

  // Clean up redundant spaces on individual lines while preserving line breaks
  rendered = rendered
    .split('\n')
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,.;!?])/g, '$1')
        .trim()
    )
    .join('\n')
    .trim();

  return rendered;
};

export const parseTextTemplatesConfig = (
  raw: unknown
): TextMessageTemplatesConfig | null => {
  if (!raw) return null;

  let parsed: any = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (Array.isArray(parsed)) {
    return {
      'Text Template 1':
        typeof parsed[0] === 'string'
          ? parsed[0]
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 1'],
      'Text Template 2':
        typeof parsed[1] === 'string'
          ? parsed[1]
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 2'],
      'Text Template 3':
        typeof parsed[2] === 'string'
          ? parsed[2]
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 3'],
      'Text Template 4':
        typeof parsed[3] === 'string'
          ? parsed[3]
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 4'],
    };
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const hasAnyKey = TEMPLATE_KEYS.some((k) => typeof parsed[k] === 'string');
    if (!hasAnyKey) return null;
    return {
      'Text Template 1':
        typeof parsed['Text Template 1'] === 'string'
          ? parsed['Text Template 1']
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 1'],
      'Text Template 2':
        typeof parsed['Text Template 2'] === 'string'
          ? parsed['Text Template 2']
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 2'],
      'Text Template 3':
        typeof parsed['Text Template 3'] === 'string'
          ? parsed['Text Template 3']
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 3'],
      'Text Template 4':
        typeof parsed['Text Template 4'] === 'string'
          ? parsed['Text Template 4']
          : DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 4'],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  }

  return null;
};

const extractTemplateString = (val: unknown, fallback: string): string => {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.template === 'string') return obj.template;
  }
  return fallback;
};

export const parseTemplatesFromGeneratorRow = (
  row: Record<string, any> | null | undefined
): TextMessageTemplatesConfig | null => {
  if (!row || typeof row !== 'object') return null;

  const hasAnyColumn = [1, 2, 3, 4].some(
    (n) => row[`Text Message Template ${n}`] !== undefined && row[`Text Message Template ${n}`] !== null
  );
  if (!hasAnyColumn) return null;

  return {
    'Text Template 1': extractTemplateString(
      row['Text Message Template 1'],
      DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 1']
    ),
    'Text Template 2': extractTemplateString(
      row['Text Message Template 2'],
      DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 2']
    ),
    'Text Template 3': extractTemplateString(
      row['Text Message Template 3'],
      DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 3']
    ),
    'Text Template 4': extractTemplateString(
      row['Text Message Template 4'],
      DEFAULT_TEXT_MESSAGE_TEMPLATES['Text Template 4']
    ),
    updatedAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
};

export const loadLocalTextTemplates = (): TextMessageTemplatesConfig | null => {
  try {
    const raw = localStorage.getItem(TEXT_TEMPLATES_STORAGE_KEY);
    if (!raw) return null;
    return parseTextTemplatesConfig(raw);
  } catch {
    return null;
  }
};

export const saveLocalTextTemplates = (config: TextMessageTemplatesConfig): void => {
  try {
    localStorage.setItem(TEXT_TEMPLATES_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
};

interface TextMessageTemplateModalProps {
  templates: TextMessageTemplatesConfig;
  initialTemplateKey?: TemplateKey;
  previewContext: TemplateRenderContext;
  onSave: (updated: TextMessageTemplatesConfig) => Promise<void>;
  onClose: () => void;
}

export const TextMessageTemplateModal: React.FC<TextMessageTemplateModalProps> = ({
  templates,
  initialTemplateKey = 'Text Template 1',
  previewContext,
  onSave,
  onClose,
}) => {
  const [drafts, setDrafts] = useState<TextMessageTemplatesConfig>(() => ({
    ...DEFAULT_TEXT_MESSAGE_TEMPLATES,
    ...templates,
  }));
  const [activeTab, setActiveTab] = useState<TemplateKey>(initialTemplateKey);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDrafts({
      ...DEFAULT_TEXT_MESSAGE_TEMPLATES,
      ...templates,
    });
  }, [templates]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const handleInsertToken = (token: string) => {
    const el = textareaRef.current;
    const currentText = drafts[activeTab] ?? '';

    if (el) {
      const start = el.selectionStart ?? currentText.length;
      const end = el.selectionEnd ?? currentText.length;
      const nextText = currentText.slice(0, start) + token + currentText.slice(end);
      setDrafts((prev) => ({ ...prev, [activeTab]: nextText }));
      requestAnimationFrame(() => {
        el.focus();
        const cursorPos = start + token.length;
        el.setSelectionRange(cursorPos, cursorPos);
      });
    } else {
      setDrafts((prev) => ({
        ...prev,
        [activeTab]: currentText ? `${currentText} ${token}` : token,
      }));
    }
  };

  const handleResetTemplate = () => {
    setDrafts((prev) => ({
      ...prev,
      [activeTab]: DEFAULT_TEXT_MESSAGE_TEMPLATES[activeTab],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload: TextMessageTemplatesConfig = {
        'Text Template 1': drafts['Text Template 1'],
        'Text Template 2': drafts['Text Template 2'],
        'Text Template 3': drafts['Text Template 3'],
        'Text Template 4': drafts['Text Template 4'],
        updatedAt: new Date().toISOString(),
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save text message templates.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeTemplateText = drafts[activeTab] ?? '';
  const hasEstimatedOfferToken = /\{my estimated offer\}/i.test(activeTemplateText);
  const isEstimatedOfferMissing = !(previewContext.myEstimatedOffer || '').trim();
  const previewText = renderTextMessageTemplate(activeTemplateText, {
    ...previewContext,
    myEstimatedOffer:
      (previewContext.myEstimatedOffer || '').trim() || '[My Estimated Offer]',
  });

  return (
    <div
      className="fixed inset-0 z-[160] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white dark:bg-[#0B1220] border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-[#172235] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MessageSquare size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                Text Message Template Editor
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Create or edit reusable seller SMS templates with dynamic inserts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Template Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TEMPLATE_KEYS.map((key) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                    isActive
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {key}
                </button>
              );
            })}
          </div>

          {/* Clickable Inserts Toolbar */}
          <div className="bg-gray-50 dark:bg-[#172235]/60 rounded-xl p-3 border border-gray-200 dark:border-gray-700/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Click to Insert Placeholder
              </span>
              <button
                type="button"
                onClick={handleResetTemplate}
                className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                title={`Reset ${activeTab} to default`}
              >
                <RotateCcw size={11} />
                <span>Reset Default</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_TEMPLATE_INSERTS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => handleInsertToken(item.token)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex items-center gap-1 transition-colors"
                >
                  <Plus size={11} />
                  <span>{item.token}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template Textarea */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
              {activeTab} Content
            </label>
            <textarea
              ref={textareaRef}
              rows={5}
              value={drafts[activeTab] ?? ''}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [activeTab]: e.target.value }))
              }
              placeholder="Write your seller text message template here using inserts like {Owner First Name}, {Property Address}, {User First Name}..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none resize-y"
            />
          </div>

          {/* Live Preview */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Eye size={12} />
              <span>Live Preview</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {previewText || 'Preview will appear here as you type...'}
            </p>
            {hasEstimatedOfferToken && isEstimatedOfferMissing && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
                Note: &ldquo;My Estimated Offer&rdquo; is currently empty on this property. Enter an amount in Valuation &amp; Equity to populate it.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-[#172235] border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-60 transition-colors"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isSaving ? 'Saving...' : 'Save Templates'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
