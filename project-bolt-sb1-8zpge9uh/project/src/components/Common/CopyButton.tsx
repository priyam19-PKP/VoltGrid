import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: number;
  className?: string;
  title?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  size = 13,
  className = '',
  title = 'Copy to clipboard',
}) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for non-secure contexts
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
        }
        setCopied(true);
        setError(false);
        const timer = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timer);
      } catch (err) {
        console.error('Failed to copy text: ', err);
        setError(true);
        const timer = setTimeout(() => setError(false), 2500);
        return () => clearTimeout(timer);
      }
    },
    [text]
  );

  return (
    <button
      type="button"
      className={`copy-button ${copied ? 'copied' : ''} ${error ? 'error' : ''} ${className}`}
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard!' : error ? 'Failed to copy' : title}
      aria-label={copied ? 'Copied to clipboard' : title}
    >
      {copied ? (
        <Check size={size} style={{ color: 'var(--status-online)' }} />
      ) : (
        <Copy size={size} />
      )}
      {label && <span className="copy-button-label">{copied ? 'Copied' : label}</span>}
    </button>
  );
};
