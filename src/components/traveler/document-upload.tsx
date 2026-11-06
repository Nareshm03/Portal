"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Image as ImageIcon, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DocumentType = "passport" | "selfie" | "address";

interface UploadedDocument {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  status: "uploaded" | "pending" | "verified" | "rejected";
  preview?: string;
}

interface DocumentUploadProps {
  documentType: DocumentType;
  label: string;
  acceptedFormats: string[];
  currentStatus?: string;
  onUpload?: (file: File) => Promise<void>;
}

const DOCUMENT_CONFIG: Record<DocumentType, { maxSize: number; icon: React.ElementType }> = {
  passport: { maxSize: 5 * 1024 * 1024, icon: FileText },
  selfie: { maxSize: 5 * 1024 * 1024, icon: ImageIcon },
  address: { maxSize: 5 * 1024 * 1024, icon: FileText },
};

export function DocumentUpload({
  documentType,
  label,
  acceptedFormats,
  currentStatus = "Not uploaded",
}: DocumentUploadProps) {
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = DOCUMENT_CONFIG[documentType];
  const Icon = config.icon;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!acceptedFormats.includes(fileExtension)) {
      return `Invalid file type. Accepted formats: ${acceptedFormats.join(", ")}`;
    }

    // Check file size
    if (file.size > config.maxSize) {
      return `File size exceeds ${formatFileSize(config.maxSize)} limit`;
    }

    return null;
  };

  const handleFileSelect = async (file: File) => {
    setError(null);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);

    try {
      // Simulate upload delay (demo mode)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Create preview for images
      let preview: string | undefined;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      // Store document info (demo - would normally upload to Supabase)
      const uploadedDoc: UploadedDocument = {
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        status: "uploaded",
        preview,
      };

      setDocument(uploadedDoc);

      // Store in localStorage for demo persistence
      const storageKey = `kyc_document_${documentType}`;
      localStorage.setItem(storageKey, JSON.stringify(uploadedDoc));
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    if (document?.preview) {
      URL.revokeObjectURL(document.preview);
    }
    setDocument(null);
    setError(null);
    
    // Remove from localStorage
    const storageKey = `kyc_document_${documentType}`;
    localStorage.removeItem(storageKey);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
    const storageKey = `kyc_document_${documentType}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const doc = JSON.parse(stored);
        // Using a timeout to avoid setState directly in effect
        const timer = setTimeout(() => setDocument(doc), 0);
        return () => clearTimeout(timer);
      } catch (e) {
        console.error("Failed to load document from storage", e);
      }
    }
  }, [documentType]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "uploaded":
      case "Uploaded - Pending Review":
        return "text-blue-600";
      case "verified":
      case "Verified":
        return "text-emerald-600";
      case "rejected":
      case "Rejected":
        return "text-red-600";
      default:
        return "text-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "uploaded":
      case "Uploaded - Pending Review":
        return <AlertCircle className="size-4" strokeWidth={2} />;
      case "verified":
      case "Verified":
        return <CheckCircle2 className="size-4" strokeWidth={2} />;
      case "rejected":
      case "Rejected":
        return <X className="size-4" strokeWidth={2} />;
      default:
        return null;
    }
  };

  if (document && !isUploading) {
    // Uploaded state
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald/40 bg-emerald/10">
            <Icon className="size-5 text-emerald" strokeWidth={1.75} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">
                {document.name}
              </p>
              <span className={cn("flex items-center gap-1 text-xs font-medium", getStatusColor(document.status))}>
                {getStatusIcon(document.status)}
                {document.status === "uploaded" ? "Uploaded - Pending Review" : document.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {formatFileSize(document.size)} · Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
            </p>

            {document.preview && (
              <div className="mt-3">
                <img
                  src={document.preview}
                  alt="Document preview"
                  className="h-32 w-auto rounded border border-border object-cover"
                />
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted/80"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-muted"
              >
                Remove
              </button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(",")}
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    );
  }

  // Upload area
  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragging
            ? "border-champagne bg-champagne/5"
            : "border-border bg-surface hover:border-champagne/40 hover:bg-surface-muted/30",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <div className="flex flex-col items-center gap-3">
          {isUploading ? (
            <>
              <div className="grid size-12 place-items-center rounded-lg border border-border bg-surface-muted">
                <Loader2 className="size-6 animate-spin text-champagne-strong" strokeWidth={1.75} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Uploading...</p>
                <p className="mt-1 text-xs text-muted">Please wait</p>
              </div>
            </>
          ) : (
            <>
              <div className="grid size-12 place-items-center rounded-lg border border-border bg-surface-muted">
                <Upload className="size-6 text-muted" strokeWidth={1.75} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drag and drop your {label.toLowerCase()} here
                </p>
                <p className="mt-1 text-xs text-muted">
                  or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-champagne-strong underline-offset-2 hover:underline"
                  >
                    browse files
                  </button>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {acceptedFormats.join(", ").toUpperCase()} · Max {formatFileSize(config.maxSize)}
                </p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(",")}
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-50/50 px-3 py-2 text-xs text-red-800">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-md border border-champagne/20 bg-champagne/5 px-3 py-2 text-xs text-muted">
        <strong className="text-champagne-strong">Demo Mode:</strong> Files are stored temporarily in your browser. 
        In production, documents would be securely uploaded to encrypted storage with role-based access control.
      </div>
    </div>
  );
}
