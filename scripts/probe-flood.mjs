const names = ['satellite-detected-flood-extent-in-punjab-province-pakistan-10-july-2025','satellite-detected-water-extents-from-26-august-to-7-september-2025-over-pakistan','pak-flood-fl-20250911-pak-00'];
for (const n of names) {
  const r = await fetch(`https://data.humdata.org/api/3/action/package_show?id=${n}`);
  const d = (await r.json()).result;
  console.log(`\n${d.title} | ${d.license_title} | ${d.dataset_date} | src: ${d.dataset_source}`);
  for (const x of d.resources) console.log(` - ${x.name} | ${x.format} | ${x.size ?? '?'} B | ${x.download_url}`);
}
