"use client";

import React from 'react';

type CustomMarkdownRendererProps = {
  content: string;
};

const CustomMarkdownRenderer: React.FC<CustomMarkdownRendererProps> = ({ content }) => {
  const parseLine = (line: string) => {
    // Headlines (must match the start of the line)
    if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`;
    if (line.startsWith('#### ')) return `<h4>${line.substring(5)}</h4>`;
    if (line.startsWith('##### ')) return `<h5>${line.substring(6)}</h5>`;
    if (line.startsWith('###### ')) return `<h6>${line.substring(7)}</h6>`;

    let parsedLine = line;

    // Bold & Italic (***text***)
    parsedLine = parsedLine.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    
    // Bold (**text**)
    parsedLine = parsedLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_)
    parsedLine = parsedLine.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    parsedLine = parsedLine.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough (~~text~~)
    parsedLine = parsedLine.replace(/~~([^~]+)~~/g, '<s>$1</s>');

    // Inline Code (`code`)
    parsedLine = parsedLine.replace(/`([^`]+)`/g, '<code>$1</code>');

    return `<p>${parsedLine}</p>`;
  };

  const parsedHtml = content
    .split('\n')
    .map(line => line.trim() === '' ? '<br/>' : parseLine(line))
    .join('');

  return (
    <div
      className="prose dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-4 prose-code:bg-secondary prose-code:p-1 prose-code:rounded"
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  );
};

export default CustomMarkdownRenderer;
