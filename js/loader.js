// 데이터 로더 — universities.json 매니페스트를 읽어 대학×구분별 JSON을 로딩하고,
// field(계열)를 field-map.json으로 병합. 전체 병합 파일 없이 파일 단위 로딩.

const DATA = 'data/';

async function getJSON(path) {
  const res = await fetch(DATA + path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`로딩 실패: ${path} (${res.status})`);
  return res.json();
}

// 학과명→계열 결정(record.field 우선, 없으면 field-map: 정확일치 → prefix일치 → 기타)
function resolveField(dept, given, fieldMap) {
  if (given) return given;
  if (!dept) return '기타';
  if (fieldMap.map && fieldMap.map[dept]) return fieldMap.map[dept];
  if (fieldMap.prefix) {
    for (const pre of Object.keys(fieldMap.prefix)) {
      if (dept.startsWith(pre)) return fieldMap.prefix[pre];
    }
  }
  return '기타';
}

// 로딩 결과: { universities:[{code,name,campus,...}], records:[{...record, _uni, _meta}] }
export async function loadAll() {
  const [manifest, fieldMap] = await Promise.all([
    getJSON('universities.json'),
    getJSON('field-map.json').catch(() => ({ map: {}, prefix: {} }))
  ]);

  const fileLists = manifest.universities.flatMap(u =>
    u.files.map(f => ({ uni: u, file: f }))
  );

  const loaded = await Promise.all(
    fileLists.map(async ({ uni, file }) => {
      try {
        const json = await getJSON(file);
        return { uni, json };
      } catch (e) {
        console.error(`[loader] ${file}`, e);
        return null;
      }
    })
  );

  const records = [];
  let omittedTotal = 0;
  for (const item of loaded) {
    if (!item) continue;
    const { uni, json } = item;
    const meta = json.meta;
    if (meta.omittedNoData) omittedTotal += (meta.omittedNoData.count || 0);
    for (const r of json.records) {
      records.push({
        ...r,
        field: resolveField(r.dept, r.field, fieldMap),
        _uni: uni,          // {code,name,campus,campusMerged}
        _meta: meta         // 파일 meta(전형구분/판정기준 등)
      });
    }
  }

  return {
    region: manifest.region,
    year: manifest.year,
    universities: manifest.universities,
    records,
    omittedTotal,
    pending: manifest.pending || []
  };
}
