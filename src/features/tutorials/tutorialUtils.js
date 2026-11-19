import { getRuleLogo } from './logoConfig';

const VALID_ALIGNMENTS = ['left', 'center', 'right'];

/**
 * Normalize a slide text-alignment value with a safe default.
 * @param {string | undefined | null} align
 * @param {'left' | 'center' | 'right'} fallback
 * @returns {'left' | 'center' | 'right'}
 */
export const normalizeTextAlign = (align, fallback = 'center') => {
  return VALID_ALIGNMENTS.includes(align) ? align : fallback;
};

/**
 * Map a text-alignment value to the global utility class in globalTheme.css.
 * @param {string | undefined | null} align
 * @param {'left' | 'center' | 'right'} fallback
 * @returns {'u-text-left' | 'u-text-center' | 'u-text-right'}
 */
export const getTextAlignClass = (align, fallback = 'center') => {
  const normalized = normalizeTextAlign(align, fallback);
  if (normalized === 'left') return 'u-text-left';
  if (normalized === 'right') return 'u-text-right';
  return 'u-text-center';
};

/**
 * Parse a rule's content into individual tutorial slides.
 * Only splits pages on explicit ---PAGE_BREAK--- delimiters added manually by the user.
 * Hydrates per-slide textAlign from optional slideAlignments array (stored in employee_rules.metadata).
 *
 * @param {string} title
 * @param {string} content
 * @param {Array<string>} [slideAlignments]
 */
export const parseRuleSlides = (title, content = '', slideAlignments = []) => {
  const trimmedContent = (content || '').replace(/^\s*\n+|\n+\s*$/g, '');
  const alignments = Array.isArray(slideAlignments) ? slideAlignments : [];

  if (!trimmedContent.includes('---PAGE_BREAK---')) {
    return [
      {
        title: title,
        text: trimmedContent,
        textAlign: normalizeTextAlign(alignments[0], 'center'),
        isIntro: true
      }
    ];
  }

  const rawPages = trimmedContent.split(/\n?---PAGE_BREAK---\n?/);
  return rawPages.map((pageContent, index) => {
    const trimmedPage = pageContent.replace(/^\s*\n+|\n+\s*$/g, '');
    const lines = trimmedPage.split('\n');
    let slideTitle = index === 0 ? title : `Page ${index + 1}`;
    let slideText = trimmedPage;

    if (lines[0]?.trim().startsWith('### ')) {
      slideTitle = lines[0].trim().substring(4).trim() || slideTitle;
      slideText = lines.slice(1).join('\n').replace(/^\s*\n+|\n+\s*$/g, '');
    }

    return {
      title: slideTitle,
      text: slideText,
      textAlign: normalizeTextAlign(alignments[index], 'center'),
      isIntro: index === 0
    };
  });
};

/**
 * Shared builder converting an employee_rules DB row into a TutorialSlideshowViewer flow object.
 * Used by both TutorialHub.jsx and App.jsx so auto-played login tutorials and hub tutorials
 * stay 100% synchronized (including metadata & per-slide textAlign).
 *
 * @param {object} rule
 */
export const buildRuleFlow = (rule) => {
  const ruleMetadata = rule?.metadata && typeof rule.metadata === 'object' ? rule.metadata : {};
  const parsedSlides = parseRuleSlides(
    rule.title,
    rule.content || '',
    ruleMetadata.slideAlignments
  );

  const flowSlides = parsedSlides.map((slide, idx) => {
    const imgPath = getRuleLogo(rule.title, idx);
    return {
      image: imgPath,
      fallbackImage: imgPath,
      title: slide.isIntro ? rule.title : slide.title,
      text: slide.text,
      textAlign: slide.textAlign,
      annotations: []
    };
  });

  return {
    id: `rule_${rule.id}`,
    title: rule.title,
    category: rule.category?.name || 'Rules & Regulations',
    category_id: rule.category_id,
    content: rule.content,
    metadata: ruleMetadata,
    description: rule.impact || `Interactive guidelines detailing ${rule.title}.`,
    accessLevel: 'All Users',
    layout: 'onboarding',
    desktopSlides: flowSlides,
    mobileSlides: flowSlides
  };
};

/**
 * Wrap the currently selected range in a textarea with prefix/suffix markers
 * (or toggle them off if already wrapped), then restore focus and selection.
 */
export const applyWrapFormat = ({ value, onChange, textareaRef, prefix, suffix = prefix, placeholder = 'text' }) => {
  const el = textareaRef?.current;
  const text = value || '';

  if (!el) {
    onChange(`${text}${prefix}${placeholder}${suffix}`);
    return;
  }

  const start = el.selectionStart ?? text.length;
  const end = el.selectionEnd ?? text.length;
  const selected = text.slice(start, end);

  // If already wrapped immediately around selection, unwrap (toggle off)
  const before = text.slice(Math.max(0, start - prefix.length), start);
  const after = text.slice(end, end + suffix.length);

  let nextText;
  let nextStart;
  let nextEnd;

  if (selected && before === prefix && after === suffix) {
    nextText =
      text.slice(0, start - prefix.length) +
      selected +
      text.slice(end + suffix.length);
    nextStart = start - prefix.length;
    nextEnd = end - prefix.length;
  } else {
    const inner = selected || placeholder;
    nextText = text.slice(0, start) + prefix + inner + suffix + text.slice(end);
    nextStart = start + prefix.length;
    nextEnd = nextStart + inner.length;
  }

  onChange(nextText);

  requestAnimationFrame(() => {
    if (textareaRef?.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextStart, nextEnd);
    }
  });
};

/**
 * Prefix every line overlapping the current selection with a bullet (`• `) or numbered (`1. `) prefix.
 */
export const applyLinePrefix = ({ value, onChange, textareaRef, mode }) => {
  const el = textareaRef?.current;
  const text = value || '';

  if (!el) {
    const prefix = mode === 'ordered' ? '1. ' : '• ';
    onChange(text ? `${text}\n${prefix}` : prefix);
    return;
  }

  const start = el.selectionStart ?? text.length;
  const end = el.selectionEnd ?? text.length;

  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextNewline = text.indexOf('\n', end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');

  const transformed = lines.map((line, idx) => {
    const stripped = line.replace(/^(\s*)(?:•\s+|-\s+|\d+\.\s+)/, '$1');
    if (mode === 'ordered') {
      return `${idx + 1}. ${stripped.trimStart()}`;
    }
    return `• ${stripped.trimStart()}`;
  }).join('\n');

  const nextText = text.slice(0, lineStart) + transformed + text.slice(lineEnd);
  onChange(nextText);

  requestAnimationFrame(() => {
    if (textareaRef?.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(lineStart, lineStart + transformed.length);
    }
  });
};

/**
 * Keyboard shortcut handler for textareas (`Ctrl/Cmd + B / I / U`).
 */
export const handleFormattingKeyDown = (e, { value, onChange, textareaRef }) => {
  e.stopPropagation();
  if (!(e.ctrlKey || e.metaKey)) return;

  const key = e.key.toLowerCase();
  if (key === 'b') {
    e.preventDefault();
    applyWrapFormat({ value, onChange, textareaRef, prefix: '**', placeholder: 'bold text' });
  } else if (key === 'i') {
    e.preventDefault();
    applyWrapFormat({ value, onChange, textareaRef, prefix: '*', placeholder: 'italic text' });
  } else if (key === 'u') {
    e.preventDefault();
    applyWrapFormat({ value, onChange, textareaRef, prefix: '__', placeholder: 'underlined text' });
  }
};
