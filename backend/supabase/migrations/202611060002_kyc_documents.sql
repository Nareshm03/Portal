-- Migration: Create kyc_documents table
-- Purpose: Standalone KYC document storage, independent of orders.
-- Each document is associated with a KYC submission profile, not an order.
-- This avoids the order_id NOT NULL constraint and category constraint issues
-- of the order_evidence table.

create type public.kyc_document_category as enum (
  'IDENTITY_DOCUMENT',
  'RESIDENCY_PROOF',
  'TRAVEL_DOCUMENT',
  'HEALTH_CERTIFICATE',
  'ADDITIONAL_KYC'
);

create table public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  kyc_submission_id uuid not null references public.kyc_submissions(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete set null,
  category public.kyc_document_category not null,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 3 and 100),
  size_bytes bigint not null check (size_bytes > 0),
  storage_path text not null,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Index for submission-level lookups
create index kyc_documents_submission_idx on public.kyc_documents (kyc_submission_id, status);
create index kyc_documents_uploader_idx on public.kyc_documents (uploader_id);

-- Comment
comment on table public.kyc_documents is 'KYC evidence documents, stored privately in Supabase Storage with signed URLs. Each document belongs to a KYC submission and is independent of order evidence.';
comment on column public.kyc_documents.kyc_submission_id is 'The KYC submission this document belongs to';
comment on column public.kyc_documents.uploader_id is 'The profile that uploaded the document';
comment on column public.kyc_documents.category is 'Type of KYC document';
comment on column public.kyc_documents.storage_path is 'Server-generated path in the order_evidence Storage bucket';
comment on column public.kyc_documents.status is 'PENDING: being uploaded, COMPLETED: verified in storage, FAILED: upload error';