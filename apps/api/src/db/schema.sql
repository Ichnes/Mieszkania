create extension if not exists pgcrypto;

create type source_kind as enum ('portal', 'public_registry', 'manual_import');
create type access_mode as enum ('api', 'crawler', 'import');
create type offer_type as enum ('sale', 'rent');
create type market_type as enum ('primary', 'secondary');
create type listing_status as enum ('active', 'reserved', 'sold', 'removed', 'unknown');
create type price_event_type as enum ('created', 'price_drop', 'price_increase', 'relisted', 'removed');
create type alert_event_type as enum ('new_listing', 'price_drop', 'status_change', 'undervalued');
create type media_download_status as enum ('pending', 'downloaded', 'failed', 'skipped');
create type crawl_artifact_type as enum ('html', 'json', 'image_manifest');

create table sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  kind source_kind not null,
  access_mode access_mode not null,
  created_at timestamptz not null default now()
);

create table property_candidates (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  confidence_score numeric(5,2) not null default 0,
  city text not null,
  district text,
  address_hash text,
  area_sqm_band numeric(10,2),
  rooms numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id),
  property_candidate_id uuid references property_candidates(id),
  external_id text not null,
  canonical_url text not null,
  title text not null,
  description text,
  offer_type offer_type not null default 'sale',
  market_type market_type not null default 'secondary',
  status listing_status not null default 'active',
  price_amount numeric(12,2),
  price_per_sqm numeric(12,2),
  area_sqm numeric(10,2),
  rooms numeric(4,1),
  floor integer,
  total_floors integer,
  year_built integer,
  latitude numeric(9,6),
  longitude numeric(9,6),
  address_text text,
  district text,
  city text not null,
  is_shortlisted boolean not null default false,
  hidden_duplicate_of_id uuid references listings(id) on delete set null,
  hidden_at timestamptz,
  published_at timestamptz,
  content_checksum text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index idx_listings_city_status on listings(city, status);
create index idx_listings_candidate on listings(property_candidate_id);
create index idx_listings_last_seen on listings(last_seen_at desc);
create index idx_listings_shortlisted on listings(is_shortlisted, city, last_seen_at desc);
create index idx_listings_hidden_duplicate on listings(hidden_duplicate_of_id) where hidden_duplicate_of_id is not null;

create table listing_parcel_context (
  listing_id uuid primary key references listings(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  parcel_id text not null,
  parcel_number text,
  commune text,
  region text,
  datasource text,
  geometry_geojson jsonb not null,
  fetched_at timestamptz not null default now()
);

create table listing_neighborhood_context (
  listing_id uuid primary key references listings(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  insights_json jsonb not null,
  fetched_at timestamptz not null default now()
);

create table listing_planning_context (
  listing_id uuid primary key references listings(id) on delete cascade,
  parcel_id text not null,
  planning_json jsonb not null,
  fetched_at timestamptz not null default now()
);

create table listing_relistings (
  current_listing_id uuid primary key references listings(id) on delete cascade,
  previous_listing_id uuid not null references listings(id) on delete cascade,
  confidence_score smallint not null,
  reason_summary text not null,
  previous_price_amount numeric(14,2),
  relisted_price_amount numeric(14,2),
  detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  check (current_listing_id <> previous_listing_id)
);

create index idx_listing_relistings_previous on listing_relistings(previous_listing_id, detected_at desc);

create table geocode_cache (
  cache_key text primary key,
  query_text text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_precision text not null,
  provider text not null default 'nominatim',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table district_boundaries (
  osm_relation_id bigint primary key,
  city text not null default 'Warszawa',
  name text not null,
  geometry_geojson jsonb not null,
  updated_at timestamptz not null default now()
);

create index idx_district_boundaries_city on district_boundaries(city);

create table listing_snapshots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  captured_at timestamptz not null default now(),
  title text not null,
  description text,
  status listing_status not null,
  price_amount numeric(12,2),
  price_per_sqm numeric(12,2),
  area_sqm numeric(10,2),
  rooms numeric(4,1),
  floor integer,
  payload_raw jsonb not null default '{}'::jsonb
);

create index idx_listing_snapshots_listing_captured on listing_snapshots(listing_id, captured_at desc);

create table listing_media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null unique,
  source_url text not null,
  mime_type text,
  file_size_bytes integer,
  width integer,
  height integer,
  content_hash text,
  download_status media_download_status not null default 'pending',
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_listing_media_assets_hash on listing_media_assets(content_hash);

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  snapshot_id uuid references listing_snapshots(id) on delete set null,
  asset_id uuid references listing_media_assets(id) on delete set null,
  source_url text not null,
  position integer not null default 0,
  caption text,
  is_primary boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_listing_images_listing_position on listing_images(listing_id, position);
create index idx_listing_images_asset on listing_images(asset_id);
create unique index uq_listing_images_listing_source_position on listing_images(listing_id, source_url, position);

create table crawl_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id),
  listing_id uuid references listings(id) on delete cascade,
  artifact_type crawl_artifact_type not null,
  storage_key text not null,
  checksum text,
  captured_at timestamptz not null default now(),
  payload_raw jsonb not null default '{}'::jsonb
);

create index idx_crawl_artifacts_source_captured on crawl_artifacts(source_id, captured_at desc);
create index idx_crawl_artifacts_listing_captured on crawl_artifacts(listing_id, captured_at desc) where listing_id is not null;

create table price_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  snapshot_id uuid references listing_snapshots(id) on delete set null,
  event_type price_event_type not null,
  previous_price_amount numeric(12,2),
  new_price_amount numeric(12,2),
  changed_at timestamptz not null default now()
);

create index idx_price_events_listing_changed on price_events(listing_id, changed_at desc);

create table transaction_rcn (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id),
  transaction_date date not null,
  city text not null,
  city_normalized text,
  district text,
  district_normalized text,
  street text,
  street_normalized text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  property_type text not null,
  market_type market_type not null,
  area_sqm numeric(10,2),
  price_amount numeric(12,2) not null,
  price_per_sqm numeric(12,2),
  building_year integer,
  floor integer,
  payload_raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_transaction_rcn_city_date on transaction_rcn(city, transaction_date desc);
create index idx_transaction_rcn_city_scope on transaction_rcn(city_normalized, district_normalized, street_normalized, transaction_date desc);

create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  city text not null,
  district text,
  min_area_sqm numeric(10,2),
  max_price_amount numeric(12,2),
  rooms_min numeric(4,1),
  price_drop_percent numeric(5,2),
  compare_to_rcn_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_rule_id uuid not null references alert_rules(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  event_type alert_event_type not null,
  message text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index idx_alert_events_rule_created on alert_events(alert_rule_id, created_at desc);
