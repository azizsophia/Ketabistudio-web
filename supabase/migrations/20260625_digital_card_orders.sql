-- Digital greeting cards: a hosted, animated card delivered by a shareable
-- link (and optionally emailed to the recipient). Nothing is printed, so this
-- table is intentionally separate from card_orders — the print worker never
-- looks at it, and there is no shipping/country gating.
--
-- Access is server-side only via the Supabase service key (which bypasses
-- RLS). RLS is enabled with no public policies, so the anon/public key cannot
-- read or write these rows. The public card viewer (/c/[token]) reads by token
-- on the server using the service key.

create table if not exists public.digital_card_orders (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,        -- public link slug: /c/<token>
  item_id         text not null,               -- which card (eid, nikah, ...)
  accent          text,                        -- inside accent colour (hex)
  theme           text not null default 'crescent', -- motif: crescent|arch|rings|lantern|rose
  scheme          text not null default 'midnight', -- colour: midnight|plum|forest|light
  message         text,                        -- inside message
  sender          text,                        -- sign-off
  recipient_name  text,                        -- "to ___" shown on the card
  photo_url       text,                        -- optional cover photo
  customer_email  text not null,               -- buyer (receipt + their link)
  deliver_email   boolean not null default false, -- email the recipient too?
  recipient_email text,                        -- where to email the card
  status          text not null default 'awaiting_payment',
  email_sent      boolean not null default false, -- idempotency for the email
  scheduled_at    timestamptz,                 -- hold the email until this UTC instant
  opened_at       timestamptz,                 -- first real open (notifies the buyer once)
  voice_url       text,                        -- optional recorded voice note (mp3)
  has_voice       boolean not null default false, -- voice add-on purchased
  notes           jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists digital_card_orders_status_idx
  on public.digital_card_orders (status);
create index if not exists digital_card_orders_token_idx
  on public.digital_card_orders (token);

-- Safe to re-run: add design columns if an earlier version of this table exists.
alter table public.digital_card_orders
  add column if not exists theme  text not null default 'crescent';
alter table public.digital_card_orders
  add column if not exists scheme text not null default 'midnight';
-- Delivery columns (scheduling + open notification).
alter table public.digital_card_orders
  add column if not exists scheduled_at timestamptz;
alter table public.digital_card_orders
  add column if not exists opened_at    timestamptz;
alter table public.digital_card_orders
  add column if not exists voice_url    text;
alter table public.digital_card_orders
  add column if not exists has_voice    boolean not null default false;

alter table public.digital_card_orders enable row level security;
-- No policies: only the service key (which bypasses RLS) may read/write.
