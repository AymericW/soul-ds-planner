import { useRef, type ReactNode } from 'react';

interface FileButtonProps {
  accept: string;
  onFile: (file: File) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

/** A normal button that opens the file picker (resets so the same file can be picked twice). */
export function FileButton({ accept, onFile, children, className = 'button', disabled }: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}
