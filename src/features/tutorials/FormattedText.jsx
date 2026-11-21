import React from 'react';
import './SlideTextToolbar.css';

/**
 * Pure, XSS-safe inline Markdown-lite renderer for tutorial & rule text.
 * Supports: **bold**, *italic*, __underline__, ~~strikethrough~~ (including nested combinations).
 * Renders native React elements — zero dangerouslySetInnerHTML.
 * Newlines are preserved naturally by the parent container's `white-space: pre-wrap`.
 */

// Order matters: match double-char delimiters before single-char `*italic*`.
// Single `*italic*` requires non-whitespace boundaries so math/bullets like `2 * 3` stay untouched.
const TOKEN_REGEX = /(\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*(?!\s)([^\n*]+?)(?<!\s)\*)/;
const MAX_NEST_DEPTH = 4;

const parseInlineNodes = (input, depth = 0, keyPrefix = 'ft') => {
  if (!input || depth >= MAX_NEST_DEPTH) return input;

  const nodes = [];
  let remaining = input;
  let tokenIdx = 0;

  while (remaining.length > 0) {
    const match = TOKEN_REGEX.exec(remaining);
    if (!match) {
      nodes.push(remaining);
      break;
    }

    const [fullMatch, , boldContent, underlineContent, strikeContent, italicContent] = match;
    const matchStart = match.index;

    if (matchStart > 0) {
      nodes.push(remaining.slice(0, matchStart));
    }

    const key = `${keyPrefix}-${depth}-${tokenIdx++}`;
    if (boldContent !== undefined) {
      nodes.push(
        <strong key={key} className="formatted-text__bold">
          {parseInlineNodes(boldContent, depth + 1, key)}
        </strong>
      );
    } else if (underlineContent !== undefined) {
      nodes.push(
        <u key={key} className="formatted-text__underline">
          {parseInlineNodes(underlineContent, depth + 1, key)}
        </u>
      );
    } else if (strikeContent !== undefined) {
      nodes.push(
        <s key={key} className="formatted-text__strike">
          {parseInlineNodes(strikeContent, depth + 1, key)}
        </s>
      );
    } else if (italicContent !== undefined) {
      nodes.push(
        <em key={key} className="formatted-text__italic">
          {parseInlineNodes(italicContent, depth + 1, key)}
        </em>
      );
    } else {
      nodes.push(fullMatch);
    }

    remaining = remaining.slice(matchStart + fullMatch.length);
  }

  return nodes;
};

const FormattedText = ({ text }) => {
  if (text === null || text === undefined || text === '') return null;
  return <>{parseInlineNodes(String(text))}</>;
};

export default FormattedText;
