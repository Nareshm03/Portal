"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, Globe2, ImagePlus, Info, Send, UploadCloud, Wallet } from "lucide-react";
import { Badge, Button, ButtonLink, Input } from "@/components/ui";
import { createApiClient } from "@/lib/api/client";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { AIRPORT_OPTIONS, ORIGIN_COUNTRIES, formatCurrency, formatDate } from "@/lib/demo/buyer";
import { cn } from "@/lib/utils";

const PRODUCT_CATEGORIES = [
  "Electronics",
  "Fashion & Apparel",
  "Beauty & Fragrance",
  "Home & Living",
  "Sports & Outdoors",
  "Books & Media",
  "Toys & Games",
  "Automotive",
  "Health & Wellness",
  "Other",
] as const;

interface CreateRequestResponse {
  data: { id: string; state: string };
  compliance: { status: string };
}

type FieldName =
  | "productName"
  | "imageUrl"
  | "description"
  | "originCountry"
  | "originAirportCode"
  | "destinationCountry"
  | "destinationAirportCode"
  | "referenceUrl"
  | "productCategory"
  | "variant"
  | "maxBudget"
  | "requiredBy";

type FormValues = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;

const INITIAL_VALUES: FormValues = {
  productName: "",
  imageUrl: "",
  description: "",
  originCountry: "",
  originAirportCode: "",
  destinationCountry: "",
  destinationAirportCode: "",
  referenceUrl: "",
  productCategory: "",
  variant: "",
  maxBudget: "",
  requiredBy: "",
};

const NEXT_STEPS = [
  {
    title: "Travelers see the brief",
    body: "Verified travelers already flying into your airport would browse matching requests.",
  },
  {
    title: "Quotes arrive",
    body: "Compare item price, carrying fee and an indicative duty estimate side by side.",
  },
  {
    title: "You approve the handover",
    body: "Payment would sit in escrow until a one-time code confirms delivery.",
  },
] as const;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateForm(values: FormValues, hasFile: boolean, today: string): FormErrors {
  const errors: FormErrors = {};

  if (values.productName.trim().length < 2) {
    errors.productName = "Add a product name of at least 2 characters.";
  }

  if (!hasFile) {
    if (!values.imageUrl.trim()) {
      errors.imageUrl = "Upload a photo or paste an image URL.";
    } else if (!isHttpUrl(values.imageUrl.trim())) {
      errors.imageUrl = 'Use a full image URL beginning with http:// or https://.';
    }
  }

  if (values.description.trim().length < 1) {
    errors.description = "Describe the item.";
  }

  if (!values.originCountry.trim()) {
    errors.originCountry = "Tell us where the product is being bought.";
  } else if (!(ORIGIN_COUNTRIES as readonly string[]).includes(values.originCountry)) {
    errors.originCountry = "Select a valid origin country.";
  }

  if (!values.originAirportCode.trim()) {
    errors.originAirportCode = "Select the origin airport.";
  } else if (!AIRPORT_OPTIONS.some((a) => a.code === values.originAirportCode)) {
    errors.originAirportCode = "Select a valid origin airport.";
  }

  if (!values.destinationCountry.trim()) {
    errors.destinationCountry = "Tell us the destination country.";
  } else if (!(ORIGIN_COUNTRIES as readonly string[]).includes(values.destinationCountry)) {
    errors.destinationCountry = "Select a valid destination country.";
  }

  if (!values.destinationAirportCode.trim()) {
    errors.destinationAirportCode = "Select the destination airport.";
  } else if (!AIRPORT_OPTIONS.some((a) => a.code === values.destinationAirportCode)) {
    errors.destinationAirportCode = "Select a valid destination airport.";
  }

  if (values.originAirportCode === values.destinationAirportCode && values.originAirportCode.trim()) {
    errors.originAirportCode = "Origin and destination airports must differ.";
    errors.destinationAirportCode = "Origin and destination airports must differ.";
  }

  if (values.referenceUrl.trim() && !isHttpUrl(values.referenceUrl.trim())) {
    errors.referenceUrl = 'Use a full URL beginning with http:// or https://.';
  }

  if (!values.productCategory.trim()) {
    errors.productCategory = "Select a product category.";
  }

  const budget = Number(values.maxBudget);
  if (!values.maxBudget.trim()) {
    errors.maxBudget = "Set a maximum budget.";
  } else if (!Number.isFinite(budget) || budget <= 0) {
    errors.maxBudget = "Enter a budget greater than zero.";
  }

  if (!values.requiredBy) {
    errors.requiredBy = "Choose the date you need it by.";
  } else if (values.requiredBy < today) {
    errors.requiredBy = "Choose today or a later date.";
  }

  return errors;
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>;
  }
  if (hint) {
    return <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>;
  }
  return null;
}

function TextAreaField({ id, label, value, placeholder, error, hint, rows = 5, onChange }: { id: FieldName; label: string; value: string; placeholder: string; error?: string; hint?: string; rows?: number; onChange: (value: string) => void }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label} <span className="text-destructive">*</span></label>
      <textarea id={id} value={value} rows={rows} required placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} className={cn("w-full resize-y rounded-md border border-border bg-surface px-3.5 py-3 text-sm text-foreground shadow-sm transition-colors duration-200", "placeholder:text-muted-foreground", "focus:border-champagne-strong focus:outline-none focus:ring-2 focus:ring-champagne/30", error && "border-destructive/60 focus:border-destructive focus:ring-destructive/20")} /> <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

function SelectField({ id, label, value, placeholder, error, hint, options, onChange }: { id: FieldName; label: string; value: string; placeholder: string; error?: string; hint?: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label} <span className="text-destructive">*</span></label>
      <div className="relative">
        <select id={id} value={value} required aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} className={cn("h-11 w-full appearance-none rounded-md border border-border bg-surface px-3.5 pr-10 text-sm text-foreground shadow-sm transition-colors duration-200", "focus:border-champagne-strong focus:outline-none focus:ring-2 focus:ring-champagne/30", !value && "text-muted-foreground", error && "border-destructive/60 focus:border-destructive focus:ring-destructive/20")}>
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(43,10,19,0.04)] sm:p-7">
      <div className="flex items-start gap-3 border-b border-border pb-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-champagne/20 font-serif text-sm text-burgundy">{number}</span>
        <div>
          <h2 className="text-xl">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-[0.6875rem] text-muted">{label}</dt>
      <dd className="max-w-[62%] truncate text-right text-xs font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function ProductRequestForm() {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [fileError, setFileError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<{ id: string; state: string; compliance_status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requiredByRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = requiredByRef.current;
    if (input) input.min = new Date().toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!filePreview) return;
    return () => URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const remotePreview = isHttpUrl(values.imageUrl.trim()) ? values.imageUrl.trim() : "";
  const previewUrl = filePreview || remotePreview;
  const previewBackground = previewUrl ? `url("${previewUrl.replace(/"/g, "%22")}")` : undefined;

  function updateField(field: FieldName, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    if (field === "imageUrl") setFileError(undefined);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) {
      setFileError("Choose a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setFileError("Keep the image under 5 MB.");
      event.target.value = "";
      return;
    }
    setFileError(undefined);
    setFile(nextFile);
    setFilePreview(URL.createObjectURL(nextFile));
    setErrors((previous) => { const next = { ...previous }; delete next.imageUrl; return next; });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError(null);

    const nextErrors = validateForm(values, Boolean(file), new Date().toISOString().slice(0, 10));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstField = Object.keys(nextErrors)[0];
      if (firstField) {
        window.setTimeout(() => { document.getElementById(firstField)?.focus(); }, 0);
      }
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;

      const api = createApiClient();
      const payload = {
        originCountry: values.originCountry.trim(),
        originAirportCode: values.originAirportCode.trim().toUpperCase(),
        destinationCountry: values.destinationCountry.trim(),
        destinationAirportCode: values.destinationAirportCode.trim().toUpperCase(),
        neededBy: `${values.requiredBy}T00:00:00Z`,
        productTitle: values.productName.trim(),
        productCategory: values.productCategory.trim(),
        productUrl: values.imageUrl.trim() || values.referenceUrl.trim() || undefined,
        quantity: 1,
        declaredValueMinor: Math.round(Number(values.maxBudget) * 100),
        declaredCurrency: "USD",
        hsCode: undefined,
        fulfilmentMode: "PASSENGER_BAGGAGE",
        isForThirdParty: true,
      };

      const result = (await api.POST("/requests", payload, {
        token,
      })) as CreateRequestResponse;
      setCreatedRequest({
        id: result.data.id,
        state: result.data.state,
        compliance_status: result.compliance.status,
      });
    } catch (err) {
      if (err instanceof Error) {
        setSubmissionError(err.message);
      } else {
        setSubmissionError("An unexpected error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setValues(INITIAL_VALUES);
    setErrors({});
    setFile(null);
    setFilePreview("");
    setFileError(undefined);
    setSubmitting(false);
    setSubmissionError(null);
    setCreatedRequest(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (createdRequest) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/buyer/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-burgundy">
          <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Back to overview
        </Link>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative overflow-hidden bg-burgundy-deep px-6 py-10 text-center text-ivory sm:px-10">
            <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full border border-champagne/20" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full border border-champagne/15" />
            <span className="relative mx-auto grid size-14 place-items-center rounded-full border border-champagne/40 bg-champagne/15">
              <CheckCircle2 className="size-6 text-champagne" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="relative mt-5 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-champagne">Request created</p>
            <h1 className="relative mt-2 text-3xl leading-tight text-ivory sm:text-4xl">Your request is live</h1>
            <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ivory/65">
              Your product request has been submitted to the backend. Travelers on matching routes can now see it.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              <SummaryRow label="Request ID" value={createdRequest.id} />
              <SummaryRow label="State" value={createdRequest.state} />
              <SummaryRow label="Compliance status" value={createdRequest.compliance_status} />
              <SummaryRow label="Product" value={values.productName.trim()} />
              <SummaryRow label="Budget" value={formatCurrency(Number(values.maxBudget) || 0)} />
              <SummaryRow label="Needed by" value={formatDate(values.requiredBy)} />
              <SummaryRow label="Destination" value={values.destinationAirportCode} />
            </dl>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={resetForm} leadingIcon={<ImagePlus className="size-4" strokeWidth={1.75} aria-hidden="true" />}>Create another request</Button>
              <ButtonLink href="/buyer/dashboard" variant="outline">Back to dashboard</ButtonLink>
            </div>

            <p className="mt-5 text-center text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">Live backend · no payment</p>
          </div>
        </div>
      </div>
    );
  }

  const summaryRows = [
    { label: "Product", value: values.productName.trim() || "Untitled piece" },
    { label: "Budget", value: values.maxBudget.trim() ? formatCurrency(Number(values.maxBudget) || 0) : "Not set" },
    { label: "Origin", value: `${values.originCountry.trim()} · ${values.originAirportCode.trim() || "—"}` },
    { label: "Needed by", value: values.requiredBy ? formatDate(values.requiredBy) : "Not set" },
    { label: "Destination", value: `${values.destinationCountry.trim()} · ${values.destinationAirportCode.trim() || "—"}` },
  ];

  return (
    <div>
      <Link href="/buyer/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-burgundy">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Back to overview
      </Link>

      <header className="mt-5 max-w-3xl">
        <p className="eyebrow">New product request</p>
        <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Tell us what to bring home.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          A precise brief gives travelers something concrete to say yes to. Fields marked <span className="font-medium text-foreground">*</span> are required. Your request will be submitted to the backend for compliance review.
        </p>
      </header>

      <ol className="mt-7 flex flex-wrap items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em]">
        <li className="inline-flex items-center gap-2 rounded-full bg-burgundy px-3 py-1.5 text-ivory"><span className="font-serif text-sm font-normal leading-none">01</span>Product details</li>
        <li className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-muted-foreground"><span className="font-serif text-sm font-normal leading-none">02</span>Traveler match</li>
        <li className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-muted-foreground"><span className="font-serif text-sm font-normal leading-none">03</span>Quote &amp; handover</li>
      </ol>

      {submissionError && (
        <div className="mt-8 rounded-lg border border-red-600/20 bg-red-600/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {submissionError}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid gap-5">
          <FormSection number="01" title="The product" description="Name the piece and describe exactly what you are looking for.">
            <div className="grid gap-5">
              <Input id="productName" label="Product name *" value={values.productName} onChange={(event) => updateField("productName", event.target.value)} placeholder="e.g. Leica Q3 compact camera" hint="Include the brand and model if you know it." error={errors.productName} autoComplete="off" required />
              <TextAreaField id="description" label="Product description" value={values.description} onChange={(value) => updateField("description", value)} placeholder="Colour, finish, edition, condition, anything a traveler should confirm in store." hint="Aim for two or three specific details." error={errors.description} />
              <SelectField id="productCategory" label="Product category *" value={values.productCategory} onChange={(value) => updateField("productCategory", value)} placeholder="Select a category" hint="Helps travelers and compliance review your request." error={errors.productCategory} options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </div>
          </FormSection>

          <FormSection number="02" title="The visual" description="Upload one image or paste a direct image URL, then add a store reference.">
            <div className="grid gap-5">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Product image <span className="text-destructive">*</span></p>
                  <span className="text-[0.625rem] text-muted-foreground">File or URL — one is enough</span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label htmlFor="product-image" className="group relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-muted/40 p-4 text-center transition-colors hover:border-champagne-strong hover:bg-champagne/10">
                    {previewUrl ? (
                      <>
                        <span role="img" aria-label="Selected product preview" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: previewBackground }} />
                        <span aria-hidden="true" className="absolute inset-0 bg-burgundy-deep/50" />
                        <span className="relative inline-flex items-center gap-2 rounded-full bg-ivory/95 px-3 py-1.5 text-xs font-medium text-burgundy-deep">
                          <ImagePlus className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Replace image
                        </span>
                        <span className="relative mt-2 max-w-full truncate text-[0.625rem] text-ivory/80">{file?.name ?? "Preview from image URL"}</span>
                      </>
                    ) : (
                      <>
                        <span className="grid size-11 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/15">
                          <UploadCloud className="size-5 text-champagne-strong" strokeWidth={1.5} aria-hidden="true" />
                        </span>
                        <span className="mt-3 text-sm font-medium">Upload a photo</span>
                        <span className="mt-1 text-[0.6875rem] text-muted">JPG, PNG or WEBP · up to 5 MB</span>
                      </>
                    )}
                    <input ref={fileInputRef} id="product-image" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleFileChange} />
                  </label>
                  <div className="flex flex-col justify-center rounded-xl border border-border bg-surface p-4">
                    <Input id="imageUrl" label="Or paste an image URL" value={values.imageUrl} onChange={(event) => updateField("imageUrl", event.target.value)} placeholder="https://images.example.com/item.jpg" hint="Previewed locally. Nothing is uploaded." error={fileError ?? errors.imageUrl} inputMode="url" autoComplete="off" />
                  </div>
                </div>
                <Input id="referenceUrl" label="Reference URL" value={values.referenceUrl} onChange={(event) => updateField("referenceUrl", event.target.value)} placeholder="https://store.example.com/product" hint="Optional — a store page helps travelers confirm the exact item." error={errors.referenceUrl} inputMode="url" autoComplete="off" />
              </div>
            </div>
          </FormSection>

          <FormSection number="03" title="Sourcing &amp; delivery" description="Where it comes from, where it's going, and your budget.">
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Input id="originCountry" label="Origin country *" value={values.originCountry} onChange={(event) => updateField("originCountry", event.target.value)} placeholder="Start typing a country" hint="Where the store or boutique is located." error={errors.originCountry} leadingIcon={<Globe2 className="size-4" strokeWidth={1.75} aria-hidden="true" />} list="origin-country-options" autoComplete="off" required />
                  <datalist id="origin-country-options">{ORIGIN_COUNTRIES.map((country) => <option key={country} value={country} />)}</datalist>
                </div>
                <Input id="originAirportCode" label="Origin airport *" value={values.originAirportCode} onChange={(event) => updateField("originAirportCode", event.target.value)} placeholder="e.g. JFK" hint="Your nearest origin airport." error={errors.originAirportCode} leadingIcon={<Globe2 className="size-4" strokeWidth={1.75} aria-hidden="true" />} list="origin-airport-options" autoComplete="off" required />
                <datalist id="origin-airport-options">{AIRPORT_OPTIONS.map((airport) => <option key={airport.code} value={airport.code}>{`${airport.code} · ${airport.city}`}</option>)}</datalist>
              </div>
              <div className="grid gap-2">
                <Input id="destinationCountry" label="Destination country *" value={values.destinationCountry} onChange={(event) => updateField("destinationCountry", event.target.value)} placeholder="e.g. India" hint="Where you will receive the item." error={errors.destinationCountry} leadingIcon={<Globe2 className="size-4" strokeWidth={1.75} aria-hidden="true" />} list="destination-country-options" autoComplete="off" required />
                <datalist id="destination-country-options">{ORIGIN_COUNTRIES.map((country) => <option key={country} value={country} />)}</datalist>
                <SelectField id="destinationAirportCode" label="Destination airport *" value={values.destinationAirportCode} onChange={(value) => updateField("destinationAirportCode", value)} placeholder="Select an airport" hint="Where you can collect the item." error={errors.destinationAirportCode} options={AIRPORT_OPTIONS.map((airport) => ({ value: airport.code, label: `${airport.code} · ${airport.city}` }))} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Input id="maxBudget" type="number" label="Maximum budget (USD) *" value={values.maxBudget} onChange={(event) => updateField("maxBudget", event.target.value)} placeholder="e.g. 1800" hint="Item price only. Carrying fees and duty are quoted separately." error={errors.maxBudget} leadingIcon={<Wallet className="size-4" strokeWidth={1.75} aria-hidden="true" />} min="1" step="1" inputMode="decimal" required />
              </div>
              <Input id="requiredBy" ref={requiredByRef} type="date" label="Required by *" value={values.requiredBy} onChange={(event) => updateField("requiredBy", event.target.value)} hint="Give travelers enough runway to plan." error={errors.requiredBy} required />
            </div>
          </FormSection>

          <div className="rounded-xl border border-champagne-strong/25 bg-champagne/10 p-4 text-[0.6875rem] leading-relaxed text-muted">
            <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-champagne-ink"><Info className="size-3.5" strokeWidth={1.75} aria-hidden="true" />Live submission</span>
            <p className="mt-1.5">Your request is submitted to the backend API. It will be reviewed for compliance before travelers can quote.</p>
          </div>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(43,10,19,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <p className="eyebrow">Request summary</p>
              <Badge variant="outline">Draft</Badge>
            </div>
            <h2 className="mt-2 text-2xl">A brief in progress.</h2>
            <dl className="mt-4 divide-y divide-border text-sm">{summaryRows.map((row) => <SummaryRow key={row.label} label={row.label} value={row.value} />)}</dl>
            <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-5" leadingIcon={<Send className="size-4" strokeWidth={1.75} aria-hidden="true" />}>{submitting ? "Submitting…" : "Submit product request"}</Button>
            <Link href="/buyer/dashboard" className="mt-3 block text-center text-xs font-medium text-muted transition-colors hover:text-burgundy">Cancel and return</Link>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="eyebrow">What happens next</p>
            <ol className="mt-4 grid gap-3">{NEXT_STEPS.map((step, index) => <li key={step.title} className="flex gap-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-champagne-strong/40 bg-champagne/15 text-[0.625rem] font-semibold text-burgundy">{index + 1}</span><div><p className="text-xs font-medium">{step.title}</p><p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted">{index === 0 ? `Verified travelers flying into ${values.destinationAirportCode || "your airport"} would see the brief.` : step.body}</p></div></li>)}</ol>
          </div>
        </aside>
      </form>
    </div>
  );
}
