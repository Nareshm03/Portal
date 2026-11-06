-- Migration: Create kyc_submissions table
-- Purpose: Track KYC submissions with status, timestamps, and metadata
-- Each submission is linked to a profile (traveller) and can be in states: SUBMITTED, REVIEWING, VERIFIED, REJECTED, RESUBMITTED

-- Create the kyc_submissions enum type
create type public.kyc_submission_status as enum ('SUBMITTED', 'REVIEWING', 'VERIFIED', 'REJECTED', 'RESUBMITTED');

-- Create the kyc_submissions table
create table public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.kyc_submission_status not null default 'SUBMITTED',
  submitted_at timestamptz not null default now(),
  reviewer_id uuid references public.profiles(id),
  decided_at timestamptz,
  provider_reference text,
  decision_reason text,
  notes text,
  document_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for profiling lookups
create index kyc_submissions_profile_idx on public.kyc_submissions (profile_id, status);
create index kyc_submissions_status_idx on public.kyc_submissions (status);
create index kyc_submissions_profile_submitted_idx on public.kyc_submissions (profile_id, submitted_at desc);

-- Comment
comment on table public.kyc_submissions is 'Tracks KYC submission lifecycle for profiles. Each submission can be resubmitted after rejection or review.';
comment on column public.kyc_submissions.profile_id is 'The profile (traveller) who submitted the KYC';
comment on column public.kyc_submissions.status is 'Current submission status: SUBMITTED, REVIEWING, VERIFIED, REJECTED, RESUBMITTED';
comment on column public.kyc_submissions.submitted_at is 'When the submission was initially created';
comment on column public.kyc_submissions.reviewer_id is 'The admin who performed the KYC review (null if still under review)';
comment on column public.kyc_submissions.decided_at is 'When the KYC decision was made (null if still under review)';
comment on column public.kyc_submissions.provider_reference is 'Provider reference from the KYC submission';
comment on column public.kyc_submissions.decision_reason is 'Reason for reject or resubmit decision';
comment on column public.kyc_submissions.notes is 'Optional notes from the review process';
comment on column public.kyc_submissions.document_count is 'Number of documents associated with this submission';
comment on column public.kyc_submissions.created_at is 'When the submission record was created';
comment on column public.kyc_submissions.updated_at is 'When the submission record was last updated';