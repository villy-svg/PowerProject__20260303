import React from 'react';
import {
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconList,
  IconListOrdered,
  IconEye
} from '../../components/ui/Icons';
import { normalizeTextAlign, applyWrapFormat, applyLinePrefix } from './tutorialUtils';

/**
 * Modular, reusable formatting + alignment toolbar shared by
 * TutorialSlideshowViewer (slide edit mode) and TutorialFormModal (tutorial creation).
 */
const SlideTextToolbar = ({
  textareaRef,
  value,
  onChange,
  textAlign = 'center',
  onAlignChange,
  showPreview = false,
  onTogglePreview
}) => {
  const currentAlign = normalizeTextAlign(textAlign, 'center');

  return (
    <div className="slide-text-toolbar" role="toolbar" aria-label="Text formatting and alignment">
      {/* Group 1: Alignment */}
      <div className="slide-text-toolbar__group" role="group" aria-label="Text alignment">
        <button
          type="button"
          className={`slide-text-toolbar__btn ${currentAlign === 'left' ? 'active' : ''}`}
          onClick={() => onAlignChange?.('left')}
          title="Align Left"
          aria-label="Align Left"
          aria-pressed={currentAlign === 'left'}
        >
          <IconAlignLeft size={14} />
        </button>
        <button
          type="button"
          className={`slide-text-toolbar__btn ${currentAlign === 'center' ? 'active' : ''}`}
          onClick={() => onAlignChange?.('center')}
          title="Align Center"
          aria-label="Align Center"
          aria-pressed={currentAlign === 'center'}
        >
          <IconAlignCenter size={14} />
        </button>
        <button
          type="button"
          className={`slide-text-toolbar__btn ${currentAlign === 'right' ? 'active' : ''}`}
          onClick={() => onAlignChange?.('right')}
          title="Align Right"
          aria-label="Align Right"
          aria-pressed={currentAlign === 'right'}
        >
          <IconAlignRight size={14} />
        </button>
      </div>

      <span className="slide-text-toolbar__divider" aria-hidden="true" />

      {/* Group 2: Inline Text Formatting */}
      <div className="slide-text-toolbar__group" role="group" aria-label="Text styles">
        <button
          type="button"
          className="slide-text-toolbar__btn slide-text-toolbar__btn--bold"
          onClick={() => applyWrapFormat({ value, onChange, textareaRef, prefix: '**', placeholder: 'bold text' })}
          disabled={showPreview}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className="slide-text-toolbar__btn slide-text-toolbar__btn--italic"
          onClick={() => applyWrapFormat({ value, onChange, textareaRef, prefix: '*', placeholder: 'italic text' })}
          disabled={showPreview}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          className="slide-text-toolbar__btn slide-text-toolbar__btn--underline"
          onClick={() => applyWrapFormat({ value, onChange, textareaRef, prefix: '__', placeholder: 'underlined text' })}
          disabled={showPreview}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
        >
          U
        </button>
        <button
          type="button"
          className="slide-text-toolbar__btn slide-text-toolbar__btn--strike"
          onClick={() => applyWrapFormat({ value, onChange, textareaRef, prefix: '~~', placeholder: 'strikethrough' })}
          disabled={showPreview}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          S
        </button>
      </div>

      <span className="slide-text-toolbar__divider" aria-hidden="true" />

      {/* Group 3: List Helpers */}
      <div className="slide-text-toolbar__group" role="group" aria-label="Lists">
        <button
          type="button"
          className="slide-text-toolbar__btn"
          onClick={() => applyLinePrefix({ value, onChange, textareaRef, mode: 'bullet' })}
          disabled={showPreview}
          title="Bullet List"
          aria-label="Bullet List"
        >
          <IconList size={14} />
        </button>
        <button
          type="button"
          className="slide-text-toolbar__btn"
          onClick={() => applyLinePrefix({ value, onChange, textareaRef, mode: 'ordered' })}
          disabled={showPreview}
          title="Numbered List"
          aria-label="Numbered List"
        >
          <IconListOrdered size={14} />
        </button>
      </div>

      {/* Optional Preview Toggle */}
      {onTogglePreview && (
        <>
          <span className="slide-text-toolbar__divider" aria-hidden="true" />
          <button
            type="button"
            className={`slide-text-toolbar__btn slide-text-toolbar__btn--preview ${showPreview ? 'active' : ''}`}
            onClick={onTogglePreview}
            title={showPreview ? 'Back to Edit' : 'Preview Formatting'}
            aria-label={showPreview ? 'Back to Edit' : 'Preview Formatting'}
            aria-pressed={showPreview}
          >
            <IconEye size={14} />
            <span>{showPreview ? 'Edit' : 'Preview'}</span>
          </button>
        </>
      )}
    </div>
  );
};

export default SlideTextToolbar;
