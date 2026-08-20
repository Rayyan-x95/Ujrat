import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Pen, Type, RotateCcw, Check, ShieldCheck } from 'lucide-react';

interface SignaturePadProps {
  initialName?: string;
  onSign: (signature: { name: string; image: string; type: 'drawn' | 'typed' }) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  initialName = '',
  onSign,
  isSubmitting = false,
  disabled = false,
}) => {
  const [mode, setMode] = useState<'drawn' | 'typed'>('drawn');
  const [typedName, setTypedName] = useState(initialName);
  const [selectedFont, setSelectedFont] = useState<'classic' | 'modern' | 'formal'>('classic');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas with proper resolution
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Scale for high DPI
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Default styles
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (mode === 'drawn') {
      setupCanvas();
    }
  }, [mode, setupCanvas]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const coords = getCanvasCoordinates(e);
    isDrawingRef.current = true;
    lastPointRef.current = coords;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    if (!hasDrawn) setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  };

  // Convert typed name to an image data URL for consistent record storage
  const renderTypedSignatureImage = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0f172a';
    if (selectedFont === 'classic') {
      ctx.font = 'italic bold 44px "Georgia", "Times New Roman", serif';
    } else if (selectedFont === 'modern') {
      ctx.font = 'italic 46px "Brush Script MT", "Caveat", "Segoe Script", cursive';
    } else {
      ctx.font = 'italic 40px "Palatino Linotype", "Book Antiqua", serif';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName.trim(), canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL('image/png');
  };

  const handleSubmit = () => {
    if (!agreedToTerms || disabled || isSubmitting) return;

    let signatureImage = '';
    const legalName = typedName.trim();

    if (mode === 'drawn') {
      if (!hasDrawn || !canvasRef.current) return;
      signatureImage = canvasRef.current.toDataURL('image/png');
    } else {
      if (!legalName) return;
      signatureImage = renderTypedSignatureImage();
    }

    onSign({
      name: legalName,
      image: signatureImage,
      type: mode,
    });
  };

  const isSignable = 
    agreedToTerms &&
    typedName.trim().length >= 2 &&
    (mode === 'drawn' ? hasDrawn : true);

  return (
    <div className="space-y-4 p-5 border border-border bg-card rounded-xl shadow-xs">
      {/* Header and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="space-y-0.5">
          <h3 className="text-small font-bold text-foreground m-0 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Client Electronic Signature</span>
          </h3>
          <p className="text-[11px] text-muted-foreground m-0">
            Sign digitally to execute this contract. Your signature will be cryptographically logged.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-muted p-1 rounded-lg border border-border select-none shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('drawn')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'drawn'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Pen className="h-3 w-3" />
            <span>Draw</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('typed')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'typed'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Type className="h-3 w-3" />
            <span>Type</span>
          </button>
        </div>
      </div>

      {/* Signer Legal Name Input */}
      <div className="space-y-1.5">
        <Input
          label="Full Legal Name"
          placeholder="e.g. Rahul Sharma"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          disabled={disabled || isSubmitting}
          required
        />
      </div>

      {/* Signature Area */}
      {mode === 'drawn' ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[11px] text-muted-foreground">
            <span>Draw your signature below using mouse, pen, or touch:</span>
            {hasDrawn && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled || isSubmitting}
                className="flex items-center gap-1 text-destructive hover:underline font-medium cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="relative border-2 border-dashed border-border rounded-lg bg-surface/40 hover:border-primary/50 transition-colors overflow-hidden">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-36 touch-none cursor-crosshair block"
              style={{ touchAction: 'none' }}
            />
            
            {/* Guide line */}
            <div className="absolute bottom-6 left-6 right-6 border-b border-muted-foreground/20 pointer-events-none select-none flex justify-between text-[10px] text-muted-foreground/40 font-mono">
              <span>Sign above this line</span>
              <span>×</span>
            </div>

            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-muted-foreground/30 text-xs italic font-mono">
                Click or tap and draw your signature here
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[11px] text-muted-foreground">
            <span>Select calligraphy style:</span>
            <div className="flex gap-1.5">
              {(['classic', 'modern', 'formal'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setSelectedFont(style)}
                  className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium cursor-pointer border ${
                    selectedFont === style
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-surface/50 p-6 text-center select-none min-h-28 flex items-center justify-center">
            {typedName.trim() ? (
              <span
                className={`text-2xl sm:text-3xl tracking-wide text-foreground select-text ${
                  selectedFont === 'classic'
                    ? 'font-serif italic font-bold'
                    : selectedFont === 'modern'
                    ? 'font-serif italic tracking-widest text-primary'
                    : 'font-mono italic'
                }`}
              >
                {typedName.trim()}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">
                Type your legal name above to preview your digital signature
              </span>
            )}
          </div>
        </div>
      )}

      {/* Legal Acknowledgement Checkbox */}
      <div className="p-3 bg-muted/50 border border-border rounded-lg">
        <label className="flex items-start gap-2.5 cursor-pointer text-xs leading-relaxed text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            disabled={disabled || isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
          />
          <span>
            I acknowledge and agree that this electronic signature represents my legally binding assent and execution of this agreement under <strong>Section 10A of the Information Technology Act, 2000</strong>.
          </span>
        </label>
      </div>

      {/* Action CTA */}
      <Button
        variant="primary"
        className="w-full font-bold shadow-sm"
        onClick={handleSubmit}
        disabled={!isSignable || disabled}
        loading={isSubmitting}
        icon={<Check className="h-4 w-4" />}
      >
        Sign & Authorize Contract
      </Button>
    </div>
  );
};
