import { withDb } from "../db";

export async function ensureRuntimeSchema() {
  await withDb(async (db) => {
    await db.query(`
      do $$
      begin
        if not exists (select 1 from pg_type where typname = 'media_download_status') then
          create type media_download_status as enum ('pending', 'downloaded', 'failed', 'skipped');
        end if;

        if not exists (select 1 from pg_type where typname = 'crawl_artifact_type') then
          create type crawl_artifact_type as enum ('html', 'json', 'image_manifest');
        end if;
      end $$;
    `);

    await db.query(`
      create table if not exists listing_media_assets (
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
    `);

    await db.query(`
      create index if not exists idx_listing_media_assets_hash
      on listing_media_assets(content_hash);
    `);

    await db.query(`
      create table if not exists listing_images (
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
    `);

    await db.query(`
      create index if not exists idx_listing_images_listing_position
      on listing_images(listing_id, position);
    `);

    await db.query(`
      create index if not exists idx_listing_images_asset
      on listing_images(asset_id);
    `);

    await db.query(`
      create unique index if not exists uq_listing_images_listing_source_position
      on listing_images(listing_id, source_url, position);
    `);

    await db.query(`
      create table if not exists crawl_artifacts (
        id uuid primary key default gen_random_uuid(),
        source_id uuid not null references sources(id),
        listing_id uuid references listings(id) on delete cascade,
        artifact_type crawl_artifact_type not null,
        storage_key text not null,
        checksum text,
        captured_at timestamptz not null default now(),
        payload_raw jsonb not null default '{}'::jsonb
      );
    `);

    await db.query(`
      create index if not exists idx_crawl_artifacts_source_captured
      on crawl_artifacts(source_id, captured_at desc);
    `);

    await db.query(`
      create index if not exists idx_crawl_artifacts_listing_captured
      on crawl_artifacts(listing_id, captured_at desc)
      where listing_id is not null;
    `);

    await db.query(`
      alter table listings
      add column if not exists is_shortlisted boolean not null default false;
    `);

    await db.query(`
      create index if not exists idx_listings_shortlisted
      on listings(is_shortlisted, city, last_seen_at desc);
    `);

    await db.query(`
      alter table listings
      add column if not exists neighborhood text;
    `);

    await db.query(`
      alter table listings
      add column if not exists source_contact_phone text;
    `);

    await db.query(`
      alter table listings
      add column if not exists published_at timestamptz;
    `);

    await db.query(`
      alter table listings
      add column if not exists content_checksum text;
    `);

    await db.query(`
      create table if not exists listing_parcel_context (
        listing_id uuid primary key references listings(id) on delete cascade,
        latitude numeric(9, 6) not null,
        longitude numeric(9, 6) not null,
        parcel_id text not null,
        parcel_number text,
        commune text,
        region text,
        datasource text,
        geometry_geojson jsonb not null,
        fetched_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create table if not exists listing_neighborhood_context (
        listing_id uuid primary key references listings(id) on delete cascade,
        latitude numeric(9, 6) not null,
        longitude numeric(9, 6) not null,
        insights_json jsonb not null,
        fetched_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create table if not exists listing_planning_context (
        listing_id uuid primary key references listings(id) on delete cascade,
        parcel_id text not null,
        planning_json jsonb not null,
        fetched_at timestamptz not null default now()
      );
    `);

    await db.query(`
      alter table listings
      add column if not exists exclusion_reason text;
    `);

    await db.query(`
      create table if not exists geocode_cache (
        cache_key text primary key,
        query_text text not null,
        latitude numeric(9,6),
        longitude numeric(9,6),
        location_precision text not null,
        provider text not null default 'nominatim',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create table if not exists streets (
        osm_type text not null,
        osm_id bigint not null,
        name text not null,
        normalized_name text not null,
        city text not null default 'Warszawa',
        center_lat numeric(9,6) not null,
        center_lng numeric(9,6) not null,
        geometry_geojson jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (osm_type, osm_id)
      );
    `);

    await db.query(`
      create index if not exists idx_streets_normalized_name
      on streets(city, normalized_name);
    `);

    await db.query(`
      alter table streets add column if not exists district text;
    `);

    await db.query(`
      create table if not exists district_boundaries (
        osm_relation_id bigint primary key,
        city text not null default 'Warszawa',
        name text not null,
        geometry_geojson jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create index if not exists idx_district_boundaries_city
      on district_boundaries(city);
    `);

    await db.query(`
      alter table listings
      add column if not exists hidden_duplicate_of_id uuid references listings(id) on delete set null;
    `);

    await db.query(`
      alter table listings
      add column if not exists hidden_at timestamptz;
    `);

    await db.query(`
      create index if not exists idx_listings_hidden_duplicate
      on listings(hidden_duplicate_of_id)
      where hidden_duplicate_of_id is not null;
    `);

    await db.query(`
      create index if not exists idx_listings_duplicate_lookup
      on listings(city, source_id, area_sqm)
      where status = 'active' and hidden_duplicate_of_id is null and area_sqm is not null;
    `);

    await db.query(`
      create table if not exists app_settings (
        key text primary key,
        value jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create table if not exists listing_scores (
        id uuid primary key default gen_random_uuid(),
        listing_id uuid not null references listings(id) on delete cascade,
        rater_key text not null,
        dimension_key text not null,
        score smallint not null,
        note text,
        updated_at timestamptz not null default now(),
        unique (listing_id, rater_key, dimension_key)
      );
    `);

    await db.query(`
      create index if not exists idx_listing_scores_listing
      on listing_scores(listing_id, rater_key);
    `);

    await db.query(`
      create table if not exists listing_viewings (
        id uuid primary key default gen_random_uuid(),
        listing_id uuid not null unique references listings(id) on delete cascade,
        scheduled_at timestamptz not null,
        status text not null default 'scheduled',
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create index if not exists idx_listing_viewings_scheduled
      on listing_viewings(status, scheduled_at);
    `);

    await db.query(`
      create table if not exists listing_manual_overrides (
        listing_id uuid primary key references listings(id) on delete cascade,
        contact_status text,
        decision_stage text,
        contact_name text,
        contact_phone text,
        contact_role text,
        negotiated_price_amount numeric(14, 2),
        asking_price_override numeric(14, 2),
        notes text,
        source_notes text,
        last_contact_at timestamptz,
        updated_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create table if not exists listing_contact_events (
        id uuid primary key default gen_random_uuid(),
        listing_id uuid not null references listings(id) on delete cascade,
        event_type text not null,
        occurred_at timestamptz not null,
        title text,
        notes text,
        contact_name text,
        amount numeric(14, 2),
        created_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create index if not exists idx_listing_contact_events_listing_occurred
      on listing_contact_events(listing_id, occurred_at desc, created_at desc);
    `);

    await db.query(`
      create table if not exists listing_duplicate_groups (
        id uuid primary key default gen_random_uuid(),
        manually_confirmed boolean not null default false,
        created_at timestamptz not null default now()
      );
    `);

    await db.query(`
      alter table listing_duplicate_groups
      add column if not exists manually_confirmed boolean not null default false;
    `);

    await db.query(`
      create table if not exists listing_duplicate_group_members (
        listing_id uuid primary key references listings(id) on delete cascade,
        group_id uuid not null references listing_duplicate_groups(id) on delete cascade,
        is_primary boolean not null default false,
        created_at timestamptz not null default now()
      );
    `);

    await db.query(`
      alter table listing_duplicate_group_members
      add column if not exists is_primary boolean not null default false;
    `);

    await db.query(`
      create index if not exists idx_listing_duplicate_group_members_group
      on listing_duplicate_group_members(group_id, created_at asc);
    `);

    await db.query(`
      create table if not exists listing_duplicate_reviews (
        pair_key text primary key,
        listing_id_left uuid not null references listings(id) on delete cascade,
        listing_id_right uuid not null references listings(id) on delete cascade,
        status text not null,
        notes text,
        reviewed_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      );
    `);

    await db.query(`
      create unique index if not exists uq_listing_duplicate_reviews_pair
      on listing_duplicate_reviews(least(listing_id_left, listing_id_right), greatest(listing_id_left, listing_id_right));
    `);

    await db.query(`
      create table if not exists listing_relistings (
        current_listing_id uuid primary key references listings(id) on delete cascade,
        previous_listing_id uuid not null references listings(id) on delete cascade,
        confidence_score smallint not null,
        reason_summary text not null,
        previous_price_amount numeric(14, 2),
        relisted_price_amount numeric(14, 2),
        detected_at timestamptz not null default now(),
        last_detected_at timestamptz not null default now(),
        check (current_listing_id <> previous_listing_id)
      );
    `);

    await db.query(`
      create index if not exists idx_listing_relistings_previous
      on listing_relistings(previous_listing_id, detected_at desc);
    `);

    await db.query(`
      alter table listing_manual_overrides
      add column if not exists contact_status text;
    `);

    await db.query(`
      alter table listing_manual_overrides
      add column if not exists decision_stage text;
    `);

    await db.query(`
      alter table listing_manual_overrides
      add column if not exists has_lift_override boolean,
      add column if not exists has_garage_override boolean,
      add column if not exists has_storage_override boolean,
      add column if not exists garage_cost_override numeric(14, 2),
      add column if not exists storage_cost_override numeric(14, 2);
    `);

    await db.query(`
      create table if not exists listing_import_queue (
        id uuid primary key default gen_random_uuid(),
        source_key text not null,
        external_id text not null,
        canonical_url text not null,
        city text not null,
        status text not null default 'pending',
        priority integer not null default 100,
        attempts integer not null default 0,
        next_attempt_at timestamptz not null default now(),
        last_error text,
        discovered_at timestamptz not null default now(),
        started_at timestamptz,
        completed_at timestamptz,
        payload_raw jsonb not null default '{}'::jsonb,
        unique (source_key, external_id)
      );
    `);

    await db.query(`
      create index if not exists idx_listing_import_queue_status
      on listing_import_queue(source_key, status, next_attempt_at, priority desc, discovered_at asc);
    `);

    await db.query(`
      alter table transaction_rcn
      add column if not exists street text;
    `);

    await db.query(`
      alter table transaction_rcn
      add column if not exists street_normalized text;
    `);

    await db.query(`
      alter table transaction_rcn
      add column if not exists district_normalized text;
    `);

    await db.query(`
      alter table transaction_rcn
      add column if not exists city_normalized text;
    `);

    await db.query(`
      create index if not exists idx_transaction_rcn_city_scope
      on transaction_rcn(city_normalized, district_normalized, street_normalized, transaction_date desc);
    `);
  });
}
