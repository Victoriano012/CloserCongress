-- Closer Democracy schema.

create table if not exists parties (
  slug        text primary key,
  name        text not null,
  emoji       text not null,
  axis        text not null,
  tagline     text not null,
  scope       text not null,
  stance      text not null,
  color       text not null,
  is_blank    boolean not null default false,
  sort_order  integer not null
);

create table if not exists bills (
  id                  text primary key,      -- e.g. "119-hr-1234"
  congress            integer not null,
  bill_type           text not null,         -- hr, s, hjres, sjres, ...
  number              integer not null,
  title               text not null,
  chamber             text not null,         -- house | senate
  sponsor_name        text,
  sponsor_party       text,
  sponsor_state       text,
  introduced_date     date,
  latest_action_date  date,
  latest_action_text  text,
  official_summary    text,
  policy_area         text,
  congress_url        text,
  text_url            text,                  -- formatted text (html)
  pdf_url             text,
  -- what actually happened in the real Congress
  real_outcome        text not null default 'pending',  -- passed | failed | pending
  real_stage          text,
  real_vote_chamber   text,
  real_vote_date      date,
  real_yea            integer,
  real_nay            integer,
  real_present        integer,
  real_not_voting     integer,
  real_vote_url       text,
  real_party_breakdown jsonb,
  -- true once the sync has confirmed the bill was settled without a roll call
  -- (voice vote, unanimous consent), so a null breakdown is final, not pending
  positions_unavailable boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists bills_latest_action_idx on bills (latest_action_date desc nulls last);

-- AI-written plain-language layer
create table if not exists bill_ai (
  bill_id       text primary key references bills(id) on delete cascade,
  plain_summary text not null,
  key_points    jsonb not null default '[]'::jsonb,
  topics        jsonb not null default '[]'::jsonb,
  model         text not null,
  created_at    timestamptz not null default now()
);

-- How each party voted on each bill (the AI stands in for a human delegate)
create table if not exists party_votes (
  bill_id    text not null references bills(id) on delete cascade,
  party_slug text not null references parties(slug) on delete cascade,
  vote       text not null check (vote in ('yes', 'no', 'abstain')),
  reason     text,
  primary key (bill_id, party_slug)
);

create index if not exists party_votes_bill_idx on party_votes (bill_id);

-- Cached tally over the synthetic electorate
create table if not exists bill_results (
  bill_id         text primary key references bills(id) on delete cascade,
  yes_weight      integer not null,
  no_weight       integer not null,
  blank_weight    integer not null,
  total_weight    integer not null,
  passed          boolean not null,
  party_breakdown jsonb not null default '[]'::jsonb,
  electorate_hash text not null,
  votes_hash      text not null default '',
  computed_at     timestamptz not null default now()
);

-- `create table if not exists` above is a no-op on an existing database, so
-- columns added after the first deploy need an explicit alter.
alter table bill_results add column if not exists votes_hash text not null default '';
alter table bills add column if not exists positions_unavailable boolean not null default false;

-- Real human users. Deliberately contains no identity and no key material:
-- `user_key` is a salted hash of the Google subject and `ciphertext` is
-- decryptable only with the Google subject itself, which is never stored.
create table if not exists user_vaults (
  user_key   text primary key,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);
