/** Include the visible live representative without changing any listing's status. */
export const mergedArchiveMemberSql = `select 1 from listings archived_member
  where archived_member.hidden_duplicate_of_id = l.id
    and archived_member.status = 'removed'
    and coalesce(archived_member.exclusion_reason, '') <> 'manual_rejected'`;

export function archiveStatusSql(includeMergedActive = false) {
  const archived =
    "(l.status = 'removed' and coalesce(l.exclusion_reason, '') <> 'manual_rejected')";
  return includeMergedActive
    ? `(${archived} or (l.status = 'active' and exists (${mergedArchiveMemberSql})))`
    : archived;
}
