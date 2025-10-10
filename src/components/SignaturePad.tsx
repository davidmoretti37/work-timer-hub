import { useRef, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface SignaturePadProps {
  width?: number;
  height?: number;
  onSignatureChange?: (signature: string) => void;
}

export interface SignaturePadRef {
  clear: () => void;
  getSignature: () => string;
  isEmpty: () => boolean;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ width = 400, height = 150, onSignatureChange }, ref) => {
    const signaturePadRef = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (signaturePadRef.current) {
          signaturePadRef.current.clear();
          onSignatureChange?.("");
        }
      },
      getSignature: () => {
        if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
          return signaturePadRef.current.toDataURL("image/png");
        }
        return "";
      },
      isEmpty: () => {
        return signaturePadRef.current ? signaturePadRef.current.isEmpty() : true;
      }
    }));

    const handleSignatureEnd = () => {
      if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
        const signature = signaturePadRef.current.toDataURL("image/png");
        onSignatureChange?.(signature);
      }
    };

    const handleClear = () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.clear();
        onSignatureChange?.("");
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800">
          <SignatureCanvas
            ref={signaturePadRef}
            canvasProps={{
              width: width,
              height: height,
              className: "rounded border bg-white dark:bg-gray-800",
              style: { width: `${width}px`, height: `${height}px` }
            }}
            backgroundColor="rgb(255, 255, 255)"
            penColor="rgb(0, 0, 0)"
            minWidth={0.5}
            maxWidth={3.0}
            velocityFilterWeight={0.7}
            onEnd={handleSignatureEnd}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="self-start"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Signature
        </Button>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
