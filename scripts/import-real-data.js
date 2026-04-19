/*
  import-real-data.js — one-off: 清空 ep01-ep12 + Summary，匯入真實場次資料。
  用法：在正式站登入後，打開 DevTools Console，整份貼上執行。
*/
(async () => {
  const token = sessionStorage.getItem('goog_access_token')
  if (!token) { alert('請先登入 Google 帳號再執行'); return }
  const SHEET_ID = '1J5LdXoTVzf2xWE6YsjZ7Y1Wk6xOWLwTLHBi2ohkTeus'
  const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`

  // 各集場次資料。每筆：[scene, length, pages, date, status, miss, notes]
  // 只有在 specials 裡出現的場次會帶額外欄位，其餘全部空白。
  const EPS = {
    ep01: {
      scenes: ['1','2','3','3ins','4','5','6','7','8','9','9A','10','11ins','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','28ins','28insA','28insB','29','30','31','32','33','33A','34','35','36','37','38','39','40','41'],
      specials: {
        '28ins': { length: '0:00:14', pages: '0.1', date: '2026/04/15', status: '已初剪' },
      },
    },
    ep02: {
      scenes: ['2','3','4','5','6','7','10','11','12','13','14','15','16','16ins','17','18','19','20','21','22','23','23ins','23insA','23insB','24','25','26','27','27A','28','29','30','31','33','34','35','36','36ins','37','38','39','40'],
      specials: {
        '16':  { length: '0:01:45', pages: '0.8', date: '2026/04/09', status: '已初剪' },
        '20':  { length: '0:01:16', pages: '0.5', date: '2026/04/09', status: '已初剪' },
        '36':  { length: '0:02:20', pages: '0.8', date: '2026/04/20', status: '已初剪' },
        '40':  { length: '0:00:17', pages: '0.2', date: '',           status: '已初剪' },
      },
    },
    ep03: {
      scenes: Array.from({length:45}, (_,i) => String(i+1)),
      specials: {
        '10': { length: '0:01:34', pages: '1.0', date: '2026/04/18', status: '已初剪' },
        '25': { length: '0:02:19', pages: '0.8', date: '2026/04/18', status: '已初剪' },
      },
    },
    ep04: {
      scenes: ['1','2','3','4','4ins','5','6','7','8','8ins','8insA','9','10','11','11ins','12','13','14','15','16','17','17ins','17insA','17insB','17insC','18','18ins','19','20','20ins','21','21A','22','23','24','25','26','27','27ins','28','29','30','31','32'],
      specials: {
        '1':  { notes: '尚待修改' },
        '2':  { status: '整場刪除' },
        '22': { length: '0:00:00', pages: '0.2', date: '2026/04/16', status: '已初剪' },
        '23': { length: '0:03:24', pages: '0.7', date: '2026/04/16', status: '已初剪' },
      },
    },
    ep05: {
      scenes: Array.from({length:41}, (_,i) => String(i+1)),
      specials: {
        '1':  { notes: '尚待修改' },
        '5':  { length: '0:01:32', pages: '0.5', date: '2026/04/17', status: '已初剪' },
        '9':  { length: '0:06:23', pages: '2.5', date: '2026/04/17', status: '已初剪' },
        '15': { length: '0:02:12', pages: '1.2', date: '',           status: '已初剪' },
        '18': { length: '0:00:51', pages: '0.5', date: '2026/04/17', status: '已初剪' },
        '24': { length: '0:00:58', pages: '0.4', date: '2026/04/17', status: '已初剪' },
        '28': { length: '0:01:32', pages: '0.4', date: '2026/04/17', status: '已初剪' },
        '31': { length: '0:00:53', pages: '0.4', date: '2026/04/17', status: '已初剪' },
        '39': { length: '0:02:30', pages: '1.2', date: '2026/04/17', status: '已初剪' },
      },
    },
    ep06: {
      scenes: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','16ins','17','18','19','20','21','22','23','24','25','26','27','28','29','30','30ins','31','32','33','33ins','34','35'],
      specials: {
        '3':  { length: '0:00:09', pages: '0.1', date: '2026/04/17', status: '已初剪' },
        '10': { length: '0:00:23', pages: '0.2', date: '2026/04/21', status: '已初剪' },
        '12': { length: '0:02:16', pages: '1.1', date: '2026/04/21', status: '已初剪' },
        '13': { length: '0:00:19', pages: '0.3', date: '2026/04/21', status: '已初剪' },
        '19': { length: '0:00:18', pages: '0.4', date: '2026/04/09', status: '已初剪' },
        '23': { length: '0:02:43', pages: '1.3', date: '2026/04/16', status: '已初剪' },
      },
    },
    ep07: {
      scenes: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','25A','26','27'],
      specials: {
        '2': { length: '0:03:34', pages: '1.9', date: '2026/04/16', status: '已初剪' },
      },
    },
    ep08: {
      scenes: ['1','2','3','3A','4','5','6','7','8','9','10','11','12','13','14','14ins','15','16','17','18','19','20','21','22','23','24','25','26','27','27ins','28','29','30','31','31ins','31insA','31insB','31insC','31insD','32','32ins','32insA','32insB','33','34','35','36','37','38','39'],
      specials: {
        '1': { notes: '尚待修改' },
        '2': { status: '整場刪除' },
      },
    },
    ep09: {
      scenes: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','23ins','24','25','26','27','28','29','29ins','30','31','32','33','34','35','36','37'],
      specials: {
        '1': { notes: '尚待修改' },
        '2': { status: '整場刪除' },
      },
    },
    ep10: {
      scenes: ['1','2','3','4','5','6','7','7ins','7insA','8','9','10','10ins','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38'],
      specials: {
        '1':  { status: '整場刪除' },
        '3':  { length: '0:00:56', pages: '1.1', date: '2026/04/17', status: '已初剪' },
        '4':  { length: '0:03:39', pages: '1.3', date: '2026/04/17', status: '已初剪' },
        '11': { length: '0:03:06', pages: '2.2', date: '2026/04/17', status: '已初剪' },
        '18': { length: '0:00:54', pages: '0.5', date: '2026/04/17', status: '已初剪' },
        '19': { length: '0:00:29', pages: '0.3', date: '2026/04/17', status: '已初剪' },
      },
    },
    ep11: {
      scenes: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','15A','16','17','18','19','20','21','22','23','24','24A','25','26','27','28','28ins','28insA','28insB','28insC','29','30','31','32','33'],
      specials: {
        '1': { status: '整場刪除' },
      },
    },
    ep12: {
      scenes: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','22ins','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45'],
      specials: {
        '1': { status: '整場刪除' },
      },
    },
  }

  function rowsFor(ep) {
    const { scenes, specials } = EPS[ep]
    return scenes.map(s => {
      const x = specials[s] || {}
      return [s, x.length || '', x.pages || '', x.date || '', x.status || '', x.miss || '', x.notes || '']
    })
  }

  function parseSecs(d) {
    if (!d) return 0
    const p = d.split(':').map(Number)
    if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2]
    if (p.length === 2) return p[0]*60 + p[1]
    return 0
  }
  function secsToHMS(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60
    return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function summaryRow(ep) {
    const rows = rowsFor(ep) // [scene, length, pages, date, status, miss, notes]
    const valid = rows.filter(r => r[4] !== '整場刪除')
    const rough = rows.filter(r => r[4] === '已初剪')
    const fine  = rows.filter(r => r[4] === '已精剪')
    const roughSecs = rough.reduce((a,r) => a + parseSecs(r[1]), 0)
    const fineSecs  = fine.reduce((a,r)  => a + parseSecs(r[1]), 0)
    const totalSecs = roughSecs + fineSecs
    const roughPages = rough.reduce((a,r) => a + (parseFloat(r[2]) || 0), 0)
    const finePages  = fine.reduce((a,r)  => a + (parseFloat(r[2]) || 0), 0)
    const cutPages = roughPages + finePages
    const avgSecs = cutPages > 0 ? Math.round(totalSecs / cutPages) : 0
    const roughPct = valid.length > 0 ? rough.length / valid.length * 100 : 0
    const finePct  = valid.length > 0 ? fine.length  / valid.length * 100 : 0
    return [
      ep,
      `${roughPct.toFixed(2)}%`,
      `${finePct.toFixed(2)}%`,
      roughSecs > 0 ? secsToHMS(roughSecs) : '',
      fineSecs  > 0 ? secsToHMS(fineSecs)  : '',
      totalSecs > 0 ? secsToHMS(totalSecs) : '',
      String(rough.length),
      String(fine.length),
      String(rows.length),
      roughPages.toFixed(1),
      finePages.toFixed(1),
      avgSecs > 0 ? secsToHMS(avgSecs) : '',
    ]
  }

  const EP_NAMES = Object.keys(EPS)

  // 1) 批次清空
  const clearRanges = [...EP_NAMES.map(ep => `${ep}!A2:G`), 'Summary!A2:L']
  console.log('Clearing…', clearRanges)
  let res = await fetch(`${BASE}/values:batchClear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranges: clearRanges }),
  })
  if (!res.ok) { console.error('clear failed', await res.text()); return }

  // 2) 寫入各集 + Summary
  const data = []
  for (const ep of EP_NAMES) {
    const values = rowsFor(ep)
    data.push({
      range: `${ep}!A2:G${values.length + 1}`,
      majorDimension: 'ROWS',
      values,
    })
  }
  const summaryValues = EP_NAMES.map(ep => summaryRow(ep))
  data.push({
    range: `Summary!A2:L13`,
    majorDimension: 'ROWS',
    values: summaryValues,
  })

  console.log('Writing…', data.length, 'ranges')
  res = await fetch(`${BASE}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  })
  if (!res.ok) { console.error('write failed', await res.text()); return }

  console.table(summaryValues.map(r => ({
    ep: r[0], rough: r[1], fine: r[2],
    roughDur: r[3], totalDur: r[5],
    roughScenes: r[6], totalScenes: r[8],
    roughPages: r[9], avg: r[11],
  })))
  console.log('✅ 匯入完成。請重新整理頁面。')
})()
