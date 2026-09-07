import { withDb } from "../db";

export async function ensureSeedData() {
  await withDb(async (db) => {
    const sourceCount = await db.query<{ count: string }>("select count(*)::text as count from sources");

    if (Number(sourceCount.rows[0]?.count ?? "0") > 0) {
      return;
    }

    await db.query("begin");

    try {
      const sourceResult = await db.query<{ id: string }>(`
        insert into sources (key, name, kind, access_mode)
        values
          ('otodom', 'Otodom', 'portal', 'crawler'),
          ('deweloperuch_rcn', 'RCN import', 'public_registry', 'import')
        returning id
      `);

      const otodomSourceId = sourceResult.rows[0]?.id;
      const rcnSourceId = sourceResult.rows[1]?.id;

      const candidateResult = await db.query<{ id: string }>(`
        insert into property_candidates (fingerprint, confidence_score, city, district, area_sqm_band, rooms)
        values
          ('warszawa-mokotow-62-3', 92.5, 'Warszawa', 'Mokotow', 62.4, 3),
          ('warszawa-praga-poludnie-45-2', 88.0, 'Warszawa', 'Praga Poludnie', 44.9, 2),
          ('warszawa-wola-71-4', 81.0, 'Warszawa', 'Wola', 71.1, 4)
        returning id
      `);

      const listingsResult = await db.query<{ id: string; title: string }>(`
        insert into listings (
          source_id,
          property_candidate_id,
          external_id,
          canonical_url,
          title,
          description,
          offer_type,
          market_type,
          status,
          price_amount,
          price_per_sqm,
          area_sqm,
          rooms,
          floor,
          total_floors,
          year_built,
          district,
          city,
          published_at
        )
        values
          (
            '${otodomSourceId}',
            '${candidateResult.rows[0]?.id}',
            'oto-1001',
            'https://example.com/oferta/oto-1001',
            'Mokotow, 3 pokoje, blisko metra',
            'Oferta testowa pochodzaca z lokalnego seeda.',
            'sale',
            'secondary',
            'active',
            1185000,
            18990,
            62.4,
            3,
            3,
            6,
            2014,
            'Mokotow',
            'Warszawa',
            now() - interval '12 days'
          ),
          (
            '${otodomSourceId}',
            '${candidateResult.rows[1]?.id}',
            'oto-1002',
            'https://example.com/oferta/oto-1002',
            'Praga Poludnie, 2 pokoje po remoncie',
            'Oferta testowa pochodzaca z lokalnego seeda.',
            'sale',
            'secondary',
            'active',
            789000,
            17572,
            44.9,
            2,
            2,
            4,
            2008,
            'Praga Poludnie',
            'Warszawa',
            now() - interval '5 days'
          ),
          (
            '${otodomSourceId}',
            '${candidateResult.rows[2]?.id}',
            'dev-1003',
            'https://example.com/oferta/dev-1003',
            'Wola, 4 pokoje, inwestycja deweloperska',
            'Oferta testowa pochodzaca z lokalnego seeda.',
            'sale',
            'primary',
            'active',
            1420000,
            19972,
            71.1,
            4,
            5,
            8,
            2026,
            'Wola',
            'Warszawa',
            now() - interval '2 days'
          )
        returning id, title
      `);

      await db.query(`
        insert into listing_snapshots (
          listing_id,
          title,
          description,
          status,
          price_amount,
          price_per_sqm,
          area_sqm,
          rooms,
          floor,
          payload_raw
        )
        values
          (
            '${listingsResult.rows[0]?.id}',
            'Mokotow, 3 pokoje, blisko metra',
            'Pierwszy snapshot seed.',
            'active',
            1237000,
            19824,
            62.4,
            3,
            3,
            '{}'::jsonb
          ),
          (
            '${listingsResult.rows[1]?.id}',
            'Praga Poludnie, 2 pokoje po remoncie',
            'Pierwszy snapshot seed.',
            'active',
            846000,
            18842,
            44.9,
            2,
            2,
            '{}'::jsonb
          ),
          (
            '${listingsResult.rows[2]?.id}',
            'Wola, 4 pokoje, inwestycja deweloperska',
            'Pierwszy snapshot seed.',
            'active',
            1420000,
            19972,
            71.1,
            4,
            5,
            '{}'::jsonb
          )
      `);

      await db.query(`
        insert into price_events (listing_id, event_type, previous_price_amount, new_price_amount, changed_at)
        values
          ('${listingsResult.rows[0]?.id}', 'price_drop', 1237000, 1185000, now() - interval '2 days'),
          ('${listingsResult.rows[1]?.id}', 'price_drop', 846000, 789000, now() - interval '1 day'),
          ('${listingsResult.rows[2]?.id}', 'created', null, 1420000, now() - interval '2 days')
      `);

      await db.query(`
        insert into transaction_rcn (
          source_id,
          transaction_date,
          city,
          city_normalized,
          district,
          district_normalized,
          street,
          street_normalized,
          property_type,
          market_type,
          area_sqm,
          price_amount,
          price_per_sqm,
          building_year,
          floor,
          payload_raw
        )
        values
          ('${rcnSourceId}', current_date - 30, 'Warszawa', 'warszawa', 'Mokotow', 'mokotow', 'Postepu', 'postepu', 'flat', 'secondary', 60.4, 1058000, 17516, 2013, 2, '{}'::jsonb),
          ('${rcnSourceId}', current_date - 21, 'Warszawa', 'warszawa', 'Praga Poludnie', 'praga poludnie', 'Panienska', 'panienska', 'flat', 'secondary', 46.1, 812300, 17620, 2007, 2, '{}'::jsonb),
          ('${rcnSourceId}', current_date - 14, 'Warszawa', 'warszawa', 'Wola', 'wola', 'Towarowa', 'towarowa', 'flat', 'primary', 70.0, 1351000, 19300, 2026, 4, '{}'::jsonb)
      `);

      await db.query(`
        insert into alert_rules (
          user_id,
          name,
          city,
          district,
          min_area_sqm,
          max_price_amount,
          rooms_min,
          price_drop_percent,
          compare_to_rcn_enabled
        )
        values
          ('local-user', 'Mokotow do 1.2 mln', 'Warszawa', 'Mokotow', 50, 1200000, 2, 3, true),
          ('local-user', 'Oferty ponizej mediany RCN', 'Warszawa', null, 35, 900000, 2, null, true)
      `);

      await db.query(`
        insert into listing_media_assets (
          storage_key,
          source_url,
          mime_type,
          content_hash,
          download_status,
          last_downloaded_at
        )
        values
          ('sources/otodom/oto-1001/images/0-seed', 'https://images.example.com/oto-1001-1.jpg', 'image/jpeg', 'seed-oto-1001-1', 'downloaded', now()),
          ('sources/otodom/oto-1001/images/1-seed', 'https://images.example.com/oto-1001-2.jpg', 'image/jpeg', 'seed-oto-1001-2', 'downloaded', now()),
          ('sources/otodom/oto-1002/images/0-seed', 'https://images.example.com/oto-1002-1.jpg', 'image/jpeg', 'seed-oto-1002-1', 'downloaded', now()),
          ('sources/otodom/dev-1003/images/0-seed', 'https://images.example.com/dev-1003-1.jpg', 'image/jpeg', 'seed-dev-1003-1', 'downloaded', now())
        on conflict do nothing
      `);

      const mediaAssets = await db.query<{ id: string; storage_key: string }>(`
        select id, storage_key
        from listing_media_assets
      `);

      const assetMap = new Map(mediaAssets.rows.map((row) => [row.storage_key, row.id]));

      await db.query(
        `
          insert into listing_images (
            listing_id,
            asset_id,
            source_url,
            position,
            caption,
            is_primary
          )
          values
            ($1, $2, $3, 0, 'Salon', true),
            ($1, $4, $5, 1, 'Kuchnia', false),
            ($6, $7, $8, 0, 'Po remoncie', true),
            ($9, $10, $11, 0, 'Wizualizacja inwestycji', true)
        `,
        [
          listingsResult.rows[0]?.id,
          assetMap.get("sources/otodom/oto-1001/images/0-seed"),
          "https://images.example.com/oto-1001-1.jpg",
          assetMap.get("sources/otodom/oto-1001/images/1-seed"),
          "https://images.example.com/oto-1001-2.jpg",
          listingsResult.rows[1]?.id,
          assetMap.get("sources/otodom/oto-1002/images/0-seed"),
          "https://images.example.com/oto-1002-1.jpg",
          listingsResult.rows[2]?.id,
          assetMap.get("sources/otodom/dev-1003/images/0-seed"),
          "https://images.example.com/dev-1003-1.jpg"
        ]
      );

      await db.query(
        `
          insert into crawl_artifacts (
            source_id,
            listing_id,
            artifact_type,
            storage_key,
            checksum,
            payload_raw
          )
          values
            ($1, $2, 'html', 'sources/otodom/oto-1001/raw/seed.html', 'seed-raw-1', '{"note":"seed html artifact"}'::jsonb),
            ($1, $3, 'image_manifest', 'sources/otodom/oto-1002/raw/images.json', 'seed-images-2', '{"note":"seed image manifest"}'::jsonb)
        `,
        [otodomSourceId, listingsResult.rows[0]?.id, listingsResult.rows[1]?.id]
      );

      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  });
}
