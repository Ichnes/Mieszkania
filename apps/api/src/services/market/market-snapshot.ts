// Only structured property fields are needed by statistics, not photos, page
// state, descriptions duplicated inside portal responses or gallery metadata.
export const marketSnapshotPayloadSql = `jsonb_build_object('portalFeatures',payload_raw->'portalFeatures',
  'jsonLd',payload_raw->'jsonLd',
  'nextData',jsonb_build_object('props',jsonb_build_object('pageProps',jsonb_build_object('ad',
    jsonb_build_object('attributes',payload_raw #> '{nextData,props,pageProps,ad,attributes}')))))`;
